using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TitanMDM.Application.Android.Policies;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/policies/{policyId:guid}/android")]
public sealed class AndroidPoliciesController : ControllerBase
{
    private readonly IAndroidPolicyPublisher _publisher;
    private readonly ILogger<AndroidPoliciesController> _logger;

    public AndroidPoliciesController(
        IAndroidPolicyPublisher publisher,
        ILogger<AndroidPoliciesController> logger)
    {
        _publisher =
            publisher ??
            throw new ArgumentNullException(nameof(publisher));

        _logger =
            logger ??
            throw new ArgumentNullException(nameof(logger));
    }

    // ============================================================
    // POST /api/policies/{policyId}/android/publish
    // ============================================================

    [HttpPost("publish")]
    public async Task<IActionResult> Publish(
        Guid policyId,
        CancellationToken cancellationToken)
    {
        var organizationId =
            GetOrganizationId();

        if (organizationId is null)
        {
            return Unauthorized(
                new
                {
                    code = "ORGANIZATION_NOT_FOUND",
                    message =
                        "No fue posible determinar la organización del usuario autenticado."
                });
        }

        try
        {
            var result =
                await _publisher.PublishAsync(
                    organizationId.Value,
                    policyId,
                    cancellationToken);

            return Ok(result);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (InvalidOperationException exception)
        {
            _logger.LogWarning(
                exception,
                "Android policy publication rejected. OrganizationId={OrganizationId}, PolicyId={PolicyId}",
                organizationId.Value,
                policyId);

            return BadRequest(
                new
                {
                    code =
                        "ANDROID_POLICY_PUBLISH_REJECTED",

                    message =
                        exception.Message
                });
        }
        catch (Exception exception)
        {
            _logger.LogError(
                exception,
                "Unexpected Android policy publication error. OrganizationId={OrganizationId}, PolicyId={PolicyId}",
                organizationId.Value,
                policyId);

            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new
                {
                    code =
                        "ANDROID_POLICY_PUBLISH_FAILED",

                    message =
                        "Ocurrió un error inesperado al publicar la política en Android Enterprise."
                });
        }
    }

    // ============================================================
    // GET /api/policies/{policyId}/android/publication
    // ============================================================

    [HttpGet("publication")]
    public async Task<IActionResult> GetPublication(
        Guid policyId,
        CancellationToken cancellationToken)
    {
        var organizationId =
            GetOrganizationId();

        if (organizationId is null)
        {
            return Unauthorized(
                new
                {
                    code = "ORGANIZATION_NOT_FOUND",
                    message =
                        "No fue posible determinar la organización del usuario autenticado."
                });
        }

        try
        {
            var result =
                await _publisher
                    .GetCurrentPublicationAsync(
                        organizationId.Value,
                        policyId,
                        cancellationToken);

            if (result is null)
            {
                return NotFound(
                    new
                    {
                        code =
                            "ANDROID_POLICY_PUBLICATION_NOT_FOUND",

                        message =
                            "La versión actual de esta política todavía no posee una publicación Android."
                    });
            }

            return Ok(result);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            _logger.LogError(
                exception,
                "Unable to retrieve Android policy publication. OrganizationId={OrganizationId}, PolicyId={PolicyId}",
                organizationId.Value,
                policyId);

            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new
                {
                    code =
                        "ANDROID_POLICY_PUBLICATION_QUERY_FAILED",

                    message =
                        "No fue posible consultar el estado de publicación de la política."
                });
        }
    }

    // ============================================================
    // GET /api/policies/{policyId}/android/verify
    //
    // IMPORTANTE:
    // Este endpoint consulta Google Android Management API.
    // No se limita a consultar TitanMDM SQL Server.
    // ============================================================

    [HttpGet("verify")]
    public async Task<IActionResult> Verify(
        Guid policyId,
        CancellationToken cancellationToken)
    {
        var organizationId =
            GetOrganizationId();

        if (organizationId is null)
        {
            return Unauthorized(
                new
                {
                    code = "ORGANIZATION_NOT_FOUND",
                    message =
                        "No fue posible determinar la organización del usuario autenticado."
                });
        }

        try
        {
            var result =
                await _publisher.VerifyRemoteAsync(
                    organizationId.Value,
                    policyId,
                    cancellationToken);

            return Ok(result);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (InvalidOperationException exception)
        {
            _logger.LogWarning(
                exception,
                "Android policy verification rejected. OrganizationId={OrganizationId}, PolicyId={PolicyId}",
                organizationId.Value,
                policyId);

            return BadRequest(
                new
                {
                    code =
                        "ANDROID_POLICY_VERIFICATION_REJECTED",

                    message =
                        exception.Message
                });
        }
        catch (Exception exception)
        {
            _logger.LogError(
                exception,
                "Unexpected Android policy verification error. OrganizationId={OrganizationId}, PolicyId={PolicyId}",
                organizationId.Value,
                policyId);

            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new
                {
                    code =
                        "ANDROID_POLICY_VERIFICATION_FAILED",

                    message =
                        "No fue posible verificar la política contra Google Android Management API."
                });
        }
    }

    // ============================================================
    // ORGANIZATION CLAIM
    // ============================================================

    private Guid? GetOrganizationId()
    {
        var value =
            User.FindFirstValue(
                "organization_id");

        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return Guid.TryParse(
            value,
            out var organizationId)
            ? organizationId
            : null;
    }
}