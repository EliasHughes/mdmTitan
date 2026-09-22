using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;

namespace TitanMDM.WindowsAgent.Execution;

public sealed class WindowsSoftwareManager
{
    private readonly ILogger<WindowsSoftwareManager>
        _logger;

    public WindowsSoftwareManager(
        ILogger<WindowsSoftwareManager> logger)
    {
        _logger = logger;
    }

    public async Task<string> InstallAsync(
        WindowsSoftwareInstallRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var packagePath =
            Path.GetFullPath(
                request.PackagePath);

        if (!File.Exists(packagePath))
        {
            throw new FileNotFoundException(
                "El paquete de software no existe.",
                packagePath);
        }

        var hash =
            await CalculateSha256Async(
                packagePath,
                cancellationToken);

        if (string.IsNullOrWhiteSpace(
                request.ExpectedSha256)
            ||
            !string.Equals(
                hash,
                request.ExpectedSha256.Trim(),
                StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "El paquete no coincide con el SHA-256 autorizado.");
        }

        var extension =
            Path.GetExtension(
                    packagePath)
                .ToLowerInvariant();

        ProcessStartInfo info =
            extension switch
            {
                ".msi" =>
                    new ProcessStartInfo
                    {
                        FileName =
                            "msiexec.exe",

                        Arguments =
                            $"/i \"{packagePath}\" /qn /norestart",

                        RedirectStandardOutput =
                            true,

                        RedirectStandardError =
                            true,

                        UseShellExecute =
                            false,

                        CreateNoWindow =
                            true
                    },

                ".exe" =>
                    new ProcessStartInfo
                    {
                        FileName =
                            packagePath,

                        Arguments =
                            request.Arguments
                            ?? string.Empty,

                        RedirectStandardOutput =
                            true,

                        RedirectStandardError =
                            true,

                        UseShellExecute =
                            false,

                        CreateNoWindow =
                            true
                    },

                ".msix" or ".appx" =>
                    CreateAppxStartInfo(
                        packagePath),

                _ =>
                    throw new InvalidOperationException(
                        $"Formato de paquete no permitido: {extension}")
            };

        var timeout =
            Math.Clamp(
                request.TimeoutSeconds,
                30,
                7200);

        using var timeoutCts =
            CancellationTokenSource
                .CreateLinkedTokenSource(
                    cancellationToken);

        timeoutCts.CancelAfter(
            TimeSpan.FromSeconds(
                timeout));

        using var process =
            new Process
            {
                StartInfo =
                    info
            };

        var startedAt =
            DateTime.UtcNow;

        try
        {
            process.Start();

            var stdoutTask =
                process.StandardOutput
                    .ReadToEndAsync(
                        timeoutCts.Token);

            var stderrTask =
                process.StandardError
                    .ReadToEndAsync(
                        timeoutCts.Token);

            await process.WaitForExitAsync(
                timeoutCts.Token);

            var stdout =
                await stdoutTask;

            var stderr =
                await stderrTask;

            var successfulExitCodes =
                extension == ".msi"
                    ? new[] { 0, 1641, 3010 }
                    : new[] { 0 };

            var success =
                successfulExitCodes.Contains(
                    process.ExitCode);

            _logger.LogInformation(
                "Instalación de {Package}. ExitCode={ExitCode}.",
                Path.GetFileName(packagePath),
                process.ExitCode);

            return JsonSerializer.Serialize(
                new
                {
                    action =
                        "SOFTWARE_INSTALL",

                    success,

                    package =
                        Path.GetFileName(
                            packagePath),

                    sha256 =
                        hash,

                    exitCode =
                        process.ExitCode,

                    rebootRequired =
                        process.ExitCode
                        is 1641 or 3010,

                    standardOutput =
                        Truncate(
                            stdout,
                            32_000),

                    standardError =
                        Truncate(
                            stderr,
                            32_000),

                    startedAtUtc =
                        startedAt,

                    completedAtUtc =
                        DateTime.UtcNow
                });
        }
        catch (OperationCanceledException)
            when (!cancellationToken.IsCancellationRequested)
        {
            TryKill(process);

            throw new TimeoutException(
                "La instalación excedió el tiempo máximo permitido.");
        }
    }

    private static ProcessStartInfo
        CreateAppxStartInfo(
            string packagePath)
    {
        var escaped =
            packagePath
                .Replace(
                    "'",
                    "''",
                    StringComparison.Ordinal);

        var script =
            $"Add-AppxPackage -Path '{escaped}'";

        var encoded =
            Convert.ToBase64String(
                System.Text.Encoding.Unicode
                    .GetBytes(script));

        return new ProcessStartInfo
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
    }

    private static async Task<string>
        CalculateSha256Async(
            string path,
            CancellationToken cancellationToken)
    {
        await using var stream =
            File.OpenRead(path);

        var hash =
            await SHA256.HashDataAsync(
                stream,
                cancellationToken);

        return Convert
            .ToHexString(hash);
    }

    private static string Truncate(
        string value,
        int maximumLength)
    {
        return value.Length <= maximumLength
            ? value.Trim()
            : value[..maximumLength].Trim();
    }

    private static void TryKill(
        Process process)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(
                    entireProcessTree: true);
            }
        }
        catch
        {
        }
    }
}

public sealed record WindowsSoftwareInstallRequest(
    string PackagePath,
    string ExpectedSha256,
    string? Arguments,
    int TimeoutSeconds);