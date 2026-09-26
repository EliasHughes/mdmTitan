using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/helpdesk/staff")]
public sealed class HelpdeskStaffController : ControllerBase
{
    private readonly TitanMdmDbContext _db;

    public HelpdeskStaffController(TitanMdmDbContext db)
    {
        _db = db;
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers(CancellationToken cancellationToken)
    {
        if (!CanManage()) return Forbid();

        var organizationValue =
            User.FindFirstValue("organization_id") ??
            User.FindFirstValue("organizationId");

        if (!Guid.TryParse(organizationValue, out var organizationId))
            return Unauthorized();

        var staffPermissionUserIds = await (
            from userRole in _db.UserRoles.AsNoTracking()
            join rolePermission in _db.RolePermissions.AsNoTracking()
                on userRole.RoleId equals rolePermission.RoleId
            join permission in _db.Permissions.AsNoTracking()
                on rolePermission.PermissionId equals permission.Id
            where permission.IsActive &&
                  (permission.Code == "tickets.comment" ||
                   permission.Code == "tickets.assign")
            select userRole.UserId
        )
        .Distinct()
        .ToListAsync(cancellationToken);

        var users = await _db.Users.AsNoTracking()
            .Where(x => x.OrganizationId == organizationId && x.IsActive)
            .OrderBy(x => x.FirstName)
            .ThenBy(x => x.LastName)
            .Select(x => new
            {
                x.Id,
                x.FirstName,
                x.LastName,
                x.Email
            })
            .ToListAsync(cancellationToken);

        var assistantAccess = await _db.HelpdeskAssistantAccess.AsNoTracking()
            .Where(x => x.OrganizationId == organizationId && x.IsEnabled)
            .Select(x => x.UserId)
            .ToListAsync(cancellationToken);

        var staffSet = staffPermissionUserIds.ToHashSet();
        var assistantSet = assistantAccess.ToHashSet();

        return Ok(users.Select(x => new
        {
            x.Id,
            name = $"{x.FirstName} {x.LastName}".Trim(),
            x.Email,
            canWorkTickets = staffSet.Contains(x.Id),
            assistantEnabled = assistantSet.Contains(x.Id)
        }));
    }

    private bool CanManage() =>
        User.Claims.Any(claim =>
            claim.Type == "permission" &&
            (string.Equals(claim.Value, "helpdesk.manage", StringComparison.OrdinalIgnoreCase) ||
             string.Equals(claim.Value, "settings.manage", StringComparison.OrdinalIgnoreCase)));
}