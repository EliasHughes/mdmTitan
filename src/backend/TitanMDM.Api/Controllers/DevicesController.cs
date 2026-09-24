using System.Security.Claims;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using TitanMDM.Application.Devices;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Route("api/devices")]
[Authorize]
public sealed class DevicesController
    : ControllerBase
{
    private const string DevicesViewPermission =
        "devices.view";

    private const string WindowsWorkspacePermission =
        "workspace.windows.view";

    private const string AndroidWorkspacePermission =
        "workspace.android.view";

    private readonly IDeviceQueryService
        _deviceQueryService;

    public DevicesController(
        IDeviceQueryService deviceQueryService)
    {
        _deviceQueryService =
            deviceQueryService
            ??
            throw new ArgumentNullException(
                nameof(deviceQueryService));
    }

    /*
     * ============================================================
     * LIST DEVICES
     * ============================================================
     */

    [HttpGet]
    public async Task<IActionResult> GetDevices(
        [FromQuery] string? search,
        [FromQuery] string? platform,
        [FromQuery] string? status,
        [FromQuery] string? compliance,
        [FromQuery] bool? managed,
        [FromQuery] string? sortBy,
        [FromQuery] string? sortDirection,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        if (
            !HasPermission(
                DevicesViewPermission))
        {
            return Forbid();
        }

        var organizationId =
            GetOrganizationId();

        if (
            organizationId is null)
        {
            return Unauthorized(
                new
                {
                    message =
                        "El token no contiene una organización válida."
                });
        }

        /*
         * ========================================================
         * PLATFORM ACCESS
         * ========================================================
         */

        var hasWindowsAccess =
            HasPermission(
                WindowsWorkspacePermission);

        var hasAndroidAccess =
            HasPermission(
                AndroidWorkspacePermission);

        if (
            !hasWindowsAccess
            &&
            !hasAndroidAccess)
        {
            return Forbid();
        }

        var normalizedPlatform =
            NormalizePlatform(
                platform);

        /*
         * Plataforma explícita.
         */

        if (
            normalizedPlatform ==
            "Windows"
            &&
            !hasWindowsAccess)
        {
            return Forbid();
        }

        if (
            normalizedPlatform ==
            "Android"
            &&
            !hasAndroidAccess)
        {
            return Forbid();
        }

        /*
         * Si no llega platform y el usuario solo tiene
         * acceso a un workspace, forzamos ese workspace.
         *
         * Esto evita:
         *
         * usuario Android
         *   ↓
         * elimina ?platform=Android
         *   ↓
         * recibe Windows también
         */

        if (
            string.IsNullOrWhiteSpace(
                normalizedPlatform))
        {
            if (
                hasWindowsAccess
                &&
                !hasAndroidAccess)
            {
                normalizedPlatform =
                    "Windows";
            }
            else if (
                hasAndroidAccess
                &&
                !hasWindowsAccess)
            {
                normalizedPlatform =
                    "Android";
            }
        }

        var result =
            await _deviceQueryService
                .GetDevicesAsync(
                    organizationId.Value,
                    search,
                    normalizedPlatform,
                    status,
                    compliance,
                    managed,
                    sortBy,
                    sortDirection,
                    page,
                    pageSize,
                    cancellationToken);

        return Ok(
            result);
    }

    /*
     * ============================================================
     * DEVICE DETAILS
     * ============================================================
     */

    [HttpGet("{deviceId:guid}")]
    public async Task<IActionResult>
        GetDeviceById(
            Guid deviceId,
            CancellationToken cancellationToken = default)
    {
        if (
            !HasPermission(
                DevicesViewPermission))
        {
            return Forbid();
        }

        var organizationId =
            GetOrganizationId();

        if (
            organizationId is null)
        {
            return Unauthorized(
                new
                {
                    message =
                        "El token no contiene una organización válida."
                });
        }

        var device =
            await _deviceQueryService
                .GetDeviceByIdAsync(
                    organizationId.Value,
                    deviceId,
                    cancellationToken);

        if (
            device is null)
        {
            return NotFound(
                new
                {
                    message =
                        "El dispositivo no existe o no pertenece a la organización."
                });
        }

        /*
         * El usuario puede conocer el ID del dispositivo,
         * pero no recibe los datos si no tiene acceso al
         * workspace correspondiente.
         */

        if (
            string.Equals(
                device.Platform,
                "Windows",
                StringComparison.OrdinalIgnoreCase)
            &&
            !HasPermission(
                WindowsWorkspacePermission))
        {
            return Forbid();
        }

        if (
            string.Equals(
                device.Platform,
                "Android",
                StringComparison.OrdinalIgnoreCase)
            &&
            !HasPermission(
                AndroidWorkspacePermission))
        {
            return Forbid();
        }

        return Ok(
            device);
    }

    /*
     * ============================================================
     * ANDROID DETAILS
     * ============================================================
     */

    [HttpGet("{deviceId:guid}/android")]
    public async Task<IActionResult>
        GetAndroidDeviceDetails(
            Guid deviceId,
            CancellationToken cancellationToken = default)
    {
        if (
            !HasPermission(
                DevicesViewPermission)
            ||
            !HasPermission(
                AndroidWorkspacePermission))
        {
            return Forbid();
        }

        var organizationId =
            GetOrganizationId();

        if (
            organizationId is null)
        {
            return Unauthorized(
                new
                {
                    message =
                        "El token no contiene una organización válida."
                });
        }

        var android =
            await _deviceQueryService
                .GetAndroidDeviceDetailsAsync(
                    organizationId.Value,
                    deviceId,
                    cancellationToken);

        if (
            android is null)
        {
            return NotFound(
                new
                {
                    message =
                        "No existe información Android Enterprise para este dispositivo."
                });
        }

        return Ok(
            android);
    }

    /*
 * ============================================================
 * OPERATIONAL SNAPSHOT
 * ============================================================
 */

[HttpGet("{deviceId:guid}/snapshot")]
public async Task<IActionResult>
    GetOperationalSnapshot(
        Guid deviceId,
        CancellationToken cancellationToken = default)
{
    if (
        !HasPermission(
            DevicesViewPermission))
    {
        return Forbid();
    }

    var organizationId =
        GetOrganizationId();

    if (
        organizationId is null)
    {
        return Unauthorized(
            new
            {
                message =
                    "El token no contiene una organización válida."
            });
    }

    var snapshot =
        await _deviceQueryService
            .GetOperationalSnapshotAsync(
                organizationId.Value,
                deviceId,
                cancellationToken);

    if (
        snapshot is null)
    {
        return NotFound(
            new
            {
                message =
                    "El dispositivo no existe."
            });
    }

    if (
        string.Equals(
            snapshot.Device.Platform,
            "Windows",
            StringComparison.OrdinalIgnoreCase)
        &&
        !HasPermission(
            WindowsWorkspacePermission))
    {
        return Forbid();
    }

    if (
        string.Equals(
            snapshot.Device.Platform,
            "Android",
            StringComparison.OrdinalIgnoreCase)
        &&
        !HasPermission(
            AndroidWorkspacePermission))
    {
        return Forbid();
    }

    return Ok(
        snapshot);
}

    /*
     * ============================================================
     * PLATFORM NORMALIZATION
     * ============================================================
     */

    private static string? NormalizePlatform(
        string? platform)
    {
        if (
            string.IsNullOrWhiteSpace(
                platform))
        {
            return null;
        }

        var value =
            platform
                .Trim();

        if (
            value.Equals(
                "Windows",
                StringComparison.OrdinalIgnoreCase))
        {
            return "Windows";
        }

        if (
            value.Equals(
                "Android",
                StringComparison.OrdinalIgnoreCase))
        {
            return "Android";
        }

        /*
         * Una plataforma desconocida no debe convertirse
         * silenciosamente en una consulta global.
         */

        return value;
    }

    /*
     * ============================================================
     * CLAIMS
     * ============================================================
     */

    private Guid? GetOrganizationId()
    {
        var value =
            User.FindFirstValue(
                "organization_id")
            ??
            User.FindFirstValue(
                "organizationId");

        return Guid.TryParse(
            value,
            out var organizationId)
            ? organizationId
            : null;
    }

    private bool HasPermission(
        string permission)
    {
        return User.Claims
            .Any(
                claim =>
                    claim.Type ==
                        "permission"
                    &&
                    string.Equals(
                        claim.Value,
                        permission,
                        StringComparison
                            .OrdinalIgnoreCase));
    }
}