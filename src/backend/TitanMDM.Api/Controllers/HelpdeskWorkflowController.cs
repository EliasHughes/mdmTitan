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
[Route("api/helpdesk/workflow")]
public sealed class HelpdeskWorkflowController : ControllerBase
{
    private readonly TitanMdmDbContext _db;
    private readonly IHelpdeskService _tickets;

    public HelpdeskWorkflowController(
        TitanMdmDbContext db,
        IHelpdeskService tickets)
    {
        _db = db;
        _tickets = tickets;
    }

    private Guid? OrganizationId =>
        Guid.TryParse(
            User.FindFirstValue("organization_id")
            ?? User.FindFirstValue("organizationId"),
            out var id) ? id : null;

    private Guid? UserId =>
        Guid.TryParse(
            User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")
            ?? User.FindFirstValue("user_id")
            ?? User.FindFirstValue("userId"),
            out var id) ? id : null;

    private bool Has(string permission) =>
        User.Claims.Any(x =>
            x.Type == "permission" &&
            string.Equals(x.Value, permission, StringComparison.OrdinalIgnoreCase));

    private bool CanManage => Has("helpdesk.manage") || Has("settings.manage");
    private bool CanWorkTickets => Has("helpdesk.view") || Has("tickets.view");

    [HttpGet("configuration")]
    public async Task<IActionResult> Configuration(CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        if (OrganizationId is not Guid org) return Unauthorized();

        var zones = await _db.HelpdeskZones.AsNoTracking()
            .Where(x => x.OrganizationId == org)
            .OrderBy(x => x.Name)
            .Select(x => new {
                x.Id, x.Name, x.Type, x.ParentZoneId, x.IsActive
            }).ToListAsync(ct);

        var teams = await _db.HelpdeskTeams.AsNoTracking()
            .Where(x => x.OrganizationId == org)
            .OrderBy(x => x.Name)
            .Select(x => new {
                x.Id, x.Name, x.Description, x.IsActive
            }).ToListAsync(ct);

        var coverage = await _db.HelpdeskTeamZones.AsNoTracking()
            .Where(x => x.OrganizationId == org)
            .Select(x => new { x.Id, x.TeamId, x.ZoneId })
            .ToListAsync(ct);

        var members = await _db.HelpdeskTeamMembers.AsNoTracking()
            .Where(x => x.OrganizationId == org)
            .Select(x => new {
                x.Id, x.TeamId, x.UserId,
                x.IsAvailable, x.AcceptsAutomaticAssignments,
                x.MaxOpenTickets
            }).ToListAsync(ct);

        var userZones = await _db.HelpdeskUserZones.AsNoTracking()
            .Where(x => x.OrganizationId == org)
            .Select(x => new { x.Id, x.UserId, x.ZoneId })
            .ToListAsync(ct);

        var users = await _db.Users.AsNoTracking()
            .Where(x => x.OrganizationId == org && x.IsActive)
            .OrderBy(x => x.FirstName)
            .Select(x => new {
                x.Id, x.FirstName, x.LastName, x.Email
            }).ToListAsync(ct);

        return Ok(new { zones, teams, coverage, members, userZones, users });
    }

    public sealed record ZoneRequest(
        string Name, string Type, Guid? ParentZoneId);

    [HttpPost("zones")]
    public async Task<IActionResult> AddZone(
        ZoneRequest request, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        if (OrganizationId is not Guid org) return Unauthorized();

        if (request.ParentZoneId is Guid parent &&
            !await _db.HelpdeskZones.AnyAsync(
                x => x.OrganizationId == org && x.Id == parent && x.IsActive, ct))
            return BadRequest(new { message = "La zona padre no existe o está inactiva." });

        try
        {
            var zone = new HelpdeskZone(
                org, request.Name, request.Type, request.ParentZoneId);
            _db.HelpdeskZones.Add(zone);
            await _db.SaveChangesAsync(ct);
            return Ok(new { zone.Id });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    public sealed record TeamRequest(string Name, string? Description);

    [HttpPost("teams")]
    public async Task<IActionResult> AddTeam(
        TeamRequest request, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        if (OrganizationId is not Guid org) return Unauthorized();

        try
        {
            var team = new HelpdeskTeam(org, request.Name, request.Description);
            _db.HelpdeskTeams.Add(team);
            await _db.SaveChangesAsync(ct);
            return Ok(new { team.Id });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    public sealed record CoverageRequest(Guid TeamId, Guid ZoneId);

    [HttpPost("coverage")]
    public async Task<IActionResult> AddCoverage(
        CoverageRequest request, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        if (OrganizationId is not Guid org) return Unauthorized();

        var team = await _db.HelpdeskTeams.AnyAsync(
            x => x.OrganizationId == org && x.Id == request.TeamId && x.IsActive, ct);
        var zone = await _db.HelpdeskZones.AnyAsync(
            x => x.OrganizationId == org && x.Id == request.ZoneId && x.IsActive, ct);

        if (!team || !zone)
            return BadRequest(new { message = "Grupo o zona inexistente o inactiva." });

        var exists = await _db.HelpdeskTeamZones.AnyAsync(
            x => x.OrganizationId == org &&
                 x.TeamId == request.TeamId &&
                 x.ZoneId == request.ZoneId, ct);

        if (!exists)
        {
            _db.HelpdeskTeamZones.Add(
                new HelpdeskTeamZone(org, request.TeamId, request.ZoneId));
            await _db.SaveChangesAsync(ct);
        }

        return Ok(new { message = "Cobertura registrada." });
    }

    public sealed record MemberRequest(
        Guid TeamId,
        Guid UserId,
        bool AcceptsAutomaticAssignments,
        bool IsAvailable,
        int MaxOpenTickets);

    [HttpPost("members")]
    public async Task<IActionResult> SaveMember(
        MemberRequest request, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        if (OrganizationId is not Guid org) return Unauthorized();

        if (request.MaxOpenTickets < 1 || request.MaxOpenTickets > 200)
            return BadRequest(new { message = "La capacidad debe estar entre 1 y 200." });

        var team = await _db.HelpdeskTeams.AnyAsync(
            x => x.OrganizationId == org && x.Id == request.TeamId && x.IsActive, ct);
        var user = await _db.Users.AnyAsync(
            x => x.OrganizationId == org && x.Id == request.UserId && x.IsActive, ct);

        if (!team || !user)
            return BadRequest(new { message = "Grupo o usuario inexistente o inactivo." });

        var member = await _db.HelpdeskTeamMembers.FirstOrDefaultAsync(
            x => x.OrganizationId == org &&
                 x.TeamId == request.TeamId &&
                 x.UserId == request.UserId, ct);

        if (member is null)
        {
            member = new HelpdeskTeamMember(
                org, request.TeamId, request.UserId,
                request.AcceptsAutomaticAssignments,
                request.MaxOpenTickets);
            _db.HelpdeskTeamMembers.Add(member);
        }
        else
        {
            member.ConfigureAutomaticAssignments(
                request.AcceptsAutomaticAssignments,
                request.MaxOpenTickets);
        }

        member.SetAvailability(request.IsAvailable);
        await _db.SaveChangesAsync(ct);
        return Ok(new { member.Id });
    }

    public sealed record UserZoneRequest(Guid UserId, Guid ZoneId);

    [HttpPost("user-zones")]
    public async Task<IActionResult> AddUserZone(
        UserZoneRequest request, CancellationToken ct)
    {
        if (!CanManage) return Forbid();
        if (OrganizationId is not Guid org) return Unauthorized();

        var user = await _db.Users.AnyAsync(
            x => x.OrganizationId == org && x.Id == request.UserId && x.IsActive, ct);
        var zone = await _db.HelpdeskZones.AnyAsync(
            x => x.OrganizationId == org && x.Id == request.ZoneId && x.IsActive, ct);

        if (!user || !zone)
            return BadRequest(new { message = "Usuario o zona inexistente o inactiva." });

        var exists = await _db.HelpdeskUserZones.AnyAsync(
            x => x.OrganizationId == org &&
                 x.UserId == request.UserId &&
                 x.ZoneId == request.ZoneId, ct);

        if (!exists)
        {
            _db.HelpdeskUserZones.Add(
                new HelpdeskUserZone(org, request.UserId, request.ZoneId));
            await _db.SaveChangesAsync(ct);
        }

        return Ok(new { message = "Ubicación registrada." });
    }

    [HttpGet("my-tickets")]
    public async Task<IActionResult> MyTickets(CancellationToken ct)
    {
        if (OrganizationId is not Guid org || UserId is not Guid user)
            return Unauthorized();

        var items = await _db.HelpdeskTickets.AsNoTracking()
            .Where(x => x.OrganizationId == org && x.RequesterUserId == user)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(100)
            .Select(x => new {
                x.Id, x.Number, x.Subject, x.Status,
                x.Priority, x.Category, x.CreatedAtUtc,
                x.UpdatedAtUtc, x.ResolveDueAtUtc
            }).ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("my-tickets/{ticketId:guid}")]
    public async Task<IActionResult> MyTicket(
        Guid ticketId, CancellationToken ct)
    {
        if (OrganizationId is not Guid org || UserId is not Guid user)
            return Unauthorized();

        var isOwner = await _db.HelpdeskTickets.AsNoTracking().AnyAsync(
            x => x.Id == ticketId &&
                 x.OrganizationId == org &&
                 x.RequesterUserId == user, ct);

        if (!isOwner) return NotFound();

        var ticket = await _tickets.GetTicketAsync(org, ticketId, ct);
        if (ticket is null) return NotFound();

        return Ok(ticket with
        {
            Comments = ticket.Comments.Where(x => !x.IsInternal).ToList(),
            Timeline = ticket.Timeline
                .Where(x => x.EventType != "internal_note")
                .ToList()
        });
    }

    public sealed record PublicReplyRequest(string Body);

    [HttpPost("my-tickets/{ticketId:guid}/reply")]
    public async Task<IActionResult> PublicReply(
        Guid ticketId, PublicReplyRequest request, CancellationToken ct)
    {
        if (OrganizationId is not Guid org || UserId is not Guid user)
            return Unauthorized();

        var isOwner = await _db.HelpdeskTickets.AnyAsync(
            x => x.Id == ticketId &&
                 x.OrganizationId == org &&
                 x.RequesterUserId == user, ct);

        if (!isOwner) return NotFound();

        if (string.IsNullOrWhiteSpace(request.Body) || request.Body.Length > 5000)
            return BadRequest(new { message = "Escribe una respuesta de hasta 5000 caracteres." });

        await _tickets.AddCommentAsync(
            org, ticketId, user,
            new AddHelpdeskCommentRequest(request.Body, false), ct);

        return Ok(new { message = "Respuesta enviada." });
    }

    [HttpPost("my-tickets")]
    public async Task<IActionResult> CreateMyTicket(
        CreateHelpdeskTicketRequest request, CancellationToken ct)
    {
        if (OrganizationId is not Guid org || UserId is not Guid user)
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.Subject) ||
            string.IsNullOrWhiteSpace(request.Description) ||
            request.Subject.Length > 200 ||
            request.Description.Length > 10000)
            return BadRequest(new { message = "Asunto o descripción no válidos." });

        // Se ignoran RequesterUserId y EntraObjectId enviados por el navegador.
        var ownRequest = request with
        {
            RequesterUserId = null,
            EntraObjectId = null,
            Source = "portal"
        };

        var created = await _tickets.CreateTicketAsync(
            org, user, ownRequest, ct);

        return Ok(created);
    }

    [HttpGet("overview")]
    public async Task<IActionResult> Overview(CancellationToken ct)
    {
        if (!CanWorkTickets) return Forbid();
        if (OrganizationId is not Guid org) return Unauthorized();

        var now = DateTime.UtcNow;
        var since = now.AddDays(-30);

        var tickets = await _db.HelpdeskTickets.AsNoTracking()
            .Where(x => x.OrganizationId == org)
            .Select(x => new {
                x.Id, x.Number, x.Subject, x.Status, x.Priority,
                x.AssigneeUserId, x.CreatedAtUtc,
                x.FirstRespondedAtUtc, x.FirstResponseDueAtUtc,
                x.ResolvedAtUtc, x.ResolveDueAtUtc
            }).ToListAsync(ct);

        var active = tickets.Where(x => x.Status is not ("resolved" or "closed")).ToList();

        var alerts = active
            .Where(x =>
                x.AssigneeUserId == null ||
                (x.FirstRespondedAtUtc == null &&
                 x.FirstResponseDueAtUtc < now) ||
                (x.ResolvedAtUtc == null &&
                 x.ResolveDueAtUtc < now))
            .OrderBy(x => x.ResolveDueAtUtc)
            .Take(30)
            .Select(x => new {
                x.Id, x.Number, x.Subject, x.Priority,
                x.CreatedAtUtc, x.ResolveDueAtUtc,
                Reason = x.AssigneeUserId == null
                    ? "Sin asignar"
                    : x.ResolveDueAtUtc < now
                        ? "Resolución vencida"
                        : "Primera respuesta vencida"
            }).ToList();

        return Ok(new
        {
            total = tickets.Count,
            active = active.Count,
            unassigned = active.Count(x => x.AssigneeUserId == null),
            breached = active.Count(x =>
                (x.FirstRespondedAtUtc == null &&
                 x.FirstResponseDueAtUtc < now) ||
                (x.ResolvedAtUtc == null &&
                 x.ResolveDueAtUtc < now)),
            createdLast30Days = tickets.Count(x => x.CreatedAtUtc >= since),
            byStatus = tickets.GroupBy(x => x.Status)
                .Select(x => new { name = x.Key, value = x.Count() }),
            byPriority = tickets.GroupBy(x => x.Priority)
                .Select(x => new { name = x.Key, value = x.Count() }),
            alerts
        });
    }
}