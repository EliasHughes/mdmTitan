using Microsoft.EntityFrameworkCore;
using TitanMDM.Application.Helpdesk;
using TitanMDM.Infrastructure.Helpdesk;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Api.Services;

public sealed class HelpdeskRoutingWorker
    : BackgroundService
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
            // Permite completar el arranque del backend.
            await Task.Delay(
                TimeSpan.FromSeconds(20),
                stoppingToken);

            using var timer = new PeriodicTimer(
                TimeSpan.FromMinutes(1));

            do
            {
                try
                {
                    await ProcessAsync(
                        stoppingToken);
                }
                catch (OperationCanceledException)
                    when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception exception)
                {
                    _logger.LogError(
                        exception,
                        "Falló el ciclo de asignación y " +
                        "relevos automáticos de Helpdesk.");
                }
            }
            while (
                await timer.WaitForNextTickAsync(
                    stoppingToken));
        }
        catch (OperationCanceledException)
            when (stoppingToken.IsCancellationRequested)
        {
            // Detención normal del servicio.
        }
    }

    private async Task ProcessAsync(
        CancellationToken cancellationToken)
    {
        List<PendingTicket> pending;

        using (var scope = _scopes.CreateScope())
        {
            var db = scope.ServiceProvider
                .GetRequiredService<TitanMdmDbContext>();

            var cutoff =
                DateTime.UtcNow.AddMinutes(-1);

            // Instantánea de identificadores. Las modificaciones
            // posteriores se vuelven a comprobar en el servicio.
            pending = await db.HelpdeskTickets
                .AsNoTracking()
                .Where(
                    x =>
                        x.CreatedAtUtc <= cutoff &&
                        x.Status != "resolved" &&
                        x.Status != "closed" &&
                        (
                            x.AssigneeUserId == null ||
                            (
                                x.FirstRespondedAtUtc == null &&
                                (
                                    x.Status == "new" ||
                                    x.Status == "open"
                                )
                            )
                        ))
                .OrderBy(x => x.CreatedAtUtc)
                .Select(
                    x => new PendingTicket(
                        x.OrganizationId,
                        x.Id,
                        x.AssigneeUserId == null))
                .ToListAsync(
                    cancellationToken);
        }

        var assignments = 0;
        var handovers = 0;

        foreach (var ticket in pending)
        {
            cancellationToken
                .ThrowIfCancellationRequested();

            // Un contexto independiente por ticket evita
            // que un fallo contamine el procesamiento siguiente.
            using var scope = _scopes.CreateScope();

            try
            {
                var service = scope.ServiceProvider
                    .GetRequiredService<IHelpdeskService>();

                if (service is not HelpdeskService routing)
                {
                    throw new InvalidOperationException(
                        "IHelpdeskService debe utilizar " +
                        "la implementación HelpdeskService.");
                }

                if (ticket.Unassigned)
                {
                    var assigned =
                        await routing
                            .RetryAutomaticAssignmentAsync(
                                ticket.OrganizationId,
                                ticket.Id,
                                cancellationToken);

                    if (assigned)
                        assignments++;
                }
                else
                {
                    var transferred =
                        await routing
                            .TryAutomaticHandoverAsync(
                                ticket.OrganizationId,
                                ticket.Id,
                                cancellationToken);

                    if (transferred)
                        handovers++;
                }
            }
            catch (OperationCanceledException)
                when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                _logger.LogError(
                    exception,
                    "No se pudo procesar automáticamente " +
                    "el ticket {TicketId}.",
                    ticket.Id);
            }
        }

        if (assignments > 0 || handovers > 0)
        {
            _logger.LogInformation(
                "Helpdesk: {Assignments} asignaciones y " +
                "{Handovers} relevos automáticos.",
                assignments,
                handovers);
        }
    }

    private sealed record PendingTicket(
        Guid OrganizationId,
        Guid Id,
        bool Unassigned);
}