using TitanMDM.WindowsAgent.Contracts;

namespace TitanMDM.WindowsAgent.Services;

public sealed class RemoteSupportBackgroundService
    : BackgroundService
{
    private readonly RemoteSupportApiClient
        _apiClient;

    private readonly RemoteSupportSessionManager
        _sessionManager;

    private readonly RemoteDesktopHostLauncher
        _hostLauncher;

    private readonly ILogger<
        RemoteSupportBackgroundService> _logger;

    public RemoteSupportBackgroundService(
        RemoteSupportApiClient apiClient,
        RemoteSupportSessionManager sessionManager,
        RemoteDesktopHostLauncher hostLauncher,
        ILogger<RemoteSupportBackgroundService> logger)
    {
        _apiClient =
            apiClient;

        _sessionManager =
            sessionManager;

        _hostLauncher =
            hostLauncher;

        _logger =
            logger;
    }

    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "============================================================");

        _logger.LogInformation(
            "TitanMDM Remote Support Background Service STARTED.");

        _logger.LogInformation(
            "Polling interval: 5 seconds.");

        _logger.LogInformation(
            "============================================================");

        while (
            !stoppingToken
                .IsCancellationRequested)
        {
            try
            {
                await PollAsync(
                    stoppingToken);
            }
            catch (
                OperationCanceledException)
                when (
                    stoppingToken
                        .IsCancellationRequested)
            {
                break;
            }
            catch (
                Exception ex)
            {
                _logger.LogError(
                    ex,
                    "TitanMDM Remote Support polling failed: {Message}",
                    ex.Message);
            }

            try
            {
                await Task.Delay(
                    TimeSpan.FromSeconds(
                        5),
                    stoppingToken);
            }
            catch (
                OperationCanceledException)
                when (
                    stoppingToken
                        .IsCancellationRequested)
            {
                break;
            }
        }

        _logger.LogInformation(
            "TitanMDM Remote Support Background Service STOPPED.");
    }

    private async Task PollAsync(
        CancellationToken cancellationToken)
    {
        _logger.LogDebug(
            "Remote Support polling started.");

        IReadOnlyList<
            RemoteSupportRequest> pending;

        try
        {
            pending =
                await _apiClient
                    .GetPendingAsync(
                        cancellationToken);
        }
        catch (
            Exception ex)
        {
            _logger.LogError(
                ex,
                "Unable to obtain pending Remote Support sessions from TitanMDM API.");

            throw;
        }

        _logger.LogInformation(
            "Remote Support poll completed. PendingSessions={Count}.",
            pending.Count);

        foreach (
            var item in pending)
        {
            _logger.LogInformation(
                "Pending Remote Session detected. " +
                "SessionId={SessionId}, " +
                "DeviceId={DeviceId}, " +
                "Status={Status}, " +
                "Technician={Technician}, " +
                "ExpiresAtUtc={ExpiresAtUtc}.",
                item.SessionId,
                item.DeviceId,
                item.Status,
                item.TechnicianDisplayName,
                item.ExpiresAtUtc);
        }

        var current =
            _sessionManager
                .CurrentSession;

        /*
         * ============================================================
         * EXISTING LOCAL SESSION
         * ============================================================
         */

        if (
            current is not null)
        {
            _logger.LogDebug(
                "Remote Support local session currently active. " +
                "SessionId={SessionId}, Status={Status}.",
                current.SessionId,
                current.Status);

            var serverSession =
                pending
                    .FirstOrDefault(
                        x =>
                            x.SessionId ==
                            current.SessionId);

            /*
             * The server no longer considers this session active.
             */
            if (
                serverSession is null)
            {
                _logger.LogWarning(
                    "Current Remote Support session is no longer active on server. " +
                    "Stopping local RemoteHost. SessionId={SessionId}.",
                    current.SessionId);

                await StopCurrentSessionAsync(
                    current.SessionId,
                    cancellationToken);

                return;
            }

            /*
             * Session expired.
             */
            if (
                serverSession
                    .ExpiresAtUtc <=
                DateTime.UtcNow)
            {
                _logger.LogWarning(
                    "Current Remote Support session expired. " +
                    "SessionId={SessionId}.",
                    current.SessionId);

                await StopCurrentSessionAsync(
                    current.SessionId,
                    cancellationToken);

                return;
            }

            return;
        }

        /*
         * ============================================================
         * FIND NEXT REQUEST
         * ============================================================
         */

        var request =
            pending
                .Where(
                    x =>
                        x.ExpiresAtUtc >
                        DateTime.UtcNow)
                .OrderBy(
                    x =>
                        x.RequestedAtUtc)
                .FirstOrDefault();

        if (
            request is null)
        {
            _logger.LogDebug(
                "No valid Remote Support request available.");

            return;
        }

        _logger.LogInformation(
            "Remote Support request selected. " +
            "SessionId={SessionId}, Technician={Technician}.",
            request.SessionId,
            request.TechnicianDisplayName);

        await StartSessionAsync(
            request,
            cancellationToken);
    }

    private async Task StartSessionAsync(
        RemoteSupportRequest request,
        CancellationToken cancellationToken)
    {
        if (
            !_sessionManager
                .TryBegin(
                    request,
                    out var localSession))
        {
            _logger.LogWarning(
                "Remote Support request ignored because another local session exists. " +
                "RequestedSessionId={SessionId}, CurrentSessionId={CurrentSessionId}.",
                request.SessionId,
                localSession.SessionId);

            return;
        }

        try
        {
            _logger.LogInformation(
                "============================================================");

            _logger.LogInformation(
                "Preparing Remote Support session.");

            _logger.LogInformation(
                "SessionId={SessionId}.",
                request.SessionId);

            _logger.LogInformation(
                "Technician={Technician}.",
                request.TechnicianDisplayName);

            _logger.LogInformation(
                "Reason={Reason}.",
                request.Reason);

            _logger.LogInformation(
                "============================================================");

            /*
             * ========================================================
             * SERVER: REQUESTED -> CONNECTING
             * ========================================================
             */

            _logger.LogInformation(
                "Marking Remote Support session as CONNECTING.");

            await _apiClient
                .MarkConnectingAsync(
                    request.SessionId,
                    cancellationToken);

            _logger.LogInformation(
                "Remote Support session marked CONNECTING successfully.");

            /*
             * ========================================================
             * REQUEST REMOTE HOST BOOTSTRAP
             * ========================================================
             */

            _logger.LogInformation(
                "Requesting RemoteHost bootstrap.");

            var bootstrap =
                await _apiClient
                    .CreateHostBootstrapAsync(
                        request.SessionId,
                        cancellationToken);

            if (
                string.IsNullOrWhiteSpace(
                    bootstrap.ServerUrl))
            {
                throw new InvalidOperationException(
                    "RemoteHost bootstrap returned an empty ServerUrl.");
            }

            if (
                string.IsNullOrWhiteSpace(
                    bootstrap.AccessToken))
            {
                throw new InvalidOperationException(
                    "RemoteHost bootstrap returned an empty AccessToken.");
            }

            _logger.LogInformation(
                "RemoteHost bootstrap received. ServerUrl={ServerUrl}.",
                bootstrap.ServerUrl);

            /*
             * ========================================================
             * CREATE REMOTE HOST REQUEST
             * ========================================================
             */

            var startRequest =
                new RemoteDesktopStartRequest(
                    SessionId:
                        request.SessionId,

                    TechnicianName:
                        request
                            .TechnicianDisplayName,

                    Reason:
                        request.Reason,

                    AllowKeyboard:
                        request.AllowKeyboard,

                    AllowMouse:
                        request.AllowMouse,

                    AllowClipboard:
                        request.AllowClipboard,

                    AllowFileTransfer:
                        request.AllowFileTransfer,

                    ExpiresAtUtc:
                        request.ExpiresAtUtc,

                    ServerUrl:
                        bootstrap.ServerUrl,

                    AccessToken:
                        bootstrap.AccessToken);

            /*
             * ========================================================
             * LAUNCH REMOTE HOST
             * ========================================================
             */

            _logger.LogInformation(
                "Launching TitanMDM.RemoteHost.exe.");

            await _hostLauncher
                .StartAsync(
                    startRequest,
                    cancellationToken);

            /*
             * IMPORTANT:
             *
             * We do NOT call MarkConnectedAsync here.
             *
             * Connected is only valid after RemoteHost connects
             * to SignalR and invokes RegisterRemoteHost().
             */
            _logger.LogInformation(
                "TitanMDM.RemoteHost.exe launched successfully.");

            _logger.LogInformation(
                "Waiting for RemoteHost SignalR registration. " +
                "SessionId={SessionId}.",
                request.SessionId);
        }
        catch (
            Exception ex)
        {
            _logger.LogError(
                ex,
                "Unable to start Remote Support session. " +
                "SessionId={SessionId}, Error={Error}.",
                request.SessionId,
                ex.Message);

            _sessionManager
                .End(
                    request.SessionId);

            try
            {
                await _hostLauncher
                    .StopAsync(
                        request.SessionId,
                        CancellationToken.None);
            }
            catch (
                Exception stopError)
            {
                _logger.LogWarning(
                    stopError,
                    "Unable to stop RemoteHost after startup failure.");
            }

            try
            {
                await _apiClient
                    .MarkFailedAsync(
                        request.SessionId,
                        ex.Message,
                        cancellationToken);
            }
            catch (
                Exception serverError)
            {
                _logger.LogWarning(
                    serverError,
                    "Unable to mark Remote Support session as Failed.");
            }

            throw;
        }
    }

    private async Task StopCurrentSessionAsync(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        try
        {
            _logger.LogInformation(
                "Stopping local RemoteHost. SessionId={SessionId}.",
                sessionId);

            await _hostLauncher
                .StopAsync(
                    sessionId,
                    cancellationToken);
        }
        finally
        {
            _sessionManager
                .End(
                    sessionId);
        }

        _logger.LogInformation(
            "Remote Support session stopped locally. SessionId={SessionId}.",
            sessionId);
    }
}