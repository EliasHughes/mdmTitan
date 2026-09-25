using System.Security.Claims;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using TitanMDM.Application.Reports;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize]
public sealed class ReportsController
    : ControllerBase
{
    private readonly IReportsService
        _reportsService;

    public ReportsController(
        IReportsService reportsService)
    {
        _reportsService =
            reportsService;
    }

    [HttpGet("overview")]
    public async Task<IActionResult>
        GetOverview(
            CancellationToken cancellationToken)
    {
        var organizationId =
            GetOrganizationId();

        if (
            !organizationId
                .HasValue)
        {
            return Unauthorized();
        }

        return Ok(
            await _reportsService
                .GetOverviewAsync(
                    organizationId.Value,
                    cancellationToken));
    }

    [HttpGet("devices/export/csv")]
    public async Task<IActionResult>
        ExportDevices(
            CancellationToken cancellationToken)
    {
        var organizationId =
            GetOrganizationId();

        if (
            !organizationId
                .HasValue)
        {
            return Unauthorized();
        }

        var bytes =
            await _reportsService
                .ExportDevicesCsvAsync(
                    organizationId.Value,
                    cancellationToken);

        return File(
            bytes,
            "text/csv",
            $"titanmdm-devices-{DateTime.UtcNow:yyyyMMdd-HHmmss}.csv");
    }

    private Guid? GetOrganizationId()
    {
        var value =
            User.FindFirstValue(
                "organization_id");

        return Guid.TryParse(
            value,
            out var organizationId)
            ? organizationId
            : null;
    }
}