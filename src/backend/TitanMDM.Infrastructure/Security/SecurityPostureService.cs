using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TitanMDM.Application.Automation;
using TitanMDM.Application.Security;
using TitanMDM.Domain.Entities;
using TitanMDM.Domain.Enums;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Infrastructure.Security;

public sealed class SecurityPostureService
    : ISecurityPostureService
{
    private readonly TitanMdmDbContext
        _dbContext;

    private readonly IAutomationEventDispatcher
        _automation;

    private static readonly
        JsonSerializerOptions JsonOptions =
            new()
            {
                PropertyNameCaseInsensitive =
                    true
            };

    public SecurityPostureService(
        TitanMdmDbContext dbContext,
        IAutomationEventDispatcher automation)
    {
        _dbContext = dbContext;
        _automation = automation;
    }

    public async Task ProcessSecurityStatusAsync(
        Guid deviceId,
        string resultJson,
        CancellationToken cancellationToken = default)
    {
        var device =
            await GetDeviceAsync(
                deviceId,
                cancellationToken);

        var payload =
            JsonSerializer.Deserialize<
                SecurityPayload>(
                    resultJson,
                    JsonOptions)
            ?? throw new InvalidOperationException(
                "SECURITY_STATUS contiene JSON inválido.");

        var posture =
            await GetOrCreateAsync(
                device,
                cancellationToken);

        ApplySecurity(
            posture,
            payload);

        await _dbContext.SaveChangesAsync(
            cancellationToken);

        var hasSecurityRisk =
            payload.RootDetected ||
            payload.AdbEnabled ||
            payload.DeveloperOptionsEnabled ||
            !payload.DeviceSecure ||
            payload.BootloaderLocked == false ||
            payload.SelinuxEnforced == false ||
            payload.UnknownSourcesAllowed == true;

        if (hasSecurityRisk)
        {
            await _automation.DispatchAsync(
                device.OrganizationId,
                device.Id,
                "SecurityRisk",
                new
                {
                    platform =
                        device.Platform.ToString(),

                    deviceName =
                        device.DeviceName,

                    rootDetected =
                        payload.RootDetected,

                    adbEnabled =
                        payload.AdbEnabled,

                    developerOptionsEnabled =
                        payload.DeveloperOptionsEnabled,

                    deviceSecure =
                        payload.DeviceSecure,

                    bootloaderLocked =
                        payload.BootloaderLocked,

                    selinuxEnforced =
                        payload.SelinuxEnforced,

                    unknownSourcesAllowed =
                        payload.UnknownSourcesAllowed,

                    securityPatchLevel =
                        payload.SecurityPatchLevel
                },
                cancellationToken:
                    cancellationToken);
        }
    }

    public async Task ProcessComplianceAsync(
        Guid deviceId,
        string resultJson,
        CancellationToken cancellationToken = default)
    {
        var device =
            await GetDeviceAsync(
                deviceId,
                cancellationToken);

        var payload =
            JsonSerializer.Deserialize<
                CompliancePayload>(
                    resultJson,
                    JsonOptions)
            ?? throw new InvalidOperationException(
                "COMPLIANCE_CHECK contiene JSON inválido.");

        var posture =
            await GetOrCreateAsync(
                device,
                cancellationToken);

        if (payload.Posture is not null)
        {
            ApplySecurity(
                posture,
                payload.Posture);
        }

        var findingsJson =
            JsonSerializer.Serialize(
                payload.Findings ?? []);

        posture.UpdateCompliance(
            payload.Score,
            payload.RiskLevel,
            payload.Status,
            payload.TotalChecks,
            payload.PassedChecks,
            payload.FailedChecks,
            findingsJson);

        var compliant =
            payload.Status.Equals(
                "Compliant",
                StringComparison.OrdinalIgnoreCase);

        device.SetCompliance(
            compliant
                ? ComplianceStatus.Compliant
                : ComplianceStatus.NonCompliant);

        await _dbContext.SaveChangesAsync(
            cancellationToken);

        if (!compliant)
        {
            await _automation.DispatchAsync(
                device.OrganizationId,
                device.Id,
                "DeviceNonCompliant",
                new
                {
                    platform =
                        device.Platform.ToString(),

                    deviceName =
                        device.DeviceName,

                    status =
                        payload.Status,

                    score =
                        payload.Score,

                    riskLevel =
                        payload.RiskLevel,

                    totalChecks =
                        payload.TotalChecks,

                    passedChecks =
                        payload.PassedChecks,

                    failedChecks =
                        payload.FailedChecks
                },
                cancellationToken:
                    cancellationToken);
        }

        if (
            payload.Posture is not null &&
            (
                payload.Posture.RootDetected ||
                payload.Posture.AdbEnabled ||
                payload.Posture
                    .DeveloperOptionsEnabled ||
                !payload.Posture.DeviceSecure ||
                payload.Posture
                    .BootloaderLocked == false ||
                payload.Posture
                    .SelinuxEnforced == false
            ))
        {
            await _automation.DispatchAsync(
                device.OrganizationId,
                device.Id,
                "SecurityRisk",
                new
                {
                    platform =
                        device.Platform.ToString(),

                    deviceName =
                        device.DeviceName,

                    riskLevel =
                        payload.RiskLevel,

                    source =
                        "ComplianceCheck"
                },
                cancellationToken:
                    cancellationToken);
        }
    }

    public async Task<SecurityDashboardDto>
        GetDashboardAsync(
            Guid organizationId,
            CancellationToken cancellationToken = default)
    {
        var totalDevices =
            await _dbContext.Devices
                .CountAsync(
                    x =>
                        x.OrganizationId ==
                            organizationId &&
                        !x.IsDeleted,
                    cancellationToken);

        var postures =
            await _dbContext
                .DeviceSecurityPostures
                .Where(
                    x =>
                        x.OrganizationId ==
                            organizationId)
                .ToListAsync(
                    cancellationToken);

        var evaluated =
            postures.Count;

        var compliant =
            postures.Count(
                x =>
                    x.ComplianceStatus ==
                    "Compliant");

        var nonCompliant =
            postures.Count(
                x =>
                    x.ComplianceStatus ==
                    "NonCompliant");

        var average =
            evaluated == 0
                ? 0
                : Math.Round(
                    postures.Average(
                        x =>
                            x.ComplianceScore),
                    1);

        return new SecurityDashboardDto(
            totalDevices,
            evaluated,
            compliant,
            nonCompliant,

            postures.Count(
                x => x.RootDetected),

            postures.Count(
                x => x.AdbEnabled),

            postures.Count(
                x =>
                    x.DeveloperOptionsEnabled),

            postures.Count(
                x =>
                    !x.DeviceSecure),

            postures.Count(
                x =>
                    x.RiskLevel ==
                        "Critical"),

            average);
    }

    public async Task<
        IReadOnlyCollection<DeviceSecurityDto>>
        GetDevicesAsync(
            Guid organizationId,
            CancellationToken cancellationToken = default)
    {
        var query =
            from posture in
                _dbContext.DeviceSecurityPostures

            join device in
                _dbContext.Devices

            on posture.DeviceId
                equals device.Id

            where
                posture.OrganizationId ==
                    organizationId &&
                !device.IsDeleted

            orderby
                posture.ComplianceScore,
                device.DeviceName

            select new DeviceSecurityDto(
                device.Id,
                device.DeviceName,
                device.Platform.ToString(),
                device.Status.ToString(),
                posture.ComplianceStatus,
                posture.ComplianceScore,
                posture.RiskLevel,
                posture.DeviceSecure,
                posture.EncryptionStatus,
                posture.AdbEnabled,
                posture.DeveloperOptionsEnabled,
                posture.RootDetected,
                posture.EmulatorDetected,
                posture.BootloaderLocked,
                posture.SelinuxEnforced,
                posture.AgentInstalled,
                posture.AgentVersionName,
                posture.SecurityPatchLevel,
                posture.TotalChecks,
                posture.PassedChecks,
                posture.FailedChecks,
                posture.FindingsJson,
                posture.LastSecurityScanAtUtc,
                posture.LastComplianceCheckAtUtc);

        return await query
            .ToListAsync(
                cancellationToken);
    }

    private async Task<Device>
        GetDeviceAsync(
            Guid deviceId,
            CancellationToken cancellationToken)
    {
        var device =
            await _dbContext.Devices
                .SingleOrDefaultAsync(
                    x =>
                        x.Id ==
                            deviceId &&
                        !x.IsDeleted,
                    cancellationToken);

        return device
            ?? throw new InvalidOperationException(
                "El dispositivo no existe.");
    }

    private async Task<DeviceSecurityPosture>
        GetOrCreateAsync(
            Device device,
            CancellationToken cancellationToken)
    {
        var posture =
            await _dbContext
                .DeviceSecurityPostures
                .SingleOrDefaultAsync(
                    x =>
                        x.DeviceId ==
                            device.Id,
                    cancellationToken);

        if (posture is not null)
            return posture;

        posture =
            new DeviceSecurityPosture(
                device.OrganizationId,
                device.Id);

        _dbContext
            .DeviceSecurityPostures
            .Add(
                posture);

        return posture;
    }

    private static void ApplySecurity(
        DeviceSecurityPosture posture,
        SecurityPayload payload)
    {
        posture.UpdateSecurity(
            payload.AndroidVersion,
            payload.ApiLevel,
            payload.SecurityPatchLevel,
            payload.DeviceSecure,
            payload.EncryptionStatus,
            payload.AdbEnabled,
            payload.DeveloperOptionsEnabled,
            payload.RootDetected,
            JsonSerializer.Serialize(
                payload.RootSignals ?? []),
            payload.EmulatorDetected,
            payload.VerifiedBootState,
            payload.BootloaderLocked,
            payload.SelinuxEnforced,
            payload.AgentInstalled,
            payload.AgentVersionName,
            payload.AgentVersionCode,
            payload.UnknownSourcesAllowed);
    }

    private sealed class SecurityPayload
    {
        public string AndroidVersion { get; set; } =
            string.Empty;

        public int ApiLevel { get; set; }

        public string? SecurityPatchLevel { get; set; }

        public bool DeviceSecure { get; set; }

        public string EncryptionStatus { get; set; } =
            "Unknown";

        public bool AdbEnabled { get; set; }

        public bool DeveloperOptionsEnabled { get; set; }

        public bool RootDetected { get; set; }

        public List<string> RootSignals { get; set; } =
            [];

        public bool EmulatorDetected { get; set; }

        public string? VerifiedBootState { get; set; }

        public bool? BootloaderLocked { get; set; }

        public bool? SelinuxEnforced { get; set; }

        public bool AgentInstalled { get; set; }

        public string AgentVersionName { get; set; } =
            string.Empty;

        public long AgentVersionCode { get; set; }

        public bool? UnknownSourcesAllowed { get; set; }
    }

    private sealed class CompliancePayload
    {
        public string Status { get; set; } =
            "Unknown";

        public int Score { get; set; }

        public string RiskLevel { get; set; } =
            "Unknown";

        public int TotalChecks { get; set; }

        public int PassedChecks { get; set; }

        public int FailedChecks { get; set; }

        public List<object> Findings { get; set; } =
            [];

        public SecurityPayload? Posture { get; set; }
    }
}