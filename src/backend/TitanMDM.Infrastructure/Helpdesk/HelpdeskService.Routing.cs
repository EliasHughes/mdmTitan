using Microsoft.EntityFrameworkCore;

using TitanMDM.Domain.Entities;

namespace TitanMDM.Infrastructure.Helpdesk;

public sealed partial class HelpdeskService
{
    // ============================================================
    // TECHNICIANS WITH HELPDESK PERMISSION
    // ============================================================

    private IQueryable<Guid>
        EligibleTechnicians(
            Guid organizationId)
    {
        return (
            from userRole
                in _db.UserRoles.AsNoTracking()

            join rolePermission
                in _db.RolePermissions.AsNoTracking()
                on userRole.RoleId
                equals rolePermission.RoleId

            join permission
                in _db.Permissions.AsNoTracking()
                on rolePermission.PermissionId
                equals permission.Id

            join user
                in _db.Users.AsNoTracking()
                on userRole.UserId
                equals user.Id

            where
                user.OrganizationId ==
                    organizationId
                &&
                user.IsActive
                &&
                permission.IsActive
                &&
                permission.Code ==
                    "tickets.comment"

            select user.Id
        )
        .Distinct();
    }

    // ============================================================
    // PREVIEW
    // ============================================================

    public async Task<RoutingPreview>
        PreviewRoutingAsync(
            Guid organizationId,
            Guid requesterId,
            string category,
            CancellationToken cancellationToken = default)
    {
        var result =
            await EvaluateRoutingAsync(
                organizationId,
                requesterId,
                category,
                cancellationToken);

        var candidate =
            result.Candidate;

        return new RoutingPreview(
            candidate is not null,
            result.Reason,
            result.RequesterLocation,
            candidate?.UserId,
            candidate?.UserName,
            candidate?.TeamName,
            candidate?.CoverageLocation,
            candidate?.TechnicianLocation,
            candidate?.OpenTickets,
            candidate?.Capacity);
    }

    // ============================================================
    // AUTO ASSIGN
    // ============================================================

    private async Task<RoutingCandidate?>
        FindAutomaticAssigneeAsync(
            Guid organizationId,
            Guid requesterId,
            string category,
            CancellationToken cancellationToken)
    {
        return (
            await EvaluateRoutingAsync(
                organizationId,
                requesterId,
                category,
                cancellationToken)
        ).Candidate;
    }

    // ============================================================
    // ROUTING ENGINE
    // ============================================================

    private async Task<RoutingEvaluation>
        EvaluateRoutingAsync(
            Guid organizationId,
            Guid requesterId,
            string category,
            CancellationToken cancellationToken,
            Guid? requestedTeamId = null)
    {
        // ========================================================
        // REQUESTER
        // ========================================================

        var requester =
            await _db.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x =>
                        x.Id ==
                            requesterId
                        &&
                        x.OrganizationId ==
                            organizationId
                        &&
                        x.IsActive,
                    cancellationToken);

        if (requester is null)
        {
            return new RoutingEvaluation(
                null,
                null,
                null,
                "El solicitante no está activo en esta organización.");
        }

        // ========================================================
        // RESOLVE SITE / LOCATION
        //
        // PRIORIDAD:
        //
        // 1. Device explícito se resolverá desde ticket creation.
        // 2. User.Site / User.SiteLocation.
        // 3. Si falta Location, Site-level routing.
        // ========================================================

        var siteId =
            requester.SiteId;

        var siteLocationId =
            requester.SiteLocationId;

        if (!siteId.HasValue)
        {
            return new RoutingEvaluation(
                null,
                null,
                null,
                "El solicitante no tiene una localidad asignada.");
        }

        var site =
            await _db.Sites
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x =>
                        x.OrganizationId ==
                            organizationId
                        &&
                        x.Id ==
                            siteId.Value
                        &&
                        x.IsActive,
                    cancellationToken);

        if (site is null)
        {
            return new RoutingEvaluation(
                null,
                null,
                null,
                "La localidad del solicitante no existe o está desactivada.");
        }

        SiteLocation? location =
            null;

        if (siteLocationId.HasValue)
        {
            location =
                await _db.SiteLocations
                    .AsNoTracking()
                    .FirstOrDefaultAsync(
                        x =>
                            x.OrganizationId ==
                                organizationId
                            &&
                            x.SiteId ==
                                site.Id
                            &&
                            x.Id ==
                                siteLocationId.Value
                            &&
                            x.IsActive,
                        cancellationToken);
        }

        var requesterLocation =
            location is null
                ? site.Name
                : $"{site.Name} / {location.Name}";

        // ========================================================
        // CATEGORY
        // ========================================================

        var normalizedCategory =
            string.IsNullOrWhiteSpace(
                category)
                ? "general"
                : category
                    .Trim()
                    .ToLowerInvariant();

        // ========================================================
        // ACTIVE TEAMS
        // ========================================================

        var allTeams =
            await _db.HelpdeskTeams
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                            organizationId
                        &&
                        x.IsActive
                        &&
                        (
                            !requestedTeamId.HasValue
                            ||
                            x.Id ==
                                requestedTeamId.Value
                        ))
                .ToListAsync(
                    cancellationToken);

        var teams =
            allTeams
                .Where(
                    x =>
                        x.HandlesCategory(
                            normalizedCategory)
                        ||
                        (
                            normalizedCategory ==
                                "general"
                            &&
                            string.IsNullOrWhiteSpace(
                                x.Categories)
                        ))
                .ToDictionary(
                    x =>
                        x.Id);

        if (teams.Count == 0)
        {
            return new RoutingEvaluation(
                null,
                requesterLocation,
                null,
                "No existe un grupo activo que atienda esta categoría.");
        }

        var teamIds =
            teams.Keys
                .ToArray();

        // ========================================================
        // SITE COVERAGE
        //
        // Orden de especificidad:
        //
        // 0 = Site + Location + Category
        // 1 = Site + Location
        // 2 = Site + Category
        // 3 = Site
        // ========================================================

        var coverages =
            await _db.HelpdeskSiteCoverages
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                            organizationId
                        &&
                        x.IsActive
                        &&
                        x.SiteId ==
                            site.Id
                        &&
                        teamIds.Contains(
                            x.TeamId))
                .ToListAsync(
                    cancellationToken);

        var rankedCoverages =
            coverages
                .Select(
                    coverage =>
                    {
                        var categoryMatches =
                            string.Equals(
                                coverage.Category,
                                normalizedCategory,
                                StringComparison.OrdinalIgnoreCase);

                        var allCategories =
                            string.IsNullOrWhiteSpace(
                                coverage.Category);

                        var exactLocation =
                            location is not null
                            &&
                            coverage.SiteLocationId ==
                                location.Id;

                        var entireSite =
                            !coverage.SiteLocationId
                                .HasValue;

                        var rank =
                            exactLocation
                            &&
                            categoryMatches
                                ? 0
                                :
                            exactLocation
                            &&
                            allCategories
                                ? 1
                                :
                            entireSite
                            &&
                            categoryMatches
                                ? 2
                                :
                            entireSite
                            &&
                            allCategories
                                ? 3
                                :
                            int.MaxValue;

                        return new RankedCoverage(
                            coverage,
                            rank);
                    })
                .Where(
                    x =>
                        x.Rank !=
                            int.MaxValue)
                .OrderBy(
                    x =>
                        x.Rank)
                .ThenBy(
                    x =>
                        x.Coverage.Priority)
                .ToList();

        if (rankedCoverages.Count == 0)
        {
            return new RoutingEvaluation(
                null,
                requesterLocation,
                null,
                "No existe cobertura Helpdesk para esta localidad, ubicación y categoría.");
        }

        var bestCoverageRank =
            rankedCoverages[0]
                .Rank;

        var usableCoverages =
            rankedCoverages
                .Where(
                    x =>
                        x.Rank ==
                            bestCoverageRank)
                .ToList();

        var coveredTeams =
            usableCoverages
                .Select(
                    x =>
                        x.Coverage.TeamId)
                .Distinct()
                .ToArray();

        // ========================================================
        // ELIGIBLE TECHNICIANS
        // ========================================================

        var eligibleTechnicians =
            await EligibleTechnicians(
                    organizationId)
                .ToListAsync(
                    cancellationToken);

        var members =
            await _db.HelpdeskTeamMembers
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                            organizationId
                        &&
                        coveredTeams.Contains(
                            x.TeamId)
                        &&
                        eligibleTechnicians.Contains(
                            x.UserId)
                        &&
                        x.IsAvailable
                        &&
                        x.AcceptsAutomaticAssignments
                        &&
                        x.MaxOpenTickets >
                            0)
                .ToListAsync(
                    cancellationToken);

        if (members.Count == 0)
        {
            return new RoutingEvaluation(
                null,
                requesterLocation,
                null,
                "La cobertura existe, pero no tiene técnicos disponibles.");
        }

        // ========================================================
        // SCHEDULE
        // ========================================================

        var schedules =
            await _db
                .Set<HelpdeskTechnicianSchedule>()
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                            organizationId
                        &&
                        coveredTeams.Contains(
                            x.TeamId))
                .ToListAsync(
                    cancellationToken);

        var now =
            DateTime.UtcNow;

        var onDuty =
            schedules
                .Where(
                    x =>
                        x.IsOnDuty(
                            now))
                .ToDictionary(
                    x =>
                        (
                            x.TeamId,
                            x.UserId
                        ));

        members =
            members
                .Where(
                    member =>
                        onDuty.ContainsKey(
                            (
                                member.TeamId,
                                member.UserId
                            )))
                .ToList();

        if (members.Count == 0)
        {
            return new RoutingEvaluation(
                null,
                requesterLocation,
                null,
                "No hay técnicos disponibles dentro de su horario.");
        }

        // ========================================================
        // USERS
        // ========================================================

        var technicianIds =
            members
                .Select(
                    x =>
                        x.UserId)
                .Distinct()
                .ToArray();

        var users =
            await _db.Users
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                            organizationId
                        &&
                        x.IsActive
                        &&
                        technicianIds.Contains(
                            x.Id))
                .ToDictionaryAsync(
                    x =>
                        x.Id,
                    cancellationToken);

        // ========================================================
        // LOAD
        // ========================================================

        var loads =
            await _db.HelpdeskTickets
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                            organizationId
                        &&
                        x.AssigneeUserId
                            .HasValue
                        &&
                        technicianIds.Contains(
                            x.AssigneeUserId.Value)
                        &&
                        x.Status !=
                            "resolved"
                        &&
                        x.Status !=
                            "closed")
                .GroupBy(
                    x =>
                        x.AssigneeUserId!.Value)
                .Select(
                    x =>
                        new
                        {
                            UserId =
                                x.Key,

                            Count =
                                x.Count()
                        })
                .ToDictionaryAsync(
                    x =>
                        x.UserId,
                    x =>
                        x.Count,
                    cancellationToken);

        // ========================================================
        // RANK CANDIDATES
        // ========================================================

        var candidates =
            new List<RankedCandidate>();

        foreach (
            var member
            in members)
        {
            if (
                !users.TryGetValue(
                    member.UserId,
                    out var user))
            {
                continue;
            }

            var load =
                loads.GetValueOrDefault(
                    member.UserId);

            if (
                load >=
                member.MaxOpenTickets)
            {
                continue;
            }

            var coverage =
                usableCoverages
                    .Where(
                        x =>
                            x.Coverage.TeamId ==
                                member.TeamId)
                    .OrderBy(
                        x =>
                            x.Coverage.Priority)
                    .FirstOrDefault();

            if (coverage is null)
            {
                continue;
            }

            string coverageLocation;

            if (
                coverage.Coverage.SiteLocationId
                    .HasValue)
            {
                var coverageLocationName =
                    await _db.SiteLocations
                        .AsNoTracking()
                        .Where(
                            x =>
                                x.Id ==
                                    coverage.Coverage.SiteLocationId.Value
                                &&
                                x.OrganizationId ==
                                    organizationId)
                        .Select(
                            x =>
                                x.Name)
                        .FirstOrDefaultAsync(
                            cancellationToken);

                coverageLocation =
                    $"{site.Name} / {coverageLocationName ?? "Ubicación"}";
            }
            else
            {
                coverageLocation =
                    site.Name;
            }

            var technicianLocation =
                await ResolveUserLocationNameAsync(
                    organizationId,
                    user,
                    cancellationToken);

            var occupancy =
                member.MaxOpenTickets ==
                    0
                    ? 1d
                    : (double)load /
                      member.MaxOpenTickets;

            candidates.Add(
                new RankedCandidate(
                    new RoutingCandidate(
                        member.UserId,
                        user.FullName,
                        teams[member.TeamId]
                            .Name,
                        coverageLocation,
                        technicianLocation,
                        load,
                        member.MaxOpenTickets),
                    coverage.Rank,
                    coverage.Coverage.Priority,
                    occupancy,
                    onDuty[
                        (
                            member.TeamId,
                            member.UserId
                        )]
                        .Priority));
        }

        var chosen =
            candidates
                .OrderBy(
                    x =>
                        x.CoverageRank)
                .ThenBy(
                    x =>
                        x.CoveragePriority)
                .ThenBy(
                    x =>
                        x.SchedulePriority)
                .ThenBy(
                    x =>
                        x.Occupancy)
                .ThenBy(
                    x =>
                        x.Candidate.OpenTickets)
                .ThenBy(
                    x =>
                        x.Candidate.UserId)
                .FirstOrDefault();

        if (chosen is null)
        {
            return new RoutingEvaluation(
                null,
                requesterLocation,
                null,
                "Los técnicos disponibles alcanzaron su límite de capacidad.");
        }

        var selected =
            chosen.Candidate;

        var reason =
            $"Localidad {requesterLocation}; " +
            $"categoría {normalizedCategory}; " +
            $"grupo {selected.TeamName}; " +
            $"cobertura {selected.CoverageLocation}; " +
            $"técnico {selected.UserName}; " +
            $"carga {selected.OpenTickets}/{selected.Capacity}. " +
            "Se verificó cobertura, horario, disponibilidad y capacidad.";

        return new RoutingEvaluation(
            selected,
            requesterLocation,
            site.Id,
            reason);
    }

    // ============================================================
    // RETRY
    // ============================================================

    public async Task<bool>
        RetryAutomaticAssignmentAsync(
            Guid organizationId,
            Guid ticketId,
            CancellationToken cancellationToken = default)
    {
        var strategy =
            _db.Database
                .CreateExecutionStrategy();

        return await strategy
            .ExecuteAsync(
                async () =>
                {
                    await using var transaction =
                        await _db.Database
                            .BeginTransactionAsync(
                                System.Data
                                    .IsolationLevel
                                    .Serializable,
                                cancellationToken);

                    var ticket =
                        await _db.HelpdeskTickets
                            .AsNoTracking()
                            .FirstOrDefaultAsync(
                                x =>
                                    x.OrganizationId ==
                                        organizationId
                                    &&
                                    x.Id ==
                                        ticketId
                                    &&
                                    x.AssigneeUserId ==
                                        null
                                    &&
                                    x.Status !=
                                        "resolved"
                                    &&
                                    x.Status !=
                                        "closed",
                                cancellationToken);

                    if (
                        ticket is null
                        ||
                        (
                            ticket.Source ==
                                "email"
                            &&
                            !string.IsNullOrWhiteSpace(
                                ticket.ExternalRequesterEmail)
                        ))
                    {
                        return false;
                    }

                    var result =
                        await EvaluateRoutingAsync(
                            organizationId,
                            ticket.RequesterUserId,
                            ticket.Category,
                            cancellationToken,
                            ticket.RequestedTeamId);

                    if (
                        result.Candidate
                        is not { }
                            routing)
                    {
                        return false;
                    }

                    var now =
                        DateTime.UtcNow;

                    var changed =
                        await _db.HelpdeskTickets
                            .Where(
                                x =>
                                    x.OrganizationId ==
                                        organizationId
                                    &&
                                    x.Id ==
                                        ticketId
                                    &&
                                    x.AssigneeUserId ==
                                        null
                                    &&
                                    x.Status !=
                                        "resolved"
                                    &&
                                    x.Status !=
                                        "closed")
                            .ExecuteUpdateAsync(
                                setters =>
                                    setters
                                        .SetProperty(
                                            x =>
                                                x.AssigneeUserId,
                                            (Guid?)routing.UserId)
                                        .SetProperty(
                                            x =>
                                                x.Status,
                                            x =>
                                                x.Status ==
                                                    "new"
                                                    ? "open"
                                                    : x.Status)
                                        .SetProperty(
                                            x =>
                                                x.UpdatedAtUtc,
                                            now),
                                cancellationToken);

                    if (changed != 1)
                    {
                        return false;
                    }

                    var audit =
                        new HelpdeskTicketEvent(
                            organizationId,
                            ticketId,
                            null,
                            "auto_assigned",
                            "Reintento automático: " +
                            result.Reason[
                                ..Math.Min(
                                    500,
                                    result.Reason.Length)]);

                    _db.HelpdeskTicketEvents
                        .Add(
                            audit);

                    try
                    {
                        await _db
                            .SaveChangesAsync(
                                cancellationToken);

                        await transaction
                            .CommitAsync(
                                cancellationToken);

                        return true;
                    }
                    finally
                    {
                        _db.Entry(
                                audit)
                            .State =
                            EntityState.Detached;
                    }
                });
    }

    // ============================================================
    // USER LOCATION NAME
    // ============================================================

    private async Task<string>
        ResolveUserLocationNameAsync(
            Guid organizationId,
            User user,
            CancellationToken cancellationToken)
    {
        if (!user.SiteId.HasValue)
        {
            return "Sin localidad";
        }

        var siteName =
            await _db.Sites
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                            organizationId
                        &&
                        x.Id ==
                            user.SiteId.Value)
                .Select(
                    x =>
                        x.Name)
                .FirstOrDefaultAsync(
                    cancellationToken)
            ??
            "Localidad desconocida";

        if (!user.SiteLocationId.HasValue)
        {
            return siteName;
        }

        var locationName =
            await _db.SiteLocations
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                            organizationId
                        &&
                        x.Id ==
                            user.SiteLocationId.Value)
                .Select(
                    x =>
                        x.Name)
                .FirstOrDefaultAsync(
                    cancellationToken);

        return locationName is null
            ? siteName
            : $"{siteName} / {locationName}";
    }

    // ============================================================
    // INTERNAL TYPES
    // ============================================================

    private sealed record RoutingCandidate(
        Guid UserId,
        string UserName,
        string TeamName,
        string CoverageLocation,
        string TechnicianLocation,
        int OpenTickets,
        int Capacity);

    private sealed record RoutingEvaluation(
        RoutingCandidate? Candidate,
        string? RequesterLocation,
        Guid? SiteId,
        string Reason);

    private sealed record RankedCoverage(
        HelpdeskSiteCoverage Coverage,
        int Rank);

    private sealed record RankedCandidate(
        RoutingCandidate Candidate,
        int CoverageRank,
        int CoveragePriority,
        double Occupancy,
        int SchedulePriority);

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