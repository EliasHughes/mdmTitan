using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Microsoft.Win32;

namespace TitanMDM.WindowsAgent.Services;

public sealed class WindowsUpdateProvider
{
    private readonly ILogger<WindowsUpdateProvider> _logger;

    public WindowsUpdateProvider(
        ILogger<WindowsUpdateProvider> logger)
    {
        _logger = logger;
    }

    public async Task<WindowsUpdateSnapshot> CollectAsync(
        CancellationToken cancellationToken = default)
    {
        var serviceStatus =
            await QueryServiceAsync(
                cancellationToken);

        var history =
            await QueryUpdateHistoryAsync(
                cancellationToken);

        return new WindowsUpdateSnapshot(
            WindowsUpdateService:
                serviceStatus,

            PendingReboot:
                DetectPendingReboot(),

            UpdateHistoryJson:
                history.Output,

            HistoryAvailable:
                history.Success,

            HistoryError:
                history.Success
                    ? null
                    : history.Error,

            CollectedAtUtc:
                DateTime.UtcNow);
    }

    public async Task<string> TriggerScanAsync(
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var system32 =
            Environment.GetFolderPath(
                Environment.SpecialFolder.System);

        var usoClient =
            Path.Combine(
                system32,
                "UsoClient.exe");

        if (!File.Exists(usoClient))
        {
            throw new FileNotFoundException(
                "UsoClient.exe no está disponible en este equipo.",
                usoClient);
        }

        using var process =
            Process.Start(
                new ProcessStartInfo
                {
                    FileName =
                        usoClient,

                    Arguments =
                        "StartScan",

                    UseShellExecute =
                        false,

                    CreateNoWindow =
                        true
                });

        if (process is null)
        {
            throw new InvalidOperationException(
                "No fue posible iniciar la búsqueda de actualizaciones.");
        }

        await process.WaitForExitAsync(
            cancellationToken);

        _logger.LogInformation(
            "TitanMDM solicitó una búsqueda de Windows Update.");

        return JsonSerializer.Serialize(
            new
            {
                action =
                    "WINDOWS_UPDATE_SCAN",

                accepted =
                    true,

                exitCode =
                    process.ExitCode,

                executedAtUtc =
                    DateTime.UtcNow
            });
    }

    private static async Task<WindowsUpdateServiceSnapshot>
        QueryServiceAsync(
            CancellationToken cancellationToken)
    {
        var info =
            new ProcessStartInfo
            {
                FileName =
                    "sc.exe",

                Arguments =
                    "query wuauserv",

                RedirectStandardOutput =
                    true,

                RedirectStandardError =
                    true,

                UseShellExecute =
                    false,

                CreateNoWindow =
                    true
            };

        using var process =
            new Process
            {
                StartInfo = info
            };

        process.Start();

        var outputTask =
            process.StandardOutput
                .ReadToEndAsync(
                    cancellationToken);

        var errorTask =
            process.StandardError
                .ReadToEndAsync(
                    cancellationToken);

        await process.WaitForExitAsync(
            cancellationToken);

        var output =
            await outputTask;

        var error =
            await errorTask;

        var status =
            output.Contains(
                "RUNNING",
                StringComparison.OrdinalIgnoreCase)
                ? "Running"
                : output.Contains(
                    "STOPPED",
                    StringComparison.OrdinalIgnoreCase)
                    ? "Stopped"
                    : "Unknown";

        return new WindowsUpdateServiceSnapshot(
            status,
            process.ExitCode == 0,
            output.Trim(),
            error.Trim());
    }

    private static async Task<PowerShellQueryResult>
        QueryUpdateHistoryAsync(
            CancellationToken cancellationToken)
    {
        const string script =
            """
            $ErrorActionPreference = 'Stop'

            $session = New-Object -ComObject Microsoft.Update.Session
            $searcher = $session.CreateUpdateSearcher()

            $count = $searcher.GetTotalHistoryCount()
            $take = [Math]::Min($count, 30)

            if ($take -eq 0) {
                @() | ConvertTo-Json -Compress
                exit 0
            }

            $searcher.QueryHistory(0, $take) |
                Select-Object Title, Date, ResultCode, HResult |
                ConvertTo-Json -Compress
            """;

        var encoded =
            Convert.ToBase64String(
                Encoding.Unicode.GetBytes(
                    script));

        var info =
            new ProcessStartInfo
            {
                FileName =
                    "powershell.exe",

                Arguments =
                    "-NoLogo -NoProfile -NonInteractive " +
                    $"-EncodedCommand {encoded}",

                RedirectStandardOutput =
                    true,

                RedirectStandardError =
                    true,

                UseShellExecute =
                    false,

                CreateNoWindow =
                    true
            };

        using var process =
            new Process
            {
                StartInfo = info
            };

        try
        {
            process.Start();

            var outputTask =
                process.StandardOutput
                    .ReadToEndAsync(
                        cancellationToken);

            var errorTask =
                process.StandardError
                    .ReadToEndAsync(
                        cancellationToken);

            await process.WaitForExitAsync(
                cancellationToken);

            var output =
                (await outputTask).Trim();

            var error =
                (await errorTask).Trim();

            return new PowerShellQueryResult(
                process.ExitCode == 0,
                output,
                error);
        }
        catch (Exception ex)
        {
            return new PowerShellQueryResult(
                false,
                string.Empty,
                ex.Message);
        }
    }

    private static bool DetectPendingReboot()
    {
        try
        {
            using var cbs =
                Registry.LocalMachine.OpenSubKey(
                    @"SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending");

            if (cbs is not null)
            {
                return true;
            }

            using var wu =
                Registry.LocalMachine.OpenSubKey(
                    @"SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired");

            if (wu is not null)
            {
                return true;
            }

            using var session =
                Registry.LocalMachine.OpenSubKey(
                    @"SYSTEM\CurrentControlSet\Control\Session Manager");

            return session?
                .GetValue(
                    "PendingFileRenameOperations")
                is not null;
        }
        catch
        {
            return false;
        }
    }

    private sealed record PowerShellQueryResult(
        bool Success,
        string Output,
        string Error);
}

public sealed record WindowsUpdateSnapshot(
    WindowsUpdateServiceSnapshot WindowsUpdateService,
    bool PendingReboot,
    string UpdateHistoryJson,
    bool HistoryAvailable,
    string? HistoryError,
    DateTime CollectedAtUtc);

public sealed record WindowsUpdateServiceSnapshot(
    string Status,
    bool QuerySucceeded,
    string RawOutput,
    string Error);