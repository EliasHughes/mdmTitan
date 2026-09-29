using Microsoft.EntityFrameworkCore;
using TitanMDM.Application.Helpdesk;
using TitanMDM.Domain.Entities;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Infrastructure.Helpdesk;

public sealed class HelpdeskService : IHelpdeskService
{
    private readonly TitanMdmDbContext _db;

    public HelpdeskService(TitanMdmDbContext db)
    {
        _db = db;
    }

    public async Task<HelpdeskTicketListResult> GetTicketsAsync(
        Guid organizationId,
        HelpdeskTicketQuery query,
        CancellationToken cancellationToken = default)
    {
        var page = Math.Max(1, query.Page);
        var pageSize = query.PageSize is < 1 or > 100
            ? 25
            : query.PageSize;

        var tickets = _db.HelpdeskTickets
            .AsNoTracking()
            .Where(x => x.OrganizationId == organizationId);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim();

            tickets = tickets.Where(x =>
                x.Number.Contains(term) ||
                x.Subject.Contains(term) ||
                x.Category.Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            var status = query.Status.Trim().ToLowerInvariant();
            tickets = tickets.Where(x => x.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(query.Priority))
        {
            var priority = query.Priority.Trim().ToLowerInvariant();
            tickets = tickets.Where(x => x.Priority == priority);
        }

        if (query.DeviceId.HasValue)
        {
            tickets = tickets.Where(
                x => x.DeviceId == query.DeviceId.Value);
        }

        if (query.AssigneeUserId.HasValue)
        {
            tickets = tickets.Where(
                x => x.AssigneeUserId ==
                     query.AssigneeUserId.Value);
        }

        var total = await tickets.CountAsync(cancellationToken);

        var rows = await tickets
            .OrderByDescending(x => x.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var userIds = rows
            .Select(x => x.RequesterUserId)
            .Concat(
                rows
                    .Where(x => x.AssigneeUserId.HasValue)
                    .Select(x => x.AssigneeUserId!.Value))
            .Distinct()
            .ToArray();

        var users = await _db.Users
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId == organizationId &&
                userIds.Contains(x.Id))
            .ToDictionaryAsync(
                x => x.Id,
                cancellationToken);

        var deviceIds = rows
            .Where(x => x.DeviceId.HasValue)
            .Select(x => x.DeviceId!.Value)
            .Distinct()
            .ToArray();

        var devices = await _db.Devices
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId == organizationId &&
                deviceIds.Contains(x.Id))
            .ToDictionaryAsync(
                x => x.Id,
                cancellationToken);

        var now = DateTime.UtcNow;

        var items = rows.Select(ticket =>
        {
            users.TryGetValue(
                ticket.RequesterUserId,
                out var requester);

            User? assignee = null;

            if (ticket.AssigneeUserId.HasValue)
            {
                users.TryGetValue(
                    ticket.AssigneeUserId.Value,
                    out assignee);
            }

            Device? device = null;

            if (ticket.DeviceId.HasValue)
            {
                devices.TryGetValue(
                    ticket.DeviceId.Value,
                    out device);
            }

            var breached =
                (ticket.FirstResponseDueAtUtc.HasValue &&
                 ticket.FirstRespondedAtUtc is null &&
                 ticket.FirstResponseDueAtUtc < now) ||
                (ticket.ResolveDueAtUtc.HasValue &&
                 ticket.ResolvedAtUtc is null &&
                 ticket.ResolveDueAtUtc < now);

            return new HelpdeskTicketListItemDto(
                ticket.Id,
                ticket.Number,
                ticket.Subject,
                ticket.Status,
                ticket.Priority,
                ticket.Type,
                ticket.Category,
                ticket.Source,
                ticket.RequesterUserId,
                requester?.FullName ?? "Usuario Titan",
                ticket.AssigneeUserId,
                assignee?.FullName,
                ticket.DeviceId,
                device?.DeviceName,
                device?.Platform.ToString(),
                ticket.CreatedAtUtc,
                ticket.UpdatedAtUtc,
                ticket.FirstResponseDueAtUtc,
                ticket.ResolveDueAtUtc,
                breached);
        }).ToList();

        return new HelpdeskTicketListResult(
            items,
            total,
            page,
            pageSize);
    }

    public async Task<HelpdeskTicketDetailsDto?> GetTicketAsync(
        Guid organizationId,
        Guid ticketId,
        CancellationToken cancellationToken = default)
    {
        var ticket = await _db.HelpdeskTickets
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.OrganizationId == organizationId &&
                     x.Id == ticketId,
                cancellationToken);

        return ticket is null
            ? null
            : await MapDetailsAsync(
                ticket,
                cancellationToken);
    }

    public async Task<HelpdeskTicketDetailsDto> CreateTicketAsync(
        Guid organizationId,
        Guid actorUserId,
        CreateHelpdeskTicketRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Subject) ||
            request.Subject.Trim().Length > 250)
        {
            throw new ArgumentException(
                "El asunto debe tener entre 1 y 250 caracteres.");
        }

        if (request.Description?.Length > 4000)
        {
            throw new ArgumentException(
                "La descripción excede 4000 caracteres.");
        }

        var requesterId =
            request.RequesterUserId ?? actorUserId;

        var requesterExists = await _db.Users.AnyAsync(
            x => x.Id == requesterId &&
                 x.OrganizationId == organizationId &&
                 x.IsActive,
            cancellationToken);

        if (!requesterExists)
        {
            throw new ArgumentException(
                "El solicitante no existe o no pertenece " +
                "a esta organización.");
        }

        if (request.DeviceId.HasValue)
        {
            var deviceExists = await _db.Devices.AnyAsync(
                x => x.Id == request.DeviceId.Value &&
                     x.OrganizationId == organizationId,
                cancellationToken);

            if (!deviceExists)
            {
                throw new ArgumentException(
                    "El dispositivo no pertenece a esta organización.");
            }
        }

        var number =
            $"HD-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid():N}"[..20]
                .ToUpperInvariant();

        var ticket = new HelpdeskTicket(
            organizationId,
            number,
            request.Subject.Trim(),
            request.Description ?? string.Empty,
            request.Type ?? "incident",
            request.Priority ?? "medium",
            request.Category ?? "general",
            request.Source ?? "console",
            requesterId,
            request.DeviceId,
            null);

        if (!string.IsNullOrWhiteSpace(request.EntraObjectId))
        {
            var directoryUser = await _db.EntraDirectoryUsers
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.OrganizationId == organizationId &&
                         x.EntraObjectId ==
                         request.EntraObjectId,
                    cancellationToken);

            if (directoryUser is null)
            {
                throw new ArgumentException(
                    "El solicitante de Entra ID no existe " +
                    "en esta organización.");
            }

            ticket.LinkEntraRequester(
                directoryUser.EntraObjectId,
                directoryUser.UserPrincipalName);
        }

        var now = DateTime.UtcNow;

        var resolutionHours = ticket.Priority switch
        {
            "urgent" => 4,
            "high" => 8,
            "low" => 72,
            _ => 24
        };

        ticket.ApplySla(
            now.AddHours(
                Math.Max(1, resolutionHours / 4)),
            now.AddHours(resolutionHours));

        _db.HelpdeskTickets.Add(ticket);

        _db.HelpdeskTicketEvents.Add(
            new HelpdeskTicketEvent(
                organizationId,
                ticket.Id,
                actorUserId,
                "created",
                $"Ticket {ticket.Number} creado."));

        // Para un remitente externo, el usuario técnico del buzón
        // no indica la ubicación real del solicitante.
        var externalEmail =
            string.Equals(
                ticket.Source,
                "email",
                StringComparison.OrdinalIgnoreCase) &&
            requesterId == actorUserId;

        var routing = externalEmail
            ? null
            : await FindAutomaticAssigneeAsync(
                organizationId,
                requesterId,
                ticket.Category,
                cancellationToken);

        if (routing is not null)
        {
            ticket.Assign(routing.UserId);

            _db.HelpdeskTicketEvents.Add(
                new HelpdeskTicketEvent(
                    organizationId,
                    ticket.Id,
                    actorUserId,
                    "auto_assigned",
                    $"Asignación automática: categoría " +
                    $"{ticket.Category}, grupo {routing.TeamName}, " +
                    $"zona {routing.ZoneName}, " +
                    $"técnico {routing.UserName}."));
        }
        else
        {
            var explanation = externalEmail
                ? "Remitente externo sin ubicación confirmada."
                : "No hay un técnico disponible con cobertura, " +
                  "categoría y capacidad para la ubicación " +
                  "del solicitante.";

            _db.HelpdeskTicketEvents.Add(
                new HelpdeskTicketEvent(
                    organizationId,
                    ticket.Id,
                    actorUserId,
                    "routing_pending",
                    $"Sin asignación automática: {explanation}"));
        }

        await _db.SaveChangesAsync(cancellationToken);

        return (await GetTicketAsync(
            organizationId,
            ticket.Id,
            cancellationToken))!;
    }

    public async Task<HelpdeskTicketDetailsDto?> AddCommentAsync(
        Guid organizationId,
        Guid ticketId,
        Guid actorUserId,
        AddHelpdeskCommentRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Body) ||
            request.Body.Trim().Length > 4000)
        {
            throw new ArgumentException(
                "El comentario debe tener entre 1 y 4000 caracteres.");
        }

        var ticket = await _db.HelpdeskTickets
            .FirstOrDefaultAsync(
                x => x.OrganizationId == organizationId &&
                     x.Id == ticketId,
                cancellationToken);

        if (ticket is null)
            return null;

        _db.HelpdeskTicketComments.Add(
            new HelpdeskTicketComment(
                organizationId,
                ticket.Id,
                actorUserId,
                request.Body.Trim(),
                request.IsInternal));

        if (!request.IsInternal)
            ticket.MarkFirstResponse();

        if (ticket.Status == "new")
            ticket.Transition("open");

        _db.HelpdeskTicketEvents.Add(
            new HelpdeskTicketEvent(
                organizationId,
                ticket.Id,
                actorUserId,
                request.IsInternal
                    ? "internal_note"
                    : "comment",
                request.IsInternal
                    ? "Nota interna agregada."
                    : "Respuesta pública agregada."));

        await _db.SaveChangesAsync(cancellationToken);

        return await GetTicketAsync(
            organizationId,
            ticket.Id,
            cancellationToken);
    }

    public async Task<HelpdeskTicketDetailsDto?> AssignAsync(
        Guid organizationId,
        Guid ticketId,
        Guid actorUserId,
        AssignHelpdeskTicketRequest request,
        CancellationToken cancellationToken = default)
    {
        var ticket = await _db.HelpdeskTickets
            .FirstOrDefaultAsync(
                x => x.OrganizationId == organizationId &&
                     x.Id == ticketId,
                cancellationToken);

        if (ticket is null)
            return null;

        var assigneeExists = await _db.Users.AnyAsync(
            x => x.Id == request.AssigneeUserId &&
                 x.OrganizationId == organizationId &&
                 x.IsActive,
            cancellationToken);

        if (!assigneeExists)
        {
            throw new InvalidOperationException(
                "El técnico no existe o está inactivo.");
        }

        ticket.Assign(request.AssigneeUserId);

        _db.HelpdeskTicketEvents.Add(
            new HelpdeskTicketEvent(
                organizationId,
                ticket.Id,
                actorUserId,
                "assigned",
                $"Asignación manual al usuario " +
                $"{request.AssigneeUserId}."));

        await _db.SaveChangesAsync(cancellationToken);

        return await GetTicketAsync(
            organizationId,
            ticket.Id,
            cancellationToken);
    }

    public async Task<HelpdeskTicketDetailsDto?> TransitionAsync(
        Guid organizationId,
        Guid ticketId,
        Guid actorUserId,
        TransitionHelpdeskTicketRequest request,
        CancellationToken cancellationToken = default)
    {
        var allowed = new[]
        {
            "open",
            "inprogress",
            "pendinguser",
            "resolved",
            "closed"
        };

        var status =
            request.Status?.Trim().ToLowerInvariant();

        if (status is null || !allowed.Contains(status))
        {
            throw new ArgumentException(
                "Estado de ticket no válido.");
        }

        var ticket = await _db.HelpdeskTickets
            .FirstOrDefaultAsync(
                x => x.OrganizationId == organizationId &&
                     x.Id == ticketId,
                cancellationToken);

        if (ticket is null)
            return null;

        ticket.Transition(status);

        _db.HelpdeskTicketEvents.Add(
            new HelpdeskTicketEvent(
                organizationId,
                ticket.Id,
                actorUserId,
                "status",
                $"Estado actualizado a {ticket.Status}."));

        await _db.SaveChangesAsync(cancellationToken);

        return await GetTicketAsync(
            organizationId,
            ticket.Id,
            cancellationToken);
    }

   private async Task<RoutingCandidate?> FindAutomaticAssigneeAsync(
    Guid organizationId,
    Guid requesterId,
    string category,
    CancellationToken cancellationToken)
{
    var userZones = await _db.HelpdeskUserZones
        .AsNoTracking()
        .Where(x =>
            x.OrganizationId == organizationId &&
            x.UserId == requesterId)
        .Select(x => x.ZoneId)
        .Distinct()
        .ToListAsync(cancellationToken);

    // La ubicación debe ser inequívoca. No asignamos una zona por intuición.
    if (userZones.Count != 1)
        return null;

    var zones = await _db.HelpdeskZones
        .AsNoTracking()
        .Where(x =>
            x.OrganizationId == organizationId &&
            x.IsActive)
        .Select(x => new
        {
            x.Id,
            x.Name,
            x.ParentZoneId
        })
        .ToListAsync(cancellationToken);

    var zonesById = zones.ToDictionary(x => x.Id);
    var zoneChain = new List<Guid>();
    var currentZoneId = userZones[0];

    // Índice 0 = zona exacta; índices posteriores = zonas superiores.
    for (var depth = 0; depth < 12; depth++)
    {
        if (!zonesById.TryGetValue(currentZoneId, out var zone) ||
            zoneChain.Contains(currentZoneId))
            break;

        zoneChain.Add(currentZoneId);

        if (!zone.ParentZoneId.HasValue)
            break;

        currentZoneId = zone.ParentZoneId.Value;
    }

    if (zoneChain.Count == 0)
        return null;

    var coverage = await _db.HelpdeskTeamZones
        .AsNoTracking()
        .Where(x =>
            x.OrganizationId == organizationId &&
            zoneChain.Contains(x.ZoneId))
        .ToListAsync(cancellationToken);

    if (coverage.Count == 0)
        return null;

    var coveredTeamIds = coverage
        .Select(x => x.TeamId)
        .Distinct()
        .ToArray();

    var teams = await _db.HelpdeskTeams
        .AsNoTracking()
        .Where(x =>
            x.OrganizationId == organizationId &&
            x.IsActive &&
            coveredTeamIds.Contains(x.Id))
        .ToDictionaryAsync(x => x.Id, cancellationToken);

    if (teams.Count == 0)
        return null;

    // Elegimos primero los grupos capaces de atender la categoría.
    // Un especialista que cubre la planta tiene preferencia sobre
    // un grupo general que cubre solamente una nave.
    var specialistTeamIds = teams.Values
        .Where(x => x.HandlesCategory(category))
        .Select(x => x.Id)
        .ToHashSet();

    var generalTeamIds = teams.Values
        .Where(x => string.IsNullOrWhiteSpace(x.Categories))
        .Select(x => x.Id)
        .ToHashSet();

    if (specialistTeamIds.Count == 0 &&
        generalTeamIds.Count == 0)
        return null;

    var eligibleUserIds = await (
        from userRole in _db.UserRoles.AsNoTracking()
        join rolePermission in _db.RolePermissions.AsNoTracking()
            on userRole.RoleId equals rolePermission.RoleId
        join permission in _db.Permissions.AsNoTracking()
            on rolePermission.PermissionId equals permission.Id
        where permission.IsActive &&
              permission.Code == "tickets.comment"
        select userRole.UserId
    )
    .Distinct()
    .ToListAsync(cancellationToken);

    if (eligibleUserIds.Count == 0)
        return null;

    var availableMembers = await _db.HelpdeskTeamMembers
        .AsNoTracking()
        .Where(x =>
            x.OrganizationId == organizationId &&
            coveredTeamIds.Contains(x.TeamId) &&
            x.IsAvailable &&
            x.AcceptsAutomaticAssignments &&
            x.MaxOpenTickets > 0 &&
            eligibleUserIds.Contains(x.UserId))
        .ToListAsync(cancellationToken);

    if (availableMembers.Count == 0)
        return null;

    var memberUserIds = availableMembers
        .Select(x => x.UserId)
        .Distinct()
        .ToArray();

    var users = await _db.Users
        .AsNoTracking()
        .Where(x =>
            x.OrganizationId == organizationId &&
            x.IsActive &&
            memberUserIds.Contains(x.Id))
        .ToDictionaryAsync(x => x.Id, cancellationToken);

    if (users.Count == 0)
        return null;

    var loads = await _db.HelpdeskTickets
        .AsNoTracking()
        .Where(x =>
            x.OrganizationId == organizationId &&
            x.AssigneeUserId.HasValue &&
            memberUserIds.Contains(x.AssigneeUserId.Value) &&
            x.Status != "resolved" &&
            x.Status != "closed")
        .GroupBy(x => x.AssigneeUserId!.Value)
        .Select(x => new
        {
            UserId = x.Key,
            Count = x.Count()
        })
        .ToDictionaryAsync(
            x => x.UserId,
            x => x.Count,
            cancellationToken);

    // Primero se intenta con especialistas. Si ninguno puede tomar
    // el caso, un grupo general con cobertura sirve de respaldo.
    foreach (var teamIds in new[] { specialistTeamIds, generalTeamIds })
    {
        if (teamIds.Count == 0)
            continue;

        var teamCoverage = coverage
            .Where(x =>
                teamIds.Contains(x.TeamId) &&
                teams.ContainsKey(x.TeamId))
            .ToList();

        if (teamCoverage.Count == 0)
            continue;

        // Dentro de esta clase de grupo se prefiere la cobertura
        // geográfica más específica.
        var distances = teamCoverage
            .Select(x => new
            {
                x.TeamId,
                x.ZoneId,
                Distance = zoneChain.IndexOf(x.ZoneId)
            })
            .Where(x => x.Distance >= 0)
            .ToList();

        if (distances.Count == 0)
            continue;

        var bestDistance = distances.Min(x => x.Distance);

        var nearestCoverage = distances
            .Where(x => x.Distance == bestDistance)
            .ToList();

        var nearestTeamIds = nearestCoverage
            .Select(x => x.TeamId)
            .ToHashSet();

        var selected = availableMembers
            .Where(x =>
                nearestTeamIds.Contains(x.TeamId) &&
                users.ContainsKey(x.UserId))
            .Select(x => new
            {
                Member = x,
                Load = loads.GetValueOrDefault(x.UserId)
            })
            .Where(x => x.Load < x.Member.MaxOpenTickets)
            .OrderBy(x =>
                (double)x.Load / x.Member.MaxOpenTickets)
            .ThenBy(x => x.Load)
            .ThenBy(x => x.Member.UserId)
            .FirstOrDefault();

        if (selected is null)
            continue;

        var selectedCoverage = nearestCoverage
            .First(x => x.TeamId == selected.Member.TeamId);

        var zoneName = zonesById.TryGetValue(
            selectedCoverage.ZoneId,
            out var coveredZone)
            ? coveredZone.Name
            : "zona asignada";

        return new RoutingCandidate(
            selected.Member.UserId,
            users[selected.Member.UserId].FullName,
            teams[selected.Member.TeamId].Name,
            zoneName);
    }

    return null;
}

    private async Task<HelpdeskTicketDetailsDto> MapDetailsAsync(
        HelpdeskTicket ticket,
        CancellationToken cancellationToken)
    {
        var requester = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.Id == ticket.RequesterUserId &&
                     x.OrganizationId ==
                     ticket.OrganizationId,
                cancellationToken);

        User? assignee = null;

        if (ticket.AssigneeUserId.HasValue)
        {
            assignee = await _db.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.Id ==
                         ticket.AssigneeUserId.Value &&
                         x.OrganizationId ==
                         ticket.OrganizationId,
                    cancellationToken);
        }

        Device? device = null;

        if (ticket.DeviceId.HasValue)
        {
            device = await _db.Devices
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.Id ==
                         ticket.DeviceId.Value &&
                         x.OrganizationId ==
                         ticket.OrganizationId,
                    cancellationToken);
        }

        var comments = await _db.HelpdeskTicketComments
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId ==
                ticket.OrganizationId &&
                x.TicketId == ticket.Id)
            .OrderBy(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var authorIds = comments
            .Select(x => x.AuthorUserId)
            .Distinct()
            .ToArray();

        var authors = await _db.Users
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId ==
                ticket.OrganizationId &&
                authorIds.Contains(x.Id))
            .ToDictionaryAsync(
                x => x.Id,
                cancellationToken);

        var events = await _db.HelpdeskTicketEvents
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId ==
                ticket.OrganizationId &&
                x.TicketId == ticket.Id)
            .OrderBy(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return new HelpdeskTicketDetailsDto(
            ticket.Id,
            ticket.Number,
            ticket.Subject,
            ticket.Description,
            ticket.Status,
            ticket.Priority,
            ticket.Type,
            ticket.Category,
            ticket.Source,
            ticket.RequesterUserId,
            requester?.FullName ?? "Usuario Titan",
            ticket.AssigneeUserId,
            assignee?.FullName,
            ticket.DeviceId,
            device?.DeviceName,
            device?.Platform.ToString(),
            ticket.RemoteSessionId,
            ticket.EntraUserPrincipalName,
            ticket.CreatedAtUtc,
            ticket.UpdatedAtUtc,
            ticket.FirstResponseDueAtUtc,
            ticket.ResolveDueAtUtc,
            ticket.Status is not ("resolved" or "closed") &&
                ((ticket.FirstRespondedAtUtc is null &&
                  ticket.FirstResponseDueAtUtc <
                  DateTime.UtcNow) ||
                 (ticket.ResolvedAtUtc is null &&
                  ticket.ResolveDueAtUtc <
                  DateTime.UtcNow)),
            comments.Select(item =>
            {
                authors.TryGetValue(
                    item.AuthorUserId,
                    out var author);

                return new HelpdeskCommentDto(
                    item.Id,
                    item.AuthorUserId,
                    author?.FullName ?? "Usuario",
                    item.Body,
                    item.IsInternal,
                    item.CreatedAtUtc);
            }).ToList(),
            events.Select(item =>
                new HelpdeskEventDto(
                    item.Id,
                    item.EventType,
                    item.Summary,
                    item.CreatedAtUtc))
                .ToList());
    }
    public async Task<bool> RetryAutomaticAssignmentAsync(
    Guid organizationId,
    Guid ticketId,
    CancellationToken cancellationToken = default)
{
    var ticket = await _db.HelpdeskTickets
        .AsNoTracking()
        .FirstOrDefaultAsync(
            x => x.OrganizationId == organizationId &&
                 x.Id == ticketId &&
                 x.AssigneeUserId == null &&
                 x.Status != "resolved" &&
                 x.Status != "closed",
            cancellationToken);

    if (ticket is null)
        return false;

    // El usuario técnico que recibe correos externos no representa
    // la ubicación real de la persona que escribió.
    if (ticket.Source == "email" &&
        !string.IsNullOrWhiteSpace(ticket.ExternalRequesterEmail))
    {
        return false;
    }

    var routing = await FindAutomaticAssigneeAsync(
        organizationId,
        ticket.RequesterUserId,
        ticket.Category,
        cancellationToken);

    if (routing is null)
        return false;

    await using var transaction =
        await _db.Database.BeginTransactionAsync(
            cancellationToken);

    var now = DateTime.UtcNow;

    // La condición AssigneeUserId == null protege una asignación
    // manual hecha mientras el trabajador calculaba el candidato.
    var changed = await _db.HelpdeskTickets
        .Where(x => x.OrganizationId == organizationId &&
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
                    x => x.Status == "new"
                        ? "open"
                        : x.Status)
                .SetProperty(
                    x => x.UpdatedAtUtc,
                    now),
            cancellationToken);

    if (changed != 1)
    {
        await transaction.RollbackAsync(cancellationToken);
        return false;
    }

    _db.HelpdeskTicketEvents.Add(
        new HelpdeskTicketEvent(
            organizationId,
            ticketId,
            null,
            "auto_assigned",
            $"Reintento automático: categoría {ticket.Category}, " +
            $"grupo {routing.TeamName}, zona {routing.ZoneName}, " +
            $"técnico {routing.UserName}."));

    await _db.SaveChangesAsync(cancellationToken);
    await transaction.CommitAsync(cancellationToken);

    return true;
}

    private sealed record RoutingCandidate(
        Guid UserId,
        string UserName,
        string TeamName,
        string ZoneName);
}