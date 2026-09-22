using System.Diagnostics;
using System.Text;
using System.Text.Json;
using TitanMDM.WindowsAgent.Contracts;
using TitanMDM.WindowsAgent.Interop;

namespace TitanMDM.WindowsAgent.Services;

public sealed class RemoteDesktopHostLauncher
{
    private readonly ActiveSessionProcessLauncher _processLauncher;
    private readonly ILogger<RemoteDesktopHostLauncher> _logger;

    private readonly object _syncRoot = new();

    private Guid? _remoteSessionId;
    private int? _hostProcessId;
    private int? _windowsSessionId;
    private DateTime? _startedAtUtc;

    public RemoteDesktopHostLauncher(
        ActiveSessionProcessLauncher processLauncher,
        ILogger<RemoteDesktopHostLauncher> logger)
    {
        _processLauncher = processLauncher;
        _logger = logger;
    }

    public bool IsRunning
    {
        get
        {
            lock (_syncRoot)
            {
                return IsProcessRunning(_hostProcessId);
            }
        }
    }

    public RemoteDesktopHostStatus? CurrentStatus
    {
        get
        {
            lock (_syncRoot)
            {
                if (!_remoteSessionId.HasValue ||
                    !_hostProcessId.HasValue ||
                    !_windowsSessionId.HasValue ||
                    !_startedAtUtc.HasValue)
                {
                    return null;
                }

                return new RemoteDesktopHostStatus(
                    SessionId: _remoteSessionId.Value,
                    Status: IsProcessRunning(_hostProcessId)
                        ? "Running"
                        : "Stopped",
                    ProcessId: _hostProcessId.Value,
                    WindowsSessionId: _windowsSessionId.Value,
                    StartedAtUtc: _startedAtUtc.Value,
                    ErrorMessage: null);
            }
        }
    }

    public Task StartAsync(
        RemoteDesktopStartRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        lock (_syncRoot)
        {
            if (IsProcessRunning(_hostProcessId))
            {
                if (_remoteSessionId == request.SessionId)
                {
                    _logger.LogDebug(
                        "TitanMDM RemoteHost ya está ejecutándose para SessionId={SessionId}.",
                        request.SessionId);

                    return Task.CompletedTask;
                }

                throw new InvalidOperationException(
                    "Ya existe una sesión de TitanMDM RemoteHost activa.");
            }

            ResetState();

            var executablePath =
                ResolveRemoteHostExecutable();

            var payload =
                JsonSerializer.Serialize(request);

            var encodedPayload =
                Convert.ToBase64String(
                    Encoding.UTF8.GetBytes(payload));

            var arguments =
                $"--session \"{encodedPayload}\"";

            _logger.LogInformation(
                "Iniciando TitanMDM RemoteHost para SessionId={SessionId}.",
                request.SessionId);

            var launchResult =
                _processLauncher.Launch(
                    executablePath,
                    arguments,
                    Path.GetDirectoryName(executablePath));

            _remoteSessionId =
                request.SessionId;

            _hostProcessId =
                launchResult.ProcessId;

            _windowsSessionId =
                launchResult.WindowsSessionId;

            _startedAtUtc =
                DateTime.UtcNow;

            _logger.LogInformation(
                "TitanMDM RemoteHost iniciado. SessionId={SessionId}, PID={ProcessId}, WindowsSessionId={WindowsSessionId}.",
                request.SessionId,
                launchResult.ProcessId,
                launchResult.WindowsSessionId);
        }

        return Task.CompletedTask;
    }

    public async Task StopAsync(
        Guid sessionId,
        CancellationToken cancellationToken = default)
    {
        int? processId;

        lock (_syncRoot)
        {
            if (_remoteSessionId != sessionId)
            {
                return;
            }

            processId = _hostProcessId;
        }

        if (!processId.HasValue)
        {
            ResetState();
            return;
        }

        try
        {
            Process process;

            try
            {
                process =
                    Process.GetProcessById(
                        processId.Value);
            }
            catch (ArgumentException)
            {
                _logger.LogDebug(
                    "RemoteHost PID={ProcessId} ya no existe.",
                    processId.Value);

                return;
            }

            using (process)
            {
                if (process.HasExited)
                {
                    return;
                }

                _logger.LogInformation(
                    "Finalizando TitanMDM RemoteHost. SessionId={SessionId}, PID={ProcessId}.",
                    sessionId,
                    process.Id);

                try
                {
                    process.CloseMainWindow();
                }
                catch (InvalidOperationException)
                {
                    // El proceso pudo terminar entre las comprobaciones.
                }

                using var timeout =
                    CancellationTokenSource
                        .CreateLinkedTokenSource(
                            cancellationToken);

                timeout.CancelAfter(
                    TimeSpan.FromSeconds(5));

                try
                {
                    await process.WaitForExitAsync(
                        timeout.Token);
                }
                catch (OperationCanceledException)
                    when (!cancellationToken.IsCancellationRequested)
                {
                    if (!process.HasExited)
                    {
                        _logger.LogWarning(
                            "RemoteHost no terminó de forma controlada. Se finalizará el árbol del proceso PID={ProcessId}.",
                            process.Id);

                        process.Kill(
                            entireProcessTree: true);

                        await process.WaitForExitAsync(
                            cancellationToken);
                    }
                }
            }
        }
        finally
        {
            ResetState();
        }
    }

    public Task StopCurrentAsync(
        CancellationToken cancellationToken = default)
    {
        Guid? sessionId;

        lock (_syncRoot)
        {
            sessionId = _remoteSessionId;
        }

        if (!sessionId.HasValue)
        {
            return Task.CompletedTask;
        }

        return StopAsync(
            sessionId.Value,
            cancellationToken);
    }

    private static string ResolveRemoteHostExecutable()
    {
        var agentDirectory =
            AppContext.BaseDirectory;

        var deployedPath =
            Path.Combine(
                agentDirectory,
                "TitanMDM.RemoteHost.exe");

        if (File.Exists(deployedPath))
        {
            return deployedPath;
        }

        var developmentDebugPath =
            Path.GetFullPath(
                Path.Combine(
                    agentDirectory,
                    "..",
                    "..",
                    "..",
                    "..",
                    "TitanMDM.RemoteHost",
                    "bin",
                    "Debug",
                    "net10.0-windows",
                    "TitanMDM.RemoteHost.exe"));

        if (File.Exists(developmentDebugPath))
        {
            return developmentDebugPath;
        }

        var developmentReleasePath =
            Path.GetFullPath(
                Path.Combine(
                    agentDirectory,
                    "..",
                    "..",
                    "..",
                    "..",
                    "TitanMDM.RemoteHost",
                    "bin",
                    "Release",
                    "net10.0-windows",
                    "TitanMDM.RemoteHost.exe"));

        if (File.Exists(developmentReleasePath))
        {
            return developmentReleasePath;
        }

        throw new FileNotFoundException(
            "No se encontró TitanMDM.RemoteHost.exe. " +
            "El ejecutable debe estar junto al Windows Agent " +
            "o en la salida Debug/Release de TitanMDM.RemoteHost.",
            deployedPath);
    }

    private static bool IsProcessRunning(
        int? processId)
    {
        if (!processId.HasValue)
        {
            return false;
        }

        try
        {
            using var process =
                Process.GetProcessById(
                    processId.Value);

            return !process.HasExited;
        }
        catch (ArgumentException)
        {
            return false;
        }
        catch (InvalidOperationException)
        {
            return false;
        }
    }

    private void ResetState()
    {
        lock (_syncRoot)
        {
            _remoteSessionId = null;
            _hostProcessId = null;
            _windowsSessionId = null;
            _startedAtUtc = null;
        }
    }
}