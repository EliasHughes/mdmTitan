using System.Security.Claims;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using TitanMDM.Application.Helpdesk;
using TitanMDM.Application.Security;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/helpdesk/tickets")]
public sealed class HelpdeskTicketsController
    : ControllerBase
{
    private const string HelpdeskView =
        "helpdesk.view";

    private const string TicketsView =
        "tickets.view";

    private const string TicketsCreate =
        "tickets.create";

    private const string TicketsAssign =
        "tickets.assign";

    private const string TicketsComment =
        "tickets.comment";

    private const string TicketsClose =
        "tickets.close";

    private readonly IHelpdeskService
        _helpdeskService;

    private readonly IScopeAccessService
        _scopeAccessService;

    public HelpdeskTicketsController(
        IHelpdeskService helpdeskService,
        IScopeAccessService scopeAccessService)
    {
        _helpdeskService =
            helpdeskService;

        _scopeAccessService =
            scopeAccessService;
    }

    // ============================================================
    // LIST
    // ============================================================

    [HttpGet]
    public async Task<IActionResult>
        GetTickets(
            [FromQuery]
            string? search,
            [FromQuery]
            string? status,
            [FromQuery]
            string? priority,
            [FromQuery]
            Guid? deviceId,
            [FromQuery]
            Guid? assigneeUserId,
            [FromQuery]
            int page = 1,
            [FromQuery]
            int pageSize = 25,
            CancellationToken cancellationToken = default)
    {
        if (
            !HasAnyPermission(
                HelpdeskView,
                TicketsView))
        {
            return Forbid();
        }

        var organizationId =
            GetOrganizationId();

        var actorUserId =
            GetUserId();

        if (
            organizationId is null
            ||
            actorUserId is null)
        {
            return Unauthorized(
                new
                {
                    message =
                        "El token no contiene una organización o usuario válido."
                });
        }

        /*
         * El inbox global de Helpdesk representa toda la organización.
         *
         * Un operador limitado a Site no debe poder utilizar
         * este endpoint para saltarse la segregación.
         */
        var organizationWide =
            await _scopeAccessService
                .HasOrganizationScopeAsync(
                    organizationId.Value,
                    actorUserId.Value,
                    cancellationToken);

        if (!organizationWide)
        {
            return Forbid();
        }

        var result =
            await _helpdeskService
                .GetTicketsAsync(
                    organizationId.Value,
                    new HelpdeskTicketQuery(
                        search,
                        status,
                        priority,
                        deviceId,
                        assigneeUserId,
                        page,
                        pageSize),
                    cancellationToken);

        return Ok(
            result);
    }

    // ============================================================
    // DETAILS
    // ============================================================

    [HttpGet("{ticketId:guid}")]
    public async Task<IActionResult>
        GetTicket(
            Guid ticketId,
            CancellationToken cancellationToken = default)
    {
        if (
            !HasAnyPermission(
                HelpdeskView,
                TicketsView))
        {
            return Forbid();
        }

        var organizationId =
            GetOrganizationId();

        var actorUserId =
            GetUserId();

        if (
            organizationId is null
            ||
            actorUserId is null)
        {
            return Unauthorized(
                new
                {
                    message =
                        "El token no contiene una organización o usuario válido."
                });
        }

        if (
            !await _scopeAccessService
                .CanAccessTicketAsync(
                    organizationId.Value,
                    actorUserId.Value,
                    ticketId,
                    cancellationToken))
        {
            return Forbid();
        }

        var ticket =
            await _helpdeskService
                .GetTicketAsync(
                    organizationId.Value,
                    ticketId,
                    cancellationToken);

        return ticket is null
            ? NotFound(
                new
                {
                    message =
                        "El ticket no existe."
                })
            : Ok(ticket);
    }

    // ============================================================
    // CREATE
    // ============================================================

    [HttpPost]
    public async Task<IActionResult>
        CreateTicket(
            [FromBody]
            CreateHelpdeskTicketRequest request,
            CancellationToken cancellationToken = default)
    {
        if (
            !HasPermission(
                TicketsCreate))
        {
            return Forbid();
        }

        var organizationId =
            GetOrganizationId();

        var actorUserId =
            GetUserId();

        if (
            organizationId is null
            ||
            actorUserId is null)
        {
            return Unauthorized(
                new
                {
                    message =
                        "El token no contiene una organización o usuario válido."
                });
        }

        try
        {
            var created =
                await _helpdeskService
                    .CreateTicketAsync(
                        organizationId.Value,
                        actorUserId.Value,
                        request,
                        cancellationToken);

            return Ok(
                created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(
                new
                {
                    message =
                        ex.Message
                });
        }
    }

    // ============================================================
    // COMMENT
    // ============================================================

    [HttpPost("{ticketId:guid}/comments")]
    public async Task<IActionResult>
        AddComment(
            Guid ticketId,
            [FromBody]
            AddHelpdeskCommentRequest request,
            CancellationToken cancellationToken = default)
    {
        if (
            !HasPermission(
                TicketsComment)
            ||
            !HasAnyPermission(
                HelpdeskView,
                TicketsView))
        {
            return Forbid();
        }

        var organizationId =
            GetOrganizationId();

        var actorUserId =
            GetUserId();

        if (
            organizationId is null
            ||
            actorUserId is null)
        {
            return Unauthorized(
                new
                {
                    message =
                        "El token no contiene una organización o usuario válido."
                });
        }

        if (
            !await _scopeAccessService
                .CanAccessTicketAsync(
                    organizationId.Value,
                    actorUserId.Value,
                    ticketId,
                    cancellationToken))
        {
            return Forbid();
        }

        try
        {
            var ticket =
                await _helpdeskService
                    .AddCommentAsync(
                        organizationId.Value,
                        ticketId,
                        actorUserId.Value,
                        request,
                        cancellationToken);

            return ticket is null
                ? NotFound(
                    new
                    {
                        message =
                            "El ticket no existe."
                    })
                : Ok(ticket);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(
                new
                {
                    message =
                        ex.Message
                });
        }
    }

    // ============================================================
    // ASSIGN
    // ============================================================

    [HttpPost("{ticketId:guid}/assign")]
    public async Task<IActionResult>
        Assign(
            Guid ticketId,
            [FromBody]
            AssignHelpdeskTicketRequest request,
            CancellationToken cancellationToken = default)
    {
        if (
            !HasPermission(
                TicketsAssign)
            ||
            !HasAnyPermission(
                HelpdeskView,
                TicketsView))
        {
            return Forbid();
        }

        var organizationId =
            GetOrganizationId();

        var actorUserId =
            GetUserId();

        if (
            organizationId is null
            ||
            actorUserId is null)
        {
            return Unauthorized(
                new
                {
                    message =
                        "El token no contiene una organización o usuario válido."
                });
        }

        if (
            !await _scopeAccessService
                .CanAccessTicketAsync(
                    organizationId.Value,
                    actorUserId.Value,
                    ticketId,
                    cancellationToken))
        {
            return Forbid();
        }

        try
        {
            var ticket =
                await _helpdeskService
                    .AssignAsync(
                        organizationId.Value,
                        ticketId,
                        actorUserId.Value,
                        request,
                        cancellationToken);

            return ticket is null
                ? NotFound(
                    new
                    {
                        message =
                            "El ticket no existe."
                    })
                : Ok(ticket);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(
                new
                {
                    message =
                        ex.Message
                });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(
                new
                {
                    message =
                        ex.Message
                });
        }
    }

    // ============================================================
    // TRANSITION
    // ============================================================

    [HttpPost("{ticketId:guid}/transition")]
    public async Task<IActionResult>
        Transition(
            Guid ticketId,
            [FromBody]
            TransitionHelpdeskTicketRequest request,
            CancellationToken cancellationToken = default)
    {
        if (
            !HasPermission(
                TicketsClose)
            ||
            !HasAnyPermission(
                HelpdeskView,
                TicketsView))
        {
            return Forbid();
        }

        var organizationId =
            GetOrganizationId();

        var actorUserId =
            GetUserId();

        if (
            organizationId is null
            ||
            actorUserId is null)
        {
            return Unauthorized(
                new
                {
                    message =
                        "El token no contiene una organización o usuario válido."
                });
        }

        if (
            !await _scopeAccessService
                .CanAccessTicketAsync(
                    organizationId.Value,
                    actorUserId.Value,
                    ticketId,
                    cancellationToken))
        {
            return Forbid();
        }

        try
        {
            var ticket =
                await _helpdeskService
                    .TransitionAsync(
                        organizationId.Value,
                        ticketId,
                        actorUserId.Value,
                        request,
                        cancellationToken);

            return ticket is null
                ? NotFound(
                    new
                    {
                        message =
                            "El ticket no existe."
                    })
                : Ok(ticket);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(
                new
                {
                    message =
                        ex.Message
                });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(
                new
                {
                    message =
                        ex.Message
                });
        }
    }

    // ============================================================
    // CLAIMS
    // ============================================================

    private Guid? GetOrganizationId()
    {
        var value =
            User.FindFirstValue(
                "organization_id")
            ??
            User.FindFirstValue(
                "organizationId");

        return Guid.TryParse(
            value,
            out var organizationId)
            ? organizationId
            : null;
    }

    private Guid? GetUserId()
    {
        var value =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier)
            ??
            User.FindFirstValue(
                "sub")
            ??
            User.FindFirstValue(
                "user_id")
            ??
            User.FindFirstValue(
                "userId");

        return Guid.TryParse(
            value,
            out var userId)
            ? userId
            : null;
    }

    private bool HasPermission(
        string permission)
    {
        return User.Claims.Any(
            claim =>
                claim.Type ==
                    "permission"
                &&
                string.Equals(
                    claim.Value,
                    permission,
                    StringComparison.OrdinalIgnoreCase));
    }

    private bool HasAnyPermission(
        params string[] permissions)
    {
        return permissions.Any(
            HasPermission);
    }
}