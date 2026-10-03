using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

using TitanMDM.Domain.Entities;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Api.Services;

public sealed class HelpdeskOutboundEmailWorker
    : BackgroundService
{
    private readonly IServiceScopeFactory
        _scopeFactory;

    private readonly IHttpClientFactory
        _httpClientFactory;

    private readonly IDataProtector
        _protector;

    private readonly IConfiguration
        _configuration;

    private readonly ILogger<
        HelpdeskOutboundEmailWorker>
        _logger;

    public HelpdeskOutboundEmailWorker(
        IServiceScopeFactory scopeFactory,
        IHttpClientFactory httpClientFactory,
        IDataProtectionProvider protectionProvider,
        IConfiguration configuration,
        ILogger<HelpdeskOutboundEmailWorker> logger)
    {
        _scopeFactory =
            scopeFactory;

        _httpClientFactory =
            httpClientFactory;

        _protector =
            protectionProvider.CreateProtector(
                "TitanMDM.Helpdesk.Entra.ClientSecret.v1");

        _configuration =
            configuration;

        _logger =
            logger;
    }

    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (IsEnabled())
                {
                    await ExecuteCycleAsync(
                        stoppingToken);
                }
            }
            catch (OperationCanceledException)
                when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                _logger.LogError(
                    exception,
                    "Error durante el procesamiento de correo saliente de Helpdesk.");
            }

            try
            {
                await Task.Delay(
                    TimeSpan.FromSeconds(
                        PollSeconds()),
                    stoppingToken);
            }
            catch (OperationCanceledException)
                when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }

    private async Task ExecuteCycleAsync(
        CancellationToken cancellationToken)
    {
        await DiscoverMessagesAsync(
            cancellationToken);

        await RecoverAbandonedMessagesAsync(
            cancellationToken);

        await SendPendingMessagesAsync(
            cancellationToken);
    }

    /*
     * ============================================================
     * DISCOVERY
     * ============================================================
     *
     * Detectamos respuestas públicas escritas en TitanMDM.
     *
     * Se excluyen:
     * - notas internas
     * - mensajes entrantes por email
     * - comentarios escritos por el propio solicitante
     * - comentarios ya colocados en Outbox
     */
    private async Task DiscoverMessagesAsync(
        CancellationToken cancellationToken)
    {
        using var scope =
            _scopeFactory.CreateScope();

        var db =
            scope.ServiceProvider
                .GetRequiredService<
                    TitanMdmDbContext>();

        var outbox =
            db.Set<
                HelpdeskOutboundEmail>();

        var batchSize =
            BatchSize();

        var candidates =
            await (
                from comment
                    in db.HelpdeskTicketComments
                        .AsNoTracking()

                join ticket
                    in db.HelpdeskTickets
                        .AsNoTracking()

                    on new
                    {
                        comment.OrganizationId,
                        TicketId =
                            comment.TicketId
                    }
                    equals new
                    {
                        ticket.OrganizationId,
                        TicketId =
                            ticket.Id
                    }

                join requester
                    in db.Users
                        .AsNoTracking()

                    on new
                    {
                        ticket.OrganizationId,
                        UserId =
                            ticket.RequesterUserId
                    }
                    equals new
                    {
                        requester.OrganizationId,
                        UserId =
                            requester.Id
                    }

                where
                    !comment.IsInternal

                    && comment.ExternalAuthorEmail
                        == null

                    && comment.AuthorUserId
                        != ticket.RequesterUserId

                    && !outbox.Any(
                        queued =>
                            queued.OrganizationId
                                == comment.OrganizationId
                            &&
                            queued.CommentId
                                == comment.Id)

                orderby comment.CreatedAtUtc

                select new
                {
                    comment.Id,

                    comment.OrganizationId,

                    comment.TicketId,

                    comment.Body,

                    TicketNumber =
                        ticket.Number,

                    TicketSubject =
                        ticket.Subject,

                    ExternalEmail =
                        ticket.ExternalRequesterEmail,

                    RequesterEmail =
                        requester.Email
                }
            )
            .Take(
                batchSize)
            .ToListAsync(
                cancellationToken);

        if (candidates.Count == 0)
        {
            return;
        }

        foreach (var candidate in candidates)
        {
            var destination =
                !string.IsNullOrWhiteSpace(
                    candidate.ExternalEmail)
                    ? candidate.ExternalEmail
                    : candidate.RequesterEmail;

            if (string.IsNullOrWhiteSpace(
                    destination))
            {
                _logger.LogWarning(
                    "Ticket {TicketId} no tiene correo de solicitante. " +
                    "El comentario {CommentId} no puede enviarse.",
                    candidate.TicketId,
                    candidate.Id);

                continue;
            }

            var subject =
                BuildSubject(
                    candidate.TicketNumber,
                    candidate.TicketSubject);

            var body =
                BuildBody(
                    candidate.TicketNumber,
                    candidate.Body);

            outbox.Add(
                new HelpdeskOutboundEmail(
                    candidate.OrganizationId,
                    candidate.TicketId,
                    candidate.Id,
                    destination,
                    subject,
                    body));
        }

        try
        {
            await db.SaveChangesAsync(
                cancellationToken);
        }
        catch (DbUpdateException exception)
        {
            /*
             * Otro nodo puede haber descubierto exactamente
             * los mismos comentarios.
             *
             * El índice único OrganizationId + CommentId
             * protege contra duplicados.
             */
            _logger.LogInformation(
                exception,
                "Una o más respuestas Helpdesk ya estaban registradas en Outbox.");
        }
    }

    /*
     * ============================================================
     * CRASH RECOVERY
     * ============================================================
     */
    private async Task RecoverAbandonedMessagesAsync(
        CancellationToken cancellationToken)
    {
        using var scope =
            _scopeFactory.CreateScope();

        var db =
            scope.ServiceProvider
                .GetRequiredService<
                    TitanMdmDbContext>();

        var staleBefore =
            DateTime.UtcNow.AddMinutes(
                -10);

        var abandoned =
            await db.Set<
                    HelpdeskOutboundEmail>()
                .Where(
                    x =>
                        x.Status ==
                            HelpdeskOutboundEmail
                                .SendingStatus
                        &&
                        x.LastAttemptAtUtc
                            .HasValue
                        &&
                        x.LastAttemptAtUtc <
                            staleBefore)
                .Take(
                    BatchSize())
                .ToListAsync(
                    cancellationToken);

        if (abandoned.Count == 0)
        {
            return;
        }

        foreach (var message in abandoned)
        {
            message
                .RecoverAbandonedSend();
        }

        await db.SaveChangesAsync(
            cancellationToken);
    }

    /*
     * ============================================================
     * DELIVERY
     * ============================================================
     */
    private async Task SendPendingMessagesAsync(
        CancellationToken cancellationToken)
    {
        using var scope =
            _scopeFactory.CreateScope();

        var db =
            scope.ServiceProvider
                .GetRequiredService<
                    TitanMdmDbContext>();

        var now =
            DateTime.UtcNow;

        var messages =
            await db.Set<
                    HelpdeskOutboundEmail>()
                .Where(
                    x =>
                        (
                            x.Status ==
                                HelpdeskOutboundEmail
                                    .PendingStatus
                            ||
                            x.Status ==
                                HelpdeskOutboundEmail
                                    .RetryStatus
                        )
                        &&
                        (
                            !x.NextAttemptAtUtc
                                .HasValue
                            ||
                            x.NextAttemptAtUtc <=
                                now
                        ))
                .OrderBy(
                    x =>
                        x.CreatedAtUtc)
                .Take(
                    BatchSize())
                .ToListAsync(
                    cancellationToken);

        if (messages.Count == 0)
        {
            return;
        }

        var mailbox =
            _configuration[
                "HelpdeskMail:Mailbox"]?
                .Trim()
                .ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(
                mailbox))
        {
            _logger.LogWarning(
                "HelpdeskOutbound está habilitado pero HelpdeskMail:Mailbox no está configurado.");

            return;
        }

        foreach (var message in messages)
        {
            if (cancellationToken
                .IsCancellationRequested)
            {
                break;
            }

            try
            {
                message.MarkSending();

                await db.SaveChangesAsync(
                    cancellationToken);

                var settings =
                    await db.EntraIdSettings
                        .AsNoTracking()
                        .FirstOrDefaultAsync(
                            x =>
                                x.OrganizationId ==
                                    message.OrganizationId,
                            cancellationToken);

                if (
                    settings is null
                    ||
                    !settings.IsEnabled
                    ||
                    string.IsNullOrWhiteSpace(
                        settings.TenantId)
                    ||
                    string.IsNullOrWhiteSpace(
                        settings.ClientId)
                    ||
                    string.IsNullOrWhiteSpace(
                        settings.ClientSecretProtected))
                {
                    throw new InvalidOperationException(
                        "Entra ID no está configurado para el envío de correo Helpdesk.");
                }

                var client =
                    _httpClientFactory
                        .CreateClient(
                            "entra-id");

                var secret =
                    _protector.Unprotect(
                        settings
                            .ClientSecretProtected);

                var accessToken =
                    await GetAccessTokenAsync(
                        client,
                        settings.TenantId,
                        settings.ClientId,
                        secret,
                        cancellationToken);

                await SendMailAsync(
                    client,
                    accessToken,
                    mailbox,
                    message,
                    cancellationToken);

                message.MarkSent();

                db.HelpdeskTicketEvents.Add(
                    new HelpdeskTicketEvent(
                        message.OrganizationId,
                        message.TicketId,
                        null,
                        "email_sent",
                        $"Respuesta enviada por correo a {message.ToEmail}."));

                await db.SaveChangesAsync(
                    cancellationToken);

                _logger.LogInformation(
                    "Respuesta Helpdesk {OutboundEmailId} enviada para ticket {TicketId}.",
                    message.Id,
                    message.TicketId);
            }
            catch (OperationCanceledException)
                when (cancellationToken
                    .IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                message.MarkFailure(
                    exception.Message,
                    MaxAttempts());

                await db.SaveChangesAsync(
                    CancellationToken.None);

                _logger.LogWarning(
                    exception,
                    "Falló correo Helpdesk {OutboundEmailId}. Intento {AttemptCount}.",
                    message.Id,
                    message.AttemptCount);
            }
        }
    }

    private static async Task<string>
        GetAccessTokenAsync(
            HttpClient client,
            string tenantId,
            string clientId,
            string clientSecret,
            CancellationToken cancellationToken)
    {
        using var request =
            new HttpRequestMessage(
                HttpMethod.Post,
                $"https://login.microsoftonline.com/" +
                $"{Uri.EscapeDataString(tenantId)}" +
                "/oauth2/v2.0/token")
            {
                Content =
                    new FormUrlEncodedContent(
                        new Dictionary<
                            string,
                            string>
                        {
                            ["client_id"] =
                                clientId,

                            ["client_secret"] =
                                clientSecret,

                            ["grant_type"] =
                                "client_credentials",

                            ["scope"] =
                                "https://graph.microsoft.com/.default"
                        })
            };

        using var response =
            await client.SendAsync(
                request,
                cancellationToken);

        var content =
            await response.Content
                .ReadAsStringAsync(
                    cancellationToken);

        if (!response
            .IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Microsoft Entra rechazó la autenticación para correo saliente. " +
                $"HTTP {(int)response.StatusCode}.");
        }

        using var json =
            JsonDocument.Parse(
                content);

        if (
            !json.RootElement
                .TryGetProperty(
                    "access_token",
                    out var tokenElement)
            ||
            string.IsNullOrWhiteSpace(
                tokenElement.GetString()))
        {
            throw new InvalidOperationException(
                "Microsoft Entra no devolvió access_token.");
        }

        return tokenElement
            .GetString()!;
    }

    private static async Task SendMailAsync(
        HttpClient client,
        string accessToken,
        string mailbox,
        HelpdeskOutboundEmail message,
        CancellationToken cancellationToken)
    {
        var endpoint =
            $"https://graph.microsoft.com/v1.0/users/" +
            $"{Uri.EscapeDataString(mailbox)}/sendMail";

        var payload =
            new
            {
                message =
                    new
                    {
                        subject =
                            message.Subject,

                        body =
                            new
                            {
                                contentType =
                                    "Text",

                                content =
                                    message.Body
                            },

                        toRecipients =
                            new[]
                            {
                                new
                                {
                                    emailAddress =
                                        new
                                        {
                                            address =
                                                message.ToEmail
                                        }
                                }
                            }
                    },

                saveToSentItems =
                    true
            };

        using var request =
            new HttpRequestMessage(
                HttpMethod.Post,
                endpoint);

        request.Headers.Authorization =
            new AuthenticationHeaderValue(
                "Bearer",
                accessToken);

        request.Content =
            new StringContent(
                JsonSerializer.Serialize(
                    payload),
                Encoding.UTF8,
                "application/json");

        using var response =
            await client.SendAsync(
                request,
                cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var responseBody =
                await response.Content
                    .ReadAsStringAsync(
                        cancellationToken);

            var safeBody =
                responseBody[
                    ..Math.Min(
                        responseBody.Length,
                        1000)];

            throw new InvalidOperationException(
                $"Microsoft Graph rechazó sendMail. " +
                $"HTTP {(int)response.StatusCode}. " +
                safeBody);
        }
    }

    private static string BuildSubject(
        string ticketNumber,
        string subject)
    {
        var value =
            $"[TitanMDM][{ticketNumber}] {subject}";

        return value[
            ..Math.Min(
                value.Length,
                250)];
    }

    private static string BuildBody(
        string ticketNumber,
        string comment)
    {
        var value =
            $"""
            TitanMDM - Mesa de Ayuda
            Ticket: {ticketNumber}

            {comment}

            ------------------------------------------------------------
            Responde directamente a este correo para continuar
            la conversación del ticket.

            Este mensaje fue generado por TitanMDM.
            """;

        return value[
            ..Math.Min(
                value.Length,
                10000)];
    }

    private bool IsEnabled()
    {
        return _configuration
            .GetValue<bool>(
                "HelpdeskOutbound:Enabled");
    }

    private int PollSeconds()
    {
        return Math.Clamp(
            _configuration
                .GetValue(
                    "HelpdeskOutbound:PollSeconds",
                    20),
            10,
            3600);
    }

    private int BatchSize()
    {
        return Math.Clamp(
            _configuration
                .GetValue(
                    "HelpdeskOutbound:BatchSize",
                    25),
            1,
            100);
    }

    private int MaxAttempts()
    {
        return Math.Clamp(
            _configuration
                .GetValue(
                    "HelpdeskOutbound:MaxAttempts",
                    8),
            1,
            20);
    }
}