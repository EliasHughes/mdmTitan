using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using TitanMDM.Api.Services;
using TitanMDM.Domain.Entities;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Api.Hubs;

[AllowAnonymous]
public sealed class RemoteSupportHub : Hub
{
    public const string Route =
        "/hubs/remote-support";

    private readonly TitanMdmDbContext
        _dbContext;

    private readonly RemoteHostTokenService
        _tokenService;

    private readonly ILogger<
        RemoteSupportHub> _logger;

    public RemoteSupportHub(
        TitanMdmDbContext dbContext,
        RemoteHostTokenService tokenService,
        ILogger<RemoteSupportHub> logger)
    {
        _dbContext =
            dbContext;

        _tokenService =
            tokenService;

        _logger =
            logger;
    }

    public override async Task OnConnectedAsync()
    {
        if (IsHumanConnection())
        {
            var organizationId =
                GetHumanOrganizationId();

            await Groups.AddToGroupAsync(
                Context.ConnectionId,
                OrganizationGroup(
                    organizationId));
        }

        await base.OnConnectedAsync();
    }

    public async Task JoinSession(
        Guid sessionId)
    {
        RequireHumanPermission(
            "remote.view");

        var organizationId =
            GetHumanOrganizationId();

        var exists =
            await _dbContext
                .RemoteSessions
                .AsNoTracking()
                .AnyAsync(
                    x =>
                        x.Id == sessionId
                        &&
                        x.OrganizationId ==
                            organizationId
                        &&
                        !x.IsTerminal);

        if (!exists)
        {
            throw new HubException(
                "La sesión remota no existe o finalizó.");
        }

        await Groups.AddToGroupAsync(
            Context.ConnectionId,
            TechnicianGroup(
                organizationId,
                sessionId));
    }

    public async Task RegisterRemoteHost(
        Guid sessionId)
    {
        var remoteHost =
            ValidateRemoteHost(
                sessionId);

        var session =
            await _dbContext
                .RemoteSessions
                .FirstOrDefaultAsync(
                    x =>
                        x.Id == sessionId
                        &&
                        x.DeviceId ==
                            remoteHost.DeviceId
                        &&
                        x.OrganizationId ==
                            remoteHost.OrganizationId
                        &&
                        !x.IsTerminal);

        if (session is null)
        {
            throw new HubException(
                "La sesión remota no está disponible.");
        }

        session.MarkConnected();

        _dbContext.RemoteSessionEvents.Add(
            new RemoteSessionEvent(
                session.OrganizationId,
                session.Id,
                "REMOTE_HOST_CONNECTED",
                "TitanMDM Remote Host estableció el canal interactivo."));

        await _dbContext.SaveChangesAsync();

        await Groups.AddToGroupAsync(
            Context.ConnectionId,
            HostGroup(
                session.OrganizationId,
                session.Id));

        await Clients
            .Group(
                TechnicianGroup(
                    session.OrganizationId,
                    session.Id))
            .SendAsync(
                "RemoteSessionUpdated",
                new
                {
                    sessionId =
                        session.Id,

                    status =
                        session.Status.ToString(),

                    connectedAtUtc =
                        session.ConnectedAtUtc
                });

        _logger.LogInformation(
            "RemoteHost connected for session {SessionId}.",
            sessionId);
    }

    public async Task PublishFrame(
        Guid sessionId,
        long sequence,
        int width,
        int height,
        string mimeType,
        string base64Data,
        DateTime capturedAtUtc)
    {
        var remoteHost =
            ValidateRemoteHost(
                sessionId);

        if (base64Data.Length >
            4_000_000)
        {
            throw new HubException(
                "Frame demasiado grande.");
        }

        await Clients
            .Group(
                TechnicianGroup(
                    remoteHost.OrganizationId,
                    sessionId))
            .SendAsync(
                "RemoteFrame",
                new
                {
                    sessionId,
                    sequence,
                    width,
                    height,
                    mimeType,
                    base64Data,
                    capturedAtUtc
                });
    }

    public async Task PointerMove(
        Guid sessionId,
        double x,
        double y)
    {
        var session =
            await GetHumanSessionAsync(
                sessionId,
                "remote.manage");

        if (!session.AllowMouse)
        {
            return;
        }

        await Clients
            .Group(
                HostGroup(
                    session.OrganizationId,
                    session.Id))
            .SendAsync(
                "PointerMove",
                Math.Clamp(x, 0, 1),
                Math.Clamp(y, 0, 1));
    }

    public async Task PointerButton(
        Guid sessionId,
        string action)
    {
        var session =
            await GetHumanSessionAsync(
                sessionId,
                "remote.manage");

        if (!session.AllowMouse)
        {
            return;
        }

        var allowed =
            action is
                "left-down"
                or "left-up"
                or "right-down"
                or "right-up";

        if (!allowed)
        {
            throw new HubException(
                "Evento de mouse no válido.");
        }

        await Clients
            .Group(
                HostGroup(
                    session.OrganizationId,
                    session.Id))
            .SendAsync(
                "PointerButton",
                action);
    }

    public async Task PointerWheel(
        Guid sessionId,
        int delta)
    {
        var session =
            await GetHumanSessionAsync(
                sessionId,
                "remote.manage");

        if (!session.AllowMouse)
        {
            return;
        }

        delta =
            Math.Clamp(
                delta,
                -1200,
                1200);

        await Clients
            .Group(
                HostGroup(
                    session.OrganizationId,
                    session.Id))
            .SendAsync(
                "PointerWheel",
                delta);
    }

    public async Task Keyboard(
        Guid sessionId,
        int virtualKey,
        bool keyDown)
    {
        var session =
            await GetHumanSessionAsync(
                sessionId,
                "remote.manage");

        if (!session.AllowKeyboard)
        {
            return;
        }

        if (virtualKey is < 1 or > 255)
        {
            return;
        }

        await Clients
            .Group(
                HostGroup(
                    session.OrganizationId,
                    session.Id))
            .SendAsync(
                "Keyboard",
                virtualKey,
                keyDown);
    }

    public async Task LeaveSession(
        Guid sessionId)
    {
        if (!IsHumanConnection())
        {
            return;
        }

        var organizationId =
            GetHumanOrganizationId();

        await Groups.RemoveFromGroupAsync(
            Context.ConnectionId,
            TechnicianGroup(
                organizationId,
                sessionId));
    }

    private async Task<RemoteSession>
        GetHumanSessionAsync(
            Guid sessionId,
            string permission)
    {
        RequireHumanPermission(
            permission);

        var organizationId =
            GetHumanOrganizationId();

        var session =
            await _dbContext
                .RemoteSessions
                .FirstOrDefaultAsync(
                    x =>
                        x.Id == sessionId
                        &&
                        x.OrganizationId ==
                            organizationId
                        &&
                        !x.IsTerminal);

        return session
            ?? throw new HubException(
                "La sesión remota no está disponible.");
    }

    private RemoteHostTokenEntry
        ValidateRemoteHost(
            Guid sessionId)
    {
        var httpContext =
            Context.GetHttpContext()
            ?? throw new HubException(
                "HTTP context no disponible.");

        var token =
            httpContext.Request.Headers[
                    "X-Titan-Remote-Token"]
                .FirstOrDefault();

        var sessionHeader =
            httpContext.Request.Headers[
                    "X-Titan-Remote-Session"]
                .FirstOrDefault();

        if (!Guid.TryParse(
                sessionHeader,
                out var headerSessionId)
            ||
            headerSessionId != sessionId)
        {
            throw new HubException(
                "Identidad RemoteHost no válida.");
        }

        if (!_tokenService.TryValidate(
                token ?? string.Empty,
                sessionId,
                out var entry))
        {
            throw new HubException(
                "Token RemoteHost inválido o expirado.");
        }

        return entry;
    }

    private bool IsHumanConnection()
    {
        return Context.User?.Identity?
            .IsAuthenticated == true;
    }

    private void RequireHumanPermission(
        string permission)
    {
        if (!IsHumanConnection())
        {
            throw new HubException(
                "Autenticación humana requerida.");
        }

        var allowed =
            Context.User!.Claims.Any(
                x =>
                    x.Type ==
                        "permission"
                    &&
                    string.Equals(
                        x.Value,
                        permission,
                        StringComparison.OrdinalIgnoreCase));

        if (!allowed)
        {
            throw new HubException(
                "No posee permisos para esta operación.");
        }
    }

    private Guid GetHumanOrganizationId()
    {
        var value =
            Context.User?
                .FindFirstValue(
                    "organization_id");

        if (!Guid.TryParse(
                value,
                out var organizationId))
        {
            throw new HubException(
                "OrganizationId no disponible.");
        }

        return organizationId;
    }

    public static string OrganizationGroup(
        Guid organizationId) =>
        $"organization:{organizationId:N}";

    public static string TechnicianGroup(
        Guid organizationId,
        Guid sessionId) =>
        $"organization:{organizationId:N}:remote:{sessionId:N}:technicians";

    public static string HostGroup(
        Guid organizationId,
        Guid sessionId) =>
        $"organization:{organizationId:N}:remote:{sessionId:N}:host";

    public static string SessionGroup(
        Guid organizationId,
        Guid sessionId) =>
        TechnicianGroup(
            organizationId,
            sessionId);
}