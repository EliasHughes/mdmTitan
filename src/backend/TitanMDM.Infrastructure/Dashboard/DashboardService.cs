using Microsoft.EntityFrameworkCore;
using TitanMDM.Application.Dashboard.DTOs;
using TitanMDM.Application.Dashboard.Interfaces;
using TitanMDM.Domain.Enums;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Infrastructure.Dashboard;

public sealed class DashboardService
    : IDashboardService
{
    private readonly TitanMdmDbContext _dbContext;

    public DashboardService(
        TitanMdmDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<DashboardSummaryDto> GetSummaryAsync(
        Guid organizationId,
        CancellationToken cancellationToken = default)
    {
        if (organizationId == Guid.Empty)
        {
            throw new ArgumentException(
                "OrganizationId is required.",
                nameof(organizationId));
        }

        var devices = _dbContext.Devices
            .AsNoTracking()
            .Where(device =>
                device.OrganizationId == organizationId &&
                !device.IsDeleted);

        var total = await devices.CountAsync(
            cancellationToken);

        var online = await devices.CountAsync(
            device =>
                device.Status == DeviceStatus.Online,
            cancellationToken);

        var offline = await devices.CountAsync(
            device =>
                device.Status == DeviceStatus.Offline,
            cancellationToken);

        var pending = await devices.CountAsync(
            device =>
                device.Status == DeviceStatus.Pending,
            cancellationToken);

        var enrolling = await devices.CountAsync(
            device =>
                device.Status == DeviceStatus.Enrolling,
            cancellationToken);

        var quarantined = await devices.CountAsync(
            device =>
                device.Status == DeviceStatus.Quarantined,
            cancellationToken);

        var retired = await devices.CountAsync(
            device =>
                device.Status == DeviceStatus.Retired,
            cancellationToken);

        var managed = await devices.CountAsync(
            device => device.IsManaged,
            cancellationToken);

        var windows = await devices.CountAsync(
            device =>
                device.Platform == DevicePlatform.Windows,
            cancellationToken);

        var android = await devices.CountAsync(
            device =>
                device.Platform == DevicePlatform.Android,
            cancellationToken);

        var unknownPlatform = await devices.CountAsync(
            device =>
                device.Platform == DevicePlatform.Unknown,
            cancellationToken);

        var compliant = await devices.CountAsync(
            device =>
                device.ComplianceStatus ==
                ComplianceStatus.Compliant,
            cancellationToken);

        var nonCompliant = await devices.CountAsync(
            device =>
                device.ComplianceStatus ==
                ComplianceStatus.NonCompliant,
            cancellationToken);

        var evaluating = await devices.CountAsync(
            device =>
                device.ComplianceStatus ==
                ComplianceStatus.Evaluating,
            cancellationToken);

        var complianceQuarantined =
            await devices.CountAsync(
                device =>
                    device.ComplianceStatus ==
                    ComplianceStatus.Quarantined,
                cancellationToken);

        var unknownCompliance =
            await devices.CountAsync(
                device =>
                    device.ComplianceStatus ==
                    ComplianceStatus.Unknown,
                cancellationToken);

        var evaluatedDevices =
            compliant + nonCompliant;

        decimal? compliancePercentage = null;

        if (evaluatedDevices > 0)
        {
            compliancePercentage =
                Math.Round(
                    (decimal)compliant /
                    evaluatedDevices *
                    100m,
                    2);
        }

        var databaseConnected =
            await _dbContext.Database.CanConnectAsync(
                cancellationToken);

        return new DashboardSummaryDto
        {
            Devices = new DeviceSummaryDto
            {
                Total = total,
                Online = online,
                Offline = offline,
                Pending = pending,
                Enrolling = enrolling,
                Quarantined = quarantined,
                Retired = retired,
                Managed = managed
            },

            Platforms = new PlatformSummaryDto
            {
                Windows = windows,
                Android = android,
                Unknown = unknownPlatform
            },

            Compliance = new ComplianceSummaryDto
            {
                Compliant = compliant,
                NonCompliant = nonCompliant,
                Evaluating = evaluating,
                Quarantined = complianceQuarantined,
                Unknown = unknownCompliance,
                CompliancePercentage =
                    compliancePercentage
            },

            System = new SystemStatusDto
            {
                Api = "Operational",

                Database = databaseConnected
                    ? "Connected"
                    : "Unavailable"
            },

            GeneratedAtUtc = DateTime.UtcNow
        };
    }
}