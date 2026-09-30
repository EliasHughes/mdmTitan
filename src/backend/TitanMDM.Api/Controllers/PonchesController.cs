using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/ponches")]
public sealed class PonchesController : ControllerBase
{
    private const long MaxBodyBytes = 8 * 1024 * 1024;

    private static readonly HttpClient Client = new()
    {
        Timeout = Timeout.InfiniteTimeSpan
    };

    private static readonly HashSet<string> Roots =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "records", "devices", "collaborators", "payroll",
            "exports", "schema", "settings", "users", "remote"
        };

    private readonly IConfiguration _configuration;
    private readonly ILogger<PonchesController> _logger;

    public PonchesController(
        IConfiguration configuration,
        ILogger<PonchesController> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    [HttpGet("health")]
    public Task<IActionResult> Health(CancellationToken ct) =>
        ForwardAsync(
            "/api/internal/titan/health",
            HttpMethod.Get, false, ct,
            "workspace.ponches.view");

    [HttpGet("dashboard")]
    public Task<IActionResult> Dashboard(CancellationToken ct) =>
        ForwardAsync(
            "/api/internal/titan/dashboard",
            HttpMethod.Get, false, ct,
            "ponches.dashboard.view");

    [HttpGet("dashboard-original")]
    public Task<IActionResult> OriginalDashboard(CancellationToken ct) =>
        ForwardAsync(
            "/api/internal/titan/dashboard-original",
            HttpMethod.Get, false, ct,
            "ponches.dashboard.view");

    [HttpGet("device-health")]
    public Task<IActionResult> DeviceHealth(CancellationToken ct) =>
        ForwardAsync(
            "/api/internal/titan/device-health",
            HttpMethod.Get, false, ct,
            "ponches.devices.view");

    [HttpGet("records")]
    public Task<IActionResult> Records(
        [FromQuery] int limit = 100,
        [FromQuery] string search = "",
        CancellationToken ct = default)
    {
        search ??= "";

        if (limit is < 1 or > 200 || search.Length > 80)
        {
            return Task.FromResult<IActionResult>(
                BadRequest(new
                {
                    message = "Filtro de registros inválido."
                }));
        }

        return ForwardAsync(
            $"/api/internal/titan/records?limit={limit}&search={Uri.EscapeDataString(search)}",
            HttpMethod.Get, false, ct,
            "ponches.records.view");
    }

    [AcceptVerbs("GET", "POST", "PUT", "PATCH", "DELETE")]
    [Route("legacy/{**path}")]
    [RequestSizeLimit(MaxBodyBytes)]
    public Task<IActionResult> Legacy(string path, CancellationToken ct)
    {
        var segments = (path ?? "").Split(
            '/',
            StringSplitOptions.RemoveEmptyEntries);

        if (segments.Length == 0 ||
            !Roots.Contains(segments[0]) ||
            segments.Any(s =>
                s is "." or ".." ||
                s.Contains('\\') ||
                s.Any(char.IsControl)))
        {
            return Task.FromResult<IActionResult>(NotFound());
        }

        var required = PonchesAccess.Required(
            string.Join("/", segments),
            Request.Method);

        if (required.Length == 0)
            return Task.FromResult<IActionResult>(NotFound());

        var route = "/api/" +
                    string.Join("/", segments.Select(Uri.EscapeDataString)) +
                    Request.QueryString.Value;

        return ForwardAsync(
            route,
            new HttpMethod(Request.Method),
            !HttpMethods.IsGet(Request.Method),
            ct,
            required);
    }

    private async Task<IActionResult> ForwardAsync(
        string route,
        HttpMethod method,
        bool hasBody,
        CancellationToken ct,
        params string[] required)
    {
        var manage = HasPermission("ponches.manage");

        if (!manage && !HasPermission("workspace.ponches.view"))
            return Forbid();

        if (!manage && !required.Any(HasPermission))
            return Forbid();

        // Eliminar un colaborador puede eliminarlo también
        // de los relojes físicos: exige ambos permisos.
        if (!manage &&
            (route.StartsWith(
                "/api/records/collaborator-delete",
                StringComparison.OrdinalIgnoreCase) ||
             route.StartsWith(
                "/api/collaborators/delete",
                StringComparison.OrdinalIgnoreCase)) &&
            !HasPermission("ponches.collaborators.sync"))
        {
            return Forbid();
        }

        var granted = User.Claims
            .Where(c => c.Type == "permission")
            .Select(c => c.Value);

        var operations = PonchesAccess.Operations(granted);

        var actor =
            User.FindFirstValue(ClaimTypes.NameIdentifier) ??
            User.FindFirstValue("sub");

        var organization =
            User.FindFirstValue("organization_id") ??
            User.FindFirstValue("organizationId");

        if (string.IsNullOrWhiteSpace(actor) ||
            !Guid.TryParse(actor, out _) ||
            !Guid.TryParse(organization, out _))
        {
            return Unauthorized();
        }

        if (!TryGetService(out var baseUri, out var key))
        {
            return StatusCode(503, new
            {
                code = "PONCHES_NOT_CONFIGURED",
                message =
                    "Configura Ponches:BaseUrl y Ponches:IntegrationKey en el servidor."
            });
        }

        if (hasBody && Request.ContentLength is > MaxBodyBytes)
        {
            return StatusCode(413, new
            {
                message = "El archivo supera el límite de 8 MB."
            });
        }

        var seconds = Math.Clamp(
            _configuration.GetValue<int?>("Ponches:TimeoutSeconds") ?? 180,
            30,
            300);

        using var timeout =
            CancellationTokenSource.CreateLinkedTokenSource(ct);

        timeout.CancelAfter(TimeSpan.FromSeconds(seconds));

        try
        {
            using var outgoing = new HttpRequestMessage(
                method,
                new Uri(baseUri, route));

            outgoing.Headers.TryAddWithoutValidation(
                "X-Titan-Integration-Key", key);

            outgoing.Headers.TryAddWithoutValidation(
                "X-Titan-Actor", actor);

            outgoing.Headers.TryAddWithoutValidation(
                "X-Titan-Organization", organization);

            outgoing.Headers.TryAddWithoutValidation(
                "X-Titan-Access",
                manage ? "manage" : "delegate");

            outgoing.Headers.TryAddWithoutValidation(
                "X-Titan-Operations",
                string.Join(",", operations));

            if (hasBody)
            {
                outgoing.Content = new StreamContent(Request.Body);

                if (!string.IsNullOrWhiteSpace(Request.ContentType))
                {
                    outgoing.Content.Headers.TryAddWithoutValidation(
                        "Content-Type",
                        Request.ContentType);
                }
            }

            using var incoming = await Client.SendAsync(
                outgoing,
                HttpCompletionOption.ResponseHeadersRead,
                timeout.Token);

            if (incoming.StatusCode ==
                System.Net.HttpStatusCode.Unauthorized)
            {
                _logger.LogWarning(
                    "Ponches rechazó la credencial interna. Ruta: {Route}",
                    route.Split('?')[0]);

                return StatusCode(502, new
                {
                    code = "PONCHES_INTEGRATION_AUTH",
                    message =
                        "La clave de integración no coincide entre TitanMDM y Python. " +
                        "Reinicia ambos con el mismo iniciador."
                });
            }

            var bytes = await incoming.Content.ReadAsByteArrayAsync(
                timeout.Token);

            Response.StatusCode = (int)incoming.StatusCode;
            Response.Headers["Cache-Control"] = "no-store";

            if (incoming.Content.Headers.ContentDisposition is not null)
            {
                Response.Headers["Content-Disposition"] =
                    incoming.Content.Headers.ContentDisposition.ToString();
            }

            return File(
                bytes,
                incoming.Content.Headers.ContentType?.ToString() ??
                "application/json");
        }
        catch (OperationCanceledException)
            when (ct.IsCancellationRequested)
        {
            return StatusCode(499);
        }
        catch (OperationCanceledException ex)
        {
            _logger.LogWarning(
                ex,
                "Ponches superó el tiempo de espera. Ruta: {Route}",
                route.Split('?')[0]);

            return StatusCode(504, new
            {
                code = "PONCHES_TIMEOUT",
                message =
                    "La operación tardó demasiado. Consulta el historial antes " +
                    "de volver a ejecutar una escritura en relojes."
            });
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(
                ex,
                "No se pudo conectar con Python.");

            return StatusCode(503, new
            {
                code = "PONCHES_UNREACHABLE",
                message =
                    "El servicio interno de Ponches no responde. " +
                    "Revisa el iniciador y sus registros."
            });
        }
    }

    private bool HasPermission(string value) =>
        User.Claims.Any(c =>
            c.Type == "permission" &&
            string.Equals(
                c.Value,
                value,
                StringComparison.OrdinalIgnoreCase));

    private bool TryGetService(out Uri baseUri, out string key)
    {
        baseUri = null!;
        key = _configuration["Ponches:IntegrationKey"] ?? "";

        if (key.Length < 32 ||
            !Uri.TryCreate(
                _configuration["Ponches:BaseUrl"],
                UriKind.Absolute,
                out var candidate) ||
            candidate.Scheme != Uri.UriSchemeHttp ||
            candidate.Host is not ("localhost" or "127.0.0.1"))
        {
            return false;
        }

        baseUri = candidate;
        return true;
    }
}

public static class PonchesAccess
{
    private static readonly Dictionary<string, string[]> Map =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["ponches.dashboard.view"] = ["attendance.read", "devices.read"],
            ["ponches.records.view"] = ["attendance.read"],
            ["ponches.history.view"] = ["settings.read", "attendance.read"],
            ["ponches.remote.create"] = ["remote_punch", "devices.read", "attendance.read"],
            ["ponches.devices.view"] = ["devices.read", "zk.read"],
            ["ponches.devices.manage"] = ["devices.read", "devices.write", "devices.delete", "zk.read"],
            ["ponches.employees.view"] = ["attendance.read"],
            ["ponches.collaborators.view"] = ["collaborators.read", "devices.read", "schedules.read"],
            ["ponches.collaborators.manage"] = ["collaborators.read", "collaborators.write", "devices.read", "schedules.read"],
            ["ponches.collaborators.sync"] = ["collaborators.read", "collaborators.sync", "devices.read", "zk.read", "zk.push", "zk.clone", "zk.move", "zk.delete"],
            ["ponches.schedules.view"] = ["schedules.read"],
            ["ponches.schedules.manage"] = ["schedules.read", "schedules.write"],
            ["ponches.inventory.view"] = ["inventory.read", "devices.read", "zk.read"],
            ["ponches.inventory.manage"] = ["inventory.read", "inventory.write", "devices.read", "devices.write", "zk.read"],
            ["ponches.bulk.execute"] = ["bulk.execute", "devices.read", "zk.read", "zk.enroll"],
            ["ponches.reports.view"] = ["reports.read", "attendance.read", "exports.read", "schedules.read"],
            ["ponches.advanced-reports.view"] = ["reports.read", "attendance.read", "exports.read", "schedules.read"],
            ["ponches.export"] = ["exports.read", "reports.export", "attendance.read"],
            ["ponches.sync.view"] = ["sync.read"],
            ["ponches.sync.run"] = ["sync.read", "sync.run"],
            ["ponches.settings.view"] = ["settings.read"],
            ["ponches.settings.manage"] = ["settings.read", "settings.write"],
        };

    public static string[] Operations(IEnumerable<string> permissions)
    {
        var granted = permissions.ToHashSet(
            StringComparer.OrdinalIgnoreCase);

        var values = Map
            .Where(pair => granted.Contains(pair.Key))
            .SelectMany(pair => pair.Value);

        if (granted.Contains("ponches.manage"))
        {
            values = Map.Values.SelectMany(x => x).Concat(
                new[]
                {
                    "users.read", "users.write", "users.delete",
                    "roles.read", "roles.write", "payroll.run",
                    "schema.admin", "zk.sync"
                });
        }

        return values
            .Distinct(StringComparer.Ordinal)
            .OrderBy(x => x)
            .ToArray();
    }

    public static string[] Required(string path, string method)
    {
        var parts = path.ToLowerInvariant().Split('/');
        var root = parts[0];
        var action = parts.Length > 1 ? parts[1] : "";
        var read = method.Equals(
            "GET",
            StringComparison.OrdinalIgnoreCase);

        if (root == "settings")
            return [read ? "ponches.settings.view" : "ponches.settings.manage"];

        if (root == "schema")
            return read ? ["ponches.history.view"] : [];

        if (root == "payroll" &&
            action == "overtime" &&
            method == "POST")
        {
            return ["ponches.reports.view", "ponches.advanced-reports.view"];
        }

        if (root == "payroll" && action == "rotations")
            return [read ? "ponches.schedules.view" : "ponches.schedules.manage"];

        if (root == "records")
        {
            if (action == "export" &&
                parts.Length == 3 &&
                parts[2] is "excel" or "pdf")
            {
                return ["ponches.export"];
            }

            if (action == "export-devices" && read)
                return ["ponches.export", "ponches.reports.view", "ponches.advanced-reports.view"];

            if (action is "app-users" or "app-roles")
                return [];

            if (action == "inventory-devices")
                return [read ? "ponches.inventory.view" : "ponches.inventory.manage"];

            if (action == "schedules")
                return [read ? "ponches.schedules.view" : "ponches.schedules.manage"];

            if (action == "sync-history" && read)
                return ["ponches.sync.view", "ponches.sync.run"];

            if (action == "sync-now" && method == "POST")
                return ["ponches.sync.run"];

            if (action is "remote-punch" or "remote-devices")
                return ["ponches.remote.create"];

            if (action is "collab-push" or "collab-clone" or
                "collab-delete-clocks" or "collab-reconcile")
            {
                return read
                    ? ["ponches.collaborators.view", "ponches.collaborators.sync"]
                    : ["ponches.collaborators.sync"];
            }

            if (action == "collaborator-copy" && !read)
                return ["ponches.collaborators.sync"];

            if (action.StartsWith(
                "collaborator",
                StringComparison.Ordinal))
            {
                return [read
                    ? "ponches.collaborators.view"
                    : "ponches.collaborators.manage"];
            }

            if (action == "bulk-enroll")
                return ["ponches.bulk.execute"];

            if (action == "managed-devices" && read)
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

            if (action == "managed-devices")
                return ["ponches.devices.manage", "ponches.inventory.manage"];

            if (action == "device-health" && read)
                return ["ponches.devices.view", "ponches.dashboard.view"];

            if (action == "employees" && read)
                return ["ponches.employees.view"];

            if (action == "devices" && read)
                return ["ponches.records.view", "ponches.export", "ponches.reports.view", "ponches.advanced-reports.view"];

            if (action is "dashboard-combined" or "summary" or
                "stats" or "ops-overview")
            {
                return read ? ["ponches.dashboard.view"] : [];
            }

            if (action is "recent" or "search" or "columns")
                return read ? ["ponches.records.view", "ponches.dashboard.view"] : [];
        }

        if (root == "devices")
        {
            if (parts.Length == 3 &&
                parts[2] == "test" &&
                method == "POST")
            {
                return ["ponches.devices.view", "ponches.inventory.view"];
            }

            if (action == "enroll-bio" && method == "POST")
                return ["ponches.bulk.execute"];

            return read
                ? ["ponches.inventory.view", "ponches.devices.view", "ponches.collaborators.sync"]
                : ["ponches.collaborators.sync"];
        }

        if (root == "collaborators")
        {
            if (!read &&
                action is "collaborator-sync" or "copy-device" or "collab-push")
            {
                return ["ponches.collaborators.sync"];
            }

            return [read
                ? "ponches.collaborators.view"
                : "ponches.collaborators.manage"];
        }

        return [];
    }
}