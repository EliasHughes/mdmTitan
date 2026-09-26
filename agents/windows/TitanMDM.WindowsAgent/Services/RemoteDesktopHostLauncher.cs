using System.Diagnostics;
using System.Text;
using System.Text.Json;
using TitanMDM.WindowsAgent.Contracts;
using TitanMDM.WindowsAgent.Interop;

namespace TitanMDM.WindowsAgent.Services;

public sealed class RemoteDesktopHostLauncher
{
    private readonly ILogger<RemoteDesktopHostLauncher>
        _logger;

    private readonly ActiveSessionProcessLauncher
        _activeSessionLauncher;

    private readonly object
        _syncRoot =
            new();

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
                return IsProcessRunningUnsafe();
            }
        }
    }

    public int? RunningWindowsSessionId
    {
        get
        {
            lock (_syncRoot)
            {
                CleanupExitedProcessUnsafe();
                return _windowsSessionId;
            }
        }
    }

    public int? ActiveConsoleSessionId =>
        _activeSessionLauncher.GetActiveConsoleSessionId();


    public Task StartAsync(
        RemoteDesktopStartRequest request,
        CancellationToken cancellationToken =
            default)
    {
        cancellationToken
            .ThrowIfCancellationRequested();

        lock (_syncRoot)
        {
            CleanupExitedProcessUnsafe();

            if (IsProcessRunningUnsafe())
            {
                if (
                    _remoteSessionId ==
                    request.SessionId)
                {
                    _logger.LogInformation(
                        "RemoteHost ya está activo para la sesión {SessionId}. PID={Pid}.",
                        request.SessionId,
                        _hostProcessId);

                    return Task.CompletedTask;
                }

                throw new InvalidOperationException(
                    $"Ya existe un TitanMDM RemoteHost activo. " +
                    $"SessionId={_remoteSessionId}, PID={_hostProcessId}.");
            }

            var executablePath =
                ResolveRemoteHostPath();

            var payload =
                JsonSerializer.Serialize(
                    request);

            var encodedPayload =
                Convert.ToBase64String(
                    Encoding.UTF8
                        .GetBytes(
                            payload));

            var arguments =
                $"--session \"{encodedPayload}\"";

            var workingDirectory =
                Path.GetDirectoryName(
                    executablePath)
                ??
                AppContext.BaseDirectory;

            _logger.LogInformation(
                "Iniciando TitanMDM RemoteHost. RemoteSession={SessionId}, Path={Path}.",
                request.SessionId,
                executablePath);

            var launchResult =
                _activeSessionLauncher
                    .Launch(
                        executablePath,
                        arguments,
                        workingDirectory);

            _hostProcessId =
                launchResult.ProcessId;

            _windowsSessionId =
                launchResult.WindowsSessionId;

            _remoteSessionId =
                request.SessionId;

            _logger.LogInformation(
                "TitanMDM RemoteHost iniciado correctamente. RemoteSession={RemoteSessionId}, PID={Pid}, WindowsSession={WindowsSessionId}, LaunchMode={LaunchMode}.",
                request.SessionId,
                launchResult.ProcessId,
                launchResult.WindowsSessionId,
                launchResult.LaunchMode);
        }

        return Task.CompletedTask;
    }

    public async Task StopAsync(
        Guid sessionId,
        CancellationToken cancellationToken =
            default)
    {
        int? processId;

        lock (_syncRoot)
        {
            if (
                _remoteSessionId !=
                sessionId)
            {
                return;
            }

            processId =
                _hostProcessId;
        }

        if (!processId.HasValue)
        {
            Reset();

            return;
        }

        try
        {
            Process? process;

            try
            {
                process =
                    Process.GetProcessById(
                        processId.Value);
            }
            catch (ArgumentException)
            {
                process =
                    null;
            }

            if (process is null)
            {
                Reset();

                return;
            }

            using (process)
            {
                if (process.HasExited)
                {
                    Reset();

                    return;
                }

                _logger.LogInformation(
                    "Deteniendo TitanMDM RemoteHost. SessionId={SessionId}, PID={Pid}.",
                    sessionId,
                    processId.Value);

                try
                {
                    process.CloseMainWindow();
                }
                catch
                {
                    // Puede no existir ventana principal.
                }

                using var timeout =
                    CancellationTokenSource
                        .CreateLinkedTokenSource(
                            cancellationToken);

                timeout.CancelAfter(
                    TimeSpan.FromSeconds(
                        5));

                try
                {
                    await process
                        .WaitForExitAsync(
                            timeout.Token);
                }
                catch (
                    OperationCanceledException)
                    when (
                        !cancellationToken
                            .IsCancellationRequested)
                {
                    if (!process.HasExited)
                    {
                        _logger.LogWarning(
                            "RemoteHost no finalizó normalmente. Se terminará PID={Pid}.",
                            processId.Value);

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
            Reset();
        }
    }

    private string ResolveRemoteHostPath()
    {
        var agentDirectory =
            AppContext.BaseDirectory;

        /*
         * PRODUCCIÓN:
         *
         * C:\Program Files\TitanMDM\
         * ├── Agent\
         * └── RemoteHost\
         */

        var productionSibling =
            Path.GetFullPath(
                Path.Combine(
                    agentDirectory,
                    "..",
                    "RemoteHost",
                    "TitanMDM.RemoteHost.exe"));

        /*
         * Compatibilidad con paquete plano.
         */

        var sameDirectory =
            Path.Combine(
                agentDirectory,
                "TitanMDM.RemoteHost.exe");

        /*
         * Compatibilidad con entorno de desarrollo.
         */

        var developmentDebug =
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

        var developmentRelease =
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

        var candidates =
            new[]
            {
                productionSibling,
                sameDirectory,
                developmentDebug,
                developmentRelease
            };

        var executablePath =
            candidates
                .FirstOrDefault(
                    File.Exists);

        if (
            executablePath is
            not null)
        {
            return executablePath;
        }

        throw new FileNotFoundException(
            "TitanMDM no encontró TitanMDM.RemoteHost.exe. " +
            "El componente RemoteHost debe instalarse junto al Windows Agent.",
            productionSibling);
    }

    private bool IsProcessRunningUnsafe()
    {
        if (!_hostProcessId.HasValue)
        {
            return false;
        }

        try
        {
            using var process =
                Process.GetProcessById(
                    _hostProcessId.Value);

            return !process.HasExited;
        }
        catch
        {
            return false;
        }
    }

    private void CleanupExitedProcessUnsafe()
    {
        if (!_hostProcessId.HasValue)
        {
            return;
        }

        if (IsProcessRunningUnsafe())
        {
            return;
        }

        _hostProcessId =
            null;

        _windowsSessionId =
            null;

        _remoteSessionId =
            null;
    }

    private void Reset()
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