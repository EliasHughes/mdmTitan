using System.Runtime.InteropServices;
using System.Text.Json;
using TitanMDM.WindowsAgent.Contracts;

namespace TitanMDM.WindowsAgent.Execution;

public sealed class CommandExecutor
    : ICommandExecutor
{
    private readonly ILogger<CommandExecutor> _logger;

    public CommandExecutor(
        ILogger<CommandExecutor> logger)
    {
        _logger = logger;
    }

    public async Task<CommandExecutionResult> ExecuteAsync(
        AgentCommand command,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (command.CommandId == Guid.Empty)
        {
            return Failure(
                "INVALID_COMMAND_ID",
                "El comando no contiene un CommandId válido.");
        }

        if (string.IsNullOrWhiteSpace(
                command.CommandType))
        {
            return Failure(
                "INVALID_COMMAND_TYPE",
                "El comando no contiene un tipo válido.");
        }

        if (command.ExpiresAtUtc <= DateTime.UtcNow)
        {
            return Failure(
                "COMMAND_EXPIRED",
                "El comando expiró antes de poder ejecutarse.");
        }

        var commandType =
            command.CommandType
                .Trim()
                .ToUpperInvariant();

        _logger.LogInformation(
            "Ejecutando comando {CommandId} de tipo {CommandType}.",
            command.CommandId,
            commandType);

        try
        {
            return commandType switch
            {
                "DEVICE_INFO" =>
                    await ExecuteDeviceInfoAsync(
                        cancellationToken),

                "PING" =>
                    ExecutePing(),

                _ =>
                    Failure(
                        "UNSUPPORTED_COMMAND",
                        $"El comando '{command.CommandType}' no está soportado por esta versión del agente.")
            };
        }
        catch (OperationCanceledException)
            when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Error ejecutando comando {CommandId}.",
                command.CommandId);

            return Failure(
                "COMMAND_EXECUTION_ERROR",
                ex.Message);
        }
    }

    private static Task<CommandExecutionResult>
        ExecuteDeviceInfoAsync(
            CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var information =
            new
            {
                computerName =
                    Environment.MachineName,

                userName =
                    Environment.UserName,

                operatingSystem =
                    RuntimeInformation.OSDescription,

                osArchitecture =
                    RuntimeInformation
                        .OSArchitecture
                        .ToString(),

                processArchitecture =
                    RuntimeInformation
                        .ProcessArchitecture
                        .ToString(),

                framework =
                    RuntimeInformation
                        .FrameworkDescription,

                processorCount =
                    Environment.ProcessorCount,

                systemDirectory =
                    Environment.SystemDirectory,

                is64BitOperatingSystem =
                    Environment.Is64BitOperatingSystem,

                is64BitProcess =
                    Environment.Is64BitProcess,

                machineName =
                    Environment.MachineName,

                agentVersion =
                    typeof(CommandExecutor)
                        .Assembly
                        .GetName()
                        .Version?
                        .ToString()
                    ?? "1.0.0",

                collectedAtUtc =
                    DateTime.UtcNow
            };

        var json =
            JsonSerializer.Serialize(
                information);

        return Task.FromResult(
            Success(json));
    }

    private static CommandExecutionResult
        ExecutePing()
    {
        var json =
            JsonSerializer.Serialize(
                new
                {
                    response = "PONG",
                    computerName =
                        Environment.MachineName,
                    timestampUtc =
                        DateTime.UtcNow
                });

        return Success(json);
    }

    private static CommandExecutionResult Success(
        string? resultJson)
    {
        return new CommandExecutionResult(
            true,
            resultJson,
            null,
            null);
    }

    private static CommandExecutionResult Failure(
        string errorCode,
        string errorMessage)
    {
        return new CommandExecutionResult(
            false,
            null,
            errorCode,
            errorMessage);
    }
}