
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
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize is < 1 or > 100 ? 25 : query.PageSize;

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
            tickets = tickets.Where(x => x.Status == query.Status.Trim().ToLowerInvariant());

        if (!string.IsNullOrWhiteSpace(query.Priority))
            tickets = tickets.Where(x => x.Priority == query.Priority.Trim().ToLowerInvariant());

        if (query.DeviceId.HasValue)
            tickets = tickets.Where(x => x.DeviceId == query.DeviceId);

        if (query.AssigneeUserId.HasValue)
            tickets = tickets.Where(x => x.AssigneeUserId == query.AssigneeUserId);

        var total = await tickets.CountAsync(cancellationToken);

        var rows = await tickets
            .OrderByDescending(x => x.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var userIds = rows
            .Select(x => x.RequesterUserId)
            .Concat(rows.Where(x => x.AssigneeUserId.HasValue).Select(x => x.AssigneeUserId!.Value))
            .Distinct()
            .ToList();

        var users = await _db.Users.AsNoTracking()
            .Where(x => userIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var deviceIds = rows.Where(x => x.DeviceId.HasValue).Select(x => x.DeviceId!.Value).Distinct().ToList();
        var devices = await _db.Devices.AsNoTracking()
            .Where(x => deviceIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var items = rows.Select(ticket =>
        {
            users.TryGetValue(ticket.RequesterUserId, out var requester);
            User? assignee = null;
            if (ticket.AssigneeUserId.HasValue)
                users.TryGetValue(ticket.AssigneeUserId.Value, out assignee);

            Device? device = null;
            if (ticket.DeviceId.HasValue)
                devices.TryGetValue(ticket.DeviceId.Value, out device);

            var breached =
                (ticket.FirstResponseDueAtUtc.HasValue &&
                 ticket.FirstRespondedAtUtc is null &&
                 ticket.FirstResponseDueAtUtc < DateTime.UtcNow)
                ||
                (ticket.ResolveDueAtUtc.HasValue &&
                 ticket.ResolvedAtUtc is null &&
                 ticket.ResolveDueAtUtc < DateTime.UtcNow);

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

        return new HelpdeskTicketListResult(items, total, page, pageSize);
    }

    public async Task<HelpdeskTicketDetailsDto?> GetTicketAsync(
        Guid organizationId,
        Guid ticketId,
        CancellationToken cancellationToken = default)
    {
        var ticket = await _db.HelpdeskTickets
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.OrganizationId == organizationId && x.Id == ticketId,
                cancellationToken);

        return ticket is null
            ? null
            : await MapDetailsAsync(ticket, cancellationToken);
    }

    public async Task<HelpdeskTicketDetailsDto> CreateTicketAsync(
        Guid organizationId,
        Guid actorUserId,
        CreateHelpdeskTicketRequest request,
        CancellationToken cancellationToken = default)
    {
        var count = await _db.HelpdeskTickets
            .CountAsync(x => x.OrganizationId == organizationId, cancellationToken);

        var number = $"HD-{count + 10001}";
        var requesterId = request.RequesterUserId ?? actorUserId;

        var ticket = new HelpdeskTicket(
            organizationId,
            number,
            request.Subject,
            request.Description,
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
                .FirstOrDefaultAsync(
                    x => x.OrganizationId == organizationId &&
                         x.EntraObjectId == request.EntraObjectId,
                    cancellationToken);

            if (directoryUser is not null)
            {
                ticket.LinkEntraRequester(
                    directoryUser.EntraObjectId,
                    directoryUser.UserPrincipalName);
            }
        }

        var now = DateTime.UtcNow;
        var hours = ticket.Priority switch
        {
            "urgent" => 4,
            "high" => 8,
            "low" => 72,
            _ => 24
        };
        ticket.ApplySla(now.AddHours(Math.Max(1, hours / 4)), now.AddHours(hours));

        _db.HelpdeskTickets.Add(ticket);
        _db.HelpdeskTicketEvents.Add(
            new HelpdeskTicketEvent(
                organizationId,
                ticket.Id,
                actorUserId,
                "created",
                $"Ticket {ticket.Number} creado."));

        await _db.SaveChangesAsync(cancellationToken);
        return (await GetTicketAsync(organizationId, ticket.Id, cancellationToken))!;
    }

    public async Task<HelpdeskTicketDetailsDto?> AddCommentAsync(
        Guid organizationId,
        Guid ticketId,
        Guid actorUserId,
        AddHelpdeskCommentRequest request,
        CancellationToken cancellationToken = default)
    {
        var ticket = await _db.HelpdeskTickets
            .FirstOrDefaultAsync(
                x => x.OrganizationId == organizationId && x.Id == ticketId,
                cancellationToken);

        if (ticket is null)
            return null;

        _db.HelpdeskTicketComments.Add(
            new HelpdeskTicketComment(
                organizationId,
                ticket.Id,
                actorUserId,
                request.Body,
                request.IsInternal));

        ticket.MarkFirstResponse();
        if (ticket.Status == "new")
            ticket.Transition("open");

        _db.HelpdeskTicketEvents.Add(
            new HelpdeskTicketEvent(
                organizationId,
                ticket.Id,
                actorUserId,
                request.IsInternal ? "internal_note" : "comment",
                request.IsInternal ? "Nota interna agregada." : "Comentario público agregado."));

        await _db.SaveChangesAsync(cancellationToken);
        return await GetTicketAsync(organizationId, ticket.Id, cancellationToken);
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
                x => x.OrganizationId == organizationId && x.Id == ticketId,
                cancellationToken);

        if (ticket is null)
            return null;

        var assigneeExists = await _db.Users.AnyAsync(
            x => x.Id == request.AssigneeUserId && x.OrganizationId == organizationId,
            cancellationToken);

        if (!assigneeExists)
            throw new InvalidOperationException("El asignado no existe en TitanMDM.");

        ticket.Assign(request.AssigneeUserId);
        _db.HelpdeskTicketEvents.Add(
            new HelpdeskTicketEvent(
                organizationId,
                ticket.Id,
                actorUserId,
                "assigned",
                "Ticket asignado a un administrador Titan."));

        await _db.SaveChangesAsync(cancellationToken);
        return await GetTicketAsync(organizationId, ticket.Id, cancellationToken);
    }

    public async Task<HelpdeskTicketDetailsDto?> TransitionAsync(
        Guid organizationId,
        Guid ticketId,
        Guid actorUserId,
        TransitionHelpdeskTicketRequest request,
        CancellationToken cancellationToken = default)
    {
        var ticket = await _db.HelpdeskTickets
            .FirstOrDefaultAsync(
                x => x.OrganizationId == organizationId && x.Id == ticketId,
                cancellationToken);

        if (ticket is null)
            return null;

        ticket.Transition(request.Status);
        _db.HelpdeskTicketEvents.Add(
            new HelpdeskTicketEvent(
                organizationId,
                ticket.Id,
                actorUserId,
                "status",
                $"Estado actualizado a {ticket.Status}."));

        await _db.SaveChangesAsync(cancellationToken);
        return await GetTicketAsync(organizationId, ticket.Id, cancellationToken);
    }

    private async Task<HelpdeskTicketDetailsDto> MapDetailsAsync(
        HelpdeskTicket ticket,
        CancellationToken cancellationToken)
    {
        var requester = await _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == ticket.RequesterUserId, cancellationToken);

        User? assignee = null;
        if (ticket.AssigneeUserId.HasValue)
        {
            assignee = await _db.Users.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == ticket.AssigneeUserId.Value, cancellationToken);
        }

        Device? device = null;
        if (ticket.DeviceId.HasValue)
        {
            device = await _db.Devices.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == ticket.DeviceId.Value, cancellationToken);
        }

        var comments = await _db.HelpdeskTicketComments.AsNoTracking()
            .Where(x => x.TicketId == ticket.Id)
            .OrderBy(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var commentAuthorIds = comments.Select(x => x.AuthorUserId).Distinct().ToList();
        var authors = await _db.Users.AsNoTracking()
            .Where(x => commentAuthorIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var events = await _db.HelpdeskTicketEvents.AsNoTracking()
            .Where(x => x.TicketId == ticket.Id)
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
            comments.Select(c =>
            {
                authors.TryGetValue(c.AuthorUserId, out var author);
                return new HelpdeskCommentDto(
                    c.Id,
                    c.AuthorUserId,
                    author?.FullName ?? "Usuario",
                    c.Body,
                    c.IsInternal,
                    c.CreatedAtUtc);
            }).ToList(),
            events.Select(e => new HelpdeskEventDto(
                e.Id,
                e.EventType,
                e.Summary,
                e.CreatedAtUtc)).ToList());
    }
}
