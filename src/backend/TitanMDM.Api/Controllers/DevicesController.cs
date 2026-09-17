using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TitanMDM.Application.Devices;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Route("api/devices")]
[Authorize]
public sealed class DevicesController : ControllerBase
{
    private readonly IDeviceQueryService _deviceQueryService;

    public DevicesController(
        IDeviceQueryService deviceQueryService)
    {
        _deviceQueryService = deviceQueryService;
    }

    [HttpGet]
    public async Task<IActionResult> GetDevices(
        [FromQuery] string? search,
        [FromQuery] string? platform,
        [FromQuery] string? status,
        [FromQuery] string? compliance,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        var organizationId = GetOrganizationId();

        if (organizationId is null)
        {
            return Unauthorized(new
            {
                message =
                    "El token no contiene una organización válida."
            });
        }

        var result =
            await _deviceQueryService.GetDevicesAsync(
                organizationId.Value,
                search,
                platform,
                status,
                compliance,
                page,
                pageSize,
                cancellationToken);

        return Ok(result);
    }

    [HttpGet("{deviceId:guid}")]
    public async Task<IActionResult> GetDeviceById(
        Guid deviceId,
        CancellationToken cancellationToken = default)
    {
        var organizationId = GetOrganizationId();

        if (organizationId is null)
        {
            return Unauthorized(new
            {
                message =
                    "El token no contiene una organización válida."
            });
        }

        var device =
            await _deviceQueryService.GetDeviceByIdAsync(
                organizationId.Value,
                deviceId,
                cancellationToken);

        if (device is null)
        {
            return NotFound(new
            {
                message =
                    "El dispositivo no existe o no pertenece a la organización."
            });
        }

        return Ok(device);
    }

    private Guid? GetOrganizationId()
    {
        var value = User.FindFirstValue(
            "organization_id");

        return Guid.TryParse(
            value,
            out var organizationId)
            ? organizationId
            : null;
    }
}