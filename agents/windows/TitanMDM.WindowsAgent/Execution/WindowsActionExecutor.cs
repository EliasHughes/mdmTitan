using System.Diagnostics;
using System.Text.Json;

namespace TitanMDM.WindowsAgent.Execution;

public sealed class WindowsActionExecutor
{
    private readonly ILogger<
        WindowsActionExecutor> _logger;

    public WindowsActionExecutor(
        ILogger<WindowsActionExecutor> logger)
    {
        _logger = logger;
    }

    public Task<string>
        LockDeviceAsync(
            CancellationToken cancellationToken = default)
    {
        cancellationToken
            .ThrowIfCancellationRequested();

        var startInfo =
            new ProcessStartInfo
            {
                FileName =
                    "rundll32.exe",

                Arguments =
                    "user32.dll,LockWorkStation",

                UseShellExecute =
                    false,

                CreateNoWindow =
                    true
            };

        Process.Start(
            startInfo);

        return Task.FromResult(
            JsonSerializer.Serialize(
                new
                {
                    action =
                        "LOCK_DEVICE",

                    accepted =
                        true,

                    executedAtUtc =
                        DateTime.UtcNow
                }));
    }

    public Task<string>
        RestartDeviceAsync(
            CancellationToken cancellationToken = default)
    {
        return StartShutdownAsync(
            "/r /t 5 /f",
            "RESTART_DEVICE",
            cancellationToken);
    }

    public Task<string>
        ShutdownDeviceAsync(
            CancellationToken cancellationToken = default)
    {
        return StartShutdownAsync(
            "/s /t 5 /f",
            "SHUTDOWN_DEVICE",
            cancellationToken);
    }

    public async Task<string>
        TerminateProcessAsync(
            int processId,
            CancellationToken cancellationToken = default)
    {
        cancellationToken
            .ThrowIfCancellationRequested();

        if (processId <= 4)
        {
            throw new InvalidOperationException(
                "TitanMDM no permite finalizar procesos críticos del sistema.");
        }

        using var process =
            Process.GetProcessById(
                processId);

        var processName =
            process.ProcessName;

        process.Kill(
            entireProcessTree: true);

        await process.WaitForExitAsync(
            cancellationToken);

        _logger.LogWarning(
            "TitanMDM finalizó el proceso {ProcessName} ({ProcessId}).",
            processName,
            processId);

        return JsonSerializer.Serialize(
            new
            {
                action =
                    "PROCESS_TERMINATE",

                processId,

                processName,

                success =
                    true,

                executedAtUtc =
                    DateTime.UtcNow
            });
    }

    private static Task<string>
        StartShutdownAsync(
            string arguments,
            string action,
            CancellationToken cancellationToken)
    {
        cancellationToken
            .ThrowIfCancellationRequested();

        var process =
            Process.Start(
                new ProcessStartInfo
                {
                    FileName =
                        "shutdown.exe",

                    Arguments =
                        arguments,

                    UseShellExecute =
                        false,

                    CreateNoWindow =
                        true
                });

        if (process is null)
        {
            throw new InvalidOperationException(
                $"No fue posible ejecutar {action}.");
        }

        process.Dispose();

        return Task.FromResult(
            JsonSerializer.Serialize(
                new
                {
                    action,

                    accepted =
                        true,

                    executedAtUtc =
                        DateTime.UtcNow
                }));
    }
}