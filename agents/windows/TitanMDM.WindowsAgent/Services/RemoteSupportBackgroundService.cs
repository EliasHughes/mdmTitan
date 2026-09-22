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
            "TitanMDM Remote Support service started.");

        while (!stoppingToken
            .IsCancellationRequested)
        {
            try
            {
                await PollAsync(
                    stoppingToken);
            }
            catch (OperationCanceledException)
                when (stoppingToken
                    .IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Remote Support polling failed.");
            }

            await Task.Delay(
                TimeSpan.FromSeconds(5),
                stoppingToken);
        }
    }

    private async Task PollAsync(
        CancellationToken cancellationToken)
    {
        var pending =
            await _apiClient
                .GetPendingAsync(
                    cancellationToken);

        var current =
            _sessionManager
                .CurrentSession;

        if (current is not null)
        {
            var serverSession =
                pending.FirstOrDefault(
                    x =>
                        x.SessionId ==
                        current.SessionId);

            if (serverSession is null)
            {
                await StopCurrentSessionAsync(
                    current.SessionId,
                    cancellationToken);

                return;
            }

            if (serverSession.ExpiresAtUtc <=
                DateTime.UtcNow)
            {
                await StopCurrentSessionAsync(
                    current.SessionId,
                    cancellationToken);
            }

            return;
        }

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

        if (request is null)
        {
            return;
        }

        await StartSessionAsync(
            request,
            cancellationToken);
    }

    private async Task StartSessionAsync(
        RemoteSupportRequest request,
        CancellationToken cancellationToken)
    {
        if (!_sessionManager.TryBegin(
                request,
                out _))
        {
            return;
        }

        try
        {
            _logger.LogInformation(
                "Preparing remote support session {SessionId}.",
                request.SessionId);

            await _apiClient
                .MarkConnectingAsync(
                    request.SessionId,
                    cancellationToken);

            var bootstrap =
                await _apiClient
                    .CreateHostBootstrapAsync(
                        request.SessionId,
                        cancellationToken);

            var startRequest =
                new RemoteDesktopStartRequest(
                    SessionId:
                        request.SessionId,

                    TechnicianName:
                        request.TechnicianDisplayName,

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

            await _hostLauncher
                .StartAsync(
                    startRequest,
                    cancellationToken);

            /*
             * NO se llama MarkConnectedAsync aquí.
             *
             * La sesión solamente pasa a Connected cuando
             * TitanMDM.RemoteHost consigue establecer
             * realmente su conexión SignalR y ejecuta
             * RegisterRemoteHost en RemoteSupportHub.
             */

            _logger.LogInformation(
                "RemoteHost launched for session {SessionId}. Waiting for SignalR registration.",
                request.SessionId);
        }
        catch (Exception ex)
        {
            _sessionManager.End(
                request.SessionId);

            try
            {
                await _hostLauncher
                    .StopAsync(
                        request.SessionId,
                        CancellationToken.None);
            }
            catch
            {
            }

            try
            {
                await _apiClient
                    .MarkFailedAsync(
                        request.SessionId,
                        ex.Message,
                        cancellationToken);
            }
            catch
            {
            }

            _logger.LogError(
                ex,
                "Unable to start remote support session {SessionId}.",
                request.SessionId);

            throw;
        }
    }

    private async Task StopCurrentSessionAsync(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        try
        {
            await _hostLauncher
                .StopAsync(
                    sessionId,
                    cancellationToken);
        }
        finally
        {
            _sessionManager.End(
                sessionId);
        }

        _logger.LogInformation(
            "Remote support session {SessionId} stopped locally.",
            sessionId);
    }
}