using Microsoft.EntityFrameworkCore;

using TitanMDM.Application.Applications;
using TitanMDM.Application.Commands.Agent;
using TitanMDM.Application.Security;

using TitanMDM.Domain.Entities;
using TitanMDM.Domain.Enums;

using TitanMDM.Infrastructure.Persistence;
using TitanMDM.Application.Location;

namespace TitanMDM.Infrastructure.Commands;

public sealed class DeviceCommandAgentService
    : IDeviceCommandAgentService
{
    private readonly TitanMdmDbContext
        _dbContext;

    private readonly IApplicationInventoryService
        _applicationInventoryService;

    private readonly ISecurityPostureService
        _securityPostureService;

    public DeviceCommandAgentService(
    TitanMdmDbContext dbContext,
    IApplicationInventoryService applicationInventoryService,
    ISecurityPostureService securityPostureService,
    IDeviceLocationService deviceLocationService)
{
    _dbContext = dbContext;
    _applicationInventoryService =
        applicationInventoryService;
    _securityPostureService =
        securityPostureService;
    _deviceLocationService =
        deviceLocationService;
}

    public async Task<IReadOnlyCollection<AgentCommandDto>>
        GetPendingCommandsAsync(
            Guid deviceId,
            CancellationToken cancellationToken = default)
    {
        if (deviceId == Guid.Empty)
        {
            throw new InvalidOperationException(
                "DeviceId no es válido.");
        }

        var now =
            DateTime.UtcNow;

        var expiredCommands =
            await _dbContext.DeviceCommands
                .Where(
                    x =>
                        x.DeviceId ==
                            deviceId &&
                        (
                            x.Status ==
                                DeviceCommandStatus.Pending ||

                            x.Status ==
                                DeviceCommandStatus.Queued ||

                            x.Status ==
                                DeviceCommandStatus.Dispatching ||

                            x.Status ==
                                DeviceCommandStatus.Sent
                        ) &&
                        x.ExpiresAtUtc <= now)
                .ToListAsync(
                    cancellationToken);

        foreach (
            var expiredCommand
            in expiredCommands)
        {
            expiredCommand.MarkTimeout();
        }

        var commands =
            await _dbContext.DeviceCommands
                .Where(
                    x =>
                        x.DeviceId ==
                            deviceId &&
                        (
                            x.Status ==
                                DeviceCommandStatus.Pending ||

                            x.Status ==
                                DeviceCommandStatus.Queued
                        ) &&
                        x.ExpiresAtUtc > now)
                .OrderBy(
                    x =>
                        x.CreatedAtUtc)
                .Take(20)
                .ToListAsync(
                    cancellationToken);

        var result =
            new List<AgentCommandDto>();

        foreach (
            var command
            in commands)
        {
            command.MarkDispatching();
            command.MarkSent();

            result.Add(
                new AgentCommandDto(
                    command.Id,
                    command.CommandType,
                    command.PayloadJson,
                    command.CreatedAtUtc,
                    command.ExpiresAtUtc));
        }

        await _dbContext.SaveChangesAsync(
            cancellationToken);

        return result;
    }

    public async Task MarkDeliveredAsync(
        Guid deviceId,
        Guid commandId,
        CancellationToken cancellationToken = default)
    {
        var command =
            await GetCommandAsync(
                deviceId,
                commandId,
                cancellationToken);

        command.MarkDelivered();

        await _dbContext.SaveChangesAsync(
            cancellationToken);
    }

    public async Task MarkExecutingAsync(
        Guid deviceId,
        Guid commandId,
        CancellationToken cancellationToken = default)
    {
        var command =
            await GetCommandAsync(
                deviceId,
                commandId,
                cancellationToken);

        command.MarkExecuting();

        await _dbContext.SaveChangesAsync(
            cancellationToken);
    }

    public async Task MarkSuccessAsync(
        Guid deviceId,
        Guid commandId,
        string? resultJson,
        CancellationToken cancellationToken = default)
    {
        var command =
            await GetCommandAsync(
                deviceId,
                commandId,
                cancellationToken);

        if (
            command.CommandType.Equals(
                "APP_INVENTORY",
                StringComparison.OrdinalIgnoreCase))
        {
            RequireResult(
                resultJson,
                "APP_INVENTORY");

            await _applicationInventoryService
                .ProcessInventoryAsync(
                    deviceId,
                    resultJson!,
                    cancellationToken);
        }

        if (
            command.CommandType.Equals(
                "SECURITY_STATUS",
                StringComparison.OrdinalIgnoreCase))
        {
            RequireResult(
                resultJson,
                "SECURITY_STATUS");

            await _securityPostureService
                .ProcessSecurityStatusAsync(
                    deviceId,
                    resultJson!,
                    cancellationToken);
        }

        if (
            command.CommandType.Equals(
                "COMPLIANCE_CHECK",
                StringComparison.OrdinalIgnoreCase))
        {
            RequireResult(
                resultJson,
                "COMPLIANCE_CHECK");

            await _securityPostureService
                .ProcessComplianceAsync(
                    deviceId,
                    resultJson!,
                    cancellationToken);
        }

        if (
            command.CommandType.Equals(
                "LOCATION_REQUEST",
                StringComparison.OrdinalIgnoreCase))
        {
            RequireResult(
                resultJson,
                "LOCATION_REQUEST");

            await _deviceLocationService
                .ProcessLocationAsync(
                    deviceId,
                    resultJson!,
                    cancellationToken);
        }

        command.CompleteSuccess(
            resultJson);

        await _dbContext.SaveChangesAsync(
            cancellationToken);
    }

    public async Task MarkFailedAsync(
        Guid deviceId,
        Guid commandId,
        string errorCode,
        string errorMessage,
        string? resultJson,
        CancellationToken cancellationToken = default)
    {
        if (
            string.IsNullOrWhiteSpace(
                errorCode))
        {
            errorCode =
                "COMMAND_FAILED";
        }

        if (
            string.IsNullOrWhiteSpace(
                errorMessage))
        {
            errorMessage =
                "El agente informó que el comando falló.";
        }

        var command =
            await GetCommandAsync(
                deviceId,
                commandId,
                cancellationToken);

        command.CompleteFailure(
            errorCode,
            errorMessage,
            resultJson);

        await _dbContext.SaveChangesAsync(
            cancellationToken);
    }

    private async Task<DeviceCommand>
        GetCommandAsync(
            Guid deviceId,
            Guid commandId,
            CancellationToken cancellationToken)
    {
        if (deviceId == Guid.Empty)
        {
            throw new InvalidOperationException(
                "DeviceId no es válido.");
        }

        if (commandId == Guid.Empty)
        {
            throw new InvalidOperationException(
                "CommandId no es válido.");
        }

        var command =
            await _dbContext.DeviceCommands
                .SingleOrDefaultAsync(
                    x =>
                        x.Id ==
                            commandId &&
                        x.DeviceId ==
                            deviceId,
                    cancellationToken);

        if (command is null)
        {
            throw new InvalidOperationException(
                "El comando no existe o no pertenece al dispositivo.");
        }

        return command;
    }

    private static void RequireResult(
        string? resultJson,
        string commandType)
    {
        if (
            string.IsNullOrWhiteSpace(
                resultJson))
        {
            throw new InvalidOperationException(
                $"{commandType} no devolvió información.");
        }
    }
}