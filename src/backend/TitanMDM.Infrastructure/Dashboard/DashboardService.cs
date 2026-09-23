using Microsoft.EntityFrameworkCore;

using TitanMDM.Application.Dashboard;
using TitanMDM.Application.Dashboard.DTOs;
using TitanMDM.Application.Dashboard.Interfaces;

using TitanMDM.Domain.Enums;

using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Infrastructure.Dashboard;

public sealed class DashboardService
    : IDashboardService
{
    private readonly TitanMdmDbContext
        _dbContext;

    public DashboardService(
        TitanMdmDbContext dbContext)
    {
        _dbContext =
            dbContext;
    }

    public async Task<DashboardSummaryDto> GetSummaryAsync(
        Guid organizationId,
        DashboardWorkspace workspace,
        CancellationToken cancellationToken = default)
    {
        if (
            organizationId ==
            Guid.Empty)
        {
            throw new ArgumentException(
                "OrganizationId is required.",
                nameof(organizationId));
        }

        /*
         * ========================================================
         * DEVICE QUERY
         * ========================================================
         */

        var devices =
            _dbContext.Devices
                .AsNoTracking()
                .Where(
                    device =>
                        device.OrganizationId ==
                            organizationId
                        &&
                        !device.IsDeleted);

        /*
         * Aplicamos el workspace en backend.
         *
         * De esta forma no confiamos en que el frontend simplemente
         * oculte información.
         */

        devices =
            workspace switch
            {
                DashboardWorkspace.Windows =>
                    devices.Where(
                        device =>
                            device.Platform ==
                            DevicePlatform.Windows),

                DashboardWorkspace.Android =>
                    devices.Where(
                        device =>
                            device.Platform ==
                            DevicePlatform.Android),

                _ =>
                    devices
            };

        /*
         * ========================================================
         * DEVICE STATUS
         * ========================================================
         */

        var total =
            await devices.CountAsync(
                cancellationToken);

        var online =
            await devices.CountAsync(
                device =>
                    device.Status ==
                    DeviceStatus.Online,
                cancellationToken);

        var offline =
            await devices.CountAsync(
                device =>
                    device.Status ==
                    DeviceStatus.Offline,
                cancellationToken);

        var pending =
            await devices.CountAsync(
                device =>
                    device.Status ==
                    DeviceStatus.Pending,
                cancellationToken);

        var enrolling =
            await devices.CountAsync(
                device =>
                    device.Status ==
                    DeviceStatus.Enrolling,
                cancellationToken);

        var quarantined =
            await devices.CountAsync(
                device =>
                    device.Status ==
                    DeviceStatus.Quarantined,
                cancellationToken);

        var retired =
            await devices.CountAsync(
                device =>
                    device.Status ==
                    DeviceStatus.Retired,
                cancellationToken);

        var managed =
            await devices.CountAsync(
                device =>
                    device.IsManaged,
                cancellationToken);

        /*
         * ========================================================
         * PLATFORM DISTRIBUTION
         * ========================================================
         */

        var windows =
            await devices.CountAsync(
                device =>
                    device.Platform ==
                    DevicePlatform.Windows,
                cancellationToken);

        var android =
            await devices.CountAsync(
                device =>
                    device.Platform ==
                    DevicePlatform.Android,
                cancellationToken);

        var unknownPlatform =
            await devices.CountAsync(
                device =>
                    device.Platform ==
                    DevicePlatform.Unknown,
                cancellationToken);

        /*
         * ========================================================
         * COMPLIANCE
         * ========================================================
         */

        var compliant =
            await devices.CountAsync(
                device =>
                    device.ComplianceStatus ==
                    ComplianceStatus.Compliant,
                cancellationToken);

        var nonCompliant =
            await devices.CountAsync(
                device =>
                    device.ComplianceStatus ==
                    ComplianceStatus.NonCompliant,
                cancellationToken);

        var evaluating =
            await devices.CountAsync(
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
            compliant +
            nonCompliant;

        decimal? compliancePercentage =
            null;

        if (
            evaluatedDevices >
            0)
        {
            compliancePercentage =
                Math.Round(
                    (
                        decimal
                    )
                    compliant
                    /
                    evaluatedDevices
                    *
                    100m,
                    2);
        }

        /*
         * ========================================================
         * COMMAND QUERY
         * ========================================================
         *
         * Los comandos también deben respetar la plataforma.
         *
         * DeviceCommand contiene DeviceId, por lo que podemos
         * filtrar mediante los dispositivos visibles dentro del
         * workspace.
         * ========================================================
         */

        var commands =
            _dbContext.DeviceCommands
                .AsNoTracking()
                .Where(
                    command =>
                        command.OrganizationId ==
                        organizationId);

        if (
            workspace !=
            DashboardWorkspace.Global)
        {
            var visibleDeviceIds =
                devices.Select(
                    device =>
                        device.Id);

            commands =
                commands.Where(
                    command =>
                        visibleDeviceIds.Contains(
                            command.DeviceId));
        }

        var totalCommands =
            await commands.CountAsync(
                cancellationToken);

        var pendingCommands =
            await commands.CountAsync(
                command =>
                    command.Status ==
                    DeviceCommandStatus.Pending,
                cancellationToken);

        var queuedCommands =
            await commands.CountAsync(
                command =>
                    command.Status ==
                    DeviceCommandStatus.Queued,
                cancellationToken);

        var dispatchingCommands =
            await commands.CountAsync(
                command =>
                    command.Status ==
                    DeviceCommandStatus.Dispatching,
                cancellationToken);

        var sentCommands =
            await commands.CountAsync(
                command =>
                    command.Status ==
                    DeviceCommandStatus.Sent,
                cancellationToken);

        var deliveredCommands =
            await commands.CountAsync(
                command =>
                    command.Status ==
                    DeviceCommandStatus.Delivered,
                cancellationToken);

        var executingCommands =
            await commands.CountAsync(
                command =>
                    command.Status ==
                    DeviceCommandStatus.Executing,
                cancellationToken);

        var successfulCommands =
            await commands.CountAsync(
                command =>
                    command.Status ==
                    DeviceCommandStatus.Success,
                cancellationToken);

        var failedCommands =
            await commands.CountAsync(
                command =>
                    command.Status ==
                    DeviceCommandStatus.Failed,
                cancellationToken);

        var timeoutCommands =
            await commands.CountAsync(
                command =>
                    command.Status ==
                    DeviceCommandStatus.Timeout,
                cancellationToken);

        var cancelledCommands =
            await commands.CountAsync(
                command =>
                    command.Status ==
                    DeviceCommandStatus.Cancelled,
                cancellationToken);

        var activeCommands =
            pendingCommands
            +
            queuedCommands
            +
            dispatchingCommands
            +
            sentCommands
            +
            deliveredCommands
            +
            executingCommands;

        var commandProblems =
            failedCommands
            +
            timeoutCommands;

        /*
         * ========================================================
         * PLATFORM HEALTH
         * ========================================================
         */

        var databaseConnected =
            await _dbContext.Database
                .CanConnectAsync(
                    cancellationToken);

        /*
         * ========================================================
         * RESULT
         * ========================================================
         */

        return new DashboardSummaryDto
        {
            Devices =
                new DeviceSummaryDto
                {
                    Total =
                        total,

                    Online =
                        online,

                    Offline =
                        offline,

                    Pending =
                        pending,

                    Enrolling =
                        enrolling,

                    Quarantined =
                        quarantined,

                    Retired =
                        retired,

                    Managed =
                        managed
                },

            Platforms =
                new PlatformSummaryDto
                {
                    Windows =
                        windows,

                    Android =
                        android,

                    Unknown =
                        unknownPlatform
                },

            Compliance =
                new ComplianceSummaryDto
                {
                    Compliant =
                        compliant,

                    NonCompliant =
                        nonCompliant,

                    Evaluating =
                        evaluating,

                    Quarantined =
                        complianceQuarantined,

                    Unknown =
                        unknownCompliance,

                    CompliancePercentage =
                        compliancePercentage
                },

            Commands =
                new CommandSummaryDto
                {
                    Total =
                        totalCommands,

                    Pending =
                        pendingCommands,

                    Queued =
                        queuedCommands,

                    Dispatching =
                        dispatchingCommands,

                    Sent =
                        sentCommands,

                    Delivered =
                        deliveredCommands,

                    Executing =
                        executingCommands,

                    Success =
                        successfulCommands,

                    Failed =
                        failedCommands,

                    Timeout =
                        timeoutCommands,

                    Cancelled =
                        cancelledCommands,

                    Active =
                        activeCommands,

                    Problems =
                        commandProblems
                },

            System =
                new SystemStatusDto
                {
                    Api =
                        "Operational",

                    Database =
                        databaseConnected
                            ? "Connected"
                            : "Unavailable"
                },

            GeneratedAtUtc =
                DateTime.UtcNow
        };
    }
}