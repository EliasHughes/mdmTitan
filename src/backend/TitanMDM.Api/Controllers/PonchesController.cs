using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/ponches")]
public sealed class PonchesController : ControllerBase
{
    private static readonly HttpClient Client = new()
    {
        Timeout = TimeSpan.FromSeconds(20)
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

    [HttpGet("dashboard")]
    public Task<IActionResult> Dashboard(CancellationToken cancellationToken) =>
        ForwardAsync("/api/internal/titan/dashboard", cancellationToken);

    [HttpGet("dashboard-original")]
    public Task<IActionResult> OriginalDashboard(CancellationToken cancellationToken) =>
        ForwardAsync("/api/internal/titan/dashboard-original", cancellationToken);

    [HttpGet("device-health")]
    public Task<IActionResult> DeviceHealth(CancellationToken cancellationToken) =>
        ForwardAsync("/api/internal/titan/device-health", cancellationToken);

    [HttpGet("records")]
    public Task<IActionResult> Records(
        [FromQuery] int limit = 100,
        [FromQuery] string search = "",
        CancellationToken cancellationToken = default)
    {
        if (limit is < 1 or > 200 || search.Length > 80)
            return Task.FromResult<IActionResult>(
                BadRequest(new { message = "Filtro de registros inválido." }));

        var path = "/api/internal/titan/records" +
                   $"?limit={limit}&search={Uri.EscapeDataString(search)}";

        return ForwardAsync(path, cancellationToken);
    }

    [AcceptVerbs("GET", "POST", "PUT", "PATCH", "DELETE")]
    [Route("legacy/{**path}")]
    public async Task<IActionResult> Legacy(
        string path,
        CancellationToken cancellationToken)
    {
        var allowedRoots = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "records", "devices", "collaborators", "payroll",
            "exports", "schema", "settings", "users"
        };

        var segments = (path ?? "")
            .Split('/', StringSplitOptions.RemoveEmptyEntries);

        if (segments.Length == 0 ||
            !allowedRoots.Contains(segments[0]) ||
            segments.Any(s => s is "." or ".." || s.Contains('\\')))
            return NotFound();

        var manage = HasPermission("settings.manage");
        var view = manage || HasPermission("settings.view");

        if (!view) return Forbid();
        if (!HttpMethods.IsGet(Request.Method) && !manage) return Forbid();

        if (!manage &&
            (segments[0].Equals("users", StringComparison.OrdinalIgnoreCase) ||
             segments[0].Equals("settings", StringComparison.OrdinalIgnoreCase) ||
             segments[0].Equals("payroll", StringComparison.OrdinalIgnoreCase) ||
             segments[0].Equals("schema", StringComparison.OrdinalIgnoreCase)))
            return Forbid();

        if (!TryGetService(out var baseUri, out var key))
            return StatusCode(503, new { message = "Ponches no configurado." });

        var actor = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(actor) ||
            !Guid.TryParse(GetOrganization(), out _))
            return Unauthorized();

        try
        {
            var route = "/api/" +
                string.Join("/", segments.Select(Uri.EscapeDataString)) +
                Request.QueryString.Value;

            using var outgoing = new HttpRequestMessage(
                new HttpMethod(Request.Method),
                new Uri(baseUri, route));

            outgoing.Headers.TryAddWithoutValidation(
                "X-Titan-Integration-Key", key);
            outgoing.Headers.TryAddWithoutValidation(
                "X-Titan-Actor", actor);
            outgoing.Headers.TryAddWithoutValidation(
                "X-Titan-Access", manage ? "manage" : "read");

            if (!HttpMethods.IsGet(Request.Method))
            {
                if (Request.ContentLength is > 1_048_576)
                    return StatusCode(413);

                outgoing.Content = new StreamContent(Request.Body);

                if (!string.IsNullOrWhiteSpace(Request.ContentType))
                    outgoing.Content.Headers.TryAddWithoutValidation(
                        "Content-Type", Request.ContentType);
            }

            using var incoming = await Client.SendAsync(
                outgoing, cancellationToken);

            var bytes = await incoming.Content.ReadAsByteArrayAsync(
                cancellationToken);

            Response.StatusCode = (int)incoming.StatusCode;

            return File(
                bytes,
                incoming.Content.Headers.ContentType?.ToString()
                    ?? "application/octet-stream");
        }
        catch (Exception ex)
            when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogWarning(ex, "Ponches no disponible.");
            return StatusCode(503, new { message = "Ponches no disponible." });
        }
    }

    private async Task<IActionResult> ForwardAsync(
        string path,
        CancellationToken cancellationToken)
    {
        if (!HasPermission("settings.view") &&
            !HasPermission("settings.manage"))
            return Forbid();

        if (!Guid.TryParse(GetOrganization(), out _))
            return Unauthorized();

        if (!TryGetService(out var baseUri, out var key))
            return StatusCode(
                503,
                new { message = "El servicio local de Ponches no está configurado." });

        try
        {
            using var outgoing = new HttpRequestMessage(
                HttpMethod.Get,
                new Uri(baseUri, path));

            outgoing.Headers.TryAddWithoutValidation(
                "X-Titan-Integration-Key", key);

            using var incoming = await Client.SendAsync(
                outgoing,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);

            if (!incoming.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Ponches respondió HTTP {Code}.",
                    (int)incoming.StatusCode);

                return StatusCode(
                    503,
                    new { message = "El servicio de Ponches no está disponible." });
            }

            var json = await incoming.Content.ReadAsStringAsync(
                cancellationToken);

            return Content(json, "application/json");
        }
        catch (Exception ex)
            when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogWarning(ex, "No se pudo consultar Ponches.");

            return StatusCode(
                503,
                new { message = "No se pudo conectar con Ponches." });
        }
    }

    private bool HasPermission(string permission) =>
        User.Claims.Any(claim =>
            claim.Type == "permission" &&
            string.Equals(
                claim.Value,
                permission,
                StringComparison.OrdinalIgnoreCase));

    private string? GetOrganization() =>
        User.FindFirstValue("organization_id") ??
        User.FindFirstValue("organizationId");

    private bool TryGetService(out Uri baseUri, out string key)
    {
        key = _configuration["Ponches:IntegrationKey"] ?? "";

        var valid =
            key.Length >= 32 &&
            Uri.TryCreate(
                _configuration["Ponches:BaseUrl"],
                UriKind.Absolute,
                out var candidate) &&
            candidate.Scheme == Uri.UriSchemeHttp &&
            (candidate.Host == "localhost" ||
             candidate.Host == "127.0.0.1");

        baseUri = valid ? candidate! : null!;
        return valid;
    }
}