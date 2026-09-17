using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TitanMDM.Application.Dashboard.DTOs;
using TitanMDM.Application.Dashboard.Interfaces;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public sealed class DashboardController
    : ControllerBase
{
    private readonly IDashboardService _dashboardService;

    public DashboardController(
        IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet("summary")]
    [ProducesResponseType(
        typeof(DashboardSummaryDto),
        StatusCodes.Status200OK)]
    [ProducesResponseType(
        StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(
        StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<DashboardSummaryDto>>
        GetSummary(
            CancellationToken cancellationToken)
    {
        var organizationId =
            GetOrganizationId();

        if (organizationId is null)
        {
            return Forbid();
        }

        var summary =
            await _dashboardService.GetSummaryAsync(
                organizationId.Value,
                cancellationToken);

        return Ok(summary);
    }

    private Guid? GetOrganizationId()
    {
        var organizationIdValue =
            User.FindFirstValue("organizationId")
            ?? User.FindFirstValue("organization_id");

        if (Guid.TryParse(
                organizationIdValue,
                out var organizationId))
        {
            return organizationId;
        }

        return null;
    }
}