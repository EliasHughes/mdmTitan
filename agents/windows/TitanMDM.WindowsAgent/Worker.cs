using Microsoft.Extensions.Options;
using TitanMDM.WindowsAgent.Configuration;
using TitanMDM.WindowsAgent.Contracts;
using TitanMDM.WindowsAgent.Execution;
using TitanMDM.WindowsAgent.Services;
using TitanMDM.WindowsAgent.Storage;

namespace TitanMDM.WindowsAgent;

public sealed class Worker : BackgroundService
{
    private readonly ILogger<Worker> _logger;
    private readonly TitanMdmApiClient _apiClient;
    private readonly EnrollmentService _enrollmentService;
    private readonly ICommandExecutor _commandExecutor;
    private readonly DeviceIdentityStore _identityStore;
    private readonly AgentOptions _options;

    public Worker(
        ILogger<Worker> logger,
        TitanMdmApiClient apiClient,
        EnrollmentService enrollmentService,
        ICommandExecutor commandExecutor,
        DeviceIdentityStore identityStore,
        IOptions<AgentOptions> options)
    {
        _logger = logger;
        _apiClient = apiClient;
        _enrollmentService = enrollmentService;
        _commandExecutor = commandExecutor;
        _identityStore = identityStore;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "TitanMDM Windows Agent iniciado.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var identity =
                    await EnsureEnrollmentAsync(
                        stoppingToken);

                if (identity is null)
                {
                    await DelayAsync(
                        stoppingToken);

                    continue;
                }

                var commands =
                    await _apiClient.GetCommandsAsync(
                        stoppingToken);

                foreach (var command in commands)
                {
                    await ProcessCommandAsync(
                        command,
                        stoppingToken);
                }
            }
            catch (OperationCanceledException)
                when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Error durante el ciclo del agente TitanMDM.");
            }

            await DelayAsync(
                stoppingToken);
        }
    }

    private async Task<DeviceIdentity?>
        EnsureEnrollmentAsync(
            CancellationToken cancellationToken)
    {
        var identity =
            await _identityStore.LoadAsync(
                cancellationToken);

        if (identity is not null)
        {
            return identity;
        }

        if (string.IsNullOrWhiteSpace(
                _options.EnrollmentToken))
        {
            _logger.LogWarning(
                "El equipo no está inscrito y no se proporcionó EnrollmentToken.");

            return null;
        }

        _logger.LogInformation(
            "Iniciando inscripción del dispositivo en TitanMDM.");

        identity =
            await _enrollmentService.EnrollAsync(
                _options.EnrollmentToken,
                cancellationToken);

        _logger.LogInformation(
            "Dispositivo inscrito correctamente. DeviceId: {DeviceId}",
            identity.DeviceId);

        return identity;
    }

    private async Task ProcessCommandAsync(
        AgentCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            _logger.LogInformation(
                "Comando recibido: {CommandId} - {CommandType}",
                command.CommandId,
                command.CommandType);

            await _apiClient.MarkDeliveredAsync(
                command.CommandId,
                cancellationToken);

            await _apiClient.MarkExecutingAsync(
                command.CommandId,
                cancellationToken);

            var result =
                await _commandExecutor.ExecuteAsync(
                    command,
                    cancellationToken);

            if (result.Success)
            {
                await _apiClient.MarkSuccessAsync(
                    command.CommandId,
                    result.ResultJson,
                    cancellationToken);

                _logger.LogInformation(
                    "Comando completado: {CommandId}",
                    command.CommandId);

                return;
            }

            await _apiClient.MarkFailedAsync(
                command.CommandId,
                result.ErrorCode ??
                    "COMMAND_FAILED",
                result.ErrorMessage ??
                    "El comando no pudo ejecutarse.",
                result.ResultJson,
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Error procesando comando {CommandId}.",
                command.CommandId);

            try
            {
                await _apiClient.MarkFailedAsync(
                    command.CommandId,
                    "AGENT_EXCEPTION",
                    ex.Message,
                    null,
                    cancellationToken);
            }
            catch (Exception reportException)
            {
                _logger.LogError(
                    reportException,
                    "No se pudo reportar el fallo del comando {CommandId}.",
                    command.CommandId);
            }
        }
    }

    private Task DelayAsync(
        CancellationToken cancellationToken)
    {
        return Task.Delay(
            TimeSpan.FromSeconds(
                Math.Max(
                    5,
                    _options.CommandPollingIntervalSeconds)),
            cancellationToken);
    }
}