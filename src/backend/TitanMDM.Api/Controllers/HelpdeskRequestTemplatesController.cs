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
    private bool Has(
        string permission)
    {
        return User.Claims.Any(
            claim =>
                claim.Type == "permission"
                &&
                string.Equals(
                    claim.Value,
                    permission,
                    StringComparison.OrdinalIgnoreCase));
    }

    private bool CanManage =>
        Has("helpdesk.templates.manage")
        ||
        Has("helpdesk.admin.access")
        ||
        Has("helpdesk.manage")
        ||
        Has("settings.manage");

    private bool CanView =>
        CanManage
        ||
        Has("helpdesk.templates.view")
        ||
        Has("helpdesk.request.create")
        ||
        Has("tickets.create")
        ||
        Has("tickets.view")
        ||
        Has("helpdesk.view");

    private async Task<(Guid Org, Guid User)?>
        Identity(
            CancellationToken cancellationToken)
    {
        var organizationClaim =
            User.FindFirstValue(
                "organization_id")
            ??
            User.FindFirstValue(
                "organizationId");

        var userClaim =
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

        if (!Guid.TryParse(
                organizationClaim,
                out var organizationId)
            ||
            !Guid.TryParse(
                userClaim,
                out var userId))
        {
            return null;
        }

        var valid =
            await db.Users
                .AsNoTracking()
                .AnyAsync(
                    x =>
                        x.OrganizationId ==
                            organizationId
                        &&
                        x.Id ==
                            userId
                        &&
                        x.IsActive,
                    cancellationToken);

        return valid
            ? (
                organizationId,
                userId
            )
            : null;
    }

    private static object View(
        HelpdeskRequestTemplate item)
    {
        return new
        {
            item.Id,
            item.Title,
            item.Description,
            item.Category,
            item.TicketType,
            item.IsActive,
            item.Revision,

            questions =
                JsonSerializer
                    .Deserialize<string[]>(
                        item.QuestionsJson)
                ??
                [],

            item.UpdatedAtUtc
        };
    }

    // ============================================================
    // LIST
    // ============================================================

    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery]
        bool all = false,

        CancellationToken cancellationToken = default)
    {
        if (!CanView)
        {
            return Forbid();
        }

        if (all &&
            !CanManage)
        {
            return Forbid();
        }

        var identity =
            await Identity(
                cancellationToken);

        if (identity is null)
        {
            return Unauthorized();
        }

        var query =
            db.Set<HelpdeskRequestTemplate>()
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                            identity.Value.Org);

        if (!all)
        {
            query =
                query.Where(
                    x =>
                        x.IsActive);
        }

        var items =
            await query
                .OrderByDescending(
                    x =>
                        x.IsActive)
                .ThenBy(
                    x =>
                        x.Title)
                .ToListAsync(
                    cancellationToken);

        return Ok(
            new
            {
                items =
                    items
                        .Select(
                            View)
                        .ToArray(),

                canManage =
                    CanManage
            });
    }

    // ============================================================
    // CREATE
    // ============================================================

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody]
        TemplateRequest request,

        CancellationToken cancellationToken)
    {
        if (!CanManage)
        {
            return Forbid();
        }

        var identity =
            await Identity(
                cancellationToken);

        if (identity is null)
        {
            return Unauthorized();
        }

        var item =
            new HelpdeskRequestTemplate(
                identity.Value.Org,
                identity.Value.User);

        try
        {
            await ApplyAsync(
                item,
                request,
                identity.Value.User,
                cancellationToken);

            db.Set<HelpdeskRequestTemplate>()
                .Add(
                    item);

            await db.SaveChangesAsync(
                cancellationToken);

            return Ok(
                View(
                    item));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(
                new
                {
                    message =
                        exception.Message
                });
        }
    }

    // ============================================================
    // UPDATE
    // ============================================================

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,

        [FromBody]
        TemplateRequest request,

        CancellationToken cancellationToken)
    {
        if (!CanManage)
        {
            return Forbid();
        }

        var identity =
            await Identity(
                cancellationToken);

        if (identity is null)
        {
            return Unauthorized();
        }

        var item =
            await db
                .Set<HelpdeskRequestTemplate>()
                .FirstOrDefaultAsync(
                    x =>
                        x.OrganizationId ==
                            identity.Value.Org
                        &&
                        x.Id ==
                            id,
                    cancellationToken);

        if (item is null)
        {
            return NotFound();
        }

        if (request.Revision.HasValue
            &&
            request.Revision.Value !=
                item.Revision)
        {
            return Conflict(
                new
                {
                    message =
                        "La plantilla cambió. Actualiza el catálogo antes de guardar nuevamente."
                });
        }

        try
        {
            await ApplyAsync(
                item,
                request,
                identity.Value.User,
                cancellationToken);

            await db.SaveChangesAsync(
                cancellationToken);

            return Ok(
                View(
                    item));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(
                new
                {
                    message =
                        exception.Message
                });
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(
                new
                {
                    message =
                        "Otro administrador modificó la plantilla. Actualiza la pantalla."
                });
        }
    }

    // ============================================================
    // VALIDATE / CONFIGURE
    // ============================================================

    private async Task ApplyAsync(
        HelpdeskRequestTemplate item,
        TemplateRequest request,
        Guid actorUserId,
        CancellationToken cancellationToken)
    {
        var title =
            (
                request.Title
                ??
                string.Empty
            )
            .Trim();

        if (string.IsNullOrWhiteSpace(
                title))
        {
            throw new ArgumentException(
                "Indica el nombre de la plantilla.");
        }

        if (title.Length >
            150)
        {
            throw new ArgumentException(
                "El nombre no puede exceder 150 caracteres.");
        }

        var description =
            (
                request.Description
                ??
                string.Empty
            )
            .Trim();

        if (description.Length >
            1000)
        {
            throw new ArgumentException(
                "La descripción no puede exceder 1000 caracteres.");
        }

        var category =
            (
                request.Category
                ??
                "general"
            )
            .Trim()
            .ToLowerInvariant();

        var ticketType =
            (
                request.TicketType
                ??
                "incident"
            )
            .Trim()
            .ToLowerInvariant();

        if (ticketType is not (
                "incident"
                or "request"))
        {
            throw new ArgumentException(
                "Tipo de solicitud no válido.");
        }

        /*
         * Categories are derived from active Helpdesk groups.
         */
        var configured =
            await db.HelpdeskTeams
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                            item.OrganizationId
                        &&
                        x.IsActive)
                .Select(
                    x =>
                        x.Categories)
                .ToListAsync(
                    cancellationToken);

        var categories =
            configured
                .SelectMany(
                    value =>
                        (
                            value
                            ??
                            string.Empty
                        )
                        .Split(
                            '|',
                            StringSplitOptions.RemoveEmptyEntries
                            |
                            StringSplitOptions.TrimEntries))
                .Append(
                    "general")
                .Distinct(
                    StringComparer.OrdinalIgnoreCase)
                .ToArray();

        if (!categories.Any(
                x =>
                    string.Equals(
                        x,
                        category,
                        StringComparison.OrdinalIgnoreCase)))
        {
            throw new ArgumentException(
                "La categoría no existe en los grupos activos de Mesa de Ayuda.");
        }

        var questions =
            (
                request.Questions
                ??
                []
            )
            .Select(
                x =>
                    x?.Trim()
                    ??
                    string.Empty)
            .Where(
                x =>
                    !string.IsNullOrWhiteSpace(
                        x))
            .Distinct(
                StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (questions.Length >
            30)
        {
            throw new ArgumentException(
                "Una plantilla admite hasta 30 preguntas.");
        }

        if (questions.Any(
                x =>
                    x.Length >
                        250))
        {
            throw new ArgumentException(
                "Cada pregunta admite hasta 250 caracteres.");
        }

        item.Configure(
            title,
            description,
            category,
            ticketType,
            questions,
            request.IsActive,
            actorUserId);
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