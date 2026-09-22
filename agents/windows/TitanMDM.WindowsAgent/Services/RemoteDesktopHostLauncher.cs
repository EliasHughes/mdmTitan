using System.Diagnostics;
using System.Text.Json;
using TitanMDM.WindowsAgent.Contracts;

namespace TitanMDM.WindowsAgent.Services;

public sealed class RemoteDesktopHostLauncher
{
    private readonly ILogger<RemoteDesktopHostLauncher> _logger;

    private readonly object _syncRoot = new();

    private Process? _hostProcess;

    private Guid? _sessionId;

    public RemoteDesktopHostLauncher(
        ILogger<RemoteDesktopHostLauncher> logger)
    {
        _logger = logger;
    }

    public bool IsRunning
    {
        get
        {
            lock (_syncRoot)
            {
                return _hostProcess is
                {
                    HasExited: false
                };
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
            if (_hostProcess is
                {
                    HasExited: false
                })
            {
                if (_sessionId == request.SessionId)
                {
                    return Task.CompletedTask;
                }

                throw new InvalidOperationException(
                    "Ya existe un Remote Desktop Host activo.");
            }

            var agentDirectory =
                AppContext.BaseDirectory;

            var executablePath =
                Path.Combine(
                    agentDirectory,
                    "TitanMDM.RemoteHost.exe");

            if (!File.Exists(executablePath))
            {
                throw new FileNotFoundException(
                    "TitanMDM.RemoteHost.exe todavía no está desplegado junto al agente.",
                    executablePath);
            }

            var payload =
                JsonSerializer.Serialize(request);

            var encodedPayload =
                Convert.ToBase64String(
                    System.Text.Encoding.UTF8
                        .GetBytes(payload));

            var startInfo =
                new ProcessStartInfo
                {
                    FileName = executablePath,

                    Arguments =
                        $"--session \"{encodedPayload}\"",

                    UseShellExecute = false,

                    CreateNoWindow = false,

                    WorkingDirectory =
                        agentDirectory
                };

            var process =
                Process.Start(startInfo)
                ?? throw new InvalidOperationException(
                    "Windows no pudo iniciar TitanMDM Remote Host.");

            _hostProcess = process;

            _sessionId = request.SessionId;

            _logger.LogInformation(
                "TitanMDM Remote Host iniciado. SessionId={SessionId}, PID={Pid}.",
                request.SessionId,
                process.Id);
        }

        return Task.CompletedTask;
    }

    public async Task StopAsync(
        Guid sessionId,
        CancellationToken cancellationToken = default)
    {
        Process? process;

        lock (_syncRoot)
        {
            if (_sessionId != sessionId)
            {
                return;
            }

            process = _hostProcess;
        }

        if (process is null)
        {
            Reset();
            return;
        }

        try
        {
            if (!process.HasExited)
            {
                process.CloseMainWindow();

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
                            entireProcessTree: true);
                    }
                }
            }
        }
        finally
        {
            Reset();
        }
    }

    private void Reset()
    {
        lock (_syncRoot)
        {
            try
            {
                _hostProcess?.Dispose();
            }
            catch
            {
            }

            _hostProcess = null;
            _sessionId = null;
        }
    }
}