using Microsoft.EntityFrameworkCore;
using TitanMDM.Domain.Entities;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Api.Services;

public sealed class HelpdeskMonitoringWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<HelpdeskMonitoringWorker> _logger;

    public HelpdeskMonitoringWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<HelpdeskMonitoringWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        // Permite completar el inicio de la API antes del primer recorrido.
        await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(15));

        do
        {
            try
            {
                await ScanAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex, "Falló el monitoreo de tickets de Mesa de Ayuda.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task ScanAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TitanMdmDbContext>();

        var now = DateTime.UtcNow;
        var today = now.Date;

        var tickets = await db.HelpdeskTickets
            .Where(x =>
                x.Status != "resolved" &&
                x.Status != "closed" &&
                (
                    x.AssigneeUserId == null ||
                    (x.FirstRespondedAtUtc == null &&
                     x.FirstResponseDueAtUtc < now) ||
                    (x.ResolvedAtUtc == null &&
                     x.ResolveDueAtUtc < now)
                ))
            .OrderBy(x => x.CreatedAtUtc)
            .Take(500)
            .ToListAsync(ct);

        if (tickets.Count == 0)
            return;

        var ids = tickets.Select(x => x.Id).ToList();

        var existingToday = await db.HelpdeskTicketEvents.AsNoTracking()
            .Where(x =>
                ids.Contains(x.TicketId) &&
                x.EventType == "monitor_reminder" &&
                x.CreatedAtUtc >= today)
            .Select(x => x.TicketId)
            .ToListAsync(ct);

        var alreadyNotified = existingToday.ToHashSet();

        foreach (var ticket in tickets)
        {
            if (alreadyNotified.Contains(ticket.Id))
                continue;

            var reason = ticket.AssigneeUserId == null
                ? "Ticket sin agente asignado."
                : ticket.ResolveDueAtUtc < now
                    ? "Plazo de resolución vencido."
                    : "Primera respuesta vencida.";

            db.HelpdeskTicketEvents.Add(
                new HelpdeskTicketEvent(
                    ticket.OrganizationId,
                    ticket.Id,
                    null,
                    "monitor_reminder",
                    reason));
        }

        await db.SaveChangesAsync(ct);
    }
}