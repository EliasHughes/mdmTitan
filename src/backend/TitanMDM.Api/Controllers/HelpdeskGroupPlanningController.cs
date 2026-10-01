using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TitanMDM.Domain.Entities;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/helpdesk/group-planning")]
public sealed class HelpdeskGroupPlanningController : ControllerBase
{
    private readonly TitanMdmDbContext _db;

    public HelpdeskGroupPlanningController(TitanMdmDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if (!CanManage())
            return Forbid();

        if (!Organization(out var org))
            return Unauthorized();

        var teams = await _db.HelpdeskTeams
            .AsNoTracking()
            .Where(x => x.OrganizationId == org)
            .OrderBy(x => x.Name)
            .ToListAsync(ct);

        var zones = await _db.HelpdeskZones
            .AsNoTracking()
            .Where(x => x.OrganizationId == org && x.IsActive)
            .OrderBy(x => x.Name)
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.Type,
                x.ParentZoneId
            })
            .ToListAsync(ct);

        var coverage = await _db.HelpdeskTeamZones
            .AsNoTracking()
            .Where(x => x.OrganizationId == org)
            .ToListAsync(ct);

        var members = await _db.HelpdeskTeamMembers
            .AsNoTracking()
            .Where(x => x.OrganizationId == org)
            .ToListAsync(ct);

        var schedules = await _db.Set<HelpdeskTechnicianSchedule>()
            .AsNoTracking()
            .Where(x => x.OrganizationId == org)
            .ToListAsync(ct);

        var eligible = await Eligible(org).ToListAsync(ct);

        var users = await _db.Users
            .AsNoTracking()
            .Where(x => x.OrganizationId == org && x.IsActive)
            .OrderBy(x => x.FirstName)
            .Select(x => new
            {
                x.Id,
                name = x.FirstName + " " + x.LastName,
                x.Email
            })
            .ToListAsync(ct);

        var locations = await _db.HelpdeskUserZones
            .AsNoTracking()
            .Where(x => x.OrganizationId == org)
            .Select(x => new { x.UserId, x.ZoneId })
            .ToListAsync(ct);

        return Ok(new
        {
            zones,

            users = users.Select(x => new
            {
                x.Id,
                x.name,
                x.Email,
                eligible = eligible.Contains(x.Id),

                zoneIds = locations
                    .Where(location => location.UserId == x.Id)
                    .Select(location => location.ZoneId)
                    .ToArray()
            }),

            groups = teams.Select(team => new
            {
                team.Id,
                team.Name,
                team.Description,
                team.IsActive,

                tasks = Parse(team.Categories),

                zoneIds = coverage
                    .Where(x => x.TeamId == team.Id)
                    .Select(x => x.ZoneId)
                    .ToArray(),

                technicians = members
                    .Where(x => x.TeamId == team.Id)
                    .Select(member =>
                    {
                        var schedule = schedules.FirstOrDefault(x =>
                            x.TeamId == team.Id &&
                            x.UserId == member.UserId);

                        return new
                        {
                            member.UserId,
                            member.IsAvailable,
                            member.AcceptsAutomaticAssignments,
                            member.MaxOpenTickets,

                            priority = schedule?.Priority ?? 1,

                            timeZoneId = schedule?.TimeZoneId
                                ?? "America/Santo_Domingo",

                            slots = schedule?.GetSlots()
                                ?? Array.Empty<HelpdeskWeeklySlot>(),

                            configured = schedule is not null,

                            onDuty = schedule?.IsOnDuty(DateTime.UtcNow)
                                ?? false
                        };
                    })
                    .OrderBy(x => x.priority)
                    .ToArray()
            })
        });
    }

    [HttpPost("groups")]
    public async Task<IActionResult> Create(
        [FromBody] CreateGroupRequest request,
        CancellationToken ct)
    {
        if (!CanManage())
            return Forbid();

        if (!Organization(out var org))
            return Unauthorized();

        var name = request.Name?.Trim() ?? "";

        if (name.Length is < 1 or > 120 ||
            (request.Description?.Length ?? 0) > 500)
        {
            return BadRequest(new
            {
                message =
                    "Nombre obligatorio de hasta 120 caracteres; " +
                    "descripción de hasta 500."
            });
        }

        if (await _db.HelpdeskTeams.AnyAsync(
                x => x.OrganizationId == org && x.Name == name,
                ct))
        {
            return Conflict(new
            {
                message = "Ya existe un grupo con ese nombre."
            });
        }

        var team = new HelpdeskTeam(org, name, request.Description);

        _db.HelpdeskTeams.Add(team);
        await _db.SaveChangesAsync(ct);

        return Ok(new { team.Id, team.Name });
    }

    [HttpPut("groups/{teamId:guid}")]
    public async Task<IActionResult> Save(
        Guid teamId,
        [FromBody] SaveGroupRequest request,
        CancellationToken ct)
    {
        if (!CanManage())
            return Forbid();

        if (!Organization(out var org))
            return Unauthorized();

        if (request.Tasks is null ||
            request.ZoneIds is null ||
            request.Technicians is null)
        {
            return BadRequest(new
            {
                message = "Envía tareas, zonas y técnicos."
            });
        }

        if (request.Technicians.Length > 100 ||
            request.Technicians.Select(x => x.UserId)
                .Distinct().Count() != request.Technicians.Length)
        {
            return BadRequest(new
            {
                message = "Admite hasta 100 técnicos sin duplicados."
            });
        }

        var team = await _db.HelpdeskTeams.FirstOrDefaultAsync(
            x => x.Id == teamId && x.OrganizationId == org,
            ct);

        if (team is null)
            return NotFound();

        var zoneIds = request.ZoneIds.Distinct().ToArray();

        var validZoneCount = await _db.HelpdeskZones.CountAsync(
            x => x.OrganizationId == org &&
                 x.IsActive &&
                 zoneIds.Contains(x.Id),
            ct);

        if (validZoneCount != zoneIds.Length)
        {
            return BadRequest(new
            {
                message = "Hay zonas inexistentes o inactivas."
            });
        }

        var ids = request.Technicians
            .Select(x => x.UserId)
            .ToArray();

        var eligible = await Eligible(org)
            .Where(x => ids.Contains(x))
            .ToListAsync(ct);

        if (eligible.Count != ids.Length)
        {
            return BadRequest(new
            {
                message =
                    "Cada técnico necesita una cuenta activa " +
                    "y permiso tickets.comment."
            });
        }

        var profiles =
            new Dictionary<Guid, HelpdeskTechnicianSchedule>();

        try
        {
            team.ConfigureCategories(request.Tasks);

            foreach (var technician in request.Technicians)
            {
                if (technician.MaxOpenTickets is < 1 or > 500 ||
                    technician.Slots is null)
                {
                    throw new ArgumentException(
                        "Indica un límite de 1–500 tickets " +
                        "y el horario de cada técnico.");
                }

                var profile = new HelpdeskTechnicianSchedule(
                    org,
                    teamId,
                    technician.UserId);

                profile.Configure(
                    technician.Priority,
                    technician.AcceptsAutomaticAssignments,
                    technician.TimeZoneId,
                    technician.Slots);

                profiles.Add(technician.UserId, profile);
            }
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        var existingCoverage = await _db.HelpdeskTeamZones
            .Where(x => x.OrganizationId == org && x.TeamId == teamId)
            .ToListAsync(ct);

        _db.HelpdeskTeamZones.RemoveRange(
            existingCoverage.Where(x => !zoneIds.Contains(x.ZoneId)));

        foreach (var zoneId in zoneIds.Where(
                     id => existingCoverage.All(x => x.ZoneId != id)))
        {
            _db.HelpdeskTeamZones.Add(
                new HelpdeskTeamZone(org, teamId, zoneId));
        }

        var members = await _db.HelpdeskTeamMembers
            .Where(x => x.OrganizationId == org && x.TeamId == teamId)
            .ToListAsync(ct);

        var schedules = await _db.Set<HelpdeskTechnicianSchedule>()
            .Where(x => x.OrganizationId == org && x.TeamId == teamId)
            .ToListAsync(ct);

        _db.HelpdeskTeamMembers.RemoveRange(
            members.Where(x => !ids.Contains(x.UserId)));

        _db.Set<HelpdeskTechnicianSchedule>().RemoveRange(
            schedules.Where(x => !ids.Contains(x.UserId)));

        foreach (var technician in request.Technicians)
        {
            var member = members.FirstOrDefault(
                x => x.UserId == technician.UserId);

            if (member is null)
            {
                member = new HelpdeskTeamMember(
                    org,
                    teamId,
                    technician.UserId,
                    technician.AcceptsAutomaticAssignments,
                    technician.MaxOpenTickets);

                _db.HelpdeskTeamMembers.Add(member);
            }
            else
            {
                member.ConfigureAutomaticAssignments(
                    technician.AcceptsAutomaticAssignments,
                    technician.MaxOpenTickets);
            }

            member.SetAvailability(technician.IsAvailable);

            var schedule = schedules.FirstOrDefault(
                x => x.UserId == technician.UserId);

            if (schedule is null)
            {
                _db.Set<HelpdeskTechnicianSchedule>()
                    .Add(profiles[technician.UserId]);
            }
            else
            {
                schedule.Configure(
                    technician.Priority,
                    technician.AcceptsAutomaticAssignments,
                    technician.TimeZoneId,
                    technician.Slots!);
            }
        }

        // EF Core guarda todas estas modificaciones dentro
        // de la transacción automática de SaveChanges.
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            message =
                "Grupo, tareas, cobertura, técnicos y horarios guardados."
        });
    }

    private IQueryable<Guid> Eligible(Guid org) =>
        (from ur in _db.UserRoles.AsNoTracking()
         join rp in _db.RolePermissions.AsNoTracking()
             on ur.RoleId equals rp.RoleId
         join permission in _db.Permissions.AsNoTracking()
             on rp.PermissionId equals permission.Id
         join user in _db.Users.AsNoTracking()
             on ur.UserId equals user.Id
         where user.OrganizationId == org &&
               user.IsActive &&
               permission.IsActive &&
               permission.Code == "tickets.comment"
         select user.Id).Distinct();

    private static string[] Parse(string? value) =>
        (value ?? "").Split(
            '|',
            StringSplitOptions.RemoveEmptyEntries |
            StringSplitOptions.TrimEntries);

    private bool CanManage() => User.Claims.Any(x =>
        x.Type == "permission" &&
        (string.Equals(
             x.Value,
             "helpdesk.manage",
             StringComparison.OrdinalIgnoreCase) ||
         string.Equals(
             x.Value,
             "settings.manage",
             StringComparison.OrdinalIgnoreCase)));

    private bool Organization(out Guid id) =>
        Guid.TryParse(
            User.FindFirstValue("organization_id") ??
            User.FindFirstValue("organizationId"),
            out id);

    public sealed record CreateGroupRequest(
        string Name,
        string? Description);

    public sealed record SaveGroupRequest(
        string[] Tasks,
        Guid[] ZoneIds,
        TechnicianRequest[] Technicians);

    public sealed record TechnicianRequest(
        Guid UserId,
        bool IsAvailable,
        bool AcceptsAutomaticAssignments,
        int MaxOpenTickets,
        int Priority,
        string TimeZoneId,
        HelpdeskWeeklySlot[]? Slots);
}