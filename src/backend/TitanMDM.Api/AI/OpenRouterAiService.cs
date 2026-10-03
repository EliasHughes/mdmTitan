using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace TitanMDM.Api.AI;

public sealed class OpenRouterAiService
    : IOpenRouterAiService
{
    private readonly HttpClient _httpClient;
    private readonly OpenRouterOptions _options;
    private readonly ILogger<OpenRouterAiService> _logger;

    public OpenRouterAiService(
        HttpClient httpClient,
        IOptions<OpenRouterOptions> options,
        ILogger<OpenRouterAiService> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<string> CompleteAsync(
        string systemPrompt,
        string userPrompt,
        string? model = null,
        CancellationToken cancellationToken = default)
    {
        if (!_options.Enabled)
        {
            throw new InvalidOperationException(
                "OpenRouter está deshabilitado.");
        }

        if (string.IsNullOrWhiteSpace(
                _options.ApiKey))
        {
            throw new InvalidOperationException(
                "AI:OpenRouter:ApiKey no está configurada.");
        }

        if (string.IsNullOrWhiteSpace(
                userPrompt))
        {
            throw new ArgumentException(
                "El prompt de usuario es obligatorio.",
                nameof(userPrompt));
        }

        var selectedModel =
            string.IsNullOrWhiteSpace(model)
                ? _options.ResolveAssistantModel()
                : model.Trim();

        var request =
            new OpenRouterRequest
            {
                Model = selectedModel,
                Temperature =
                    _options.Temperature,
                MaxTokens =
                    _options.MaxTokens,
                Messages =
                [
                    new OpenRouterMessage
                    {
                        Role = "system",
                        Content =
                            systemPrompt
                            ?? string.Empty
                    },

                    new OpenRouterMessage
                    {
                        Role = "user",
                        Content =
                            userPrompt
                    }
                ]
            };

        using var httpRequest =
            new HttpRequestMessage(
                HttpMethod.Post,
                "chat/completions");

        httpRequest.Headers.Authorization =
            new AuthenticationHeaderValue(
                "Bearer",
                _options.ApiKey.Trim());

        if (!string.IsNullOrWhiteSpace(
                _options.SiteUrl))
        {
            httpRequest.Headers.TryAddWithoutValidation(
                "HTTP-Referer",
                _options.SiteUrl.Trim());
        }

        var title =
            !string.IsNullOrWhiteSpace(
                _options.ApplicationTitle)
                ? _options.ApplicationTitle
                : _options.AppName;

        if (!string.IsNullOrWhiteSpace(
                title))
        {
            httpRequest.Headers.TryAddWithoutValidation(
                "X-Title",
                title.Trim());
        }

        httpRequest.Content =
            JsonContent.Create(
                request);

        var attempts =
            Math.Max(
                1,
                _options.MaxRetries + 1);

        Exception? lastException =
            null;

        for (
            var attempt = 1;
            attempt <= attempts;
            attempt++)
        {
            try
            {
                using var response =
                    await _httpClient.SendAsync(
                        httpRequest,
                        HttpCompletionOption
                            .ResponseHeadersRead,
                        cancellationToken);

                var body =
                    await response.Content
                        .ReadAsStringAsync(
                            cancellationToken);

                if (response.IsSuccessStatusCode)
                {
                    return ExtractContent(
                        body);
                }

                if (!ShouldRetry(
                        response.StatusCode)
                    ||
                    attempt >= attempts)
                {
                    throw new InvalidOperationException(
                        $"OpenRouter respondió HTTP {(int)response.StatusCode}. " +
                        body);
                }

                _logger.LogWarning(
                    "OpenRouter respondió HTTP {StatusCode}. " +
                    "Intento {Attempt}/{Attempts}.",
                    (int)response.StatusCode,
                    attempt,
                    attempts);
            }
            catch (
                OperationCanceledException)
                when (!cancellationToken
                    .IsCancellationRequested)
            {
                lastException =
                    new TimeoutException(
                        "OpenRouter excedió el tiempo de espera.");

                if (attempt >= attempts)
                {
                    throw lastException;
                }
            }
            catch (HttpRequestException ex)
            {
                lastException =
                    ex;

                if (attempt >= attempts)
                {
                    throw;
                }

                _logger.LogWarning(
                    ex,
                    "Fallo HTTP temporal contra OpenRouter. " +
                    "Intento {Attempt}/{Attempts}.",
                    attempt,
                    attempts);
            }

            var delay =
                TimeSpan.FromMilliseconds(
                    Math.Min(
                        5000,
                        Math.Max(
                            250,
                            _options
                                .RetryBaseDelayMilliseconds)
                        *
                        attempt));

            await Task.Delay(
                delay,
                cancellationToken);

            /*
             * HttpRequestMessage no puede reutilizarse
             * después del primer SendAsync.
             *
             * Por eso, si llegamos a un retry,
             * reconstruimos la petición.
             */
            httpRequest.Dispose();

            throw new InvalidOperationException(
                "La implementación de retry necesita " +
                "una nueva instancia HttpRequestMessage por intento.");
        }

        throw lastException
            ?? new InvalidOperationException(
                "OpenRouter no devolvió respuesta.");
    }

    private static bool ShouldRetry(
        HttpStatusCode statusCode)
    {
        return statusCode ==
                   HttpStatusCode.RequestTimeout
               ||
               statusCode ==
                   (HttpStatusCode)429
               ||
               (int)statusCode >= 500;
    }

    private static string ExtractContent(
        string json)
    {
        if (string.IsNullOrWhiteSpace(
                json))
        {
            throw new InvalidOperationException(
                "OpenRouter devolvió una respuesta vacía.");
        }

        using var document =
            JsonDocument.Parse(
                json);

        var root =
            document.RootElement;

        if (!root.TryGetProperty(
                "choices",
                out var choices)
            ||
            choices.ValueKind !=
                JsonValueKind.Array
            ||
            choices.GetArrayLength() == 0)
        {
            throw new InvalidOperationException(
                "OpenRouter no devolvió choices válidos.");
        }

        var firstChoice =
            choices[0];

        if (!firstChoice.TryGetProperty(
                "message",
                out var message))
        {
            throw new InvalidOperationException(
                "OpenRouter no devolvió message.");
        }

        if (!message.TryGetProperty(
                "content",
                out var content))
        {
            throw new InvalidOperationException(
                "OpenRouter no devolvió content.");
        }

        return content.GetString()
               ?? string.Empty;
    }

    private sealed class OpenRouterRequest
    {
        public string Model { get; init; } =
            string.Empty;

        public List<OpenRouterMessage> Messages { get; init; } =
            [];

        public double Temperature { get; init; }

        public int MaxTokens { get; init; }
    }

    private sealed class OpenRouterMessage
    {
        public string Role { get; init; } =
            string.Empty;

        public string Content { get; init; } =
            string.Empty;
    }
}