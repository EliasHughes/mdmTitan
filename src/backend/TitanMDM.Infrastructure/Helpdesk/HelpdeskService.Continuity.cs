using Microsoft.EntityFrameworkCore;
using TitanMDM.Domain.Entities;

namespace TitanMDM.Infrastructure.Helpdesk;

public sealed partial class HelpdeskService
{
    public async Task<bool> TryAutomaticHandoverAsync(
        Guid organizationId,
        Guid ticketId,
        CancellationToken cancellationToken = default)
    {
        var strategy =
            _db.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction =
                await _db.Database.BeginTransactionAsync(
                    System.Data.IsolationLevel.Serializable,
                    cancellationToken);

            var ticket = await _db.HelpdeskTickets
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x =>
                        x.OrganizationId == organizationId &&
                        x.Id == ticketId &&
                        x.AssigneeUserId != null &&
                        x.FirstRespondedAtUtc == null &&
                        (
                            x.Status == "new" ||
                            x.Status == "open"
                        ),
                    cancellationToken);

            if (ticket is null)
                return false;

            // No se utiliza la identidad de un usuario interno
            // para enrutar solicitudes de remitentes externos.
            if (!string.IsNullOrWhiteSpace(
                    ticket.ExternalRequesterEmail))
            {
                return false;
            }

            var lastAssignment =
                await _db.HelpdeskTicketEvents
                    .AsNoTracking()
                    .Where(
                        x =>
                            x.OrganizationId ==
                                organizationId &&
                            x.TicketId == ticketId &&
                            (
                                x.EventType == "assigned" ||
                                x.EventType == "auto_assigned" ||
                                x.EventType == "auto_handover"
                            ))
                    .OrderByDescending(
                        x => x.CreatedAtUtc)
                    .FirstOrDefaultAsync(
                        cancellationToken);

            var now = DateTime.UtcNow;

            if (lastAssignment is null)
                return false;

            // Una decisión manual del coordinador se conserva.
            if (lastAssignment.EventType == "assigned")
                return false;

            // Evita cambios consecutivos de responsable.
            if (lastAssignment.CreatedAtUtc >
                now.AddMinutes(-15))
            {
                return false;
            }

            var previousUserId =
                ticket.AssigneeUserId!.Value;

            var currentTechnicianAvailable =
                await TechnicianHasActiveShiftAsync(
                    organizationId,
                    previousUserId,
                    ticket.Category,
                    now,
                    cancellationToken);

            if (currentTechnicianAvailable)
                return false;

            // Reutiliza la misma evaluación de especialidad,
            // ubicación, cobertura, horario y capacidad.
            var evaluation =
                await EvaluateRoutingAsync(
                    organizationId,
                    ticket.RequesterUserId,
                    ticket.Category,
                    cancellationToken);

            var nextTechnician =
                evaluation.Candidate;

            if (nextTechnician is null ||
                nextTechnician.UserId == previousUserId)
            {
                // Si no hay relevo apto, conserva al responsable.
                // Nunca asigna a una persona arbitrariamente.
                return false;
            }

            // Comprueba que nadie respondió, reasignó o cambió
            // el ticket mientras se calculaba el relevo.
            var changed = await _db.HelpdeskTickets
                .Where(
                    x =>
                        x.OrganizationId == organizationId &&
                        x.Id == ticketId &&
                        x.AssigneeUserId == previousUserId &&
                        x.UpdatedAtUtc == ticket.UpdatedAtUtc &&
                        x.FirstRespondedAtUtc == null &&
                        (
                            x.Status == "new" ||
                            x.Status == "open"
                        ))
                .ExecuteUpdateAsync(
                    setters => setters
                        .SetProperty(
                            x => x.AssigneeUserId,
                            (Guid?)nextTechnician.UserId)
                        .SetProperty(
                            x => x.Status,
                            "open")
                        .SetProperty(
                            x => x.UpdatedAtUtc,
                            now),
                    cancellationToken);

            if (changed != 1)
                return false;

            var previousName = await _db.Users
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId == organizationId &&
                        x.Id == previousUserId)
                .Select(
                    x => x.FirstName + " " + x.LastName)
                .FirstOrDefaultAsync(
                    cancellationToken);

            var summary =
                $"Relevo automático de " +
                $"{previousName ?? previousUserId.ToString()} " +
                $"a {nextTechnician.UserName}: " +
                "el responsable anterior no tiene un turno " +
                "habilitado disponible. " +
                evaluation.Reason;

            if (summary.Length > 500)
                summary = summary[..500];

            var audit = new HelpdeskTicketEvent(
                organizationId,
                ticketId,
                null,
                "auto_handover",
                summary);

            _db.HelpdeskTicketEvents.Add(audit);

            try
            {
                await _db.SaveChangesAsync(
                    cancellationToken);

                await transaction.CommitAsync(
                    cancellationToken);

                return true;
            }
            finally
            {
                // Evita conservar el evento en el seguimiento
                // de EF si la estrategia debe reintentar.
                _db.Entry(audit).State =
                    EntityState.Detached;
            }
        });
    }

    private async Task<bool> TechnicianHasActiveShiftAsync(
        Guid organizationId,
        Guid userId,
        string category,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var eligible = await EligibleTechnicians(
                organizationId)
            .AnyAsync(
                id => id == userId,
                cancellationToken);

        if (!eligible)
            return false;

        var teams = await _db.HelpdeskTeams
            .AsNoTracking()
            .Where(
                x =>
                    x.OrganizationId == organizationId &&
                    x.IsActive)
            .ToListAsync(
                cancellationToken);

        var matchingTeamIds = teams
            .Where(
                x =>
                    x.HandlesCategory(category) ||
                    (
                        category == "general" &&
                        string.IsNullOrWhiteSpace(
                            x.Categories)
                    ))
            .Select(x => x.Id)
            .ToArray();

        if (matchingTeamIds.Length == 0)
            return false;

        var availableTeamIds =
            await _db.HelpdeskTeamMembers
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId == organizationId &&
                        x.UserId == userId &&
                        matchingTeamIds.Contains(x.TeamId) &&
                        x.IsAvailable &&
                        x.AcceptsAutomaticAssignments)
                .Select(x => x.TeamId)
                .ToArrayAsync(
                    cancellationToken);

        if (availableTeamIds.Length == 0)
            return false;

        var schedules =
            await _db.Set<HelpdeskTechnicianSchedule>()
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId == organizationId &&
                        x.UserId == userId &&
                        availableTeamIds.Contains(x.TeamId))
                .ToListAsync(
                    cancellationToken);

        return schedules.Any(
            schedule => schedule.IsOnDuty(now));
    }
}