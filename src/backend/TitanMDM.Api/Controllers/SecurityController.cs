using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TitanMDM.Application.Security;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Route("api/security")]
[Authorize]
public sealed class SecurityController
    : ControllerBase
{
    private readonly ISecurityPostureService
        _securityPostureService;

    public SecurityController(
        ISecurityPostureService securityPostureService)
    {
        _securityPostureService =
            securityPostureService;
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult>
        GetDashboard(
            CancellationToken cancellationToken)
    {
        var organizationId =
            GetOrganizationId();

        if (organizationId is null)
        {
            return Unauthorized(
                new
                {
                    message =
                        "El token no contiene una organización válida."
                });
        }

        var result =
            await _securityPostureService
                .GetDashboardAsync(
                    organizationId.Value,
                    cancellationToken);

        return Ok(
            result);
    }

    [HttpGet("devices")]
    public async Task<IActionResult>
        GetDevices(
            CancellationToken cancellationToken)
    {
        var organizationId =
            GetOrganizationId();

        if (organizationId is null)
        {
            return Unauthorized(
                new
                {
                    message =
                        "El token no contiene una organización válida."
                });
        }

        var result =
            await _securityPostureService
                .GetDevicesAsync(
                    organizationId.Value,
                    cancellationToken);

        return Ok(
            result);
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