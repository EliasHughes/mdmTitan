using System.Text;

using Microsoft.EntityFrameworkCore;

using TitanMDM.Application.Reports;
using TitanMDM.Domain.Enums;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Infrastructure.Reports;

public sealed class ReportsService
    : IReportsService
{
    private readonly TitanMdmDbContext
        _dbContext;

    public ReportsService(
        TitanMdmDbContext dbContext)
    {
        _dbContext =
            dbContext;
    }

    public async Task<ReportsOverviewDto>
        GetOverviewAsync(
            Guid organizationId,
            CancellationToken cancellationToken = default)
    {
        var devices =
            _dbContext
                .Devices
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                            organizationId
                        &&
                        !x.IsDeleted);

        var totalDevices =
            await devices.CountAsync(
                cancellationToken);

        var online =
            await devices.CountAsync(
                x =>
                    x.Status ==
                    DeviceStatus.Online,
                cancellationToken);

        var offline =
            await devices.CountAsync(
                x =>
                    x.Status ==
                    DeviceStatus.Offline,
                cancellationToken);

        var managed =
            await devices.CountAsync(
                x =>
                    x.IsManaged,
                cancellationToken);

        var windows =
            await devices.CountAsync(
                x =>
                    x.Platform ==
                    DevicePlatform.Windows,
                cancellationToken);

        var android =
            await devices.CountAsync(
                x =>
                    x.Platform ==
                    DevicePlatform.Android,
                cancellationToken);

        var compliant =
            await devices.CountAsync(
                x =>
                    x.ComplianceStatus ==
                    ComplianceStatus.Compliant,
                cancellationToken);

        var nonCompliant =
            await devices.CountAsync(
                x =>
                    x.ComplianceStatus ==
                    ComplianceStatus.NonCompliant,
                cancellationToken);

        var quarantined =
            await devices.CountAsync(
                x =>
                    x.Status ==
                    DeviceStatus.Quarantined
                    ||
                    x.ComplianceStatus ==
                    ComplianceStatus.Quarantined,
                cancellationToken);

        var fleet =
            new FleetOverviewDto(
                totalDevices,
                online,
                offline,
                managed,
                Math.Max(
                    totalDevices - managed,
                    0),
                windows,
                android,
                compliant,
                nonCompliant,
                quarantined);

        var fromUtc =
            DateTime.UtcNow
                .AddDays(-30);

        var commands =
            _dbContext
                .DeviceCommands
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                            organizationId
                        &&
                        x.CreatedAtUtc >=
                            fromUtc);

        var totalCommands =
            await commands.CountAsync(
                cancellationToken);

        var success =
            await commands.CountAsync(
                x =>
                    x.Status ==
                    DeviceCommandStatus.Success,
                cancellationToken);

        var failed =
            await commands.CountAsync(
                x =>
                    x.Status ==
                    DeviceCommandStatus.Failed,
                cancellationToken);

        var timeout =
            await commands.CountAsync(
                x =>
                    x.Status ==
                    DeviceCommandStatus.Timeout,
                cancellationToken);

        var cancelled =
            await commands.CountAsync(
                x =>
                    x.Status ==
                    DeviceCommandStatus.Cancelled,
                cancellationToken);

        var active =
            totalCommands
            -
            success
            -
            failed
            -
            timeout
            -
            cancelled;

        var successRate =
            totalCommands == 0
                ? 0M
                : Math.Round(
                    success
                    /
                    (decimal)totalCommands
                    *
                    100M,
                    1);

        var commandOverview =
            new CommandOverviewDto(
                totalCommands,
                success,
                failed,
                timeout,
                cancelled,
                Math.Max(
                    active,
                    0),
                successRate);

        var securityQuery =
            _dbContext
                .DeviceSecurityPostures
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                        organizationId);

        var evaluatedDevices =
            await securityQuery
                .CountAsync(
                    cancellationToken);

        var averageScore =
            evaluatedDevices == 0
                ? 0M
                : Math.Round(
                    await securityQuery
                        .AverageAsync(
                            x =>
                                (decimal)
                                x.ComplianceScore,
                            cancellationToken),
                    1);

        var critical =
            await securityQuery
                .CountAsync(
                    x =>
                        x.RiskLevel ==
                        "Critical",
                    cancellationToken);

        var high =
            await securityQuery
                .CountAsync(
                    x =>
                        x.RiskLevel ==
                        "High",
                    cancellationToken);

        var security =
            new SecurityOverviewDto(
                evaluatedDevices,
                averageScore,
                critical,
                high);

        var operatingSystems =
            await devices
                .GroupBy(
                    x =>
                        x.OperatingSystem ??
                        "N/D")
                .Select(
                    group =>
                        new ReportBreakdownDto(
                            group.Key,
                            group.Count()))
                .OrderByDescending(
                    x =>
                        x.Value)
                .Take(8)
                .ToArrayAsync(
                    cancellationToken);

        var departments =
            await devices
                .GroupBy(
                    x =>
                        x.Department ??
                        "Sin departamento")
                .Select(
                    group =>
                        new ReportBreakdownDto(
                            group.Key,
                            group.Count()))
                .OrderByDescending(
                    x =>
                        x.Value)
                .Take(8)
                .ToArrayAsync(
                    cancellationToken);

        var commandTypes =
            await commands
                .GroupBy(
                    x =>
                        x.CommandType)
                .Select(
                    group =>
                        new ReportBreakdownDto(
                            group.Key,
                            group.Count()))
                .OrderByDescending(
                    x =>
                        x.Value)
                .Take(10)
                .ToArrayAsync(
                    cancellationToken);

        return new ReportsOverviewDto(
            DateTime.UtcNow,
            fleet,
            commandOverview,
            security,
            operatingSystems,
            departments,
            commandTypes);
    }

    public async Task<byte[]>
        ExportDevicesCsvAsync(
            Guid organizationId,
            CancellationToken cancellationToken = default)
    {
        var devices =
            await _dbContext
                .Devices
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                            organizationId
                        &&
                        !x.IsDeleted)
                .OrderBy(
                    x =>
                        x.DeviceName)
                .ToListAsync(
                    cancellationToken);

        var builder =
            new StringBuilder();

        builder.AppendLine(
            "Nombre,Plataforma,Estado,Cumplimiento,Serial,Fabricante,Modelo,SistemaOperativo,Version,Usuario,Departamento,IP,Administrado,UltimoContacto");

        foreach (
            var device
            in devices)
        {
            builder.AppendLine(
                string.Join(
                    ",",
                    Csv(
                        device.DeviceName),
                    Csv(
                        device.Platform
                            .ToString()),
                    Csv(
                        device.Status
                            .ToString()),
                    Csv(
                        device
                            .ComplianceStatus
                            .ToString()),
                    Csv(
                        device.SerialNumber),
                    Csv(
                        device.Manufacturer
                        ??
                        string.Empty),
                    Csv(
                        device.Model
                        ??
                        string.Empty),
                    Csv(
                        device.OperatingSystem
                        ??
                        string.Empty),
                    Csv(
                        device
                            .OperatingSystemVersion
                        ??
                        string.Empty),
                    Csv(
                        device.AssignedUser
                        ??
                        string.Empty),
                    Csv(
                        device.Department
                        ??
                        string.Empty),
                    Csv(
                        device.IpAddress
                        ??
                        string.Empty),
                    Csv(
                        device.IsManaged
                            ? "Sí"
                            : "No"),
                    Csv(
                        device.LastSeenAtUtc
                            ?.ToString("O")
                        ??
                        string.Empty)));
        }

        return Encoding.UTF8
            .GetBytes(
                builder.ToString());
    }

    private static string Csv(
        string value)
    {
        return
            $"\"{value.Replace(
                "\"",
                "\"\"",
                StringComparison.Ordinal)}\"";
    }
}