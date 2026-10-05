using Microsoft.EntityFrameworkCore;

using TitanMDM.Domain.Entities;

namespace TitanMDM.Infrastructure.Helpdesk;

public sealed partial class HelpdeskService
{
    // ============================================================
    // PERMISSIONS THAT QUALIFY A USER AS HELPDESK TECHNICIAN
    // ============================================================

    private static readonly string[] TechnicianPermissions =
    [
        // Nuevo modelo RBAC.
        "helpdesk.agent.access",
        "helpdesk.ticket.details.view",
        "helpdesk.ticket.comment",
        "helpdesk.ticket.take",
        "helpdesk.ticket.assign",
        "helpdesk.ticket.transition",
        "helpdesk.ticket.resolve",
        "helpdesk.ticket.close",

        // Compatibilidad temporal.
        "tickets.comment",
        "tickets.assign",
        "tickets.close",
        "helpdesk.view",
        "helpdesk.manage"
    ];

    // ============================================================
    // TECHNICIANS WITH HELPDESK PERMISSION
    // ============================================================

    private IQueryable<Guid> EligibleTechnicians(
        Guid organizationId)
    {
        return
            (
                from userRole
                    in _db.UserRoles.AsNoTracking()

                join role
                    in _db.Roles.AsNoTracking()
                    on userRole.RoleId
                    equals role.Id

                join rolePermission
                    in _db.RolePermissions.AsNoTracking()
                    on role.Id
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
                    role.OrganizationId ==
                        organizationId
                    &&
                    user.IsActive
                    &&
                    role.IsActive
                    &&
                    permission.IsActive
                    &&
                    TechnicianPermissions.Contains(
                        permission.Code)

                select user.Id
            )
            .Distinct();
    }

    // ============================================================
    // PREVIEW
    // ============================================================

    public async Task<RoutingPreview> PreviewRoutingAsync(
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
        var result =
            await EvaluateRoutingAsync(
                organizationId,
                requesterId,
                category,
                cancellationToken);

        return result.Candidate;
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
                        x.Id == requesterId
                        &&
                        x.OrganizationId == organizationId
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
        // REQUESTER SITE
        // ========================================================

        if (!requester.SiteId.HasValue)
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
                        x.OrganizationId == organizationId
                        &&
                        x.Id == requester.SiteId.Value
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

        SiteLocation? requesterLocationEntity =
            null;

        if (requester.SiteLocationId.HasValue)
        {
            requesterLocationEntity =
                await _db.SiteLocations
                    .AsNoTracking()
                    .FirstOrDefaultAsync(
                        x =>
                            x.OrganizationId == organizationId
                            &&
                            x.SiteId == site.Id
                            &&
                            x.Id == requester.SiteLocationId.Value
                            &&
                            x.IsActive,
                        cancellationToken);
        }

        var requesterLocation =
            requesterLocationEntity is null
                ? site.Name
                : $"{site.Name} / {requesterLocationEntity.Name}";

        // ========================================================
        // CATEGORY
        // ========================================================

        var normalizedCategory =
            string.IsNullOrWhiteSpace(category)
                ? "general"
                : category
                    .Trim()
                    .ToLowerInvariant();

        // ========================================================
        // TEAMS
        // ========================================================

        var allTeams =
            await _db.HelpdeskTeams
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId == organizationId
                        &&
                        x.IsActive
                        &&
                        (
                            !requestedTeamId.HasValue
                            ||
                            x.Id == requestedTeamId.Value
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
                            normalizedCategory == "general"
                            &&
                            string.IsNullOrWhiteSpace(
                                x.Categories)
                        ))
                .ToDictionary(
                    x => x.Id);

        if (teams.Count == 0)
        {
            return new RoutingEvaluation(
                null,
                requesterLocation,
                site.Id,
                requestedTeamId.HasValue
                    ? "El grupo seleccionado no atiende esta categoría."
                    : "No existe un grupo activo que atienda esta categoría.");
        }

        var teamIds =
            teams.Keys.ToArray();

        // ========================================================
        // SITE COVERAGE
        // ========================================================

        var coverages =
            await _db.HelpdeskSiteCoverages
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId == organizationId
                        &&
                        x.IsActive
                        &&
                        x.SiteId == site.Id
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
                            requesterLocationEntity is not null
                            &&
                            coverage.SiteLocationId ==
                                requesterLocationEntity.Id;

                        var entireSite =
                            !coverage.SiteLocationId.HasValue;

                        var rank =
                            exactLocation &&
                            categoryMatches
                                ? 0
                                :
                            exactLocation &&
                            allCategories
                                ? 1
                                :
                            entireSite &&
                            categoryMatches
                                ? 2
                                :
                            entireSite &&
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
                    x => x.Rank)
                .ThenBy(
                    x =>
                        x.Coverage.Priority)
                .ToList();

        if (rankedCoverages.Count == 0)
        {
            return new RoutingEvaluation(
                null,
                requesterLocation,
                site.Id,
                "No existe cobertura Helpdesk para la localidad, ubicación y categoría del solicitante.");
        }

        var bestCoverageRank =
            rankedCoverages[0].Rank;

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

        if (eligibleTechnicians.Count == 0)
        {
            return new RoutingEvaluation(
                null,
                requesterLocation,
                site.Id,
                "No existen técnicos con permisos operativos de Mesa de Ayuda.");
        }

        // ========================================================
        // TEAM MEMBERS
        // ========================================================

        var members =
            await _db.HelpdeskTeamMembers
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId == organizationId
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
                        x.MaxOpenTickets > 0)
                .ToListAsync(
                    cancellationToken);

        if (members.Count == 0)
        {
            return new RoutingEvaluation(
                null,
                requesterLocation,
                site.Id,
                "Existe cobertura, pero no hay técnicos disponibles que acepten asignación automática.");
        }

        // ========================================================
        // SCHEDULES
        //
        // REGLA:
        //
        // - Si el técnico tiene turnos configurados:
        //   debe existir un turno activo.
        //
        // - Si todavía NO tiene turnos configurados:
        //   utilizamos IsAvailable del miembro.
        //
        // Esto evita que una configuración incompleta de turnos
        // rompa toda la autoasignación.
        // ========================================================

        var memberTeamIds =
            members
                .Select(
                    x => x.TeamId)
                .Distinct()
                .ToArray();

        var memberUserIds =
            members
                .Select(
                    x => x.UserId)
                .Distinct()
                .ToArray();

        var schedules =
            await _db
                .Set<HelpdeskTechnicianSchedule>()
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId == organizationId
                        &&
                        memberTeamIds.Contains(
                            x.TeamId)
                        &&
                        memberUserIds.Contains(
                            x.UserId))
                .ToListAsync(
                    cancellationToken);

        var now =
            DateTime.UtcNow;

        var schedulePriorities =
            new Dictionary<
                (Guid TeamId, Guid UserId),
                int>();

        var filteredMembers =
            new List<HelpdeskTeamMember>();

        foreach (
            var member
            in members)
        {
            var configuredSchedules =
                schedules
                    .Where(
                        x =>
                            x.TeamId ==
                                member.TeamId
                            &&
                            x.UserId ==
                                member.UserId)
                    .ToList();

            /*
             * Sin turno configurado:
             * disponibilidad general.
             */
            if (
                configuredSchedules.Count ==
                0)
            {
                filteredMembers.Add(
                    member);

                schedulePriorities[
                    (
                        member.TeamId,
                        member.UserId
                    )] =
                    1000;

                continue;
            }

            var currentSchedule =
                configuredSchedules
                    .Where(
                        x =>
                            x.IsOnDuty(now))
                    .OrderBy(
                        x =>
                            x.Priority)
                    .FirstOrDefault();

            /*
             * Tiene turnos, pero ninguno está activo.
             */
            if (
                currentSchedule is null)
            {
                continue;
            }

            filteredMembers.Add(
                member);

            schedulePriorities[
                (
                    member.TeamId,
                    member.UserId
                )] =
                currentSchedule.Priority;
        }

        members =
            filteredMembers;

        if (members.Count == 0)
        {
            return new RoutingEvaluation(
                null,
                requesterLocation,
                site.Id,
                "Los técnicos tienen turnos configurados, pero ninguno se encuentra actualmente de servicio.");
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
                        x.OrganizationId == organizationId
                        &&
                        x.IsActive
                        &&
                        technicianIds.Contains(
                            x.Id))
                .ToDictionaryAsync(
                    x => x.Id,
                    cancellationToken);

        if (users.Count == 0)
        {
            return new RoutingEvaluation(
                null,
                requesterLocation,
                site.Id,
                "No existen cuentas activas para los técnicos configurados.");
        }

        // ========================================================
        // LOAD
        // ========================================================

        var loads =
            await _db.HelpdeskTickets
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId == organizationId
                        &&
                        x.AssigneeUserId.HasValue
                        &&
                        technicianIds.Contains(
                            x.AssigneeUserId.Value)
                        &&
                        x.Status != "resolved"
                        &&
                        x.Status != "closed")
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
        // PRELOAD TECHNICIAN LOCATIONS
        // ========================================================

        var technicianSiteIds =
            users.Values
                .Where(
                    x =>
                        x.SiteId.HasValue)
                .Select(
                    x =>
                        x.SiteId!.Value)
                .Distinct()
                .ToArray();

        var technicianLocationIds =
            users.Values
                .Where(
                    x =>
                        x.SiteLocationId
                            .HasValue)
                .Select(
                    x =>
                        x.SiteLocationId!.Value)
                .Distinct()
                .ToArray();

        var siteNames =
            technicianSiteIds.Length == 0
                ? new Dictionary<Guid, string>()
                : await _db.Sites
                    .AsNoTracking()
                    .Where(
                        x =>
                            x.OrganizationId ==
                                organizationId
                            &&
                            technicianSiteIds
                                .Contains(
                                    x.Id))
                    .ToDictionaryAsync(
                        x =>
                            x.Id,
                        x =>
                            x.Name,
                        cancellationToken);

        var locationNames =
            technicianLocationIds.Length == 0
                ? new Dictionary<Guid, string>()
                : await _db.SiteLocations
                    .AsNoTracking()
                    .Where(
                        x =>
                            x.OrganizationId ==
                                organizationId
                            &&
                            technicianLocationIds
                                .Contains(
                                    x.Id))
                    .ToDictionaryAsync(
                        x =>
                            x.Id,
                        x =>
                            x.Name,
                        cancellationToken);

        // ========================================================
        // COVERAGE LOCATION NAMES
        // ========================================================

        var coverageLocationIds =
            usableCoverages
                .Where(
                    x =>
                        x.Coverage
                            .SiteLocationId
                            .HasValue)
                .Select(
                    x =>
                        x.Coverage
                            .SiteLocationId!
                            .Value)
                .Distinct()
                .ToArray();

        var coverageLocationNames =
            coverageLocationIds.Length == 0
                ? new Dictionary<Guid, string>()
                : await _db.SiteLocations
                    .AsNoTracking()
                    .Where(
                        x =>
                            x.OrganizationId ==
                                organizationId
                            &&
                            coverageLocationIds
                                .Contains(
                                    x.Id))
                    .ToDictionaryAsync(
                        x =>
                            x.Id,
                        x =>
                            x.Name,
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
                            x.Coverage
                                .TeamId ==
                            member.TeamId)
                    .OrderBy(
                        x =>
                            x.Coverage
                                .Priority)
                    .FirstOrDefault();

            if (
                coverage is null)
            {
                continue;
            }

            string coverageLocation;

            if (
                coverage.Coverage
                    .SiteLocationId
                    .HasValue)
            {
                var locationId =
                    coverage.Coverage
                        .SiteLocationId
                        .Value;

                coverageLocation =
                    coverageLocationNames
                        .TryGetValue(
                            locationId,
                            out var locationName)
                        ? $"{site.Name} / {locationName}"
                        : site.Name;
            }
            else
            {
                coverageLocation =
                    site.Name;
            }

            var technicianLocation =
                ResolveUserLocationName(
                    user,
                    siteNames,
                    locationNames);

            var occupancy =
                member.MaxOpenTickets == 0
                    ? 1d
                    : (double)load /
                      member.MaxOpenTickets;

            var schedulePriority =
                schedulePriorities
                    .GetValueOrDefault(
                        (
                            member.TeamId,
                            member.UserId
                        ),
                        1000);

            candidates.Add(
                new RankedCandidate(
                    new RoutingCandidate(
                        member.UserId,
                        user.FullName,
                        teams[
                            member.TeamId]
                            .Name,
                        coverageLocation,
                        technicianLocation,
                        load,
                        member.MaxOpenTickets),
                    coverage.Rank,
                    coverage.Coverage.Priority,
                    occupancy,
                    schedulePriority));
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
                        x.Candidate
                            .OpenTickets)
                .ThenBy(
                    x =>
                        x.Candidate
                            .UserId)
                .FirstOrDefault();

        if (
            chosen is null)
        {
            return new RoutingEvaluation(
                null,
                requesterLocation,
                site.Id,
                "Los técnicos elegibles alcanzaron su límite de capacidad.");
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
            "Se verificó cobertura, permisos, disponibilidad, turno y capacidad.";

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
                        ticket is null)
                    {
                        return false;
                    }

                    /*
                     * Tickets externos por email sin usuario interno
                     * todavía requieren resolución especial.
                     */
                    if (
                        ticket.Source ==
                            "email"
                        &&
                        !string.IsNullOrWhiteSpace(
                            ticket.ExternalRequesterEmail))
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
                        is not { } routing)
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

                    if (
                        changed != 1)
                    {
                        await transaction
                            .RollbackAsync(
                                cancellationToken);

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

                    await _db.SaveChangesAsync(
                        cancellationToken);

                    await transaction
                        .CommitAsync(
                            cancellationToken);

                    _db.Entry(
                            audit)
                        .State =
                        EntityState.Detached;

                    return true;
                });
    }

    // ============================================================
    // USER LOCATION NAME
    // ============================================================

    private static string
        ResolveUserLocationName(
            User user,
            IReadOnlyDictionary<Guid, string> sites,
            IReadOnlyDictionary<Guid, string> locations)
    {
        if (
            !user.SiteId.HasValue)
        {
            return "Sin localidad";
        }

        if (
            !sites.TryGetValue(
                user.SiteId.Value,
                out var siteName))
        {
            siteName =
                "Localidad desconocida";
        }

        if (
            !user.SiteLocationId.HasValue)
        {
            return siteName;
        }

        if (
            !locations.TryGetValue(
                user.SiteLocationId.Value,
                out var locationName))
        {
            return siteName;
        }

        return
            $"{siteName} / {locationName}";
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