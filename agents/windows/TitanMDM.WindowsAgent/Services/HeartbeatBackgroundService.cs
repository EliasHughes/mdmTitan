using Microsoft.Extensions.Options;
using TitanMDM.WindowsAgent.Configuration;
using TitanMDM.WindowsAgent.Storage;

namespace TitanMDM.WindowsAgent.Services;

public sealed class HeartbeatBackgroundService
    : BackgroundService
{
    private readonly ILogger<HeartbeatBackgroundService>
        _logger;

    private readonly TitanMdmApiClient
        _apiClient;

    private readonly DeviceIdentityStore
        _identityStore;

    private readonly AgentOptions
        _options;

    public HeartbeatBackgroundService(
        ILogger<HeartbeatBackgroundService> logger,
        TitanMdmApiClient apiClient,
        DeviceIdentityStore identityStore,
        IOptions<AgentOptions> options)
    {
        _logger = logger;
        _apiClient = apiClient;
        _identityStore = identityStore;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "TitanMDM Heartbeat Service iniciado.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var identity =
                    await _identityStore.LoadAsync(
                        stoppingToken);

                if (identity is null)
                {
                    _logger.LogDebug(
                        "Heartbeat omitido: dispositivo todavía no inscrito.");
                }
                else
                {
                    var heartbeat =
                        await _apiClient.SendHeartbeatAsync(
                            stoppingToken);

                    _logger.LogInformation(
                        "Heartbeat correcto. DeviceId: {DeviceId}, Estado: {Status}, LastSeen: {LastSeenAtUtc}",
                        heartbeat.DeviceId,
                        heartbeat.Status,
                        heartbeat.LastSeenAtUtc);
                }
            }
            catch (OperationCanceledException)
                when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (HttpRequestException ex)
            {
                _logger.LogWarning(
                    ex,
                    "No fue posible enviar heartbeat a TitanMDM.");
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Error inesperado en TitanMDM Heartbeat Service.");
            }

            try
            {
                await Task.Delay(
                    TimeSpan.FromSeconds(
                        Math.Max(
                            15,
                            _options.HeartbeatIntervalSeconds)),
                    stoppingToken);
            }
            catch (OperationCanceledException)
                when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }

        _logger.LogInformation(
            "TitanMDM Heartbeat Service detenido.");
    }
}