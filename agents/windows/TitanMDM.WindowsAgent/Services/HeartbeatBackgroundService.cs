using Microsoft.Extensions.Options;

using TitanMDM.WindowsAgent.Configuration;
using TitanMDM.WindowsAgent.Storage;

namespace TitanMDM.WindowsAgent.Services;

public sealed class HeartbeatBackgroundService
    : BackgroundService
{
    private const int MinimumHeartbeatSeconds =
        15;

    private const int MaximumBackoffSeconds =
        300;

    private const int MaximumBackoffExponent =
        6;

    private readonly ILogger<
        HeartbeatBackgroundService>
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
        _logger =
            logger;

        _apiClient =
            apiClient;

        _identityStore =
            identityStore;

        _options =
            options.Value;
    }

    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "TitanMDM Heartbeat Service iniciado.");

        var consecutiveFailures =
            0;

        while (!stoppingToken.IsCancellationRequested)
        {
            var heartbeatSucceeded =
                false;

            try
            {
                var identity =
                    await _identityStore
                        .LoadAsync(
                            stoppingToken);

                if (identity is null)
                {
                    consecutiveFailures =
                        0;

                    _logger.LogDebug(
                        "Heartbeat omitido: dispositivo todavía no inscrito.");
                }
                else
                {
                    var heartbeat =
                        await _apiClient
                            .SendHeartbeatAsync(
                                stoppingToken);

                    heartbeatSucceeded =
                        true;

                    consecutiveFailures =
                        0;

                    _logger.LogDebug(
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
                consecutiveFailures++;

                _logger.LogWarning(
                    ex,
                    "No fue posible enviar heartbeat a TitanMDM. Fallos consecutivos: {FailureCount}.",
                    consecutiveFailures);
            }
            catch (TaskCanceledException ex)
                when (!stoppingToken.IsCancellationRequested)
            {
                consecutiveFailures++;

                _logger.LogWarning(
                    ex,
                    "Timeout enviando heartbeat a TitanMDM. Fallos consecutivos: {FailureCount}.",
                    consecutiveFailures);
            }
            catch (Exception ex)
            {
                consecutiveFailures++;

                _logger.LogError(
                    ex,
                    "Error inesperado en TitanMDM Heartbeat Service. Fallos consecutivos: {FailureCount}.",
                    consecutiveFailures);
            }

            var delay =
                CalculateDelay(
                    heartbeatSucceeded,
                    consecutiveFailures);

            try
            {
                await Task.Delay(
                    delay,
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

    private TimeSpan CalculateDelay(
        bool heartbeatSucceeded,
        int consecutiveFailures)
    {
        var configuredIntervalSeconds =
            Math.Clamp(
                _options
                    .HeartbeatIntervalSeconds,
                MinimumHeartbeatSeconds,
                3600);

        if (heartbeatSucceeded ||
            consecutiveFailures <= 0)
        {
            return TimeSpan.FromSeconds(
                configuredIntervalSeconds);
        }

        /*
         * Backoff exponencial exclusivamente para
         * fallos de comunicación.
         *
         * El intervalo normal de heartbeat no se suma
         * al backoff. De lo contrario un heartbeat de
         * 60 s podría tardar varios minutos incluso
         * después de una caída breve.
         */
        var exponent =
            Math.Min(
                consecutiveFailures - 1,
                MaximumBackoffExponent);

        var backoffSeconds =
            Math.Min(
                MaximumBackoffSeconds,
                5 * (1 << exponent));

        /*
         * Se conserva un mínimo para evitar loops
         * agresivos contra el servidor.
         */
        var retrySeconds =
            Math.Max(
                MinimumHeartbeatSeconds,
                backoffSeconds);

        return TimeSpan.FromSeconds(
            retrySeconds);
    }
}