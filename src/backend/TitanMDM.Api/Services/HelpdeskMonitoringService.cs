using Microsoft.EntityFrameworkCore;
using TitanMDM.Domain.Entities;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Api.Services;

public sealed class HelpdeskMonitoringService : BackgroundService
{
    private static readonly TimeSpan ScanInterval = TimeSpan.FromMinutes(5);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<HelpdeskMonitoringService> _logger;

    public HelpdeskMonitoringService(
        IServiceScopeFactory scopeFactory,
        ILogger<HelpdeskMonitoringService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Permite que el arranque de la API y el seeder terminen primero.
        await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);

        using var timer = new PeriodicTimer(ScanInterval);

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
                    ex,
                    "Falló la revisión automática de tickets de Helpdesk.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task ScanAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TitanMdmDbContext>();
        var now = DateTime.UtcNow;

        var tickets = await db.HelpdeskTickets.AsNoTracking()
            .Where(x => x.Status != "resolved" && x.Status != "closed")
            .Select(x => new TicketState(
                x.Id,
                x.OrganizationId,
                x.Number,
                x.AssigneeUserId,
                x.CreatedAtUtc,
                x.FirstResponseDueAtUtc,
                x.FirstRespondedAtUtc,
                x.ResolveDueAtUtc,
                x.ResolvedAtUtc))
            .ToListAsync(cancellationToken);

        if (tickets.Count == 0) return;

        var ticketIds = tickets.Select(x => x.Id).ToArray();
        var recentEvents = await db.HelpdeskTicketEvents.AsNoTracking()
            .Where(x => ticketIds.Contains(x.TicketId) &&
                        x.CreatedAtUtc >= now.AddHours(-24))
            .Select(x => new
            {
                x.TicketId,
                x.EventType,
                x.CreatedAtUtc
            })
            .ToListAsync(cancellationToken);

        var pending = new List<HelpdeskTicketEvent>();

        foreach (var ticket in tickets)
        {
            // Sin responsable: primer aviso tras 15 minutos,
            // repetición no más de una vez por hora.
            if (ticket.AssigneeUserId is null &&
                ticket.CreatedAtUtc <= now.AddMinutes(-15))
            {
                AddIfDue(
                    ticket,
                    "unassigned_reminder",
                    $"El ticket {ticket.Number} sigue sin técnico asignado.",
                    TimeSpan.FromHours(1));
            }

            if (ticket.FirstRespondedAtUtc is null &&
                ticket.FirstResponseDueAtUtc.HasValue)
            {
                if (ticket.FirstResponseDueAtUtc.Value <= now)
                {
                    AddIfDue(
                        ticket,
                        "first_response_overdue",
                        $"El ticket {ticket.Number} superó el plazo de primera respuesta.",
                        TimeSpan.FromHours(2));
                }
                else if (ticket.FirstResponseDueAtUtc.Value <= now.AddMinutes(30))
                {
                    AddIfDue(
                        ticket,
                        "first_response_warning",
                        $"El plazo de primera respuesta del ticket {ticket.Number} vence pronto.",
                        TimeSpan.FromHours(1));
                }
            }

            if (ticket.ResolvedAtUtc is null &&
                ticket.ResolveDueAtUtc.HasValue)
            {
                if (ticket.ResolveDueAtUtc.Value <= now)
                {
                    AddIfDue(
                        ticket,
                        "resolution_overdue",
                        $"El ticket {ticket.Number} superó el plazo de resolución.",
                        TimeSpan.FromHours(2));
                }
                else if (ticket.ResolveDueAtUtc.Value <= now.AddHours(1))
                {
                    AddIfDue(
                        ticket,
                        "resolution_warning",
                        $"El plazo de resolución del ticket {ticket.Number} vence pronto.",
                        TimeSpan.FromHours(1));
                }
            }
        }

        if (pending.Count == 0) return;

        db.HelpdeskTicketEvents.AddRange(pending);
        await db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Helpdesk registró {Count} alertas para {TicketCount} tickets activos.",
            pending.Count,
            tickets.Count);

        void AddIfDue(
            TicketState ticket,
            string eventType,
            string summary,
            TimeSpan repeatInterval)
        {
            var alreadySent = recentEvents.Any(x =>
                x.TicketId == ticket.Id &&
                x.EventType == eventType &&
                x.CreatedAtUtc > now.Subtract(repeatInterval));

            if (alreadySent) return;

            // Evita duplicados dentro del mismo ciclo.
            if (pending.Any(x =>
                    x.TicketId == ticket.Id &&
                    x.EventType == eventType))
                return;

            pending.Add(new HelpdeskTicketEvent(
                ticket.OrganizationId,
                ticket.Id,
                actorUserId: null,
                eventType,
                summary));
        }
    }

    private sealed record TicketState(
        Guid Id,
        Guid OrganizationId,
        string Number,
        Guid? AssigneeUserId,
        DateTime CreatedAtUtc,
        DateTime? FirstResponseDueAtUtc,
        DateTime? FirstRespondedAtUtc,
        DateTime? ResolveDueAtUtc,
        DateTime? ResolvedAtUtc);
}