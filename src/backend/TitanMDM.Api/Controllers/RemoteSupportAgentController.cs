using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TitanMDM.Api.Services;
using TitanMDM.Application.Devices.Agent;
using TitanMDM.Domain.Entities;
using TitanMDM.Domain.Enums;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Route("api/device/remote-support")]
[AllowAnonymous]
public sealed class RemoteSupportAgentController
    : ControllerBase
{
    private readonly TitanMdmDbContext
        _dbContext;

    private readonly IDeviceAuthenticator
        _deviceAuthenticator;

    private readonly RemoteSupportNotifier
        _notifier;

    private readonly ILogger<
        RemoteSupportAgentController> _logger;
    
    private readonly RemoteHostTokenService
    _remoteHostTokenService;

    public RemoteSupportAgentController(
    TitanMdmDbContext dbContext,
    IDeviceAuthenticator deviceAuthenticator,
    RemoteSupportNotifier notifier,
    RemoteHostTokenService remoteHostTokenService,
    ILogger<RemoteSupportAgentController> logger)
{
    _dbContext =
        dbContext;

    _deviceAuthenticator =
        deviceAuthenticator;

    _notifier =
        notifier;

    _remoteHostTokenService =
        remoteHostTokenService;

    _logger =
        logger;
}

    [HttpGet("pending")]
    public async Task<IActionResult> GetPending(
        CancellationToken cancellationToken)
    {
        var authentication =
            await AuthenticateDeviceAsync(
                cancellationToken);

        if (!authentication.Success)
        {
            return authentication.Error!;
        }

        var now =
            DateTime.UtcNow;

        var sessions =
            await _dbContext
                .RemoteSessions
                .Where(
                    x =>
                        x.DeviceId ==
                            authentication.DeviceId
                        &&
                        (
                            x.Status ==
                                RemoteSessionStatus.Requested
                            ||
                            x.Status ==
                                RemoteSessionStatus.Connecting
                            ||
                            x.Status ==
                                RemoteSessionStatus.Connected
                        ))
                .OrderBy(
                    x =>
                        x.RequestedAtUtc)
                .ToListAsync(
                    cancellationToken);

        foreach (var expired in
                 sessions.Where(
                     x =>
                         x.ExpiresAtUtc <= now
                         &&
                         !x.IsTerminal))
        {
            expired.Expire();

            _dbContext.RemoteSessionEvents.Add(
                new RemoteSessionEvent(
                    expired.OrganizationId,
                    expired.Id,
                    "SESSION_EXPIRED",
                    "La sesión remota expiró antes de finalizar."));
        }

        if (_dbContext.ChangeTracker
            .HasChanges())
        {
            await _dbContext
                .SaveChangesAsync(
                    cancellationToken);
        }

        var active =
            sessions
                .Where(
                    x =>
                        !x.IsTerminal
                        &&
                        x.ExpiresAtUtc > now)
                .Select(
                    x => new
                    {
                        sessionId =
                            x.Id,

                        deviceId =
                            x.DeviceId,

                        requestedByUserId =
                            x.RequestedByUserId,

                        technicianDisplayName =
                            x.TechnicianName,

                        reason =
                            x.Reason,

                        allowKeyboard =
                            x.AllowKeyboard,

                        allowMouse =
                            x.AllowMouse,

                        allowClipboard =
                            x.AllowClipboard,

                        allowFileTransfer =
                            x.AllowFileTransfer,

                        requestedAtUtc =
                            x.RequestedAtUtc,

                        expiresAtUtc =
                            x.ExpiresAtUtc,

                        status =
                            x.Status.ToString()
                    })
                .ToList();

        return Ok(active);
    }

    [HttpPost("{sessionId:guid}/connecting")]
    public async Task<IActionResult> Connecting(
        Guid sessionId,
        CancellationToken cancellationToken)
    {

    [HttpPost("{sessionId:guid}/host-bootstrap")]
public async Task<IActionResult> CreateHostBootstrap(
    Guid sessionId,
    CancellationToken cancellationToken)
{
    var authentication =
        await AuthenticateDeviceAsync(
            cancellationToken);

    if (!authentication.Success)
    {
        return authentication.Error!;
    }

    var session =
        await _dbContext
            .RemoteSessions
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x =>
                    x.Id == sessionId
                    &&
                    x.DeviceId ==
                        authentication.DeviceId
                    &&
                    !x.IsTerminal,
                cancellationToken);

    if (session is null)
    {
        return NotFound(
            new
            {
                code =
                    "REMOTE_SESSION_NOT_FOUND",

                message =
                    "La sesión remota no existe o ya finalizó."
            });
    }

    if (session.ExpiresAtUtc <=
        DateTime.UtcNow)
    {
        return Conflict(
            new
            {
                code =
                    "REMOTE_SESSION_EXPIRED",

                message =
                    "La sesión remota expiró."
            });
    }

    var lifetime =
        session.ExpiresAtUtc -
        DateTime.UtcNow;

    var token =
        _remoteHostTokenService.Create(
            session.OrganizationId,
            session.DeviceId,
            session.Id,
            lifetime);

    var baseUrl =
        $"{Request.Scheme}://{Request.Host}";

    return Ok(
        new
        {
            sessionId =
                session.Id,

            serverUrl =
                baseUrl,

            accessToken =
                token,

            expiresAtUtc =
                session.ExpiresAtUtc
        });
}
        return await ChangeStateAsync(
            sessionId,
            RemoteAgentTransition.Connecting,
            null,
            cancellationToken);
    }

    [HttpPost("{sessionId:guid}/connected")]
    public async Task<IActionResult> Connected(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        return await ChangeStateAsync(
            sessionId,
            RemoteAgentTransition.Connected,
            null,
            cancellationToken);
    }

    [HttpPost("{sessionId:guid}/completed")]
    public async Task<IActionResult> Completed(
        Guid sessionId,
        [FromBody]
        RemoteAgentCompletedRequest? request,
        CancellationToken cancellationToken)
    {
        return await ChangeStateAsync(
            sessionId,
            RemoteAgentTransition.Completed,
            request?.Reason,
            cancellationToken);
    }

    [HttpPost("{sessionId:guid}/failed")]
    public async Task<IActionResult> Failed(
        Guid sessionId,
        [FromBody]
        RemoteAgentFailedRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(
                request.Reason))
        {
            return BadRequest(
                new
                {
                    code =
                        "INVALID_FAILURE_REASON",

                    message =
                        "Reason es obligatorio."
                });
        }

        return await ChangeStateAsync(
            sessionId,
            RemoteAgentTransition.Failed,
            request.Reason,
            cancellationToken);
    }

    private async Task<IActionResult>
        ChangeStateAsync(
            Guid sessionId,
            RemoteAgentTransition transition,
            string? reason,
            CancellationToken cancellationToken)
    {
        var authentication =
            await AuthenticateDeviceAsync(
                cancellationToken);

        if (!authentication.Success)
        {
            return authentication.Error!;
        }

        var session =
            await _dbContext
                .RemoteSessions
                .FirstOrDefaultAsync(
                    x =>
                        x.Id ==
                            sessionId
                        &&
                        x.DeviceId ==
                            authentication.DeviceId,
                    cancellationToken);

        if (session is null)
        {
            return NotFound(
                new
                {
                    code =
                        "REMOTE_SESSION_NOT_FOUND",

                    message =
                        "La sesión remota no existe para este dispositivo."
                });
        }

        if (session.IsTerminal)
        {
            return Conflict(
                new
                {
                    code =
                        "REMOTE_SESSION_TERMINAL",

                    message =
                        "La sesión remota ya finalizó."
                });
        }

        string eventType;
        string description;

        try
        {
            switch (transition)
            {
                case RemoteAgentTransition.Connecting:

                    session.MarkConnecting();

                    eventType =
                        "AGENT_CONNECTING";

                    description =
                        "El agente Windows inició la preparación de la sesión remota.";

                    break;

                case RemoteAgentTransition.Connected:

                    session.MarkConnected();

                    eventType =
                        "AGENT_CONNECTED";

                    description =
                        "El agente Windows confirmó la sesión remota activa.";

                    break;

                case RemoteAgentTransition.Completed:

                    session.Complete(
                        "WindowsAgent",
                        reason ??
                        "La sesión finalizó desde el agente Windows.");

                    eventType =
                        "AGENT_COMPLETED";

                    description =
                        "El agente Windows confirmó la finalización de la sesión.";

                    break;

                case RemoteAgentTransition.Failed:

                    session.Fail(
                        reason ??
                        "Remote support failure.");

                    eventType =
                        "AGENT_FAILED";

                    description =
                        reason
                        ?? "La sesión remota falló en el agente Windows.";

                    break;

                default:

                    return BadRequest();
            }
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(
                new
                {
                    code =
                        "INVALID_REMOTE_SESSION_STATE",

                    message =
                        ex.Message
                });
        }

        _dbContext.RemoteSessionEvents.Add(
            new RemoteSessionEvent(
                session.OrganizationId,
                session.Id,
                eventType,
                description));

        await _dbContext
            .SaveChangesAsync(
                cancellationToken);

        var payload =
            new
            {
                sessionId =
                    session.Id,

                deviceId =
                    session.DeviceId,

                status =
                    session.Status.ToString(),

                session.ConnectedAtUtc,
                session.DisconnectedAtUtc,

                updatedAtUtc =
                    session.UpdatedAtUtc
            };

        await _notifier.PublishAsync(
            session.OrganizationId,
            session.Id,
            payload,
            cancellationToken);

        _logger.LogInformation(
            "Remote session {SessionId} transitioned to {Status}.",
            session.Id,
            session.Status);

        return Ok(payload);
    }

    private async Task<DeviceAuthenticationResult>
        AuthenticateDeviceAsync(
            CancellationToken cancellationToken)
    {
        var deviceIdHeader =
            Request.Headers[
                    "X-Titan-Device-Id"]
                .FirstOrDefault();

        var deviceSecret =
            Request.Headers[
                    "X-Titan-Device-Secret"]
                .FirstOrDefault();

        if (!Guid.TryParse(
                deviceIdHeader,
                out var deviceId))
        {
            return DeviceAuthenticationResult.Fail(
                Unauthorized(
                    new
                    {
                        code =
                            "INVALID_DEVICE_ID",

                        message =
                            "X-Titan-Device-Id no es válido."
                    }));
        }

        try
        {
            await _deviceAuthenticator
                .AuthenticateAsync(
                    deviceId,
                    deviceSecret
                    ?? string.Empty,
                    cancellationToken);

            return DeviceAuthenticationResult.Ok(
                deviceId);
        }
        catch (DeviceAuthenticationException ex)
        {
            return DeviceAuthenticationResult.Fail(
                Unauthorized(
                    new
                    {
                        code =
                            ex.Code,

                        message =
                            ex.Message
                    }));
        }
    }

    private enum RemoteAgentTransition
    {
        Connecting,
        Connected,
        Completed,
        Failed
    }

    private sealed record DeviceAuthenticationResult(
        bool Success,
        Guid DeviceId,
        IActionResult? Error)
    {
        public static DeviceAuthenticationResult Ok(
            Guid deviceId)
        {
            return new(
                true,
                deviceId,
                null);
        }

        public static DeviceAuthenticationResult Fail(
            IActionResult error)
        {
            return new(
                false,
                Guid.Empty,
                error);
        }
    }
}

public sealed record RemoteAgentCompletedRequest(
    string? Reason);

public sealed record RemoteAgentFailedRequest(
    string Reason);