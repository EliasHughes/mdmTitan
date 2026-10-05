using System.Security.Claims;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using TitanMDM.Api.Ponches;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/ponches")]
public sealed class PonchesController : ControllerBase
{
    private const long MaxBodyBytes =
        8L * 1024L * 1024L;

    private static readonly HashSet<string> LegacyRoots =
        new(
            StringComparer.OrdinalIgnoreCase)
        {
            "records",
            "devices",
            "collaborators",
            "payroll",
            "exports",
            "schema",
            "settings",
            "users",
            "remote"
        };

    private readonly IPonchesGateway
        _gateway;

    private readonly ILogger<PonchesController>
        _logger;

    public PonchesController(
        IPonchesGateway gateway,
        ILogger<PonchesController> logger)
    {
        _gateway =
            gateway
            ??
            throw new ArgumentNullException(
                nameof(gateway));

        _logger =
            logger
            ??
            throw new ArgumentNullException(
                nameof(logger));
    }

    // ============================================================
    // HEALTH
    // ============================================================

    [HttpGet("health")]
    public Task<IActionResult> Health(
        CancellationToken cancellationToken)
    {
        return ForwardAsync(
            route:
                "/api/internal/titan/health",
            method:
                HttpMethod.Get,
            hasBody:
                false,
            deviceOperation:
                false,
            cancellationToken,
            "workspace.ponches.view");
    }

    // ============================================================
    // DASHBOARD
    // ============================================================

    [HttpGet("dashboard")]
    public Task<IActionResult> Dashboard(
        CancellationToken cancellationToken)
    {
        return ForwardAsync(
            route:
                "/api/internal/titan/dashboard",
            method:
                HttpMethod.Get,
            hasBody:
                false,
            deviceOperation:
                false,
            cancellationToken,
            "ponches.dashboard.view");
    }

    [HttpGet("dashboard-original")]
    public Task<IActionResult> OriginalDashboard(
        CancellationToken cancellationToken)
    {
        return ForwardAsync(
            route:
                "/api/internal/titan/dashboard-original",
            method:
                HttpMethod.Get,
            hasBody:
                false,
            deviceOperation:
                false,
            cancellationToken,
            "ponches.dashboard.view");
    }

    // ============================================================
    // DEVICE HEALTH
    // ============================================================

    [HttpGet("device-health")]
    public Task<IActionResult> DeviceHealth(
        CancellationToken cancellationToken)
    {
        return ForwardAsync(
            route:
                "/api/internal/titan/device-health",
            method:
                HttpMethod.Get,
            hasBody:
                false,
            deviceOperation:
                true,
            cancellationToken,
            "ponches.devices.view");
    }

    // ============================================================
    // RECORDS
    // ============================================================

    [HttpGet("records")]
    public Task<IActionResult> Records(
        [FromQuery]
        int limit = 100,
        [FromQuery]
        string search = "",
        CancellationToken cancellationToken = default)
    {
        search ??= string.Empty;

        search =
            search.Trim();

        if (limit is < 1 or > 200)
        {
            return Task.FromResult<IActionResult>(
                BadRequest(
                    new
                    {
                        code =
                            "PONCHES_INVALID_LIMIT",

                        message =
                            "El límite debe estar entre 1 y 200."
                    }));
        }

        if (search.Length > 80)
        {
            return Task.FromResult<IActionResult>(
                BadRequest(
                    new
                    {
                        code =
                            "PONCHES_INVALID_SEARCH",

                        message =
                            "El criterio de búsqueda supera el tamaño permitido."
                    }));
        }

        var route =
            "/api/internal/titan/records" +
            $"?limit={limit}" +
            $"&search={Uri.EscapeDataString(search)}";

        return ForwardAsync(
            route,
            HttpMethod.Get,
            hasBody:
                false,
            deviceOperation:
                false,
            cancellationToken,
            "ponches.records.view");
    }

    // ============================================================
    // LEGACY BRIDGE
    //
    // Este endpoint permanece mientras migramos las pantallas
    // originales de Ponches hacia TitanMDM.
    // ============================================================

    [AcceptVerbs(
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE")]
    [Route("legacy/{**path}")]
    [RequestSizeLimit(MaxBodyBytes)]
    public Task<IActionResult> Legacy(
        string path,
        CancellationToken cancellationToken)
    {
        var segments =
            (path ?? string.Empty)
                .Split(
                    '/',
                    StringSplitOptions
                        .RemoveEmptyEntries);

        if (!IsSafeLegacyPath(
                segments))
        {
            return Task.FromResult<IActionResult>(
                NotFound());
        }

        var normalizedPath =
            string.Join(
                "/",
                segments);

        var requiredPermissions =
            PonchesAccess.Required(
                normalizedPath,
                Request.Method);

        if (requiredPermissions.Length == 0)
        {
            return Task.FromResult<IActionResult>(
                NotFound());
        }

        var route =
            "/api/" +
            string.Join(
                "/",
                segments.Select(
                    Uri.EscapeDataString)) +
            Request.QueryString.Value;

        return ForwardAsync(
            route,
            new HttpMethod(
                Request.Method),
            hasBody:
                !HttpMethods.IsGet(
                    Request.Method),
            deviceOperation:
                IsDeviceOperation(
                    normalizedPath,
                    Request.Method),
            cancellationToken,
            requiredPermissions);
    }

    // ============================================================
    // FORWARD
    // ============================================================

    private async Task<IActionResult> ForwardAsync(
        string route,
        HttpMethod method,
        bool hasBody,
        bool deviceOperation,
        CancellationToken cancellationToken,
        params string[] requiredPermissions)
    {
        var manage =
            HasPermission(
                "ponches.manage");

        if (!manage &&
            !HasPermission(
                "workspace.ponches.view"))
        {
            return Forbid();
        }

        if (!manage &&
            requiredPermissions.Length > 0 &&
            !requiredPermissions.Any(
                HasPermission))
        {
            return Forbid();
        }

        /*
         * Eliminar colaboradores puede afectar
         * directamente relojes físicos.
         */
        if (!manage &&
            RequiresCollaboratorSyncPermission(
                route) &&
            !HasPermission(
                "ponches.collaborators.sync"))
        {
            return Forbid();
        }

        if (hasBody &&
            Request.ContentLength
                is > MaxBodyBytes)
        {
            return StatusCode(
                StatusCodes
                    .Status413PayloadTooLarge,
                new
                {
                    code =
                        "PONCHES_PAYLOAD_TOO_LARGE",

                    message =
                        "El contenido supera el límite de 8 MB."
                });
        }

        var actor =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier)
            ??
            User.FindFirstValue(
                "sub");

        var organization =
            User.FindFirstValue(
                "organization_id")
            ??
            User.FindFirstValue(
                "organizationId");

        if (!Guid.TryParse(
                actor,
                out _) ||
            !Guid.TryParse(
                organization,
                out _))
        {
            return Unauthorized(
                new
                {
                    code =
                        "PONCHES_INVALID_IDENTITY",

                    message =
                        "La identidad de TitanMDM no contiene un usuario u organización válidos."
                });
        }

        var grantedPermissions =
            User.Claims
                .Where(
                    claim =>
                        string.Equals(
                            claim.Type,
                            "permission",
                            StringComparison.OrdinalIgnoreCase))
                .Select(
                    claim =>
                        claim.Value);

        var operations =
            PonchesAccess.Operations(
                grantedPermissions);

        try
        {
            var result =
                await _gateway.SendAsync(
                    new PonchesGatewayRequest(
                        Route:
                            route,

                        Method:
                            method,

                        ActorUserId:
                            actor!,

                        OrganizationId:
                            organization!,

                        IsAdministrator:
                            manage,

                        Operations:
                            operations,

                        Body:
                            hasBody
                                ? Request.Body
                                : null,

                        ContentType:
                            hasBody
                                ? Request.ContentType
                                : null,

                        DeviceOperation:
                            deviceOperation),
                    cancellationToken);

            /*
             * Python nunca debe poder forzar caché
             * sobre respuestas operativas.
             */
            Response.Headers.CacheControl =
                "no-store";

            if (!string.IsNullOrWhiteSpace(
                    result.ContentDisposition))
            {
                Response.Headers
                    .ContentDisposition =
                        result.ContentDisposition;
            }

            /*
             * Una 401 del Edge Service no debe convertirse
             * en una falsa 401 del usuario.
             *
             * Esa situación significa que la credencial
             * machine-to-machine está desincronizada.
             */
            if (result.StatusCode ==
                StatusCodes.Status401Unauthorized)
            {
                _logger.LogWarning(
                    "Ponches Edge rechazó la credencial interna. Route={Route}",
                    GetSafeRouteForLog(
                        route));

                return StatusCode(
                    StatusCodes
                        .Status502BadGateway,
                    new
                    {
                        code =
                            "PONCHES_INTEGRATION_AUTH",

                        message =
                            "La autenticación interna entre TitanMDM y Ponches Edge fue rechazada."
                    });
            }

            Response.StatusCode =
                result.StatusCode;

            return File(
                result.Body,
                string.IsNullOrWhiteSpace(
                    result.ContentType)
                    ? "application/json"
                    : result.ContentType);
        }
        catch (OperationCanceledException)
            when (cancellationToken
                .IsCancellationRequested)
        {
            /*
             * 499 no es estándar HTTP oficial,
             * pero se usa ampliamente para
             * Client Closed Request.
             */
            return StatusCode(
                499);
        }
        catch (PonchesNotConfiguredException exception)
        {
            _logger.LogWarning(
                exception,
                "Ponches no está configurado.");

            return StatusCode(
                StatusCodes
                    .Status503ServiceUnavailable,
                new
                {
                    code =
                        "PONCHES_NOT_CONFIGURED",

                    message =
                        "La integración de Ponches no está configurada en este servidor."
                });
        }
        catch (PonchesTimeoutException exception)
        {
            _logger.LogWarning(
                exception,
                "Timeout de Ponches. Route={Route}",
                GetSafeRouteForLog(
                    route));

            return StatusCode(
                StatusCodes
                    .Status504GatewayTimeout,
                new
                {
                    code =
                        "PONCHES_TIMEOUT",

                    message =
                        "La operación de Ponches superó el tiempo permitido. " +
                        "Si fue una escritura en reloj, consulta el historial antes de repetirla."
                });
        }
        catch (PonchesUnavailableException exception)
        {
            _logger.LogWarning(
                exception,
                "Ponches Edge no está disponible. Route={Route}",
                GetSafeRouteForLog(
                    route));

            return StatusCode(
                StatusCodes
                    .Status503ServiceUnavailable,
                new
                {
                    code =
                        "PONCHES_UNAVAILABLE",

                    message =
                        "El servicio interno de Ponches no está disponible."
                });
        }
    }

    // ============================================================
    // HELPERS
    // ============================================================

    private bool HasPermission(
        string permission)
    {
        return User.Claims.Any(
            claim =>
                string.Equals(
                    claim.Type,
                    "permission",
                    StringComparison.OrdinalIgnoreCase)
                &&
                string.Equals(
                    claim.Value,
                    permission,
                    StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsSafeLegacyPath(
        IReadOnlyList<string> segments)
    {
        if (segments.Count == 0)
        {
            return false;
        }

        if (!LegacyRoots.Contains(
                segments[0]))
        {
            return false;
        }

        foreach (var segment in segments)
        {
            if (segment is "." or "..")
            {
                return false;
            }

            if (segment.Contains('\\'))
            {
                return false;
            }

            if (segment.Any(
                    char.IsControl))
            {
                return false;
            }

            if (segment.Length > 120)
            {
                return false;
            }
        }

        return true;
    }

    private static bool RequiresCollaboratorSyncPermission(
        string route)
    {
        return route.StartsWith(
                   "/api/records/collaborator-delete",
                   StringComparison.OrdinalIgnoreCase)
               ||
               route.StartsWith(
                   "/api/collaborators/delete",
                   StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsDeviceOperation(
        string path,
        string method)
    {
        if (HttpMethods.IsGet(
                method))
        {
            return path.Contains(
                       "device-health",
                       StringComparison.OrdinalIgnoreCase)
                   ||
                   path.Contains(
                       "devices/test",
                       StringComparison.OrdinalIgnoreCase);
        }

        return path.Contains(
                   "device",
                   StringComparison.OrdinalIgnoreCase)
               ||
               path.Contains(
                   "zk",
                   StringComparison.OrdinalIgnoreCase)
               ||
               path.Contains(
                   "collab-push",
                   StringComparison.OrdinalIgnoreCase)
               ||
               path.Contains(
                   "collab-clone",
                   StringComparison.OrdinalIgnoreCase)
               ||
               path.Contains(
                   "collab-delete-clocks",
                   StringComparison.OrdinalIgnoreCase)
               ||
               path.Contains(
                   "collab-reconcile",
                   StringComparison.OrdinalIgnoreCase)
               ||
               path.Contains(
                   "bulk-enroll",
                   StringComparison.OrdinalIgnoreCase)
               ||
               path.Contains(
                   "sync-now",
                   StringComparison.OrdinalIgnoreCase);
    }

    private static string GetSafeRouteForLog(
        string route)
    {
        var questionMarkIndex =
            route.IndexOf(
                '?',
                StringComparison.Ordinal);

        return questionMarkIndex >= 0
            ? route[..questionMarkIndex]
            : route;
    }
}

// ================================================================
// TITANMDM <-> PONCHES PERMISSION TRANSLATION
// ================================================================

public static class PonchesAccess
{
    private static readonly Dictionary<string, string[]> Map =
        new(
            StringComparer.OrdinalIgnoreCase)
        {
            ["ponches.dashboard.view"] =
            [
                "attendance.read",
                "devices.read"
            ],

            ["ponches.records.view"] =
            [
                "attendance.read"
            ],

            ["ponches.history.view"] =
            [
                "settings.read",
                "attendance.read"
            ],

            ["ponches.remote.create"] =
            [
                "remote_punch",
                "devices.read",
                "attendance.read"
            ],

            ["ponches.devices.view"] =
            [
                "devices.read",
                "zk.read"
            ],

            ["ponches.devices.manage"] =
            [
                "devices.read",
                "devices.write",
                "devices.delete",
                "zk.read"
            ],

            ["ponches.employees.view"] =
            [
                "attendance.read"
            ],

            ["ponches.collaborators.view"] =
            [
                "collaborators.read",
                "devices.read",
                "schedules.read"
            ],

            ["ponches.collaborators.manage"] =
            [
                "collaborators.read",
                "collaborators.write",
                "devices.read",
                "schedules.read"
            ],

            ["ponches.collaborators.sync"] =
            [
                "collaborators.read",
                "collaborators.sync",
                "devices.read",
                "zk.read",
                "zk.push",
                "zk.clone",
                "zk.move",
                "zk.delete"
            ],

            ["ponches.schedules.view"] =
            [
                "schedules.read"
            ],

            ["ponches.schedules.manage"] =
            [
                "schedules.read",
                "schedules.write"
            ],

            ["ponches.inventory.view"] =
            [
                "inventory.read",
                "devices.read",
                "zk.read"
            ],

            ["ponches.inventory.manage"] =
            [
                "inventory.read",
                "inventory.write",
                "devices.read",
                "devices.write",
                "zk.read"
            ],

            ["ponches.bulk.execute"] =
            [
                "bulk.execute",
                "devices.read",
                "zk.read",
                "zk.enroll"
            ],

            ["ponches.reports.view"] =
            [
                "reports.read",
                "attendance.read",
                "exports.read",
                "schedules.read"
            ],

            ["ponches.advanced-reports.view"] =
            [
                "reports.read",
                "attendance.read",
                "exports.read",
                "schedules.read"
            ],

            ["ponches.export"] =
            [
                "exports.read",
                "reports.export",
                "attendance.read"
            ],

            ["ponches.sync.view"] =
            [
                "sync.read"
            ],

            ["ponches.sync.run"] =
            [
                "sync.read",
                "sync.run"
            ],

            ["ponches.settings.view"] =
            [
                "settings.read"
            ],

            ["ponches.settings.manage"] =
            [
                "settings.read",
                "settings.write"
            ]
        };

    public static string[] Operations(
        IEnumerable<string> permissions)
    {
        var granted =
            permissions.ToHashSet(
                StringComparer.OrdinalIgnoreCase);

        IEnumerable<string> values =
            Map
                .Where(
                    pair =>
                        granted.Contains(
                            pair.Key))
                .SelectMany(
                    pair =>
                        pair.Value);

        if (granted.Contains(
                "ponches.manage"))
        {
            values =
                Map.Values
                    .SelectMany(
                        value =>
                            value)
                    .Concat(
                        new[]
                        {
                            "users.read",
                            "users.write",
                            "users.delete",
                            "roles.read",
                            "roles.write",
                            "payroll.run",
                            "schema.admin",
                            "zk.sync"
                        });
        }

        return values
            .Distinct(
                StringComparer.Ordinal)
            .OrderBy(
                value =>
                    value,
                StringComparer.Ordinal)
            .ToArray();
    }

    public static string[] Required(
        string path,
        string method)
    {
        var parts =
            path
                .ToLowerInvariant()
                .Split(
                    '/',
                    StringSplitOptions
                        .RemoveEmptyEntries);

        if (parts.Length == 0)
        {
            return [];
        }

        var root =
            parts[0];

        var action =
            parts.Length > 1
                ? parts[1]
                : string.Empty;

        var read =
            method.Equals(
                "GET",
                StringComparison.OrdinalIgnoreCase);

        if (root == "settings")
        {
            return
            [
                read
                    ? "ponches.settings.view"
                    : "ponches.settings.manage"
            ];
        }

        if (root == "schema")
        {
            return read
                ? ["ponches.history.view"]
                : [];
        }

        if (root == "payroll" &&
            action == "overtime" &&
            method.Equals(
                "POST",
                StringComparison.OrdinalIgnoreCase))
        {
            return
            [
                "ponches.reports.view",
                "ponches.advanced-reports.view"
            ];
        }

        if (root == "payroll" &&
            action == "rotations")
        {
            return
            [
                read
                    ? "ponches.schedules.view"
                    : "ponches.schedules.manage"
            ];
        }

        if (root == "records")
        {
            if (action == "export" &&
                parts.Length == 3 &&
                parts[2] is "excel" or "pdf")
            {
                return
                [
                    "ponches.export"
                ];
            }

            if (action == "export-devices" &&
                read)
            {
                return
                [
                    "ponches.export",
                    "ponches.reports.view",
                    "ponches.advanced-reports.view"
                ];
            }

            if (action is
                "app-users"
                or
                "app-roles")
            {
                return [];
            }

            if (action ==
                "inventory-devices")
            {
                return
                [
                    read
                        ? "ponches.inventory.view"
                        : "ponches.inventory.manage"
                ];
            }

            if (action ==
                "schedules")
            {
                return
                [
                    read
                        ? "ponches.schedules.view"
                        : "ponches.schedules.manage"
                ];
            }

            if (action ==
                    "sync-history" &&
                read)
            {
                return
                [
                    "ponches.sync.view",
                    "ponches.sync.run"
                ];
            }

            if (action ==
                    "sync-now" &&
                method.Equals(
                    "POST",
                    StringComparison.OrdinalIgnoreCase))
            {
                return
                [
                    "ponches.sync.run"
                ];
            }

            if (action is
                "remote-punch"
                or
                "remote-devices")
            {
                return
                [
                    "ponches.remote.create"
                ];
            }

            if (action is
                "collab-push"
                or
                "collab-clone"
                or
                "collab-delete-clocks"
                or
                "collab-reconcile")
            {
                return read
                    ?
                    [
                        "ponches.collaborators.view",
                        "ponches.collaborators.sync"
                    ]
                    :
                    [
                        "ponches.collaborators.sync"
                    ];
            }

            if (action ==
                    "collaborator-copy" &&
                !read)
            {
                return
                [
                    "ponches.collaborators.sync"
                ];
            }

            if (action.StartsWith(
                    "collaborator",
                    StringComparison.Ordinal))
            {
                return
                [
                    read
                        ? "ponches.collaborators.view"
                        : "ponches.collaborators.manage"
                ];
            }

            if (action ==
                "bulk-enroll")
            {
                return
                [
                    "ponches.bulk.execute"
                ];
            }

            if (action ==
                    "managed-devices" &&
                read)
            {
                return
                [
                    "ponches.devices.view",
                    "ponches.devices.manage",
                    "ponches.inventory.view",
                    "ponches.inventory.manage",
                    "ponches.collaborators.view",
                    "ponches.collaborators.manage",
                    "ponches.collaborators.sync",
                    "ponches.bulk.execute"
                ];
            }

            if (action ==
                "managed-devices")
            {
                return
                [
                    "ponches.devices.manage",
                    "ponches.inventory.manage"
                ];
            }

            if (action ==
                    "device-health" &&
                read)
            {
                return
                [
                    "ponches.devices.view",
                    "ponches.dashboard.view"
                ];
            }

            if (action ==
                    "employees" &&
                read)
            {
                return
                [
                    "ponches.employees.view"
                ];
            }

            if (action ==
                    "devices" &&
                read)
            {
                return
                [
                    "ponches.records.view",
                    "ponches.export",
                    "ponches.reports.view",
                    "ponches.advanced-reports.view"
                ];
            }

            if (action is
                "dashboard-combined"
                or
                "summary"
                or
                "stats"
                or
                "ops-overview")
            {
                return read
                    ? ["ponches.dashboard.view"]
                    : [];
            }

            if (action is
                "recent"
                or
                "search"
                or
                "columns")
            {
                return read
                    ?
                    [
                        "ponches.records.view",
                        "ponches.dashboard.view"
                    ]
                    :
                    [];
            }
        }

        if (root == "devices")
        {
            if (parts.Length == 3 &&
                parts[2] == "test" &&
                method.Equals(
                    "POST",
                    StringComparison.OrdinalIgnoreCase))
            {
                return
                [
                    "ponches.devices.view",
                    "ponches.inventory.view"
                ];
            }

            if (action ==
                    "enroll-bio" &&
                method.Equals(
                    "POST",
                    StringComparison.OrdinalIgnoreCase))
            {
                return
                [
                    "ponches.bulk.execute"
                ];
            }

            return read
                ?
                [
                    "ponches.inventory.view",
                    "ponches.devices.view",
                    "ponches.collaborators.sync"
                ]
                :
                [
                    "ponches.collaborators.sync"
                ];
        }

        if (root ==
            "collaborators")
        {
            if (!read &&
                action is
                    "collaborator-sync"
                    or
                    "copy-device"
                    or
                    "collab-push")
            {
                return
                [
                    "ponches.collaborators.sync"
                ];
            }

            return
            [
                read
                    ? "ponches.collaborators.view"
                    : "ponches.collaborators.manage"
            ];
        }

        return [];
    }
}