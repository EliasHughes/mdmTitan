using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TitanMDM.Domain.Entities;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Api.Controllers;

[ApiController, Authorize]
[Route("api/helpdesk/closure")]
public sealed class HelpdeskClosureController(
    TitanMdmDbContext db,
    IConfiguration configuration) : ControllerBase
{
    private bool Has(string code) =>
        User.Claims.Any(x =>
            x.Type == "permission" &&
            string.Equals(
                x.Value, code,
                StringComparison.OrdinalIgnoreCase));

    private bool Manager =>
        Has("helpdesk.manage") || Has("settings.manage");

    private async Task<Guid?> Organization(CancellationToken ct)
    {
        var org =
            User.FindFirstValue("organization_id") ??
            User.FindFirstValue("organizationId");

        var actor =
            User.FindFirstValue(ClaimTypes.NameIdentifier) ??
            User.FindFirstValue("sub") ??
            User.FindFirstValue("user_id") ??
            User.FindFirstValue("userId");

        if (!Guid.TryParse(org, out var id) ||
            !Guid.TryParse(actor, out var userId))
            return null;

        return await db.Users.AsNoTracking().AnyAsync(
            x => x.Id == userId &&
                 x.OrganizationId == id && x.IsActive, ct)
            ? id : null;
    }

    [HttpGet("settings")]
    public async Task<IActionResult> Settings(CancellationToken ct)
    {
        if (!Manager) return Forbid();

        var org = await Organization(ct);
        if (org is null) return Unauthorized();

        var settings = await db.Set<HelpdeskAutomationSettings>()
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.OrganizationId == org.Value, ct)
            ?? new HelpdeskAutomationSettings(org.Value);

        return Ok(new
        {
            settings.ClassificationEnabled,
            settings.EscalationDelayMinutes,
            settings.ReopenDays,
            settings.Revision,

            modelConfigured =
                configuration.GetValue<bool>(
                    "HelpdeskAssistant:Enabled") &&
                !string.IsNullOrWhiteSpace(
                    configuration["HelpdeskAssistant:Model"])
        });
    }

    [HttpPut("settings")]
    public async Task<IActionResult> SaveSettings(
        [FromBody] SettingsRequest request,
        CancellationToken ct)
    {
        if (!Manager) return Forbid();

        var org = await Organization(ct);
        if (org is null) return Unauthorized();

        var item = await db.Set<HelpdeskAutomationSettings>()
            .FirstOrDefaultAsync(
                x => x.OrganizationId == org.Value, ct);

        if ((item?.Revision ?? 0) != request.Revision)
            return Conflict(new
            {
                message =
                    "La configuración cambió. Actualiza la pantalla."
            });

        if (item is null)
        {
            item = new HelpdeskAutomationSettings(org.Value);
            db.Add(item);
        }

        try
        {
            item.Configure(
                request.ClassificationEnabled,
                request.EscalationDelayMinutes,
                request.ReopenDays);

            await db.SaveChangesAsync(ct);
            return await Settings(ct);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (DbUpdateException)
        {
            return Conflict(new
            {
                message =
                    "No se guardó la configuración. " +
                    "Actualiza y vuelve a intentarlo."
            });
        }
    }

    [HttpGet("readiness")]
    public async Task<IActionResult> Readiness(CancellationToken ct)
    {
        if (!Manager) return Forbid();

        var org = await Organization(ct);
        if (org is null) return Unauthorized();

        return Ok(new
        {
            zones = await db.HelpdeskZones.CountAsync(
                x => x.OrganizationId == org.Value &&
                     x.IsActive, ct),

            groups = await db.HelpdeskTeams.CountAsync(
                x => x.OrganizationId == org.Value &&
                     x.IsActive, ct),

            availableMemberships =
                await db.HelpdeskTeamMembers.CountAsync(
                    x => x.OrganizationId == org.Value &&
                         x.IsAvailable &&
                         x.AcceptsAutomaticAssignments, ct),

            activeSchedules =
                await db.Set<HelpdeskTechnicianSchedule>()
                    .CountAsync(
                        x => x.OrganizationId == org.Value &&
                             x.IsEnabled, ct),

            activeTemplates =
                await db.Set<HelpdeskRequestTemplate>()
                    .CountAsync(
                        x => x.OrganizationId == org.Value &&
                             x.IsActive, ct),

            unlocatedUsers = await db.Users.CountAsync(
                x => x.OrganizationId == org.Value &&
                     x.IsActive &&
                     !db.HelpdeskUserZones.Any(z =>
                         z.OrganizationId == org.Value &&
                         z.UserId == x.Id), ct),

            assistantUsers =
                await db.HelpdeskAssistantAccess.CountAsync(
                    x => x.OrganizationId == org.Value &&
                         x.IsEnabled, ct)
        });
    }

    [HttpGet("analytics")]
    public async Task<IActionResult> Analytics(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken ct)
    {
        if (!Manager && !Has("helpdesk.view"))
            return Forbid();

        if (from.HasValue && to.HasValue &&
            from.Value.Date > to.Value.Date)
            return BadRequest(new
            {
                message = "El inicio debe ser anterior al fin."
            });

        if (to.HasValue &&
            to.Value.Date >= DateTime.MaxValue.Date)
            return BadRequest();

        var org = await Organization(ct);
        if (org is null) return Unauthorized();

        var query = db.HelpdeskTickets.AsNoTracking()
            .Where(x => x.OrganizationId == org.Value);

        if (from.HasValue)
        {
            var start = from.Value.Date;
            query = query.Where(x => x.CreatedAtUtc >= start);
        }

        if (to.HasValue)
        {
            var end = to.Value.Date.AddDays(1);
            query = query.Where(x => x.CreatedAtUtc < end);
        }

        var now = DateTime.UtcNow;
        var total = await query.CountAsync(ct);

        var resolved = await query.CountAsync(
            x => x.Status == "resolved" ||
                 x.Status == "closed", ct);

        var first = await query
            .Where(x => x.FirstRespondedAtUtc != null)
            .Select(x => (double?)
                (EF.Functions.DateDiffSecond(
                    x.CreatedAtUtc,
                    x.FirstRespondedAtUtc!.Value)
                 - x.FirstResponsePausedSeconds) / 3600)
            .AverageAsync(ct);

        var resolution = await query
            .Where(x => x.ResolvedAtUtc != null)
            .Select(x => (double?)
                (EF.Functions.DateDiffSecond(
                    x.CreatedAtUtc, x.ResolvedAtUtc!.Value)
                 - x.TotalSlaPausedSeconds) / 3600)
            .AverageAsync(ct);

        var requesterCounts = await query
            .GroupBy(x => x.RequesterUserId)
            .Select(g => new
            {
                UserId = g.Key,
                Count = g.Count()
            })
            .ToListAsync(ct);

        var locations = await (
            from membership in db.HelpdeskUserZones.AsNoTracking()
            join zone in db.HelpdeskZones.AsNoTracking()
                on membership.ZoneId equals zone.Id
            where membership.OrganizationId == org.Value &&
                  zone.OrganizationId == org.Value &&
                  zone.IsActive
            select new
            {
                membership.UserId,
                zone.Id,
                zone.Name
            }).ToListAsync(ct);

        var locationNames = locations
            .GroupBy(x => x.UserId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(x => x.Id).Distinct().Count() == 1
                    ? g.First().Name
                    : "Ubicación ambigua");

        var byZone = requesterCounts
            .GroupBy(x => locationNames.GetValueOrDefault(
                x.UserId, "Sin ubicación activa"))
            .Select(g => new
            {
                label = g.Key,
                count = g.Sum(x => x.Count)
            })
            .OrderByDescending(x => x.count)
            .ToArray();

        var agentCounts = await query
            .GroupBy(x => x.AssigneeUserId)
            .Select(g => new
            {
                UserId = g.Key,
                Count = g.Count()
            })
            .ToListAsync(ct);

        var users = await db.Users.AsNoTracking()
            .Where(x => x.OrganizationId == org.Value)
            .ToDictionaryAsync(
                x => x.Id,
                x => x.FirstName + " " + x.LastName, ct);

        var byAgent = agentCounts.Select(x => new
        {
            label = x.UserId.HasValue
                ? users.GetValueOrDefault(
                    x.UserId.Value, "Técnico no disponible")
                : "Sin técnico",
            count = x.Count
        }).ToArray();

        var since = now.AddHours(-24);

        return Ok(new
        {
            total,
            resolved,
            active = total - resolved,
            byZone,
            byAgent,

            paused = await query.CountAsync(
                x => x.Status == "pendinguser", ct),

            unassigned = await query.CountAsync(
                x => x.AssigneeUserId == null &&
                     x.Status != "resolved" &&
                     x.Status != "closed", ct),

            firstOverdue = await query.CountAsync(
                x => x.FirstRespondedAtUtc == null &&
                     x.FirstResponseDueAtUtc <= now &&
                     x.Status != "resolved" &&
                     x.Status != "closed", ct),

            resolutionOverdue = await query.CountAsync(
                x => x.ResolveDueAtUtc <= now &&
                     x.Status != "resolved" &&
                     x.Status != "closed", ct),

            averageFirstResponseHours = first,
            averageResolutionHours = resolution,

            escalations24h =
                await db.HelpdeskTicketEvents.CountAsync(
                    x => x.OrganizationId == org.Value &&
                         x.EventType == "sla_escalated" &&
                         x.CreatedAtUtc >= since, ct),

            byStatus = await query.GroupBy(x => x.Status)
                .Select(g => new
                {
                    label = g.Key,
                    count = g.Count()
                }).ToListAsync(ct),

            byCategory = await query.GroupBy(x => x.Category)
                .Select(g => new
                {
                    label = g.Key,
                    count = g.Count()
                })
                .OrderByDescending(x => x.count)
                .ToListAsync(ct),

            daily = await query.GroupBy(x => x.CreatedAtUtc.Date)
                .Select(g => new
                {
                    date = g.Key,
                    count = g.Count()
                })
                .OrderBy(x => x.date)
                .ToListAsync(ct),

            alerts = await (
                from activity in
                    db.HelpdeskTicketEvents.AsNoTracking()
                join ticket in query
                    on activity.TicketId equals ticket.Id
                where activity.OrganizationId == org.Value &&
                      activity.CreatedAtUtc >= since &&
                      (
                          activity.EventType == "sla_escalated" ||
                          activity.EventType == "classification_review" ||
                          activity.EventType == "auto_classified" ||
                          activity.EventType == "auto_handover"
                      )
                orderby activity.CreatedAtUtc descending
                select new
                {
                    activity.Id,
                    activity.TicketId,
                    ticket.Number,
                    activity.EventType,
                    activity.Summary,
                    activity.CreatedAtUtc
                }).Take(100).ToListAsync(ct),

            generatedAtUtc = now
        });
    }

    public sealed record SettingsRequest(
        bool ClassificationEnabled,
        int EscalationDelayMinutes,
        int ReopenDays,
        int Revision);
}