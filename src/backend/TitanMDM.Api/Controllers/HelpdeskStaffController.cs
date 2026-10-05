using System.Security.Claims;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/helpdesk/staff")]
public sealed class HelpdeskStaffController
    : ControllerBase
{
    private static readonly string[]
        OperationalPermissions =
        [
            "helpdesk.agent.access",
            "helpdesk.ticket.details.view",
            "helpdesk.ticket.comment",
            "helpdesk.ticket.take",
            "helpdesk.ticket.assign",
            "helpdesk.ticket.transition",
            "helpdesk.ticket.resolve",
            "helpdesk.ticket.close",

            // Legacy
            "tickets.comment",
            "tickets.assign",
            "tickets.close",
            "helpdesk.view",
            "helpdesk.manage"
        ];

    private readonly TitanMdmDbContext
        _db;

    public HelpdeskStaffController(
        TitanMdmDbContext db)
    {
        _db =
            db;
    }

    [HttpGet("users")]
    public async Task<IActionResult>
        GetUsers(
            CancellationToken cancellationToken)
    {
        if (
            !CanViewTechnicians())
        {
            return Forbid();
        }

        var organizationValue =
            User.FindFirstValue(
                "organization_id")
            ??
            User.FindFirstValue(
                "organizationId");

        if (
            !Guid.TryParse(
                organizationValue,
                out var organizationId))
        {
            return Unauthorized();
        }

        var staffPermissionUserIds =
            await (
                from userRole
                    in _db.UserRoles
                        .AsNoTracking()

                join role
                    in _db.Roles
                        .AsNoTracking()
                    on userRole.RoleId
                    equals role.Id

                join rolePermission
                    in _db.RolePermissions
                        .AsNoTracking()
                    on role.Id
                    equals rolePermission.RoleId

                join permission
                    in _db.Permissions
                        .AsNoTracking()
                    on rolePermission.PermissionId
                    equals permission.Id

                join user
                    in _db.Users
                        .AsNoTracking()
                    on userRole.UserId
                    equals user.Id

                where
                    user.OrganizationId ==
                        organizationId
                    &&
                    role.OrganizationId ==
                        organizationId
                    &&
                    user.IsActive
                    &&
                    role.IsActive
                    &&
                    permission.IsActive
                    &&
                    OperationalPermissions
                        .Contains(
                            permission.Code)

                select user.Id
            )
            .Distinct()
            .ToListAsync(
                cancellationToken);

        var users =
            await _db.Users
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                            organizationId
                        &&
                        x.IsActive)
                .OrderBy(
                    x =>
                        x.FirstName)
                .ThenBy(
                    x =>
                        x.LastName)
                .Select(
                    x =>
                        new
                        {
                            x.Id,
                            x.FirstName,
                            x.LastName,
                            x.Email,
                            x.SiteId,
                            x.SiteLocationId
                        })
                .ToListAsync(
                    cancellationToken);

        var siteIds =
            users
                .Where(
                    x =>
                        x.SiteId.HasValue)
                .Select(
                    x =>
                        x.SiteId!.Value)
                .Distinct()
                .ToArray();

        var locationIds =
            users
                .Where(
                    x =>
                        x.SiteLocationId.HasValue)
                .Select(
                    x =>
                        x.SiteLocationId!.Value)
                .Distinct()
                .ToArray();

        var sites =
            await _db.Sites
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                            organizationId
                        &&
                        siteIds.Contains(
                            x.Id))
                .ToDictionaryAsync(
                    x =>
                        x.Id,
                    x =>
                        x.Name,
                    cancellationToken);

        var locations =
            await _db.SiteLocations
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                            organizationId
                        &&
                        locationIds.Contains(
                            x.Id))
                .ToDictionaryAsync(
                    x =>
                        x.Id,
                    x =>
                        x.Name,
                    cancellationToken);

        var assistantAccess =
            await _db.HelpdeskAssistantAccess
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                            organizationId
                        &&
                        x.IsEnabled)
                .Select(
                    x =>
                        x.UserId)
                .ToListAsync(
                    cancellationToken);

        var staffSet =
            staffPermissionUserIds
                .ToHashSet();

        var assistantSet =
            assistantAccess
                .ToHashSet();

        return Ok(
            users.Select(
                x =>
                {
                    string? siteName =
                        null;

                    string? locationName =
                        null;

                    if (
                        x.SiteId.HasValue)
                    {
                        sites.TryGetValue(
                            x.SiteId.Value,
                            out siteName);
                    }

                    if (
                        x.SiteLocationId.HasValue)
                    {
                        locations.TryGetValue(
                            x.SiteLocationId.Value,
                            out locationName);
                    }

                    return new
                    {
                        x.Id,

                        name =
                            $"{x.FirstName} {x.LastName}"
                                .Trim(),

                        x.Email,

                        x.SiteId,

                        siteName,

                        x.SiteLocationId,

                        siteLocationName =
                            locationName,

                        canWorkTickets =
                            staffSet.Contains(
                                x.Id),

                        assistantEnabled =
                            assistantSet.Contains(
                                x.Id)
                    };
                }));
    }

    private bool CanViewTechnicians()
    {
        return User.Claims.Any(
            claim =>
                claim.Type ==
                    "permission"
                &&
                (
                    string.Equals(
                        claim.Value,
                        "helpdesk.technicians.view",
                        StringComparison.OrdinalIgnoreCase)
                    ||
                    string.Equals(
                        claim.Value,
                        "helpdesk.technicians.manage",
                        StringComparison.OrdinalIgnoreCase)
                    ||
                    string.Equals(
                        claim.Value,
                        "helpdesk.admin.access",
                        StringComparison.OrdinalIgnoreCase)
                    ||
                    string.Equals(
                        claim.Value,
                        "helpdesk.manage",
                        StringComparison.OrdinalIgnoreCase)
                    ||
                    string.Equals(
                        claim.Value,
                        "settings.manage",
                        StringComparison.OrdinalIgnoreCase)
                ));
    }
}