using System.Security.Claims;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

using TitanMDM.Api.Services;
using TitanMDM.Domain.Entities;
using TitanMDM.Domain.Enums;
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

    private readonly ILogger<RemoteSupportHub>
        _logger;

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

    /*
     * ============================================================
     * CONNECTION
     * ============================================================
     */

    public override async Task OnConnectedAsync()
    {
        if (IsHumanConnection())
        {
            var organizationId =
                GetHumanOrganizationId();

            await Groups
                .AddToGroupAsync(
                    Context.ConnectionId,
                    OrganizationGroup(
                        organizationId));

            _logger.LogInformation(
                "TitanMDM Remote Support technician connected. " +
                "ConnectionId={ConnectionId}, OrganizationId={OrganizationId}, User={User}.",
                Context.ConnectionId,
                organizationId,
                Context.User?.Identity?.Name);
        }
        else
        {
            _logger.LogInformation(
                "TitanMDM Remote Support non-human connection established. " +
                "ConnectionId={ConnectionId}.",
                Context.ConnectionId);
        }

        await base
            .OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(
        Exception? exception)
    {
        if (exception is null)
        {
            _logger.LogInformation(
                "TitanMDM Remote Support connection closed. " +
                "ConnectionId={ConnectionId}.",
                Context.ConnectionId);
        }
        else
        {
            _logger.LogWarning(
                exception,
                "TitanMDM Remote Support connection closed with error. " +
                "ConnectionId={ConnectionId}.",
                Context.ConnectionId);
        }

        await base
            .OnDisconnectedAsync(
                exception);
    }

    /*
     * ============================================================
     * TECHNICIAN SESSION
     * ============================================================
     */

    public async Task JoinSession(
        Guid sessionId)
    {
        RequireHumanPermission(
            "remote.view");

        if (sessionId == Guid.Empty)
        {
            throw new HubException(
                "SessionId no válido.");
        }

        var organizationId =
            GetHumanOrganizationId();

        /*
         * IMPORTANTE:
         *
         * No utilizar:
         *
         *     !x.IsTerminal
         *
         * dentro de una consulta de Entity Framework.
         *
         * IsTerminal es una propiedad calculada del dominio y
         * no puede traducirse directamente a SQL.
         *
         * Consultamos Status, que sí está almacenado en SQL.
         */
        var session =
            await _dbContext
                .RemoteSessions
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x =>
                        x.Id ==
                            sessionId
                        &&
                        x.OrganizationId ==
                            organizationId
                        &&
                        x.Status !=
                            RemoteSessionStatus.Completed
                        &&
                        x.Status !=
                            RemoteSessionStatus.Failed
                        &&
                        x.Status !=
                            RemoteSessionStatus.Expired
                        &&
                        x.Status !=
                            RemoteSessionStatus.Cancelled);

        if (session is null)
        {
            _logger.LogWarning(
                "JoinSession rejected. " +
                "SessionId={SessionId}, OrganizationId={OrganizationId}, User={User}.",
                sessionId,
                organizationId,
                Context.User?.Identity?.Name);

            throw new HubException(
                "La sesión remota no existe, pertenece a otra organización o ya finalizó.");
        }

        await Groups
            .AddToGroupAsync(
                Context.ConnectionId,
                TechnicianGroup(
                    organizationId,
                    sessionId));

        _logger.LogInformation(
            "Technician joined remote session. " +
            "SessionId={SessionId}, ConnectionId={ConnectionId}, OrganizationId={OrganizationId}, User={User}.",
            sessionId,
            Context.ConnectionId,
            organizationId,
            Context.User?.Identity?.Name);
    }

    public async Task LeaveSession(
        Guid sessionId)
    {
        if (!IsHumanConnection())
        {
            return;
        }

        if (sessionId == Guid.Empty)
        {
            return;
        }

        var organizationId =
            GetHumanOrganizationId();

        await Groups
            .RemoveFromGroupAsync(
                Context.ConnectionId,
                TechnicianGroup(
                    organizationId,
                    sessionId));

        _logger.LogInformation(
            "Technician left remote session. " +
            "SessionId={SessionId}, ConnectionId={ConnectionId}.",
            sessionId,
            Context.ConnectionId);
    }

    /*
     * ============================================================
     * REMOTE HOST REGISTRATION
     * ============================================================
     */

    public async Task RegisterRemoteHost(
        Guid sessionId)
    {
        var remoteHost =
            ValidateRemoteHost(
                sessionId);

        /*
         * Igual que JoinSession:
         * consultar Status directamente.
         */
        var session =
            await _dbContext
                .RemoteSessions
                .FirstOrDefaultAsync(
                    x =>
                        x.Id ==
                            sessionId
                        &&
                        x.DeviceId ==
                            remoteHost.DeviceId
                        &&
                        x.OrganizationId ==
                            remoteHost.OrganizationId
                        &&
                        x.Status !=
                            RemoteSessionStatus.Completed
                        &&
                        x.Status !=
                            RemoteSessionStatus.Failed
                        &&
                        x.Status !=
                            RemoteSessionStatus.Expired
                        &&
                        x.Status !=
                            RemoteSessionStatus.Cancelled);

        if (session is null)
        {
            _logger.LogWarning(
                "RemoteHost registration rejected. " +
                "SessionId={SessionId}, DeviceId={DeviceId}, OrganizationId={OrganizationId}.",
                sessionId,
                remoteHost.DeviceId,
                remoteHost.OrganizationId);

            throw new HubException(
                "La sesión remota no está disponible.");
        }

        /*
         * Si la sesión todavía está Requested o Connecting,
         * el RemoteHost acaba de demostrar que el canal
         * interactivo está disponible.
         */
        if (
            session.Status ==
                RemoteSessionStatus.Requested
            ||
            session.Status ==
                RemoteSessionStatus.Connecting)
        {
            session.MarkConnected();
        }

        _dbContext
            .RemoteSessionEvents
            .Add(
                new RemoteSessionEvent(
                    session.OrganizationId,
                    session.Id,
                    "REMOTE_HOST_CONNECTED",
                    "TitanMDM Remote Host estableció el canal interactivo."));
        
        await _dbContext
            .SaveChangesAsync();

        /*
         * El RemoteHost entra en su grupo separado.
         *
         * Los comandos de mouse/teclado se envían a este grupo.
         */
        await Groups
            .AddToGroupAsync(
                Context.ConnectionId,
                HostGroup(
                    session.OrganizationId,
                    session.Id));

        /*
         * Avisar al técnico de que la sesión pasó a Connected.
         */
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
            "RemoteHost registered successfully. " +
            "SessionId={SessionId}, DeviceId={DeviceId}, ConnectionId={ConnectionId}.",
            sessionId,
            remoteHost.DeviceId,
            Context.ConnectionId);
    }

    /*
     * ============================================================
     * VIDEO
     * ============================================================
     */

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

        if (
            width <= 0
            ||
            height <= 0)
        {
            throw new HubException(
                "Dimensiones de frame no válidas.");
        }

        if (
            string.IsNullOrWhiteSpace(
                mimeType))
        {
            throw new HubException(
                "MimeType del frame no válido.");
        }

        if (
            string.IsNullOrWhiteSpace(
                base64Data))
        {
            return;
        }

        /*
         * Protección básica contra frames excesivamente grandes.
         */
        if (
            base64Data.Length >
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

    /*
     * ============================================================
     * MOUSE
     * ============================================================
     */

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
                Math.Clamp(
                    x,
                    0,
                    1),
                Math.Clamp(
                    y,
                    0,
                    1));
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

    /*
     * ============================================================
     * KEYBOARD
     * ============================================================
     */

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

        if (
            virtualKey is
                < 1
                or > 255)
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

    /*
     * ============================================================
     * HUMAN SESSION VALIDATION
     * ============================================================
     */

    private async Task<RemoteSession>
        GetHumanSessionAsync(
            Guid sessionId,
            string permission)
    {
        RequireHumanPermission(
            permission);

        if (sessionId == Guid.Empty)
        {
            throw new HubException(
                "SessionId no válido.");
        }

        var organizationId =
            GetHumanOrganizationId();

        /*
         * No utilizar x.IsTerminal dentro de LINQ-to-SQL.
         */
        var session =
            await _dbContext
                .RemoteSessions
                .FirstOrDefaultAsync(
                    x =>
                        x.Id ==
                            sessionId
                        &&
                        x.OrganizationId ==
                            organizationId
                        &&
                        x.Status !=
                            RemoteSessionStatus.Completed
                        &&
                        x.Status !=
                            RemoteSessionStatus.Failed
                        &&
                        x.Status !=
                            RemoteSessionStatus.Expired
                        &&
                        x.Status !=
                            RemoteSessionStatus.Cancelled);

        if (session is null)
        {
            throw new HubException(
                "La sesión remota no está disponible.");
        }

        return session;
    }

    /*
     * ============================================================
     * REMOTE HOST VALIDATION
     * ============================================================
     */

    private RemoteHostTokenEntry
        ValidateRemoteHost(
            Guid sessionId)
    {
        var httpContext =
            Context.GetHttpContext()
            ??
            throw new HubException(
                "HTTP context no disponible.");

        var token =
            httpContext
                .Request
                .Headers[
                    "X-Titan-Remote-Token"]
                .FirstOrDefault();

        var sessionHeader =
            httpContext
                .Request
                .Headers[
                    "X-Titan-Remote-Session"]
                .FirstOrDefault();

        if (
            !Guid.TryParse(
                sessionHeader,
                out var headerSessionId)
            ||
            headerSessionId !=
                sessionId)
        {
            throw new HubException(
                "Identidad RemoteHost no válida.");
        }

        if (
            !_tokenService
                .TryValidate(
                    token ??
                    string.Empty,
                    sessionId,
                    out var entry))
        {
            throw new HubException(
                "Token RemoteHost inválido o expirado.");
        }

        return entry;
    }

    /*
     * ============================================================
     * HUMAN AUTHENTICATION
     * ============================================================
     */

    private bool IsHumanConnection()
    {
        return
            Context.User
                ?.Identity
                ?.IsAuthenticated ==
            true;
    }

    private void RequireHumanPermission(
        string permission)
    {
        if (!IsHumanConnection())
        {
            _logger.LogWarning(
                "Remote Support human authentication required. " +
                "ConnectionId={ConnectionId}.",
                Context.ConnectionId);

            throw new HubException(
                "Autenticación humana requerida.");
        }

        var allowed =
            Context.User!
                .Claims
                .Any(
                    claim =>
                        claim.Type ==
                            "permission"
                        &&
                        string.Equals(
                            claim.Value,
                            permission,
                            StringComparison
                                .OrdinalIgnoreCase));

        if (!allowed)
        {
            _logger.LogWarning(
                "Remote Support permission denied. " +
                "Permission={Permission}, User={User}, ConnectionId={ConnectionId}.",
                permission,
                Context.User?.Identity?.Name,
                Context.ConnectionId);

            throw new HubException(
                $"El usuario no posee el permiso '{permission}'.");
        }
    }

    /*
     * ============================================================
     * ORGANIZATION
     * ============================================================
     */

    private Guid GetHumanOrganizationId()
    {
        var value =
            Context.User?
                .FindFirstValue(
                    "organization_id");

        if (
            !Guid.TryParse(
                value,
                out var organizationId)
            ||
            organizationId ==
                Guid.Empty)
        {
            _logger.LogWarning(
                "Remote Support OrganizationId claim missing. " +
                "User={User}, ConnectionId={ConnectionId}.",
                Context.User?.Identity?.Name,
                Context.ConnectionId);

            throw new HubException(
                "OrganizationId no disponible.");
        }

        return organizationId;
    }

    /*
     * ============================================================
     * SIGNALR GROUP NAMES
     * ============================================================
     */

    public static string OrganizationGroup(
        Guid organizationId)
    {
        return
            $"organization:{organizationId:N}";
    }

    public static string TechnicianGroup(
        Guid organizationId,
        Guid sessionId)
    {
        return
            $"organization:{organizationId:N}:remote:{sessionId:N}:technicians";
    }

    public static string HostGroup(
        Guid organizationId,
        Guid sessionId)
    {
        return
            $"organization:{organizationId:N}:remote:{sessionId:N}:host";
    }

    public static string SessionGroup(
        Guid organizationId,
        Guid sessionId)
    {
        return TechnicianGroup(
            organizationId,
            sessionId);
    }
}