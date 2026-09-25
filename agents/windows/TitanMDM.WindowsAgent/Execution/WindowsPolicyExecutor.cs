using System.Diagnostics;
using System.Runtime.Versioning;
using System.Text;
using System.Text.Json;

using Microsoft.Win32;

namespace TitanMDM.WindowsAgent.Execution;

[SupportedOSPlatform("windows")]
public sealed class WindowsPolicyExecutor
{
    private readonly ILogger<WindowsPolicyExecutor>
        _logger;

    private static readonly JsonSerializerOptions
        JsonOptions =
            new()
            {
                PropertyNameCaseInsensitive = true
            };

    public WindowsPolicyExecutor(
        ILogger<WindowsPolicyExecutor> logger)
    {
        _logger = logger;
    }

    public async Task<string> ApplyAsync(
        string payloadJson,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            throw new InvalidOperationException(
                "La política no contiene configuración.");
        }

        var payload =
            JsonSerializer.Deserialize<PolicyEnvelope>(
                payloadJson,
                JsonOptions)
            ??
            throw new InvalidOperationException(
                "La política contiene un payload inválido.");

        if (!payload.Platform.Equals(
                "Windows",
                StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"La política recibida pertenece a {payload.Platform}.");
        }

        if (payload.Configuration.ValueKind
            is JsonValueKind.Null
            or JsonValueKind.Undefined)
        {
            throw new InvalidOperationException(
                "Configuration no existe.");
        }

        var root =
            payload.Configuration;

        /*
         * El editor actual guarda:
         *
         * {
         *   windows: { ... },
         *   android: { ... }
         * }
         *
         * Pero admitimos también una configuración
         * Windows directamente para compatibilidad.
         */
        var windows =
            TryGetProperty(
                root,
                "windows",
                out var windowsElement)
                ? windowsElement
                : root;

        var results =
            new List<PolicyActionResult>();

        await ApplyPasswordAsync(
            windows,
            results,
            cancellationToken);

        await ApplyDefenderAsync(
            windows,
            results,
            cancellationToken);

        await ApplyFirewallAsync(
            windows,
            results,
            cancellationToken);

        ApplyUsb(
            windows,
            results);

        ApplyScreenLock(
            windows,
            results);

        ApplyWindowsUpdate(
            windows,
            results);

        var failed =
            results.Count(
                x => !x.Success);

        var response =
            new
            {
                policyId =
                    payload.PolicyId,

                policyVersion =
                    payload.PolicyVersion,

                appliedAtUtc =
                    DateTime.UtcNow,

                success =
                    failed == 0,

                totalActions =
                    results.Count,

                successfulActions =
                    results.Count - failed,

                failedActions =
                    failed,

                actions =
                    results
            };

        return JsonSerializer.Serialize(
            response);
    }

    private async Task ApplyPasswordAsync(
        JsonElement windows,
        List<PolicyActionResult> results,
        CancellationToken cancellationToken)
    {
        if (!TryGetProperty(
                windows,
                "password",
                out var section))
        {
            return;
        }

        if (!GetBool(
                section,
                "enabled"))
        {
            results.Add(
                PolicyActionResult.Skipped(
                    "Password",
                    "Configuración deshabilitada."));

            return;
        }

        var minimumLength =
            Math.Clamp(
                GetInt(
                    section,
                    "minimumLength",
                    8),
                0,
                128);

        var maximumAge =
            Math.Clamp(
                GetInt(
                    section,
                    "maximumAgeDays",
                    90),
                1,
                999);

        var command =
            $"net accounts /minpwlen:{minimumLength} /maxpwage:{maximumAge}";

        var execution =
            await RunCmdAsync(
                command,
                cancellationToken);

        results.Add(
            new PolicyActionResult(
                "Password",
                execution.Success,
                execution.Success
                    ? $"Longitud mínima {minimumLength}; edad máxima {maximumAge} días."
                    : execution.Error));
    }

    private async Task ApplyDefenderAsync(
        JsonElement windows,
        List<PolicyActionResult> results,
        CancellationToken cancellationToken)
    {
        if (!TryGetProperty(
                windows,
                "defender",
                out var section))
        {
            return;
        }

        if (!GetBool(
                section,
                "enabled"))
        {
            results.Add(
                PolicyActionResult.Skipped(
                    "Defender",
                    "Configuración deshabilitada."));

            return;
        }

        var realtime =
            GetBool(
                section,
                "realTimeProtection");

        var cloud =
            GetBool(
                section,
                "cloudProtection");

        var script =
            $$"""
            $ErrorActionPreference = 'Stop'

            Set-MpPreference `
              -DisableRealtimeMonitoring ${{(!realtime).ToString().ToLowerInvariant()}}

            if ({{cloud.ToString().ToLowerInvariant()}}) {
                Set-MpPreference -MAPSReporting Advanced
                Set-MpPreference -SubmitSamplesConsent SendSafeSamples
            }
            else {
                Set-MpPreference -MAPSReporting Disabled
            }
            """;

        var execution =
            await RunPowerShellAsync(
                script,
                cancellationToken);

        results.Add(
            new PolicyActionResult(
                "Microsoft Defender",
                execution.Success,
                execution.Success
                    ? "Configuración aplicada."
                    : execution.Error));
    }

    private async Task ApplyFirewallAsync(
        JsonElement windows,
        List<PolicyActionResult> results,
        CancellationToken cancellationToken)
    {
        if (!TryGetProperty(
                windows,
                "firewall",
                out var section))
        {
            return;
        }

        if (!GetBool(
                section,
                "enabled"))
        {
            results.Add(
                PolicyActionResult.Skipped(
                    "Firewall",
                    "Configuración deshabilitada."));

            return;
        }

        var domain =
            GetBool(
                section,
                "domainProfile");

        var privateProfile =
            GetBool(
                section,
                "privateProfile");

        var publicProfile =
            GetBool(
                section,
                "publicProfile");

        var script =
            $$"""
            $ErrorActionPreference = 'Stop'

            Set-NetFirewallProfile `
              -Profile Domain `
              -Enabled ${{domain.ToString().ToLowerInvariant()}}

            Set-NetFirewallProfile `
              -Profile Private `
              -Enabled ${{privateProfile.ToString().ToLowerInvariant()}}

            Set-NetFirewallProfile `
              -Profile Public `
              -Enabled ${{publicProfile.ToString().ToLowerInvariant()}}
            """;

        var execution =
            await RunPowerShellAsync(
                script,
                cancellationToken);

        results.Add(
            new PolicyActionResult(
                "Windows Firewall",
                execution.Success,
                execution.Success
                    ? "Perfiles actualizados."
                    : execution.Error));
    }

    private static void ApplyUsb(
        JsonElement windows,
        List<PolicyActionResult> results)
    {
        if (!TryGetProperty(
                windows,
                "usb",
                out var section))
        {
            return;
        }

        var block =
            GetBool(
                section,
                "blockRemovableStorage");

        try
        {
            using var key =
                Registry.LocalMachine.CreateSubKey(
                    @"SYSTEM\CurrentControlSet\Services\USBSTOR",
                    writable: true);

            key.SetValue(
                "Start",
                block ? 4 : 3,
                RegistryValueKind.DWord);

            results.Add(
                new PolicyActionResult(
                    "USB Storage",
                    true,
                    block
                        ? "Almacenamiento USB bloqueado."
                        : "Almacenamiento USB permitido."));
        }
        catch (Exception ex)
        {
            results.Add(
                new PolicyActionResult(
                    "USB Storage",
                    false,
                    ex.Message));
        }
    }

    private static void ApplyScreenLock(
        JsonElement windows,
        List<PolicyActionResult> results)
    {
        if (!TryGetProperty(
                windows,
                "screenLock",
                out var section))
        {
            return;
        }

        var enabled =
            GetBool(
                section,
                "enabled");

        var timeoutMinutes =
            Math.Clamp(
                GetInt(
                    section,
                    "timeoutMinutes",
                    15),
                1,
                1440);

        try
        {
            using var key =
                Registry.LocalMachine.CreateSubKey(
                    @"SOFTWARE\Policies\Microsoft\Windows\Control Panel\Desktop",
                    writable: true);

            key.SetValue(
                "ScreenSaveActive",
                enabled ? "1" : "0",
                RegistryValueKind.String);

            if (enabled)
            {
                key.SetValue(
                    "ScreenSaverIsSecure",
                    "1",
                    RegistryValueKind.String);

                key.SetValue(
                    "ScreenSaveTimeOut",
                    (timeoutMinutes * 60)
                        .ToString(),
                    RegistryValueKind.String);
            }

            results.Add(
                new PolicyActionResult(
                    "Screen Lock",
                    true,
                    enabled
                        ? $"Bloqueo configurado a {timeoutMinutes} minutos."
                        : "Bloqueo administrado deshabilitado."));
        }
        catch (Exception ex)
        {
            results.Add(
                new PolicyActionResult(
                    "Screen Lock",
                    false,
                    ex.Message));
        }
    }

    private static void ApplyWindowsUpdate(
        JsonElement windows,
        List<PolicyActionResult> results)
    {
        if (!TryGetProperty(
                windows,
                "windowsUpdate",
                out var section))
        {
            return;
        }

        var enabled =
            GetBool(
                section,
                "enabled");

        var automatic =
            GetBool(
                section,
                "automaticUpdates");

        try
        {
            using var key =
                Registry.LocalMachine.CreateSubKey(
                    @"SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU",
                    writable: true);

            if (!enabled)
            {
                key.SetValue(
                    "NoAutoUpdate",
                    1,
                    RegistryValueKind.DWord);
            }
            else
            {
                key.SetValue(
                    "NoAutoUpdate",
                    0,
                    RegistryValueKind.DWord);

                key.SetValue(
                    "AUOptions",
                    automatic ? 4 : 3,
                    RegistryValueKind.DWord);
            }

            results.Add(
                new PolicyActionResult(
                    "Windows Update",
                    true,
                    enabled
                        ? automatic
                            ? "Actualizaciones automáticas habilitadas."
                            : "Actualizaciones habilitadas con control manual."
                        : "Actualizaciones automáticas deshabilitadas."));
        }
        catch (Exception ex)
        {
            results.Add(
                new PolicyActionResult(
                    "Windows Update",
                    false,
                    ex.Message));
        }
    }

    private async Task<ExecutionResult>
        RunPowerShellAsync(
            string script,
            CancellationToken cancellationToken)
    {
        var encoded =
            Convert.ToBase64String(
                Encoding.Unicode
                    .GetBytes(
                        script));

        return await RunProcessAsync(
            "powershell.exe",
            $"-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand {encoded}",
            cancellationToken);
    }

    private async Task<ExecutionResult>
        RunCmdAsync(
            string command,
            CancellationToken cancellationToken)
    {
        return await RunProcessAsync(
            "cmd.exe",
            $"/d /s /c \"{command}\"",
            cancellationToken);
    }

    private async Task<ExecutionResult>
        RunProcessAsync(
            string fileName,
            string arguments,
            CancellationToken cancellationToken)
    {
        var startInfo =
            new ProcessStartInfo
            {
                FileName =
                    fileName,

                Arguments =
                    arguments,

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
                StartInfo =
                    startInfo
            };

        try
        {
            process.Start();

            var stdoutTask =
                process.StandardOutput
                    .ReadToEndAsync(
                        cancellationToken);

            var stderrTask =
                process.StandardError
                    .ReadToEndAsync(
                        cancellationToken);

            await process.WaitForExitAsync(
                cancellationToken);

            var stdout =
                await stdoutTask;

            var stderr =
                await stderrTask;

            return new ExecutionResult(
                process.ExitCode == 0,
                process.ExitCode,
                stdout.Trim(),
                stderr.Trim());
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Error aplicando configuración de política.");

            return new ExecutionResult(
                false,
                -1,
                string.Empty,
                ex.Message);
        }
    }

    private static bool TryGetProperty(
        JsonElement element,
        string name,
        out JsonElement value)
    {
        if (element.ValueKind !=
            JsonValueKind.Object)
        {
            value = default;
            return false;
        }

        foreach (
            var property
            in element.EnumerateObject())
        {
            if (property.Name.Equals(
                    name,
                    StringComparison.OrdinalIgnoreCase))
            {
                value =
                    property.Value;

                return true;
            }
        }

        value = default;

        return false;
    }

    private static bool GetBool(
        JsonElement section,
        string name)
    {
        if (!TryGetProperty(
                section,
                name,
                out var value))
        {
            return false;
        }

        return value.ValueKind switch
        {
            JsonValueKind.True =>
                true,

            JsonValueKind.False =>
                false,

            _ =>
                false
        };
    }

    private static int GetInt(
        JsonElement section,
        string name,
        int fallback)
    {
        if (!TryGetProperty(
                section,
                name,
                out var value))
        {
            return fallback;
        }

        return value.TryGetInt32(
            out var result)
                ? result
                : fallback;
    }

    private sealed class PolicyEnvelope
    {
        public Guid PolicyId
        {
            get;
            set;
        }

        public int PolicyVersion
        {
            get;
            set;
        }

        public string Platform
        {
            get;
            set;
        } = string.Empty;

        public JsonElement Configuration
        {
            get;
            set;
        }
    }

    private sealed record ExecutionResult(
        bool Success,
        int ExitCode,
        string Output,
        string Error);

    private sealed record PolicyActionResult(
        string Action,
        bool Success,
        string Message)
    {
        public static PolicyActionResult Skipped(
            string action,
            string message)
        {
            return new PolicyActionResult(
                action,
                true,
                message);
        }
    }
}