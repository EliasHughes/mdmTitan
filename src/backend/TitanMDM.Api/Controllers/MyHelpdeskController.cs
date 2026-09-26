using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TitanMDM.Application.Helpdesk;
using TitanMDM.Domain.Entities;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/my/helpdesk")]
public sealed class MyHelpdeskController : ControllerBase
{
    private readonly TitanMdmDbContext _db;
    private readonly IHelpdeskService _helpdesk;

    public MyHelpdeskController(
        TitanMdmDbContext db,
        IHelpdeskService helpdesk)
    {
        _db = db;
        _helpdesk = helpdesk;
    }

    [HttpGet("tickets")]
    public async Task<IActionResult> GetMyTickets(
        CancellationToken cancellationToken)
    {
        if (!TryGetIdentity(out var organizationId, out var userId))
            return Unauthorized();

        var tickets = await _db.HelpdeskTickets.AsNoTracking()
            .Where(x => x.OrganizationId == organizationId &&
                        x.RequesterUserId == userId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => new
            {
                x.Id,
                x.Number,
                x.Subject,
                x.Description,
                x.Status,
                x.Priority,
                x.Category,
                x.CreatedAtUtc,
                x.UpdatedAtUtc,
                x.FirstResponseDueAtUtc,
                x.ResolveDueAtUtc
            })
            .Take(100)
            .ToListAsync(cancellationToken);

        return Ok(tickets);
    }

    [HttpGet("tickets/{ticketId:guid}")]
    public async Task<IActionResult> GetMyTicket(
        Guid ticketId,
        CancellationToken cancellationToken)
    {
        if (!TryGetIdentity(out var organizationId, out var userId))
            return Unauthorized();

        var ticket = await _db.HelpdeskTickets.AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.OrganizationId == organizationId &&
                     x.RequesterUserId == userId &&
                     x.Id == ticketId,
                cancellationToken);

        if (ticket is null) return NotFound();

        var comments = await (
            from comment in _db.HelpdeskTicketComments.AsNoTracking()
            join author in _db.Users.AsNoTracking()
                on comment.AuthorUserId equals author.Id
            where comment.OrganizationId == organizationId &&
                  comment.TicketId == ticketId &&
                  !comment.IsInternal &&
                  author.OrganizationId == organizationId
            orderby comment.CreatedAtUtc
            select new
            {
                comment.Id,
                comment.Body,
                comment.CreatedAtUtc,
                authorUserId = author.Id,
                authorName = author.FirstName + " " + author.LastName
            }
        ).ToListAsync(cancellationToken);

        // Solo eventos aptos para el solicitante.
        var publicTypes = new[] { "created", "comment", "status" };
        var activity = await _db.HelpdeskTicketEvents.AsNoTracking()
            .Where(x => x.OrganizationId == organizationId &&
                        x.TicketId == ticketId &&
                        publicTypes.Contains(x.EventType))
            .OrderBy(x => x.CreatedAtUtc)
            .Select(x => new
            {
                x.Id,
                x.EventType,
                x.Summary,
                x.CreatedAtUtc
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            ticket.Id,
            ticket.Number,
            ticket.Subject,
            ticket.Description,
            ticket.Status,
            ticket.Priority,
            ticket.Category,
            ticket.CreatedAtUtc,
            ticket.UpdatedAtUtc,
            ticket.FirstResponseDueAtUtc,
            ticket.ResolveDueAtUtc,
            comments,
            activity
        });
    }

    [HttpPost("tickets")]
    public async Task<IActionResult> CreateMyTicket(
        [FromBody] CreateMyTicketRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetIdentity(out var organizationId, out var userId))
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.Subject) ||
            request.Subject.Length > 250 ||
            string.IsNullOrWhiteSpace(request.Description) ||
            request.Description.Length > 4000)
        {
            return BadRequest(new
            {
                message = "Indica asunto y descripción dentro de los límites permitidos."
            });
        }

        if (request.DeviceId.HasValue)
        {
            var deviceExists = await _db.Devices.AnyAsync(
                x => x.Id == request.DeviceId.Value &&
                     x.OrganizationId == organizationId,
                cancellationToken);

            if (!deviceExists)
                return BadRequest(new { message = "El dispositivo no es válido." });
        }

        try
        {
            var created = await _helpdesk.CreateTicketAsync(
                organizationId,
                userId,
                new CreateHelpdeskTicketRequest(
                    request.Subject.Trim(),
                    request.Description.Trim(),
                    request.Type is "request" ? "request" : "incident",
                    request.Priority is "low" or "medium" or "high"
                        ? request.Priority
                        : "medium",
                    string.IsNullOrWhiteSpace(request.Category)
                        ? "general"
                        : request.Category.Trim(),
                    "selfservice",
                    request.DeviceId,
                    userId,
                    null),
                cancellationToken);

            // El detalle se devuelve mediante el endpoint personal, que
            // excluye notas y eventos internos.
            return CreatedAtAction(
                nameof(GetMyTicket),
                new { ticketId = created.Id },
                new { created.Id, created.Number });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("tickets/{ticketId:guid}/reply")]
    public async Task<IActionResult> Reply(
        Guid ticketId,
        [FromBody] MyTicketReplyRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetIdentity(out var organizationId, out var userId))
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.Body) ||
            request.Body.Trim().Length > 4000)
            return BadRequest(new { message = "La respuesta debe tener entre 1 y 4000 caracteres." });

        var ticket = await _db.HelpdeskTickets.FirstOrDefaultAsync(
            x => x.Id == ticketId &&
                 x.OrganizationId == organizationId &&
                 x.RequesterUserId == userId,
            cancellationToken);

        if (ticket is null) return NotFound();

        if (ticket.Status is "resolved" or "closed")
            return Conflict(new
            {
                message = "Este ticket está finalizado. Solicita su reapertura a TIC."
            });

        _db.HelpdeskTicketComments.Add(
            new HelpdeskTicketComment(
                organizationId,
                ticketId,
                userId,
                request.Body.Trim(),
                isInternal: false));

        _db.HelpdeskTicketEvents.Add(
            new HelpdeskTicketEvent(
                organizationId,
                ticketId,
                userId,
                "requester_reply",
                "El solicitante respondió al ticket."));

        if (ticket.Status == "pendinguser")
            ticket.Transition("open");

        await _db.SaveChangesAsync(cancellationToken);
        return await GetMyTicket(ticketId, cancellationToken);
    }

    private bool TryGetIdentity(out Guid organizationId, out Guid userId)
    {
        var organizationValue =
            User.FindFirstValue("organization_id") ??
            User.FindFirstValue("organizationId");

        var userValue =
            User.FindFirstValue(ClaimTypes.NameIdentifier) ??
            User.FindFirstValue("sub") ??
            User.FindFirstValue("user_id") ??
            User.FindFirstValue("userId");

        return Guid.TryParse(organizationValue, out organizationId) &&
               Guid.TryParse(userValue, out userId);
    }

    public sealed record CreateMyTicketRequest(
        string Subject,
        string Description,
        string? Type,
        string? Priority,
        string? Category,
        Guid? DeviceId);

    public sealed record MyTicketReplyRequest(string Body);
}