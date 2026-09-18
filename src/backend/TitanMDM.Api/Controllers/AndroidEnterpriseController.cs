using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TitanMDM.Application.AndroidEnterprise;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/android-enterprise")]
public sealed class AndroidEnterpriseController
    : ControllerBase
{
    private readonly IAndroidEnterpriseService _service;

    public AndroidEnterpriseController(
        IAndroidEnterpriseService service)
    {
        _service = service;
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus(
        CancellationToken cancellationToken)
    {
        var organizationId =
            GetOrganizationId();

        if (organizationId is null)
            return Unauthorized();

        return Ok(
            await _service.GetStatusAsync(
                organizationId.Value,
                cancellationToken));
    }

    [HttpPost("signup")]
    public async Task<IActionResult> CreateSignup(
        CancellationToken cancellationToken)
    {
        var organizationId =
            GetOrganizationId();

        if (organizationId is null)
            return Unauthorized();

        try
        {
            return Ok(
                await _service.CreateSignupUrlAsync(
                    organizationId.Value,
                    cancellationToken));
        }
        catch (Exception exception)
        {
            return BadRequest(new
            {
                message = exception.Message
            });
        }
    }

    [HttpGet("callback")]
    [AllowAnonymous]
    public async Task<IActionResult> Callback(
        [FromQuery] string enterpriseToken,
        [FromQuery] string signupUrlName,
        [FromQuery] Guid organizationId,
        CancellationToken cancellationToken)
    {
        try
        {
            await _service.CompleteSignupAsync(
                organizationId,
                enterpriseToken,
                signupUrlName,
                cancellationToken);

            return Redirect(
                "/enrollment?androidEnterprise=connected");
        }
        catch (Exception exception)
        {
            return BadRequest(new
            {
                message = exception.Message
            });
        }
    }

    [HttpGet("enrollments")]
    public async Task<IActionResult> GetEnrollments(
        CancellationToken cancellationToken)
    {
        var organizationId =
            GetOrganizationId();

        if (organizationId is null)
            return Unauthorized();

        return Ok(
            await _service.GetEnrollmentsAsync(
                organizationId.Value,
                cancellationToken));
    }

    [HttpPost("enrollments")]
    public async Task<IActionResult> CreateEnrollment(
        [FromBody]
        CreateAndroidEnrollmentRequest request,
        CancellationToken cancellationToken)
    {
        var organizationId =
            GetOrganizationId();

        var userId =
            GetUserId();

        if (organizationId is null ||
            userId is null)
        {
            return Unauthorized();
        }

        try
        {
            var result =
                await _service.CreateEnrollmentAsync(
                    organizationId.Value,
                    userId.Value,
                    request,
                    cancellationToken);

            return Created(
                $"/api/android-enterprise/enrollments/{result.Id}",
                result);
        }
        catch (Exception exception)
        {
            return BadRequest(new
            {
                message = exception.Message
            });
        }
    }

    [HttpDelete("enrollments/{id:guid}")]
    public async Task<IActionResult> RevokeEnrollment(
        Guid id,
        CancellationToken cancellationToken)
    {
        var organizationId =
            GetOrganizationId();

        if (organizationId is null)
            return Unauthorized();

        try
        {
            var result =
                await _service.RevokeEnrollmentAsync(
                    organizationId.Value,
                    id,
                    cancellationToken);

            return result
                ? NoContent()
                : NotFound();
        }
        catch (Exception exception)
        {
            return BadRequest(new
            {
                message = exception.Message
            });
        }
    }

    private Guid? GetOrganizationId()
    {
        var value =
            User.FindFirstValue(
                "organization_id");

        return Guid.TryParse(
            value,
            out var id)
            ? id
            : null;
    }

    private Guid? GetUserId()
    {
        var value =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        return Guid.TryParse(
            value,
            out var id)
            ? id
            : null;
    }
}