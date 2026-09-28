using Microsoft.EntityFrameworkCore;
using TitanMDM.Application.Helpdesk;
using TitanMDM.Infrastructure.Helpdesk;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Api.Services;

public sealed class HelpdeskRoutingWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<HelpdeskRoutingWorker> _logger;

    public HelpdeskRoutingWorker(
        IServiceScopeFactory scopes,
        ILogger<HelpdeskRoutingWorker> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        try
        {
            // Da tiempo al arranque de la API y las migraciones.
            await Task.Delay(
                TimeSpan.FromSeconds(20),
                stoppingToken);

            using var timer = new PeriodicTimer(
                TimeSpan.FromMinutes(5));

            do
            {
                try
                {
                    await ProcessAsync(stoppingToken);
                }
                catch (OperationCanceledException)
                    when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(
                        ex,
                        "Falló el reintento de asignación Helpdesk.");
                }
            }
            while (await timer.WaitForNextTickAsync(
                stoppingToken));
        }
        catch (OperationCanceledException)
            when (stoppingToken.IsCancellationRequested)
        {
            // Apagado normal de la API.
        }
    }

    private async Task ProcessAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();

        var db = scope.ServiceProvider
            .GetRequiredService<TitanMdmDbContext>();

        // IHelpdeskService está registrado con HelpdeskService
        // en InfrastructureServiceExtensions.
        var routing = (HelpdeskService)scope.ServiceProvider
            .GetRequiredService<IHelpdeskService>();

        var cutoff = DateTime.UtcNow.AddMinutes(-1);

        var candidates = await db.HelpdeskTickets
            .AsNoTracking()
            .Where(x =>
                x.AssigneeUserId == null &&
                x.Status != "resolved" &&
                x.Status != "closed" &&
                x.CreatedAtUtc <= cutoff)
            .OrderBy(x => x.CreatedAtUtc)
            .Select(x => new
            {
                x.OrganizationId,
                x.Id
            })
            .Take(100)
            .ToListAsync(ct);

        var assigned = 0;

        foreach (var ticket in candidates)
        {
            try
            {
                if (await routing.RetryAutomaticAssignmentAsync(
                    ticket.OrganizationId,
                    ticket.Id,
                    ct))
                {
                    assigned++;
                }
            }
            catch (OperationCanceledException)
                when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "No se pudo reintentar la asignación " +
                    "del ticket {TicketId}.",
                    ticket.Id);
            }
        }

        if (assigned > 0)
        {
            _logger.LogInformation(
                "Helpdesk asignó automáticamente {Count} " +
                "tickets pendientes.",
                assigned);
        }
    }
}