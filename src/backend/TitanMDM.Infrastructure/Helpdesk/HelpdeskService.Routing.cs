using Microsoft.EntityFrameworkCore;
using TitanMDM.Domain.Entities;

namespace TitanMDM.Infrastructure.Helpdesk;

public sealed partial class HelpdeskService
{
    private IQueryable<Guid> EligibleTechnicians(Guid organizationId) =>
        (from userRole in _db.UserRoles.AsNoTracking()
         join rolePermission in _db.RolePermissions.AsNoTracking()
             on userRole.RoleId equals rolePermission.RoleId
         join permission in _db.Permissions.AsNoTracking()
             on rolePermission.PermissionId equals permission.Id
         join user in _db.Users.AsNoTracking()
             on userRole.UserId equals user.Id
         where user.OrganizationId == organizationId &&
               user.IsActive &&
               permission.IsActive &&
               permission.Code == "tickets.comment"
         select user.Id).Distinct();

    public async Task<RoutingPreview> PreviewRoutingAsync(
        Guid organizationId,
        Guid requesterId,
        string category,
        CancellationToken cancellationToken = default)
    {
        var evaluation = await EvaluateRoutingAsync(
            organizationId,
            requesterId,
            category,
            cancellationToken);

        var selected = evaluation.Candidate;

        return new RoutingPreview(
            selected is not null,
            evaluation.Reason,
            evaluation.RequesterZone,
            selected?.UserId,
            selected?.UserName,
            selected?.TeamName,
            selected?.ZoneName,
            selected?.TechnicianZone,
            selected?.OpenTickets,
            selected?.Capacity);
    }

    private async Task<RoutingCandidate?> FindAutomaticAssigneeAsync(
        Guid organizationId,
        Guid requesterId,
        string category,
        CancellationToken cancellationToken)
    {
        var evaluation = await EvaluateRoutingAsync(
            organizationId,
            requesterId,
            category,
            cancellationToken);

        return evaluation.Candidate;
    }

    private async Task<RoutingEvaluation> EvaluateRoutingAsync(
        Guid organizationId,
        Guid requesterId,
        string category,
        CancellationToken cancellationToken)
    {
        if (!await _db.Users.AsNoTracking().AnyAsync(
                x => x.Id == requesterId &&
                     x.OrganizationId == organizationId &&
                     x.IsActive,
                cancellationToken))
        {
            return new(
                null,
                null,
                "El solicitante no está activo en esta organización.");
        }

        var zones = await _db.HelpdeskZones
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId == organizationId &&
                x.IsActive)
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var requesterZones = await _db.HelpdeskUserZones
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId == organizationId &&
                x.UserId == requesterId)
            .Select(x => x.ZoneId)
            .Distinct()
            .ToListAsync(cancellationToken);

        if (requesterZones.Count != 1 ||
            !zones.ContainsKey(requesterZones[0]))
        {
            return new(
                null,
                null,
                "Asigna al solicitante una única ubicación activa.");
        }

        List<Guid> Chain(Guid id)
        {
            var result = new List<Guid>();

            while (zones.TryGetValue(id, out var zone) &&
                   !result.Contains(id))
            {
                result.Add(id);

                if (!zone.ParentZoneId.HasValue)
                    break;

                id = zone.ParentZoneId.Value;
            }

            return result;
        }

        var chain = Chain(requesterZones[0]);
        var requesterZone = zones[requesterZones[0]].Name;

        var normalizedCategory =
            (category ?? "general").Trim().ToLowerInvariant();

        if (normalizedCategory.Length == 0)
            normalizedCategory = "general";

        var allTeams = await _db.HelpdeskTeams
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId == organizationId &&
                x.IsActive)
            .ToListAsync(cancellationToken);

        var teams = allTeams
            .Where(x =>
                x.HandlesCategory(normalizedCategory) ||
                (normalizedCategory == "general" &&
                 string.IsNullOrWhiteSpace(x.Categories)))
            .ToDictionary(x => x.Id);

        if (teams.Count == 0)
        {
            return new(
                null,
                requesterZone,
                "No hay una especialidad configurada para esta categoría.");
        }

        var teamIds = teams.Keys.ToArray();

        var coverage = await _db.HelpdeskTeamZones
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId == organizationId &&
                teamIds.Contains(x.TeamId) &&
                chain.Contains(x.ZoneId))
            .ToListAsync(cancellationToken);

        var coveredTeamIds = coverage
            .Select(x => x.TeamId)
            .Distinct()
            .ToArray();

        if (coveredTeamIds.Length == 0)
        {
            return new(
                null,
                requesterZone,
                "La especialidad no tiene cobertura en esta ubicación.");
        }

        var eligible = await EligibleTechnicians(organizationId)
            .ToListAsync(cancellationToken);

        var members = await _db.HelpdeskTeamMembers
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId == organizationId &&
                coveredTeamIds.Contains(x.TeamId) &&
                eligible.Contains(x.UserId) &&
                x.IsAvailable &&
                x.AcceptsAutomaticAssignments &&
                x.MaxOpenTickets > 0)
            .ToListAsync(cancellationToken);

        var schedules = await _db.Set<HelpdeskTechnicianSchedule>()
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId == organizationId &&
                coveredTeamIds.Contains(x.TeamId))
            .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;

        var onDuty = schedules
            .Where(x => x.IsOnDuty(now))
            .ToDictionary(x => (x.TeamId, x.UserId));

        members = members
            .Where(x => onDuty.ContainsKey((x.TeamId, x.UserId)))
            .ToList();

        var userIds = members
            .Select(x => x.UserId)
            .Distinct()
            .ToArray();

        if (userIds.Length == 0)
        {
            return new(
                null,
                requesterZone,
                "No hay técnicos disponibles dentro de su horario " +
                "en esta especialidad.");
        }

        var users = await _db.Users
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId == organizationId &&
                x.IsActive &&
                userIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var locations = await _db.HelpdeskUserZones
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId == organizationId &&
                userIds.Contains(x.UserId))
            .Select(x => new { x.UserId, x.ZoneId })
            .ToListAsync(cancellationToken);

        var technicianZones = locations
            .GroupBy(x => x.UserId)
            .Where(group =>
                group.Select(x => x.ZoneId).Distinct().Count() == 1)
            .ToDictionary(
                group => group.Key,
                group => group.First().ZoneId);

        var loads = await _db.HelpdeskTickets
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId == organizationId &&
                x.AssigneeUserId.HasValue &&
                userIds.Contains(x.AssigneeUserId.Value) &&
                x.Status != "resolved" &&
                x.Status != "closed")
            .GroupBy(x => x.AssigneeUserId!.Value)
            .Select(group => new
            {
                UserId = group.Key,
                Count = group.Count()
            })
            .ToDictionaryAsync(
                x => x.UserId,
                x => x.Count,
                cancellationToken);

        var candidates = new List<RankedCandidate>();

        foreach (var member in members)
        {
            if (!users.TryGetValue(member.UserId, out var user) ||
                !technicianZones.TryGetValue(
                    member.UserId, out var homeZoneId) ||
                !zones.TryGetValue(homeZoneId, out var homeZone))
            {
                continue;
            }

            var load = loads.GetValueOrDefault(member.UserId);

            if (load >= member.MaxOpenTickets)
                continue;

            var homeChain = Chain(homeZoneId);
            var distance = chain.FindIndex(homeChain.Contains);

            if (distance < 0)
                distance = int.MaxValue;

            var coverageZone = coverage
                .Where(x => x.TeamId == member.TeamId)
                .OrderBy(x => chain.IndexOf(x.ZoneId))
                .First()
                .ZoneId;

            candidates.Add(new RankedCandidate(
                new RoutingCandidate(
                    member.UserId,
                    user.FullName,
                    teams[member.TeamId].Name,
                    zones[coverageZone].Name,
                    homeZone.Name,
                    load,
                    member.MaxOpenTickets),
                distance,
                chain.IndexOf(coverageZone),
                (double)load / member.MaxOpenTickets,
                teams[member.TeamId].HandlesCategory(normalizedCategory)
                    ? 0
                    : 1,
                onDuty[(member.TeamId, member.UserId)].Priority));
        }

        var chosen = candidates
            .OrderBy(x => x.SpecialtyRank)
            .ThenBy(x => x.LocationRank)
            .ThenBy(x => x.Priority)
            .ThenBy(x => x.CoverageRank)
            .ThenBy(x => x.Occupancy)
            .ThenBy(x => x.Candidate.OpenTickets)
            .ThenBy(x => x.Candidate.UserId)
            .ThenBy(x => x.Candidate.TeamName)
            .FirstOrDefault();

        if (chosen is null)
        {
            return new(
                null,
                requesterZone,
                "Los técnicos están al límite de capacidad " +
                "o no tienen una ubicación válida.");
        }

        var selected = chosen.Candidate;

        return new(
            selected,
            requesterZone,
            $"Especialidad {selected.TeamName}; " +
            $"solicitante en {requesterZone}; " +
            $"técnico en {selected.TechnicianZone}; " +
            $"cobertura {selected.ZoneName}; " +
            $"carga {selected.OpenTickets}/{selected.Capacity}. " +
            "Se verificó el horario y se priorizó ubicación, " +
            "orden del técnico y capacidad.");
    }

    public async Task<bool> RetryAutomaticAssignmentAsync(
        Guid organizationId,
        Guid ticketId,
        CancellationToken cancellationToken = default)
    {
        var strategy = _db.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction =
                await _db.Database.BeginTransactionAsync(
                    System.Data.IsolationLevel.Serializable,
                    cancellationToken);

            var ticket = await _db.HelpdeskTickets
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.OrganizationId == organizationId &&
                         x.Id == ticketId &&
                         x.AssigneeUserId == null &&
                         x.Status != "resolved" &&
                         x.Status != "closed",
                    cancellationToken);

            if (ticket is null ||
                (ticket.Source == "email" &&
                 !string.IsNullOrWhiteSpace(
                     ticket.ExternalRequesterEmail)))
            {
                return false;
            }

            var evaluation = await EvaluateRoutingAsync(
                organizationId,
                ticket.RequesterUserId,
                ticket.Category,
                cancellationToken);

            var routing = evaluation.Candidate;

            if (routing is null)
                return false;

            var now = DateTime.UtcNow;

            var changed = await _db.HelpdeskTickets
                .Where(x =>
                    x.OrganizationId == organizationId &&
                    x.Id == ticketId &&
                    x.AssigneeUserId == null &&
                    x.Status != "resolved" &&
                    x.Status != "closed")
                .ExecuteUpdateAsync(
                    setters => setters
                        .SetProperty(
                            x => x.AssigneeUserId,
                            (Guid?)routing.UserId)
                        .SetProperty(
                            x => x.Status,
                            x => x.Status == "new" ? "open" : x.Status)
                        .SetProperty(
                            x => x.UpdatedAtUtc,
                            now),
                    cancellationToken);

            if (changed != 1)
                return false;

            var audit = new HelpdeskTicketEvent(
                organizationId,
                ticketId,
                null,
                "auto_assigned",
                "Reintento automático: " + evaluation.Reason);

            _db.HelpdeskTicketEvents.Add(audit);

            try
            {
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return true;
            }
            finally
            {
                _db.Entry(audit).State = EntityState.Detached;
            }
        });
    }

    private sealed record RoutingCandidate(
        Guid UserId,
        string UserName,
        string TeamName,
        string ZoneName,
        string TechnicianZone,
        int OpenTickets,
        int Capacity);

    private sealed record RoutingEvaluation(
        RoutingCandidate? Candidate,
        string? RequesterZone,
        string Reason);

    private sealed record RankedCandidate(
        RoutingCandidate Candidate,
        int LocationRank,
        int CoverageRank,
        double Occupancy,
        int SpecialtyRank,
        int Priority);

    public sealed record RoutingPreview(
        bool CanAssign,
        string Reason,
        string? RequesterZone,
        Guid? TechnicianId,
        string? TechnicianName,
        string? TeamName,
        string? CoverageZone,
        string? TechnicianZone,
        int? OpenTickets,
        int? Capacity);
}