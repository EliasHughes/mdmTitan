using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TitanMDM.Application.Groups;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/device-groups")]
public sealed class DeviceGroupsController
    : ControllerBase
{
    private readonly IDeviceGroupService
        _service;

    public DeviceGroupsController(
        IDeviceGroupService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        CancellationToken cancellationToken)
    {
        var organizationId =
            GetOrganizationId();

        if (organizationId is null)
            return Unauthorized();

        return Ok(
            await _service.GetAllAsync(
                organizationId.Value,
                cancellationToken));
    }

    [HttpGet("{groupId:guid}")]
    public async Task<IActionResult> Get(
        Guid groupId,
        CancellationToken cancellationToken)
    {
        var organizationId =
            GetOrganizationId();

        if (organizationId is null)
            return Unauthorized();

        var result =
            await _service.GetByIdAsync(
                organizationId.Value,
                groupId,
                cancellationToken);

        return result is null
            ? NotFound()
            : Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        CreateDeviceGroupRequest request,
        CancellationToken cancellationToken)
    {
        var organizationId =
            GetOrganizationId();

        if (organizationId is null)
            return Unauthorized();

        try
        {
            var result =
                await _service.CreateAsync(
                    organizationId.Value,
                    request,
                    cancellationToken);

            return Created(
                $"/api/device-groups/{result.Id}",
                result);
        }
        catch (
            InvalidOperationException exception)
        {
            return BadRequest(
                new
                {
                    message =
                        exception.Message
                });
        }
    }

    [HttpPut("{groupId:guid}")]
    public async Task<IActionResult> Update(
        Guid groupId,
        UpdateDeviceGroupRequest request,
        CancellationToken cancellationToken)
    {
        var organizationId =
            GetOrganizationId();

        if (organizationId is null)
            return Unauthorized();

        try
        {
            return Ok(
                await _service.UpdateAsync(
                    organizationId.Value,
                    groupId,
                    request,
                    cancellationToken));
        }
        catch (
            InvalidOperationException exception)
        {
            return BadRequest(
                new
                {
                    message =
                        exception.Message
                });
        }
    }

    [HttpPost("{groupId:guid}/members")]
    public async Task<IActionResult> AddMembers(
        Guid groupId,
        AddGroupMembersRequest request,
        CancellationToken cancellationToken)
    {
        var organizationId =
            GetOrganizationId();

        if (organizationId is null)
            return Unauthorized();

        await _service.AddMembersAsync(
            organizationId.Value,
            groupId,
            request.DeviceIds,
            cancellationToken);

        return NoContent();
    }

    [HttpDelete(
        "{groupId:guid}/members/{deviceId:guid}")]
    public async Task<IActionResult>
        RemoveMember(
            Guid groupId,
            Guid deviceId,
            CancellationToken cancellationToken)
    {
        var organizationId =
            GetOrganizationId();

        if (organizationId is null)
            return Unauthorized();

        await _service.RemoveMemberAsync(
            organizationId.Value,
            groupId,
            deviceId,
            cancellationToken);

        return NoContent();
    }

    [HttpPost("{groupId:guid}/commands")]
    public async Task<IActionResult>
        ExecuteCommand(
            Guid groupId,
            GroupCommandRequest request,
            CancellationToken cancellationToken)
    {
        var organizationId =
            GetOrganizationId();

        var userId =
            GetUserId();

        if (
            organizationId is null ||
            userId is null)
        {
            return Unauthorized();
        }

        var count =
            await _service.ExecuteCommandAsync(
                organizationId.Value,
                userId.Value,
                groupId,
                request,
                cancellationToken);

        return Ok(
            new
            {
                queuedDevices = count
            });
    }

    [HttpDelete("{groupId:guid}")]
    public async Task<IActionResult> Delete(
        Guid groupId,
        CancellationToken cancellationToken)
    {
        var organizationId =
            GetOrganizationId();

        if (organizationId is null)
            return Unauthorized();

        await _service.DeleteAsync(
            organizationId.Value,
            groupId,
            cancellationToken);

        return NoContent();
    }

    private Guid? GetOrganizationId()
    {
        var value =
            User.FindFirstValue(
                "organization_id");

        return Guid.TryParse(
            value,
            out var result)
            ? result
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
            out var result)
            ? result
            : null;
    }
}