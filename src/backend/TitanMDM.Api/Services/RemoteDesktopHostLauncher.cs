using System.Diagnostics;
using System.Text;
using System.Text.Json;
using TitanMDM.WindowsAgent.Contracts;
using TitanMDM.WindowsAgent.Interop;

namespace TitanMDM.WindowsAgent.Services;

public sealed class RemoteDesktopHostLauncher
{
    private readonly ActiveSessionProcessLauncher
        _activeSessionLauncher;

    private readonly ILogger<RemoteDesktopHostLauncher>
        _logger;

    private readonly object
        _syncRoot = new();

    private int?
        _hostProcessId;

    private int?
        _windowsSessionId;

    private Guid?
        _remoteSessionId;

    public RemoteDesktopHostLauncher(
        ActiveSessionProcessLauncher activeSessionLauncher,
        ILogger<RemoteDesktopHostLauncher> logger)
    {
        _activeSessionLauncher =
            activeSessionLauncher;

        _logger =
            logger;
    }

    public bool IsRunning
    {
        get
        {
            lock (_syncRoot)
            {
                return IsProcessRunning(
                    _hostProcessId);
            }
        }
    }

    public RemoteDesktopHostStatus?
        CurrentStatus
    {
        get
        {
            lock (_syncRoot)
            {
                if (!_remoteSessionId.HasValue ||
                    !_hostProcessId.HasValue ||
                    !_windowsSessionId.HasValue)
                {
                    return null;
                }

                return new RemoteDesktopHostStatus(
                    SessionId:
                        _remoteSessionId.Value,

                    Status:
                        IsProcessRunning(
                            _hostProcessId)
                            ? "Running"
                            : "Stopped",

                    ProcessId:
                        _hostProcessId.Value,

                    WindowsSessionId:
                        _windowsSessionId.Value,

                    StartedAtUtc:
                        DateTime.UtcNow);
            }
        }
    }

    public Task StartAsync(
        RemoteDesktopStartRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken
            .ThrowIfCancellationRequested();

        lock (_syncRoot)
        {
            if (IsProcessRunning(
                    _hostProcessId))
            {
                if (_remoteSessionId ==
                    request.SessionId)
                {
                    return Task.CompletedTask;
                }

                throw new InvalidOperationException(
                    "Ya existe una sesión RemoteHost activa en este dispositivo.");
            }

            ResetState();

            var executablePath =
                ResolveRemoteHostExecutable();

            var payload =
                JsonSerializer.Serialize(
                    request);

            var encodedPayload =
                Convert.ToBase64String(
                    Encoding.UTF8.GetBytes(
                        payload));

            var arguments =
                $"--session \"{encodedPayload}\"";

            var launchResult =
                _activeSessionLauncher.Launch(
                    executablePath,
                    arguments,
                    Path.GetDirectoryName(
                        executablePath));

            _hostProcessId =
                launchResult.ProcessId;

            _windowsSessionId =
                launchResult.WindowsSessionId;

            _remoteSessionId =
                request.SessionId;

            _logger.LogInformation(
                "TitanMDM RemoteHost iniciado en sesión interactiva. RemoteSession={RemoteSessionId}, PID={ProcessId}, WindowsSession={WindowsSessionId}.",
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
            if (_remoteSessionId !=
                sessionId)
            {
                return;
            }

            processId =
                _hostProcessId;
        }

        if (!processId.HasValue)
        {
            ResetState();

            return;
        }

        try
        {
            Process? process = null;

            try
            {
                process =
                    Process.GetProcessById(
                        processId.Value);
            }
            catch (
                ArgumentException)
            {
                ResetState();

                return;
            }

            using (process)
            {
                if (process.HasExited)
                {
                    return;
                }

                _logger.LogInformation(
                    "Deteniendo TitanMDM RemoteHost. Session={SessionId}, PID={ProcessId}.",
                    sessionId,
                    process.Id);

                try
                {
                    process.CloseMainWindow();
                }
                catch
                {
                    // RemoteHost puede no aceptar WM_CLOSE.
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
                    when (!cancellationToken
                        .IsCancellationRequested)
                {
                    if (!process.HasExited)
                    {
                        process.Kill(
                            entireProcessTree:
                                true);

                        await process
                            .WaitForExitAsync(
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

    private static string
        ResolveRemoteHostExecutable()
    {
        var agentDirectory =
            AppContext.BaseDirectory;

        var candidates =
            new[]
            {
                Path.Combine(
                    agentDirectory,
                    "TitanMDM.RemoteHost.exe"),

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
                        "TitanMDM.RemoteHost.exe"))
            };

        foreach (var candidate in
                 candidates)
        {
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        throw new FileNotFoundException(
            "TitanMDM.RemoteHost.exe no está desplegado junto al Windows Agent ni fue encontrado en la ruta de desarrollo.",
            candidates[0]);
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
        catch
        {
            return false;
        }
    }

    private void ResetState()
    {
        lock (_syncRoot)
        {
            _hostProcessId =
                null;

            _windowsSessionId =
                null;

            _remoteSessionId =
                null;
        }
    }
}