using TitanMDM.WindowsAgent.Contracts;

namespace TitanMDM.WindowsAgent.Services;

public sealed class RemoteSupportBackgroundService : BackgroundService
{
    private const int MaxRestartAttempts = 3;

    private static readonly TimeSpan PollInterval =
        TimeSpan.FromSeconds(5);

    private static readonly TimeSpan RestartInterval =
        TimeSpan.FromSeconds(10);

    private readonly RemoteSupportApiClient _apiClient;
    private readonly RemoteSupportSessionManager _sessionManager;
    private readonly RemoteDesktopHostLauncher _hostLauncher;
    private readonly ILogger<RemoteSupportBackgroundService> _logger;

    private RemoteDesktopStartRequest? _activeLaunchRequest;
    private int _restartAttempts;
    private DateTime _nextRestartAtUtc;

    public RemoteSupportBackgroundService(
        RemoteSupportApiClient apiClient,
        RemoteSupportSessionManager sessionManager,
        RemoteDesktopHostLauncher hostLauncher,
        ILogger<RemoteSupportBackgroundService> logger)
    {
        _apiClient = apiClient;
        _sessionManager = sessionManager;
        _hostLauncher = hostLauncher;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "TitanMDM Remote Support service started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PollAsync(stoppingToken);
            }
            catch (OperationCanceledException)
                when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Remote Support polling failed.");
            }

            try
            {
                await Task.Delay(
                    PollInterval,
                    stoppingToken);
            }
            catch (OperationCanceledException)
                when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }

        var current = _sessionManager.CurrentSession;

        if (current is not null)
        {
            try
            {
                await StopCurrentSessionAsync(
                    current.SessionId,
                    CancellationToken.None);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "RemoteHost cleanup failed while stopping the service.");
            }
        }
    }

    private async Task PollAsync(
        CancellationToken cancellationToken)
    {
        var pending = await _apiClient.GetPendingAsync(
            cancellationToken);

        var current = _sessionManager.CurrentSession;

        if (current is not null)
        {
            var serverSession = pending.FirstOrDefault(
                x => x.SessionId == current.SessionId);

            if (serverSession is null ||
                serverSession.ExpiresAtUtc <= DateTime.UtcNow)
            {
                await StopCurrentSessionAsync(
                    current.SessionId,
                    cancellationToken);

                return;
            }

            await EnsureHostRunningAsync(
                current.SessionId,
                cancellationToken);

            return;
        }

        var request = pending
            .Where(x => x.ExpiresAtUtc > DateTime.UtcNow)
            .OrderBy(x => x.RequestedAtUtc)
            .FirstOrDefault();

        if (request is not null)
        {
            await StartSessionAsync(
                request,
                cancellationToken);
        }
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
            await _apiClient.MarkConnectingAsync(
                request.SessionId,
                cancellationToken);

            var bootstrap =
                await _apiClient.CreateHostBootstrapAsync(
                    request.SessionId,
                    cancellationToken);

            var launchRequest =
                new RemoteDesktopStartRequest(
                    SessionId: request.SessionId,
                    TechnicianName: request.TechnicianDisplayName,
                    Reason: request.Reason,
                    AllowKeyboard: request.AllowKeyboard,
                    AllowMouse: request.AllowMouse,
                    AllowClipboard: request.AllowClipboard,
                    AllowFileTransfer: request.AllowFileTransfer,
                    ExpiresAtUtc: request.ExpiresAtUtc,
                    ServerUrl: bootstrap.ServerUrl,
                    AccessToken: bootstrap.AccessToken);

            await _hostLauncher.StartAsync(
                launchRequest,
                cancellationToken);

            _activeLaunchRequest = launchRequest;
            _restartAttempts = 0;
            _nextRestartAtUtc = DateTime.MinValue;

            // RegisterRemoteHost en SignalR confirma la conexión real.
            // El lanzamiento del proceso por sí solo no la confirma.
            _logger.LogInformation(
                "RemoteHost launched for session {SessionId}. Waiting for SignalR registration.",
                request.SessionId);
        }
        catch (Exception ex)
        {
            await FailSessionAsync(
                request.SessionId,
                ex,
                cancellationToken);

            throw;
        }
    }

    private async Task EnsureHostRunningAsync(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var activeWindowsSessionId =
    _hostLauncher.ActiveConsoleSessionId;

if (activeWindowsSessionId is null)
{
    // Windows puede quedar brevemente sin sesión activa durante
    // un cambio de usuario. Esperamos al siguiente ciclo.
    return;
}

var runningWindowsSessionId =
    _hostLauncher.RunningWindowsSessionId;

if (_hostLauncher.IsRunning &&
    runningWindowsSessionId != activeWindowsSessionId)
{
    _logger.LogInformation(
        "Windows session changed from {PreviousSessionId} to {CurrentSessionId}. Restarting RemoteHost for remote session {RemoteSessionId}.",
        runningWindowsSessionId,
        activeWindowsSessionId,
        sessionId);

    await _hostLauncher.StopAsync(
        sessionId,
        cancellationToken);

    // Conservamos _activeLaunchRequest. El resto de este método
    // iniciará RemoteHost usando la nueva sesión activa.
    _restartAttempts = 0;
    _nextRestartAtUtc = DateTime.MinValue;
}
        if (_hostLauncher.IsRunning)
        {
            _restartAttempts = 0;
            _nextRestartAtUtc = DateTime.MinValue;
            return;
        }

        if (_activeLaunchRequest is null ||
            _activeLaunchRequest.SessionId != sessionId)
        {
            await FailSessionAsync(
                sessionId,
                new InvalidOperationException(
                    "RemoteHost terminó y no existe una configuración válida para reiniciarlo."),
                cancellationToken);

            return;
        }

        if (_activeLaunchRequest.ExpiresAtUtc <= DateTime.UtcNow)
        {
            await StopCurrentSessionAsync(
                sessionId,
                cancellationToken);

            return;
        }

        if (DateTime.UtcNow < _nextRestartAtUtc)
        {
            return;
        }

        if (_restartAttempts >= MaxRestartAttempts)
        {
            await FailSessionAsync(
                sessionId,
                new InvalidOperationException(
                    "RemoteHost no pudo recuperarse después de tres intentos."),
                cancellationToken);

            return;
        }

        _restartAttempts++;
        _nextRestartAtUtc =
            DateTime.UtcNow.Add(RestartInterval);

        try
        {
            _logger.LogWarning(
                "RemoteHost exited unexpectedly. Restarting session {SessionId}, attempt {Attempt}/{Maximum}.",
                sessionId,
                _restartAttempts,
                MaxRestartAttempts);

            await _hostLauncher.StartAsync(
                _activeLaunchRequest,
                cancellationToken);
        }
        catch (OperationCanceledException)
            when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "RemoteHost restart failed for session {SessionId}, attempt {Attempt}/{Maximum}.",
                sessionId,
                _restartAttempts,
                MaxRestartAttempts);
        }
    }

    private async Task FailSessionAsync(
        Guid sessionId,
        Exception error,
        CancellationToken cancellationToken)
    {
        try
        {
            await _apiClient.MarkFailedAsync(
                sessionId,
                error.Message,
                cancellationToken);
        }
        catch (Exception reportError)
        {
            _logger.LogWarning(
                reportError,
                "Unable to report failure for remote session {SessionId}.",
                sessionId);
        }

        try
        {
            await StopCurrentSessionAsync(
                sessionId,
                CancellationToken.None);
        }
        catch (Exception stopError)
        {
            _logger.LogWarning(
                stopError,
                "Unable to stop RemoteHost for failed session {SessionId}.",
                sessionId);
        }

        _logger.LogError(
            error,
            "Remote support session {SessionId} failed.",
            sessionId);
    }

    private async Task StopCurrentSessionAsync(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        try
        {
            await _hostLauncher.StopAsync(
                sessionId,
                cancellationToken);
        }
        finally
        {
            _sessionManager.End(sessionId);
            _activeLaunchRequest = null;
            _restartAttempts = 0;
            _nextRestartAtUtc = DateTime.MinValue;
        }

        _logger.LogInformation(
            "Remote support session {SessionId} stopped locally.",
            sessionId);
    }
}