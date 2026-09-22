using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TitanMDM.Domain.Entities;
using TitanMDM.Domain.Enums;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Route("api/remote-sessions")]
[Authorize]
public sealed class RemoteSessionsController
    : ControllerBase
{
    private readonly TitanMdmDbContext
        _dbContext;

    private readonly ILogger<
        RemoteSessionsController> _logger;

    public RemoteSessionsController(
        TitanMdmDbContext dbContext,
        ILogger<RemoteSessionsController> logger)
    {
        _dbContext =
            dbContext;

        _logger =
            logger;
    }

    [HttpGet]
    public async Task<ActionResult>
        GetSessions(
            [FromQuery] int take = 50,
            CancellationToken cancellationToken = default)
    {
        if (!HasPermission(
                "remote.view"))
        {
            return Forbid();
        }

        var organizationId =
            GetOrganizationId();

        take =
            Math.Clamp(
                take,
                1,
                200);

        var sessions =
            await _dbContext
                .RemoteSessions
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                        organizationId)
                .OrderByDescending(
                    x =>
                        x.RequestedAtUtc)
                .Take(take)
                .Select(
                    x => new
                    {
                        x.Id,
                        x.DeviceId,
                        x.RequestedByUserId,
                        x.TechnicianName,
                        x.Reason,

                        status =
                            x.Status.ToString(),

                        x.AllowKeyboard,
                        x.AllowMouse,
                        x.AllowClipboard,
                        x.AllowFileTransfer,

                        x.RequestedAtUtc,
                        x.ExpiresAtUtc,
                        x.ConnectedAtUtc,
                        x.DisconnectedAtUtc,
                        x.FailureReason,
                        x.TerminationReason,
                        x.TerminatedBy
                    })
                .ToListAsync(
                    cancellationToken);

        return Ok(
            sessions);
    }

    [HttpGet("{sessionId:guid}")]
    public async Task<ActionResult>
        GetSession(
            Guid sessionId,
            CancellationToken cancellationToken = default)
    {
        if (!HasPermission(
                "remote.view"))
        {
            return Forbid();
        }

        var organizationId =
            GetOrganizationId();

        var session =
            await _dbContext
                .RemoteSessions
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x =>
                        x.Id == sessionId &&
                        x.OrganizationId ==
                        organizationId,
                    cancellationToken);

        if (session is null)
        {
            return NotFound();
        }

        var events =
            await _dbContext
                .RemoteSessionEvents
                .AsNoTracking()
                .Where(
                    x =>
                        x.RemoteSessionId ==
                        sessionId &&
                        x.OrganizationId ==
                        organizationId)
                .OrderBy(
                    x =>
                        x.OccurredAtUtc)
                .Select(
                    x => new
                    {
                        x.Id,
                        x.EventType,
                        x.Description,
                        x.UserId,
                        x.MetadataJson,
                        x.OccurredAtUtc
                    })
                .ToListAsync(
                    cancellationToken);

        return Ok(
            new
            {
                session.Id,
                session.DeviceId,
                session.RequestedByUserId,
                session.TechnicianName,
                session.Reason,

                status =
                    session.Status.ToString(),

                session.AllowKeyboard,
                session.AllowMouse,
                session.AllowClipboard,
                session.AllowFileTransfer,

                session.RequestedAtUtc,
                session.ExpiresAtUtc,
                session.ConnectedAtUtc,
                session.DisconnectedAtUtc,

                session.FailureReason,
                session.TerminationReason,
                session.TerminatedBy,

                events
            });
    }

    [HttpPost]
    public async Task<ActionResult>
        CreateSession(
            [FromBody]
            CreateRemoteSessionRequest request,
            CancellationToken cancellationToken = default)
    {
        if (!HasPermission(
                "remote.manage"))
        {
            return Forbid();
        }

        if (request.DeviceId ==
            Guid.Empty)
        {
            return BadRequest(
                new
                {
                    message =
                        "DeviceId es obligatorio."
                });
        }

        if (string.IsNullOrWhiteSpace(
                request.Reason))
        {
            return BadRequest(
                new
                {
                    message =
                        "Debe indicar el motivo de la sesión."
                });
        }

        var organizationId =
            GetOrganizationId();

        var userId =
            GetUserId();

        var technicianName =
            User.FindFirstValue(
                ClaimTypes.Name)
            ?? "TitanMDM Technician";

        var device =
            await _dbContext
                .Devices
                .FirstOrDefaultAsync(
                    x =>
                        x.Id ==
                        request.DeviceId &&
                        x.OrganizationId ==
                        organizationId &&
                        !x.IsDeleted,
                    cancellationToken);

        if (device is null)
        {
            return NotFound(
                new
                {
                    message =
                        "El dispositivo no existe dentro de la organización."
                });
        }

        if (device.Platform !=
            DevicePlatform.Windows)
        {
            return BadRequest(
                new
                {
                    message =
                        "El control remoto interactivo de este bloque está disponible para Windows."
                });
        }

        if (!device.IsManaged)
        {
            return Conflict(
                new
                {
                    message =
                        "El dispositivo no está administrado actualmente por TitanMDM."
                });
        }

        var existing =
            await _dbContext
                .RemoteSessions
                .AnyAsync(
                    x =>
                        x.OrganizationId ==
                        organizationId &&
                        x.DeviceId ==
                        request.DeviceId &&
                        (
                            x.Status ==
                                RemoteSessionStatus.Requested
                            ||
                            x.Status ==
                                RemoteSessionStatus.Connecting
                            ||
                            x.Status ==
                                RemoteSessionStatus.Connected
                            ||
                            x.Status ==
                                RemoteSessionStatus.Disconnecting
                        ),
                    cancellationToken);

        if (existing)
        {
            return Conflict(
                new
                {
                    message =
                        "El dispositivo ya posee una sesión remota activa o en proceso."
                });
        }

        var durationMinutes =
            Math.Clamp(
                request.MaximumDurationMinutes,
                5,
                480);

        var session =
            new RemoteSession(
                organizationId,
                device.Id,
                userId,
                technicianName,
                request.Reason,
                request.AllowKeyboard,
                request.AllowMouse,
                request.AllowClipboard,
                request.AllowFileTransfer,
                DateTime.UtcNow.AddMinutes(
                    durationMinutes));

        var auditEvent =
            new RemoteSessionEvent(
                organizationId,
                session.Id,
                "SESSION_REQUESTED",
                $"Sesión remota solicitada por {technicianName}.",
                userId);

        _dbContext.RemoteSessions.Add(
            session);

        _dbContext.RemoteSessionEvents.Add(
            auditEvent);

        await _dbContext.SaveChangesAsync(
            cancellationToken);

        _logger.LogInformation(
            "Remote session {SessionId} created for device {DeviceId} by user {UserId}.",
            session.Id,
            device.Id,
            userId);

        return CreatedAtAction(
            nameof(GetSession),
            new
            {
                sessionId =
                    session.Id
            },
            new
            {
                session.Id,
                session.DeviceId,
                session.TechnicianName,
                session.Reason,

                status =
                    session.Status.ToString(),

                session.AllowKeyboard,
                session.AllowMouse,
                session.AllowClipboard,
                session.AllowFileTransfer,

                session.RequestedAtUtc,
                session.ExpiresAtUtc
            });
    }

    [HttpPost("{sessionId:guid}/terminate")]
    public async Task<ActionResult>
        TerminateSession(
            Guid sessionId,
            [FromBody]
            TerminateRemoteSessionRequest? request,
            CancellationToken cancellationToken = default)
    {
        if (!HasPermission(
                "remote.manage"))
        {
            return Forbid();
        }

        var organizationId =
            GetOrganizationId();

        var userId =
            GetUserId();

        var technicianName =
            User.FindFirstValue(
                ClaimTypes.Name)
            ?? userId.ToString();

        var session =
            await _dbContext
                .RemoteSessions
                .FirstOrDefaultAsync(
                    x =>
                        x.Id ==
                        sessionId &&
                        x.OrganizationId ==
                        organizationId,
                    cancellationToken);

        if (session is null)
        {
            return NotFound();
        }

        session.Complete(
            technicianName,
            request?.Reason
            ?? "Sesión finalizada desde TitanMDM.");

        _dbContext.RemoteSessionEvents.Add(
            new RemoteSessionEvent(
                organizationId,
                session.Id,
                "SESSION_TERMINATED",
                $"Sesión finalizada por {technicianName}.",
                userId));

        await _dbContext.SaveChangesAsync(
            cancellationToken);

        return Ok(
            new
            {
                session.Id,

                status =
                    session.Status.ToString(),

                session.DisconnectedAtUtc,
                session.TerminatedBy,
                session.TerminationReason
            });
    }

    private bool HasPermission(
        string permission)
    {
        return User.Claims.Any(
            claim =>
                claim.Type ==
                    "permission"
                &&
                string.Equals(
                    claim.Value,
                    permission,
                    StringComparison.OrdinalIgnoreCase));
    }

    private Guid GetOrganizationId()
    {
        var value =
            User.FindFirstValue(
                "organization_id");

        if (!Guid.TryParse(
                value,
                out var organizationId)
            ||
            organizationId ==
            Guid.Empty)
        {
            throw new UnauthorizedAccessException(
                "Organization claim is missing.");
        }

        return organizationId;
    }

    private Guid GetUserId()
    {
        var value =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier);

        if (!Guid.TryParse(
                value,
                out var userId)
            ||
            userId ==
            Guid.Empty)
        {
            throw new UnauthorizedAccessException(
                "User claim is missing.");
        }

        return userId;
    }
}

public sealed record CreateRemoteSessionRequest(
    Guid DeviceId,
    string Reason,
    bool AllowKeyboard = true,
    bool AllowMouse = true,
    bool AllowClipboard = false,
    bool AllowFileTransfer = false,
    int MaximumDurationMinutes = 120);

public sealed record TerminateRemoteSessionRequest(
    string? Reason);