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
    public Task<IActionResult> Dashboard(
        CancellationToken cancellationToken)
    {
        return ForwardAsync(
            "/api/internal/titan/dashboard",
            cancellationToken);
    }

    [HttpGet("records")]
    public Task<IActionResult> Records(
        [FromQuery] int limit = 100,
        [FromQuery] string search = "",
        CancellationToken cancellationToken = default)
    {
        if (limit is < 1 or > 200 ||
            search.Length > 80)
        {
            return Task.FromResult<IActionResult>(
                BadRequest(new
                {
                    message = "Filtro de registros inválido."
                }));
        }

        var path =
            "/api/internal/titan/records" +
            $"?limit={limit}" +
            $"&search={Uri.EscapeDataString(search)}";

        return ForwardAsync(
            path,
            cancellationToken);
    }

    private async Task<IActionResult> ForwardAsync(
        string path,
        CancellationToken cancellationToken)
    {
        var allowed = User.Claims.Any(claim =>
            claim.Type == "permission" &&
            (string.Equals(
                 claim.Value,
                 "settings.view",
                 StringComparison.OrdinalIgnoreCase) ||
             string.Equals(
                 claim.Value,
                 "settings.manage",
                 StringComparison.OrdinalIgnoreCase)));

        if (!allowed)
            return Forbid();

        var organization =
            User.FindFirstValue("organization_id") ??
            User.FindFirstValue("organizationId");

        if (!Guid.TryParse(organization, out _))
            return Unauthorized();

        var url = _configuration["Ponches:BaseUrl"];
        var key = _configuration["Ponches:IntegrationKey"];

        if (string.IsNullOrWhiteSpace(url) ||
            string.IsNullOrWhiteSpace(key) ||
            key.Length < 32 ||
            !Uri.TryCreate(
                url,
                UriKind.Absolute,
                out var baseUri) ||
            baseUri.Scheme != Uri.UriSchemeHttp ||
            baseUri.Host is not ("localhost" or "127.0.0.1"))
        {
            return StatusCode(
                503,
                new
                {
                    message =
                        "El servicio local de Ponches no está configurado."
                });
        }

        try
        {
            using var request =
                new HttpRequestMessage(
                    HttpMethod.Get,
                    new Uri(baseUri, path));

            request.Headers.TryAddWithoutValidation(
                "X-Titan-Integration-Key",
                key);

            using var response =
                await Client.SendAsync(
                    request,
                    HttpCompletionOption.ResponseHeadersRead,
                    cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Ponches respondió HTTP {Code}.",
                    (int)response.StatusCode);

                return StatusCode(
                    503,
                    new
                    {
                        message =
                            "El servicio de Ponches no está disponible."
                    });
            }

            var json = await response.Content
                .ReadAsStringAsync(cancellationToken);

            return Content(
                json,
                "application/json");
        }
        catch (Exception ex)
            when (ex is HttpRequestException
                     or TaskCanceledException)
        {
            _logger.LogWarning(
                ex,
                "No se pudo consultar Ponches.");

            return StatusCode(
                503,
                new
                {
                    message =
                        "No se pudo conectar con Ponches."
                });
        }
    }
}