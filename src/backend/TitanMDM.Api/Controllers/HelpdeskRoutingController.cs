using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TitanMDM.Application.Helpdesk;
using TitanMDM.Infrastructure.Helpdesk;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/helpdesk/routing")]
public sealed class HelpdeskRoutingController : ControllerBase
{
    private readonly IHelpdeskService _service;

    public HelpdeskRoutingController(IHelpdeskService service)
    {
        _service = service;
    }

    [HttpGet("preview")]
    public async Task<IActionResult> Preview(
        [FromQuery] Guid requesterId,
        [FromQuery] string category = "general",
        CancellationToken cancellationToken = default)
    {
        if (!CanManage())
            return Forbid();

        var organizationValue =
            User.FindFirstValue("organization_id") ??
            User.FindFirstValue("organizationId");

        if (!Guid.TryParse(
                organizationValue,
                out var organizationId))
        {
            return Unauthorized();
        }

        if (requesterId == Guid.Empty ||
            string.IsNullOrWhiteSpace(category) ||
            category.Length > 80)
        {
            return BadRequest(new
            {
                message =
                    "Indica un solicitante y una categoría válida."
            });
        }

        if (_service is not HelpdeskService routing)
        {
            return Problem(
                "El servicio de asignación no está disponible.");
        }

        var result = await routing.PreviewRoutingAsync(
            organizationId,
            requesterId,
            category,
            cancellationToken);

        return Ok(result);
    }

    private bool CanManage()
    {
        return User.Claims.Any(claim =>
            claim.Type == "permission" &&
            (string.Equals(
                claim.Value,
                "helpdesk.manage",
                StringComparison.OrdinalIgnoreCase) ||
             string.Equals(
                claim.Value,
                "settings.manage",
                StringComparison.OrdinalIgnoreCase)));
    }
}