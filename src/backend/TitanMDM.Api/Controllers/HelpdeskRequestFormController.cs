using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TitanMDM.Application.Helpdesk;
using TitanMDM.Infrastructure.Helpdesk;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Api.Controllers;

[ApiController, Authorize]
[Route("api/my/helpdesk/request-form")]
public sealed class HelpdeskRequestFormController(
    TitanMdmDbContext db,
    IHelpdeskService helpdesk) : ControllerBase
{
    [HttpGet("groups")]
    public async Task<IActionResult> Groups(CancellationToken ct)
    {
        if (!Identity(out var org, out var actor))
            return Unauthorized();

        if (!await db.Users.AnyAsync(x =>
            x.Id == actor &&
            x.OrganizationId == org &&
            x.IsActive, ct))
        {
            return Forbid();
        }

        var groups = await db.HelpdeskTeams.AsNoTracking()
            .Where(x => x.OrganizationId == org && x.IsActive)
            .OrderBy(x => x.Name)
            .ToListAsync(ct);

        return Ok(groups.Select(x => new
        {
            x.Id,
            x.Name,
            categories = (x.Categories ?? "").Split(
                '|',
                StringSplitOptions.RemoveEmptyEntries |
                StringSplitOptions.TrimEntries)
        }));
    }

    [HttpPost("tickets")]
    public async Task<IActionResult> Create(
        CreateRequest request,
        CancellationToken ct)
    {
        if (!Identity(out var org, out var actor))
            return Unauthorized();

        if (!Has("tickets.create"))
            return Forbid();

        if (helpdesk is not HelpdeskService service)
        {
            return Problem(
                "El servicio de Helpdesk no admite solicitudes por grupo.");
        }

        try
        {
            var id = await service.CreateGroupedRequestAsync(
                org,
                actor,
                request.GroupId,
                request.Subject,
                request.Description,
                request.Type,
                request.Category,
                request.Console &&
                    (Has("helpdesk.view") ||
                     Has("tickets.comment") ||
                     Has("helpdesk.manage")),
                ct);

            return Ok(new { id });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("groups/{groupId:guid}")]
    public async Task<IActionResult> Delete(
        Guid groupId,
        CancellationToken ct)
    {
        if (!Identity(out var org, out var actor))
            return Unauthorized();

        if (!Has("helpdesk.manage") && !Has("settings.manage"))
            return Forbid();

        if (!await db.Users.AnyAsync(x =>
            x.Id == actor &&
            x.OrganizationId == org &&
            x.IsActive, ct))
        {
            return Forbid();
        }

        var group = await db.HelpdeskTeams.FirstOrDefaultAsync(x =>
            x.Id == groupId &&
            x.OrganizationId == org, ct);

        if (group is null)
            return NotFound();

        // Eliminación lógica: conserva tickets y grupo histórico.
        group.SetActive(false);

        await db.SaveChangesAsync(ct);

        return Ok(new
        {
            message =
                "Grupo eliminado de los disponibles. " +
                "Se conserva el historial de tickets."
        });
    }

    private bool Has(string code) => User.Claims.Any(x =>
        x.Type == "permission" &&
        string.Equals(
            x.Value,
            code,
            StringComparison.OrdinalIgnoreCase));

    private bool Identity(out Guid org, out Guid actor)
    {
        var organization = Guid.TryParse(
            User.FindFirstValue("organization_id") ??
            User.FindFirstValue("organizationId"),
            out org);

        var person = Guid.TryParse(
            User.FindFirstValue(ClaimTypes.NameIdentifier) ??
            User.FindFirstValue("sub") ??
            User.FindFirstValue("user_id") ??
            User.FindFirstValue("userId"),
            out actor);

        return organization && person;
    }

    public sealed record CreateRequest(
        Guid GroupId,
        string Subject,
        string Description,
        string Type,
        string Category,
        bool Console = false);
}