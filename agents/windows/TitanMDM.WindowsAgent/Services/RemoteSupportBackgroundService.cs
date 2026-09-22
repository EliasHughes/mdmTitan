using TitanMDM.WindowsAgent.Contracts;

namespace TitanMDM.WindowsAgent.Services;

public sealed class RemoteSupportBackgroundService
    : BackgroundService
{
    private readonly RemoteSupportApiClient
        _apiClient;

    private readonly RemoteSupportSessionManager
        _sessionManager;

    private readonly ILogger<
        RemoteSupportBackgroundService> _logger;

    public RemoteSupportBackgroundService(
        RemoteSupportApiClient apiClient,
        RemoteSupportSessionManager sessionManager,
        ILogger<RemoteSupportBackgroundService> logger)
    {
        _apiClient =
            apiClient;

        _sessionManager =
            sessionManager;

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
            var stillExists =
                pending.Any(
                    x =>
                        x.SessionId ==
                        current.SessionId);

            if (!stillExists)
            {
                _sessionManager.End(
                    current.SessionId);
            }

            return;
        }

        var request =
            pending
                .OrderBy(
                    x =>
                        x.RequestedAtUtc)
                .FirstOrDefault();

        if (request is null)
        {
            return;
        }

        if (request.ExpiresAtUtc <=
            DateTime.UtcNow)
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
            await _apiClient
                .MarkConnectingAsync(
                    request.SessionId,
                    cancellationToken);
            
            var bootstrap =
                await _apiClient
                    .CreateHostBootstrapAsync(
                        request.SessionId,
                        cancellationToken);

            /*
             * El siguiente bloque RS-5 conectará aquí:
             *
             * 1. Remote desktop host.
             * 2. Captura de escritorio.
             * 3. Transporte WebRTC.
             * 4. Keyboard/mouse.
             * 5. Session indicator visible.
             *
             * NO marcamos Connected todavía porque
             * todavía no existe un canal de escritorio real.
             */
        }
        catch (Exception ex)
        {
            _sessionManager.End(
                request.SessionId);

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

            throw;
        }
    }
}