using Microsoft.EntityFrameworkCore;
using TitanMDM.Application.Commands.Agent;
using TitanMDM.Domain.Enums;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Infrastructure.Commands;

public sealed class DeviceCommandAgentService
    : IDeviceCommandAgentService
{
    private readonly TitanMdmDbContext _dbContext;

    public DeviceCommandAgentService(
        TitanMdmDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyCollection<AgentCommandDto>>
        GetPendingCommandsAsync(
            Guid deviceId,
            CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;

        var commands =
            await _dbContext.DeviceCommands
                .Where(x =>
                    x.DeviceId == deviceId &&
                    (
                        x.Status == DeviceCommandStatus.Pending ||
                        x.Status == DeviceCommandStatus.Queued
                    ) &&
                    x.ExpiresAtUtc > now)
                .OrderBy(x => x.CreatedAtUtc)
                .Take(20)
                .ToListAsync(cancellationToken);

        var result = new List<AgentCommandDto>();

        foreach (var command in commands)
        {
            /*
             * AQUÍ llamaremos al método de dominio que ya existe
             * para pasar el comando a Sent/Dispatching.
             *
             * No asignes command.Status directamente.
             */

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

        /*
         * command.MarkDelivered();
         */

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

        /*
         * command.MarkExecuting();
         */

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

        /*
         * command.MarkSuccess(resultJson);
         */

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
        var command =
            await GetCommandAsync(
                deviceId,
                commandId,
                cancellationToken);

        /*
         * command.MarkFailed(
         *     errorCode,
         *     errorMessage,
         *     resultJson);
         */

        await _dbContext.SaveChangesAsync(
            cancellationToken);
    }

    private async Task<TitanMDM.Domain.Entities.DeviceCommand>
        GetCommandAsync(
            Guid deviceId,
            Guid commandId,
            CancellationToken cancellationToken)
    {
        var command =
            await _dbContext.DeviceCommands
                .SingleOrDefaultAsync(
                    x =>
                        x.Id == commandId &&
                        x.DeviceId == deviceId,
                    cancellationToken);

        if (command is null)
        {
            throw new InvalidOperationException(
                "El comando no existe o no pertenece al dispositivo.");
        }

        return command;
    }
}