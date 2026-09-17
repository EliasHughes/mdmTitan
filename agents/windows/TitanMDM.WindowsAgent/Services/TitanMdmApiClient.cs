using System.Net.Http.Json;
using TitanMDM.WindowsAgent.Contracts;
using TitanMDM.WindowsAgent.Storage;

namespace TitanMDM.WindowsAgent.Services;

public sealed class TitanMdmApiClient
{
    private readonly HttpClient _httpClient;
    private readonly DeviceIdentityStore _identityStore;
    private readonly ILogger<TitanMdmApiClient> _logger;

    public TitanMdmApiClient(
        HttpClient httpClient,
        DeviceIdentityStore identityStore,
        ILogger<TitanMdmApiClient> logger)
    {
        _httpClient = httpClient;
        _identityStore = identityStore;
        _logger = logger;
    }

    public async Task<IReadOnlyCollection<AgentCommand>>
        GetCommandsAsync(
            CancellationToken cancellationToken = default)
    {
        using var request =
            await CreateAuthenticatedRequestAsync(
                HttpMethod.Get,
                "/api/device/commands",
                cancellationToken);

        using var response =
            await _httpClient.SendAsync(
                request,
                cancellationToken);

        await EnsureSuccessfulAsync(
            response,
            "consultar comandos",
            cancellationToken);

        var commands =
            await response.Content
                .ReadFromJsonAsync<List<AgentCommand>>(
                    cancellationToken: cancellationToken);

        return commands ??
               Array.Empty<AgentCommand>();
    }

    public async Task MarkDeliveredAsync(
        Guid commandId,
        CancellationToken cancellationToken = default)
    {
        await SendCommandStatusAsync(
            commandId,
            "delivered",
            null,
            cancellationToken);
    }

    public async Task MarkExecutingAsync(
        Guid commandId,
        CancellationToken cancellationToken = default)
    {
        await SendCommandStatusAsync(
            commandId,
            "executing",
            null,
            cancellationToken);
    }

    public async Task MarkSuccessAsync(
        Guid commandId,
        string? resultJson,
        CancellationToken cancellationToken = default)
    {
        var content =
            JsonContent.Create(
                new CommandSuccessRequest(
                    resultJson));

        await SendCommandStatusAsync(
            commandId,
            "success",
            content,
            cancellationToken);
    }

    public async Task MarkFailedAsync(
        Guid commandId,
        string errorCode,
        string errorMessage,
        string? resultJson,
        CancellationToken cancellationToken = default)
    {
        var content =
            JsonContent.Create(
                new CommandFailedRequest(
                    errorCode,
                    errorMessage,
                    resultJson));

        await SendCommandStatusAsync(
            commandId,
            "failed",
            content,
            cancellationToken);
    }

    private async Task SendCommandStatusAsync(
        Guid commandId,
        string status,
        HttpContent? content,
        CancellationToken cancellationToken)
    {
        if (commandId == Guid.Empty)
        {
            throw new ArgumentException(
                "CommandId no puede estar vacío.",
                nameof(commandId));
        }

        using var request =
            await CreateAuthenticatedRequestAsync(
                HttpMethod.Post,
                $"/api/device/commands/{commandId}/{status}",
                cancellationToken);

        request.Content = content;

        using var response =
            await _httpClient.SendAsync(
                request,
                cancellationToken);

        await EnsureSuccessfulAsync(
            response,
            $"reportar estado '{status}' del comando",
            cancellationToken);
    }

    private async Task<HttpRequestMessage>
        CreateAuthenticatedRequestAsync(
            HttpMethod method,
            string relativeUrl,
            CancellationToken cancellationToken)
    {
        var identity =
            await _identityStore.LoadAsync(
                cancellationToken);

        if (identity is null)
        {
            throw new InvalidOperationException(
                "El agente todavía no posee una identidad TitanMDM.");
        }

        if (identity.DeviceId == Guid.Empty)
        {
            throw new InvalidOperationException(
                "La identidad TitanMDM contiene un DeviceId inválido.");
        }

        if (string.IsNullOrWhiteSpace(
                identity.DeviceSecret))
        {
            throw new InvalidOperationException(
                "La identidad TitanMDM no contiene DeviceSecret.");
        }

        var request =
            new HttpRequestMessage(
                method,
                relativeUrl);

        request.Headers.TryAddWithoutValidation(
            "X-Titan-Device-Id",
            identity.DeviceId.ToString());

        request.Headers.TryAddWithoutValidation(
            "X-Titan-Device-Secret",
            identity.DeviceSecret);

        return request;
    }

    private async Task EnsureSuccessfulAsync(
        HttpResponseMessage response,
        string operation,
        CancellationToken cancellationToken)
    {
        if (response.IsSuccessStatusCode)
        {
            return;
        }

        var responseBody =
            await response.Content
                .ReadAsStringAsync(
                    cancellationToken);

        _logger.LogWarning(
            "TitanMDM rechazó la operación {Operation}. HTTP {StatusCode}.",
            operation,
            (int)response.StatusCode);

        throw new HttpRequestException(
            $"TitanMDM rechazó la operación '{operation}'. " +
            $"HTTP {(int)response.StatusCode}. " +
            responseBody);
    }
}