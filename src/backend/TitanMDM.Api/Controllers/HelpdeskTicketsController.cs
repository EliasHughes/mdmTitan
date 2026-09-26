
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TitanMDM.Application.Helpdesk;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Route("api/helpdesk/tickets")]
[Authorize]
public sealed class HelpdeskTicketsController : ControllerBase
{
    private const string HelpdeskView = "helpdesk.view";
    private const string TicketsView = "tickets.view";
    private const string TicketsCreate = "tickets.create";
    private const string TicketsAssign = "tickets.assign";
    private const string TicketsComment = "tickets.comment";
    private const string TicketsClose = "tickets.close";

    private readonly IHelpdeskService _helpdeskService;

    public HelpdeskTicketsController(IHelpdeskService helpdeskService)
    {
        _helpdeskService = helpdeskService;
    }

    [HttpGet]
    public async Task<IActionResult> GetTickets(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] string? priority,
        [FromQuery] Guid? deviceId,
        [FromQuery] Guid? assigneeUserId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        if (!HasAnyPermission(HelpdeskView, TicketsView))
            return Forbid();

        var organizationId = GetOrganizationId();
        if (organizationId is null)
            return Unauthorized(new { message = "El token no contiene una organización válida." });

        var result = await _helpdeskService.GetTicketsAsync(
            organizationId.Value,
            new HelpdeskTicketQuery(search, status, priority, deviceId, assigneeUserId, page, pageSize),
            cancellationToken);

        return Ok(result);
    }

    [HttpGet("{ticketId:guid}")]
    public async Task<IActionResult> GetTicket(
        Guid ticketId,
        CancellationToken cancellationToken = default)
    {
        if (!HasAnyPermission(HelpdeskView, TicketsView))
            return Forbid();

        var organizationId = GetOrganizationId();
        if (organizationId is null)
            return Unauthorized(new { message = "El token no contiene una organización válida." });

        var ticket = await _helpdeskService.GetTicketAsync(
            organizationId.Value,
            ticketId,
            cancellationToken);

        return ticket is null
            ? NotFound(new { message = "El ticket no existe." })
            : Ok(ticket);
    }

    [HttpPost]
    public async Task<IActionResult> CreateTicket(
        [FromBody] CreateHelpdeskTicketRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!HasPermission(TicketsCreate))
            return Forbid();

        var organizationId = GetOrganizationId();
        var actorUserId = GetUserId();
        if (organizationId is null || actorUserId is null)
            return Unauthorized(new { message = "El token no contiene una organización o usuario válido." });

        var created = await _helpdeskService.CreateTicketAsync(
            organizationId.Value,
            actorUserId.Value,
            request,
            cancellationToken);

        return Ok(created);
    }

    [HttpPost("{ticketId:guid}/comments")]
    public async Task<IActionResult> AddComment(
        Guid ticketId,
        [FromBody] AddHelpdeskCommentRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!HasPermission(TicketsComment))
            return Forbid();

        var organizationId = GetOrganizationId();
        var actorUserId = GetUserId();
        if (organizationId is null || actorUserId is null)
            return Unauthorized(new { message = "El token no contiene una organización o usuario válido." });

        var ticket = await _helpdeskService.AddCommentAsync(
            organizationId.Value,
            ticketId,
            actorUserId.Value,
            request,
            cancellationToken);

        return ticket is null
            ? NotFound(new { message = "El ticket no existe." })
            : Ok(ticket);
    }

    [HttpPost("{ticketId:guid}/assign")]
    public async Task<IActionResult> Assign(
        Guid ticketId,
        [FromBody] AssignHelpdeskTicketRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!HasPermission(TicketsAssign))
            return Forbid();

        var organizationId = GetOrganizationId();
        var actorUserId = GetUserId();
        if (organizationId is null || actorUserId is null)
            return Unauthorized(new { message = "El token no contiene una organización o usuario válido." });

        try
        {
            var ticket = await _helpdeskService.AssignAsync(
                organizationId.Value,
                ticketId,
                actorUserId.Value,
                request,
                cancellationToken);

            return ticket is null
                ? NotFound(new { message = "El ticket no existe." })
                : Ok(ticket);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{ticketId:guid}/transition")]
    public async Task<IActionResult> Transition(
        Guid ticketId,
        [FromBody] TransitionHelpdeskTicketRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!HasPermission(TicketsClose) &&
            !string.Equals(request.Status, "open", StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        if (!HasAnyPermission(HelpdeskView, TicketsView))
            return Forbid();

        var organizationId = GetOrganizationId();
        var actorUserId = GetUserId();
        if (organizationId is null || actorUserId is null)
            return Unauthorized(new { message = "El token no contiene una organización o usuario válido." });

        var ticket = await _helpdeskService.TransitionAsync(
            organizationId.Value,
            ticketId,
            actorUserId.Value,
            request,
            cancellationToken);

        return ticket is null
            ? NotFound(new { message = "El ticket no existe." })
            : Ok(ticket);
    }

    private Guid? GetOrganizationId()
    {
        var value = User.FindFirstValue("organization_id") ?? User.FindFirstValue("organizationId");
        return Guid.TryParse(value, out var organizationId) ? organizationId : null;
    }

    private Guid? GetUserId()
    {
        var value =
            User.FindFirstValue(ClaimTypes.NameIdentifier) ??
            User.FindFirstValue("sub") ??
            User.FindFirstValue("user_id") ??
            User.FindFirstValue("userId");

        return Guid.TryParse(value, out var userId) ? userId : null;
    }

    private bool HasPermission(string permission)
    {
        return User.Claims.Any(claim =>
            claim.Type == "permission" &&
            string.Equals(claim.Value, permission, StringComparison.OrdinalIgnoreCase));
    }

    private bool HasAnyPermission(params string[] permissions)
    {
        return permissions.Any(HasPermission);
    }
}
