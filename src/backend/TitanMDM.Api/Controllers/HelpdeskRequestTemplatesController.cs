using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TitanMDM.Domain.Entities;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/my/helpdesk/templates")]
public sealed class HelpdeskRequestTemplatesController(
    TitanMdmDbContext db)
    : ControllerBase
{
    private bool Has(string code) =>
        User.Claims.Any(
            x =>
                x.Type == "permission" &&
                string.Equals(
                    x.Value,
                    code,
                    StringComparison.OrdinalIgnoreCase));

    private bool Manager =>
        Has("helpdesk.manage") ||
        Has("settings.manage");

    private async Task<(Guid Org, Guid User)?> Identity(
        CancellationToken cancellationToken)
    {
        var organizationClaim =
            User.FindFirstValue("organization_id") ??
            User.FindFirstValue("organizationId");

        var userClaim =
            User.FindFirstValue(ClaimTypes.NameIdentifier) ??
            User.FindFirstValue("sub") ??
            User.FindFirstValue("user_id") ??
            User.FindFirstValue("userId");

        if (!Guid.TryParse(
                organizationClaim,
                out var organizationId) ||
            !Guid.TryParse(
                userClaim,
                out var userId))
        {
            return null;
        }

        var valid = await db.Users
            .AsNoTracking()
            .AnyAsync(
                x =>
                    x.Id == userId &&
                    x.OrganizationId == organizationId &&
                    x.IsActive,
                cancellationToken);

        return valid
            ? (organizationId, userId)
            : null;
    }

    private static object View(
        HelpdeskRequestTemplate item) =>
        new
        {
            item.Id,
            item.Title,
            item.Description,
            item.Category,
            item.TicketType,
            item.IsActive,
            item.Revision,

            questions =
                JsonSerializer.Deserialize<string[]>(
                    item.QuestionsJson) ?? [],

            item.UpdatedAtUtc
        };

    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] bool all = false,
        CancellationToken cancellationToken = default)
    {
        if (!Manager &&
            !Has("tickets.create") &&
            !Has("tickets.view") &&
            !Has("helpdesk.view"))
        {
            return Forbid();
        }

        if (all && !Manager)
            return Forbid();

        var identity =
            await Identity(cancellationToken);

        if (identity is null)
            return Unauthorized();

        var query = db.Set<HelpdeskRequestTemplate>()
            .AsNoTracking()
            .Where(
                x =>
                    x.OrganizationId ==
                        identity.Value.Org);

        if (!all)
            query = query.Where(x => x.IsActive);

        var items = await query
            .OrderBy(x => x.Title)
            .ToListAsync(cancellationToken);

        return Ok(
            new
            {
                items = items.Select(View).ToArray(),
                canManage = Manager
            });
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] TemplateRequest request,
        CancellationToken cancellationToken)
    {
        if (!Manager)
            return Forbid();

        var identity =
            await Identity(cancellationToken);

        if (identity is null)
            return Unauthorized();

        var item = new HelpdeskRequestTemplate(
            identity.Value.Org,
            identity.Value.User);

        try
        {
            await Apply(
                item,
                request,
                identity.Value.User,
                cancellationToken);

            db.Set<HelpdeskRequestTemplate>().Add(item);

            await db.SaveChangesAsync(
                cancellationToken);

            return Ok(View(item));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(
                new { message = exception.Message });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] TemplateRequest request,
        CancellationToken cancellationToken)
    {
        if (!Manager)
            return Forbid();

        var identity =
            await Identity(cancellationToken);

        if (identity is null)
            return Unauthorized();

        var item = await db.Set<HelpdeskRequestTemplate>()
            .FirstOrDefaultAsync(
                x =>
                    x.Id == id &&
                    x.OrganizationId ==
                        identity.Value.Org,
                cancellationToken);

        if (item is null)
            return NotFound();

        if (request.Revision != item.Revision)
        {
            return Conflict(
                new
                {
                    message =
                        "La plantilla cambió. Actualiza el " +
                        "catálogo antes de editar nuevamente."
                });
        }

        try
        {
            await Apply(
                item,
                request,
                identity.Value.User,
                cancellationToken);

            await db.SaveChangesAsync(
                cancellationToken);

            return Ok(View(item));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(
                new { message = exception.Message });
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(
                new
                {
                    message =
                        "Otro administrador modificó la " +
                        "plantilla. Actualiza el catálogo."
                });
        }
    }

    private async Task Apply(
        HelpdeskRequestTemplate item,
        TemplateRequest request,
        Guid actorId,
        CancellationToken cancellationToken)
    {
        var category =
            (request.Category ?? "general")
                .Trim()
                .ToLowerInvariant();

        var configured = await db.HelpdeskTeams
            .AsNoTracking()
            .Where(
                x =>
                    x.OrganizationId ==
                        item.OrganizationId &&
                    x.IsActive)
            .Select(x => x.Categories)
            .ToListAsync(cancellationToken);

        var valid = configured
            .SelectMany(
                x =>
                    (x ?? "").Split(
                        '|',
                        StringSplitOptions.RemoveEmptyEntries |
                        StringSplitOptions.TrimEntries))
            .Append("general")
            .Any(
                x =>
                    string.Equals(
                        x,
                        category,
                        StringComparison.OrdinalIgnoreCase));

        if (!valid)
        {
            throw new ArgumentException(
                "La categoría no existe en los grupos " +
                "activos de esta organización.");
        }

        if (request.Questions is null ||
            request.Questions.Any(x => x is null))
        {
            throw new ArgumentException(
                "Indica las preguntas de la plantilla.");
        }

        item.Configure(
            request.Title ?? "",
            request.Description ?? "",
            category,
            request.TicketType ?? "incident",
            request.Questions,
            request.IsActive,
            actorId);
    }

    public sealed record TemplateRequest(
        string? Title,
        string? Description,
        string? Category,
        string? TicketType,
        string[]? Questions,
        bool IsActive,
        int? Revision);
}