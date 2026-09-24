using Microsoft.Extensions.Options;
using TitanMDM.WindowsAgent.Configuration;
using TitanMDM.WindowsAgent.Contracts;
using TitanMDM.WindowsAgent.Execution;
using TitanMDM.WindowsAgent.Services;
using TitanMDM.WindowsAgent.Storage;

namespace TitanMDM.WindowsAgent;

public sealed class Worker
    : BackgroundService
{
    private readonly ILogger<Worker>
        _logger;

    private readonly TitanMdmApiClient
        _apiClient;

    private readonly EnrollmentService
        _enrollmentService;

    private readonly ICommandExecutor
        _commandExecutor;

    private readonly DeviceIdentityStore
        _identityStore;

    private readonly AgentRuntimeSettingsStore
        _runtimeSettingsStore;

    private readonly AgentOptions
        _options;

    public Worker(
        ILogger<Worker> logger,
        TitanMdmApiClient apiClient,
        EnrollmentService enrollmentService,
        ICommandExecutor commandExecutor,
        DeviceIdentityStore identityStore,
        AgentRuntimeSettingsStore
            runtimeSettingsStore,
        IOptions<AgentOptions> options)
    {
        _logger =
            logger;

        _apiClient =
            apiClient;

        _enrollmentService =
            enrollmentService;

        _commandExecutor =
            commandExecutor;

        _identityStore =
            identityStore;

        _runtimeSettingsStore =
            runtimeSettingsStore;

        _options =
            options.Value;
    }

    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "TitanMDM Windows Agent iniciado.");

        _logger.LogInformation(
            "TitanMDM ServerUrl activo: {ServerUrl}",
            _options.ServerUrl);

        _logger.LogInformation(
            "Archivo de identidad: {IdentityPath}",
            _identityStore
                .GetIdentityFilePath());

        _logger.LogInformation(
            "Archivo de configuración: {SettingsPath}",
            _runtimeSettingsStore
                .GetSettingsFilePath());

        while (
            !stoppingToken
                .IsCancellationRequested)
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
                    await _apiClient
                        .GetCommandsAsync(
                            stoppingToken);

                foreach (
                    var command
                    in commands)
                {
                    if (
                        stoppingToken
                            .IsCancellationRequested)
                    {
                        break;
                    }

                    await ProcessCommandAsync(
                        command,
                        stoppingToken);
                }
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
                HttpRequestException ex)
            {
                _logger.LogWarning(
                    ex,
                    "TitanMDM API no está disponible actualmente.");
            }
            catch (
                Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Error durante el ciclo principal del agente TitanMDM.");
            }

            await DelayAsync(
                stoppingToken);
        }

        _logger.LogInformation(
            "TitanMDM Windows Agent detenido.");
    }

    private async Task<DeviceIdentity?>
        EnsureEnrollmentAsync(
            CancellationToken cancellationToken)
    {
        var identity =
            await _identityStore
                .LoadAsync(
                    cancellationToken);

        if (
            identity is
            not null)
        {
            return identity;
        }

        if (
            string.IsNullOrWhiteSpace(
                _options.EnrollmentToken))
        {
            _logger.LogWarning(
                "El equipo todavía no está inscrito y no existe EnrollmentToken.");

            return null;
        }

        _logger.LogInformation(
            "Iniciando inscripción del dispositivo contra {ServerUrl}.",
            _options.ServerUrl);

        identity =
            await _enrollmentService
                .EnrollAsync(
                    _options.EnrollmentToken,
                    cancellationToken);

        _logger.LogInformation(
            "Dispositivo inscrito correctamente. DeviceId={DeviceId}",
            identity.DeviceId);

        /*
         * El EnrollmentToken ya no es necesario después de crear
         * DeviceId + DeviceSecret.
         *
         * Se elimina del archivo runtime para no dejar credenciales
         * de inscripción almacenadas permanentemente.
         */

        try
        {
            await _runtimeSettingsStore
                .ClearEnrollmentTokenAsync(
                    cancellationToken);

            _options.EnrollmentToken =
                null;

            _logger.LogInformation(
                "EnrollmentToken eliminado de la configuración runtime.");
        }
        catch (
            Exception ex)
        {
            /*
             * La inscripción YA fue completada.
             * Un fallo al limpiar el token no debe invalidar
             * DeviceId/DeviceSecret.
             */

            _logger.LogWarning(
                ex,
                "El dispositivo fue inscrito, pero no fue posible limpiar EnrollmentToken.");
        }

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

            await _apiClient
                .MarkDeliveredAsync(
                    command.CommandId,
                    cancellationToken);

            await _apiClient
                .MarkExecutingAsync(
                    command.CommandId,
                    cancellationToken);

            var result =
                await _commandExecutor
                    .ExecuteAsync(
                        command,
                        cancellationToken);

            if (
                result.Success)
            {
                await _apiClient
                    .MarkSuccessAsync(
                        command.CommandId,
                        result.ResultJson,
                        cancellationToken);

                _logger.LogInformation(
                    "Comando completado: {CommandId}",
                    command.CommandId);

                return;
            }

            await _apiClient
                .MarkFailedAsync(
                    command.CommandId,

                    result.ErrorCode
                    ??
                    "COMMAND_FAILED",

                    result.ErrorMessage
                    ??
                    "El comando no pudo ejecutarse.",

                    result.ResultJson,

                    cancellationToken);

            _logger.LogWarning(
                "Comando fallido: {CommandId} - {CommandType} - {ErrorCode}",
                command.CommandId,
                command.CommandType,
                result.ErrorCode);
        }
        catch (
            OperationCanceledException)
                when (
                    cancellationToken
                        .IsCancellationRequested)
        {
            throw;
        }
        catch (
            Exception ex)
        {
            _logger.LogError(
                ex,
                "Error procesando comando {CommandId}.",
                command.CommandId);

            try
            {
                await _apiClient
                    .MarkFailedAsync(
                        command.CommandId,
                        "AGENT_EXCEPTION",
                        ex.Message,
                        null,
                        cancellationToken);
            }
            catch (
                Exception reportException)
            {
                _logger.LogError(
                    reportException,
                    "No se pudo reportar el fallo del comando {CommandId}.",
                    command.CommandId);
            }
        }
    }

    private async Task DelayAsync(
        CancellationToken cancellationToken)
    {
        try
        {
            await Task.Delay(
                TimeSpan.FromSeconds(
                    Math.Max(
                        5,
                        _options
                            .CommandPollingIntervalSeconds)),
                cancellationToken);
        }
        catch (
            OperationCanceledException)
                when (
                    cancellationToken
                        .IsCancellationRequested)
        {
            // Finalización normal del servicio.
        }
    }
}