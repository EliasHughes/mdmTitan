using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

using TitanMDM.Domain.Entities;

using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

using TitanMDM.Infrastructure.Helpdesk;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Api.Services;

public sealed class HelpdeskMailWorker
    : BackgroundService
{
    private const int WorkerTickSeconds =
        10;

    private const long MaxAttachmentBytes =
        10L * 1024L * 1024L;

    private const long MaxTotalAttachmentBytes =
        25L * 1024L * 1024L;

    private readonly IServiceScopeFactory
        _scopeFactory;

    private readonly IHttpClientFactory
        _httpClientFactory;

    private readonly IDataProtector
        _protector;

    private readonly IConfiguration
        _configuration;

    private readonly ILogger<
        HelpdeskMailWorker>
        _logger;

    public HelpdeskMailWorker(
        IServiceScopeFactory scopeFactory,
        IHttpClientFactory httpClientFactory,
        IDataProtectionProvider protectionProvider,
        IConfiguration configuration,
        ILogger<HelpdeskMailWorker> logger)
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
        while (!stoppingToken
            .IsCancellationRequested)
        {
            try
            {
                await ExecuteDueMailboxesAsync(
                    stoppingToken);
            }
            catch (OperationCanceledException)
                when (
                    stoppingToken
                        .IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                _logger.LogError(
                    exception,
                    "Error general del worker de correo entrante de Helpdesk.");
            }

            try
            {
                await Task.Delay(
                    TimeSpan.FromSeconds(
                        WorkerTickSeconds),
                    stoppingToken);
            }
            catch (OperationCanceledException)
                when (
                    stoppingToken
                        .IsCancellationRequested)
            {
                break;
            }
        }
    }

    // ============================================================
    // SCHEDULER
    // ============================================================

    private async Task ExecuteDueMailboxesAsync(
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

        var configurations =
            await db.HelpdeskMailSettings
                .AsNoTracking()
                .Where(
                    x =>
                        x.InboundEnabled
                        &&
                        x.Mailbox !=
                            null
                        &&
                        x.ActorUserId
                            .HasValue)
                .Select(
                    x =>
                        new
                        {
                            x.OrganizationId,
                            x.InboundPollSeconds,
                            x.LastInboundAttemptAtUtc
                        })
                .ToListAsync(
                    cancellationToken);

        var dueOrganizations =
            configurations
                .Where(
                    x =>
                        !x.LastInboundAttemptAtUtc
                            .HasValue
                        ||
                        x.LastInboundAttemptAtUtc
                            .Value
                            .AddSeconds(
                                Math.Clamp(
                                    x.InboundPollSeconds,
                                    30,
                                    3600))
                        <= now)
                .Select(
                    x =>
                        x.OrganizationId)
                .ToArray();

        foreach (
            var organizationId
            in dueOrganizations)
        {
            cancellationToken
                .ThrowIfCancellationRequested();

            await ProcessOrganizationAsync(
                organizationId,
                cancellationToken);
        }
    }

    // ============================================================
    // ORGANIZATION
    // ============================================================

    private async Task ProcessOrganizationAsync(
        Guid organizationId,
        CancellationToken cancellationToken)
    {
        using var scope =
            _scopeFactory.CreateScope();

        var db =
            scope.ServiceProvider
                .GetRequiredService<
                    TitanMdmDbContext>();

        var importer =
            scope.ServiceProvider
                .GetRequiredService<
                    HelpdeskEmailImportService>();

        var attachmentImporter =
            scope.ServiceProvider
                .GetRequiredService<
                    HelpdeskEmailAttachmentImportService>();

        var mailSettings =
            await db.HelpdeskMailSettings
                .FirstOrDefaultAsync(
                    x =>
                        x.OrganizationId ==
                            organizationId,
                    cancellationToken);

        if (mailSettings is null ||
            !mailSettings.InboundEnabled ||
            string.IsNullOrWhiteSpace(
                mailSettings.Mailbox) ||
            !mailSettings.ActorUserId
                .HasValue)
        {
            return;
        }

        var mailbox =
            mailSettings.Mailbox
                .Trim()
                .ToLowerInvariant();

        var actorUserId =
            mailSettings
                .ActorUserId
                .Value;

        mailSettings
            .MarkInboundAttempt();

        await TrySaveRuntimeStatusAsync(
            db,
            cancellationToken);

        try
        {
            var actorValid =
                await db.Users
                    .AsNoTracking()
                    .AnyAsync(
                        x =>
                            x.OrganizationId ==
                                organizationId
                            &&
                            x.Id ==
                                actorUserId
                            &&
                            x.IsActive,
                        cancellationToken);

            if (!actorValid)
            {
                throw new InvalidOperationException(
                    "El usuario técnico configurado para el buzón no existe o está inactivo.");
            }

            var entra =
                await db.EntraIdSettings
                    .AsNoTracking()
                    .FirstOrDefaultAsync(
                        x =>
                            x.OrganizationId ==
                                organizationId,
                        cancellationToken);

            if (entra is null ||
                !entra.IsEnabled ||
                string.IsNullOrWhiteSpace(
                    entra.TenantId) ||
                string.IsNullOrWhiteSpace(
                    entra.ClientId) ||
                string.IsNullOrWhiteSpace(
                    entra.ClientSecretProtected))
            {
                throw new InvalidOperationException(
                    "Entra ID no está configurado o habilitado para correo Helpdesk.");
            }

            var client =
                _httpClientFactory
                    .CreateClient(
                        "entra-id");

            var token =
                await GetTokenAsync(
                    client,
                    entra.TenantId,
                    entra.ClientId,
                    _protector.Unprotect(
                        entra
                            .ClientSecretProtected),
                    cancellationToken);

            await SyncMailboxAsync(
                client,
                token,
                organizationId,
                actorUserId,
                mailbox,
                importer,
                attachmentImporter,
                cancellationToken);

            mailSettings
                .MarkInboundSuccess();

            await TrySaveRuntimeStatusAsync(
                db,
                cancellationToken);

            _logger.LogInformation(
                "Sincronización de correo entrante completada para organización {OrganizationId}, buzón {Mailbox}.",
                organizationId,
                mailbox);
        }
        catch (OperationCanceledException)
            when (
                cancellationToken
                    .IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            /*
             * Reload because a configuration update may have
             * occurred while Graph was being queried.
             */
            await ReloadMailSettingsAsync(
                db,
                mailSettings,
                CancellationToken.None);

            mailSettings
                .MarkInboundFailure(
                    exception.Message);

            await TrySaveRuntimeStatusAsync(
                db,
                CancellationToken.None);

            _logger.LogError(
                exception,
                "No se pudo sincronizar correo entrante para organización {OrganizationId}, buzón {Mailbox}.",
                organizationId,
                mailbox);
        }
    }

    // ============================================================
    // MAILBOX DELTA
    // ============================================================

    private async Task SyncMailboxAsync(
        HttpClient client,
        string token,
        Guid organizationId,
        Guid actorUserId,
        string mailbox,
        HelpdeskEmailImportService importer,
        HelpdeskEmailAttachmentImportService attachmentImporter,
        CancellationToken cancellationToken)
    {
        var cursorDirectory =
            ResolveCursorDirectory();

        Directory.CreateDirectory(
            cursorDirectory);

        var mailboxKey =
            Convert.ToHexString(
                SHA256.HashData(
                    Encoding.UTF8
                        .GetBytes(
                            mailbox)))[..16];

        var cursorFile =
            Path.Combine(
                cursorDirectory,
                $"{organizationId:N}-{mailboxKey}-helpdesk-mail.txt");

        var initialUrl =
            $"https://graph.microsoft.com/v1.0/users/" +
            $"{Uri.EscapeDataString(mailbox)}" +
            "/mailFolders/inbox/messages/delta" +
            "?$select=id,internetMessageId,conversationId,from,subject,body,hasAttachments" +
            "&$top=50";

        var url =
            File.Exists(
                cursorFile)
                ? (
                    await File.ReadAllTextAsync(
                        cursorFile,
                        cancellationToken)
                  )
                  .Trim()
                : initialUrl;

        if (string.IsNullOrWhiteSpace(
                url))
        {
            url =
                initialUrl;
        }

        while (!cancellationToken
            .IsCancellationRequested)
        {
            EnsureGraphUrl(
                url);

            using var request =
                new HttpRequestMessage(
                    HttpMethod.Get,
                    url);

            request.Headers.Authorization =
                new AuthenticationHeaderValue(
                    "Bearer",
                    token);

            request.Headers
                .TryAddWithoutValidation(
                    "Prefer",
                    "outlook.body-content-type=\"text\"");

            using var response =
                await client.SendAsync(
                    request,
                    cancellationToken);

            if (!response
                .IsSuccessStatusCode)
            {
                throw new InvalidOperationException(
                    $"Microsoft Graph devolvió HTTP {(int)response.StatusCode} al consultar el buzón.");
            }

            using var document =
                JsonDocument.Parse(
                    await response.Content
                        .ReadAsStringAsync(
                            cancellationToken));

            if (!document.RootElement
                    .TryGetProperty(
                        "value",
                        out var value)
                ||
                value.ValueKind !=
                    JsonValueKind.Array)
            {
                throw new InvalidOperationException(
                    "Microsoft Graph devolvió una respuesta delta inválida.");
            }

            foreach (
                var item
                in value.EnumerateArray())
            {
                if (
                    item.TryGetProperty(
                        "@removed",
                        out _)
                    ||
                    !item.TryGetProperty(
                        "id",
                        out var id)
                    ||
                    id.GetString()
                    is not { Length: > 0 }
                        graphId)
                {
                    continue;
                }

                var inbound =
                    await GetMessageAsync(
                        client,
                        token,
                        mailbox,
                        graphId,
                        cancellationToken);

                if (inbound is null)
                {
                    continue;
                }

                var ticketId =
                    await importer
                        .ImportAsync(
                            organizationId,
                            actorUserId,
                            inbound.Message,
                            cancellationToken);

                if (inbound.Attachments.Count >
                    0)
                {
                    var imported =
                        await attachmentImporter
                            .ImportAsync(
                                organizationId,
                                ticketId,
                                actorUserId,
                                inbound.Message
                                    .InternetMessageId,
                                inbound.Attachments,
                                cancellationToken);

                    if (imported >
                        0)
                    {
                        _logger.LogInformation(
                            "{AttachmentCount} adjunto(s) importados por correo para ticket {TicketId}.",
                            imported,
                            ticketId);
                    }
                }

                if (inbound.SkippedAttachments >
                    0)
                {
                    _logger.LogWarning(
                        "{SkippedCount} adjunto(s) fueron omitidos por seguridad/tamaño para ticket {TicketId}.",
                        inbound.SkippedAttachments,
                        ticketId);
                }
            }

            var next =
                document.RootElement
                    .TryGetProperty(
                        "@odata.nextLink",
                        out var nextLink)
                    ? nextLink
                        .GetString()
                    : null;

            var delta =
                document.RootElement
                    .TryGetProperty(
                        "@odata.deltaLink",
                        out var deltaLink)
                    ? deltaLink
                        .GetString()
                    : null;

            var checkpoint =
                next
                ??
                delta
                ??
                throw new InvalidOperationException(
                    "Microsoft Graph no devolvió cursor delta.");

            EnsureGraphUrl(
                checkpoint);

            var temporaryFile =
                cursorFile +
                ".tmp";

            await File.WriteAllTextAsync(
                temporaryFile,
                checkpoint,
                cancellationToken);

            File.Move(
                temporaryFile,
                cursorFile,
                overwrite:
                    true);

            if (next is null)
            {
                break;
            }

            url =
                next;
        }
    }

    // ============================================================
    // MESSAGE
    // ============================================================

    private static async Task<
        GraphInboundMessage?>
        GetMessageAsync(
            HttpClient client,
            string token,
            string mailbox,
            string graphId,
            CancellationToken cancellationToken)
    {
        var url =
            $"https://graph.microsoft.com/v1.0/users/" +
            $"{Uri.EscapeDataString(mailbox)}/messages/" +
            $"{Uri.EscapeDataString(graphId)}" +
            "?$select=internetMessageId,conversationId,from,subject,body,hasAttachments";

        EnsureGraphUrl(
            url);

        using var request =
            new HttpRequestMessage(
                HttpMethod.Get,
                url);

        request.Headers.Authorization =
            new AuthenticationHeaderValue(
                "Bearer",
                token);

        request.Headers
            .TryAddWithoutValidation(
                "Prefer",
                "outlook.body-content-type=\"text\"");

        using var response =
            await client.SendAsync(
                request,
                cancellationToken);

        if (response.StatusCode ==
            HttpStatusCode.NotFound)
        {
            return null;
        }

        if (!response
            .IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Microsoft Graph devolvió HTTP {(int)response.StatusCode} al leer un mensaje.");
        }

        using var document =
            JsonDocument.Parse(
                await response.Content
                    .ReadAsStringAsync(
                        cancellationToken));

        var root =
            document.RootElement;

        if (!root.TryGetProperty(
                "from",
                out var fromElement) ||
            fromElement.ValueKind !=
                JsonValueKind.Object ||
            !fromElement.TryGetProperty(
                "emailAddress",
                out var from))
        {
            return null;
        }

        var sender =
            from.TryGetProperty(
                "address",
                out var address)
                ? address
                    .GetString()?
                    .Trim()
                : null;

        /*
         * Never import outbound mail from TitanMDM itself.
         */
        if (string.IsNullOrWhiteSpace(
                sender) ||
            string.Equals(
                sender,
                mailbox,
                StringComparison
                    .OrdinalIgnoreCase))
        {
            return null;
        }

        var internetMessageId =
            root.TryGetProperty(
                "internetMessageId",
                out var id)
                ? id.GetString()
                : null;

        if (string.IsNullOrWhiteSpace(
                internetMessageId))
        {
            throw new InvalidOperationException(
                "El correo no contiene internetMessageId.");
        }

        var incoming =
            new IncomingHelpdeskEmail(
                mailbox,
                internetMessageId,
                root.TryGetProperty(
                    "conversationId",
                    out var conversation)
                    ? conversation
                        .GetString()
                    : null,
                sender,
                from.TryGetProperty(
                    "name",
                    out var name)
                    ? name
                        .GetString()
                    : null,
                root.TryGetProperty(
                    "subject",
                    out var subject)
                    ? subject
                        .GetString()
                        ??
                        string.Empty
                    : string.Empty,
                root.TryGetProperty(
                    "body",
                    out var body) &&
                body.ValueKind ==
                    JsonValueKind.Object &&
                body.TryGetProperty(
                    "content",
                    out var content)
                    ? content
                        .GetString()
                        ??
                        string.Empty
                    : string.Empty);

        var hasAttachments =
            root.TryGetProperty(
                "hasAttachments",
                out var hasAttachmentsElement)
            &&
            hasAttachmentsElement
                .ValueKind ==
                JsonValueKind.True;

        if (!hasAttachments)
        {
            return new GraphInboundMessage(
                incoming,
                Array.Empty<
                    IncomingHelpdeskAttachment>(),
                0);
        }

        var attachments =
            await GetAttachmentsAsync(
                client,
                token,
                mailbox,
                graphId,
                cancellationToken);

        return new GraphInboundMessage(
            incoming,
            attachments.Items,
            attachments.Skipped);
    }

    // ============================================================
    // ATTACHMENTS
    // ============================================================

    private static async Task<
        GraphAttachmentResult>
        GetAttachmentsAsync(
            HttpClient client,
            string token,
            string mailbox,
            string graphId,
            CancellationToken cancellationToken)
    {
        var url =
            $"https://graph.microsoft.com/v1.0/users/" +
            $"{Uri.EscapeDataString(mailbox)}/messages/" +
            $"{Uri.EscapeDataString(graphId)}/attachments" +
            "?$select=id,name,contentType,size,isInline,@odata.type";

        EnsureGraphUrl(
            url);

        using var request =
            new HttpRequestMessage(
                HttpMethod.Get,
                url);

        request.Headers.Authorization =
            new AuthenticationHeaderValue(
                "Bearer",
                token);

        using var response =
            await client.SendAsync(
                request,
                cancellationToken);

        if (!response
            .IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Microsoft Graph devolvió HTTP {(int)response.StatusCode} al consultar adjuntos.");
        }

        using var document =
            JsonDocument.Parse(
                await response.Content
                    .ReadAsStringAsync(
                        cancellationToken));

        var attachments =
            new List<
                IncomingHelpdeskAttachment>();

        var skipped =
            0;

        long totalBytes =
            0;

        foreach (
            var item
            in document.RootElement
                .GetProperty(
                    "value")
                .EnumerateArray())
        {
            var type =
                item.TryGetProperty(
                    "@odata.type",
                    out var typeElement)
                    ? typeElement
                        .GetString()
                    : null;

            if (!string.Equals(
                    type,
                    "#microsoft.graph.fileAttachment",
                    StringComparison
                        .OrdinalIgnoreCase))
            {
                skipped++;
                continue;
            }

            var isInline =
                item.TryGetProperty(
                    "isInline",
                    out var inlineElement)
                &&
                inlineElement.ValueKind ==
                    JsonValueKind.True;

            if (isInline)
            {
                skipped++;
                continue;
            }

            var attachmentId =
                item.TryGetProperty(
                    "id",
                    out var idElement)
                    ? idElement.GetString()
                    : null;

            var name =
                item.TryGetProperty(
                    "name",
                    out var nameElement)
                    ? nameElement.GetString()
                    : null;

            var size =
                item.TryGetProperty(
                    "size",
                    out var sizeElement)
                &&
                sizeElement.TryGetInt64(
                    out var parsedSize)
                    ? parsedSize
                    : 0;

            if (string.IsNullOrWhiteSpace(
                    attachmentId) ||
                string.IsNullOrWhiteSpace(
                    name) ||
                size <= 0 ||
                size > MaxAttachmentBytes ||
                totalBytes + size >
                    MaxTotalAttachmentBytes ||
                !IsAllowedExtension(
                    name))
            {
                skipped++;
                continue;
            }

            var attachment =
                await GetAttachmentAsync(
                    client,
                    token,
                    mailbox,
                    graphId,
                    attachmentId,
                    cancellationToken);

            if (attachment is null)
            {
                skipped++;
                continue;
            }

            if (attachment.Content.LongLength >
                    MaxAttachmentBytes ||
                totalBytes +
                    attachment.Content.LongLength >
                    MaxTotalAttachmentBytes)
            {
                skipped++;
                continue;
            }

            totalBytes +=
                attachment.Content
                    .LongLength;

            attachments.Add(
                attachment);
        }

        return new GraphAttachmentResult(
            attachments,
            skipped);
    }

    private static async Task<
        IncomingHelpdeskAttachment?>
        GetAttachmentAsync(
            HttpClient client,
            string token,
            string mailbox,
            string graphId,
            string attachmentId,
            CancellationToken cancellationToken)
    {
        var url =
            $"https://graph.microsoft.com/v1.0/users/" +
            $"{Uri.EscapeDataString(mailbox)}/messages/" +
            $"{Uri.EscapeDataString(graphId)}/attachments/" +
            $"{Uri.EscapeDataString(attachmentId)}";

        EnsureGraphUrl(
            url);

        using var request =
            new HttpRequestMessage(
                HttpMethod.Get,
                url);

        request.Headers.Authorization =
            new AuthenticationHeaderValue(
                "Bearer",
                token);

        using var response =
            await client.SendAsync(
                request,
                cancellationToken);

        if (response.StatusCode ==
            HttpStatusCode.NotFound)
        {
            return null;
        }

        if (!response
            .IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Microsoft Graph devolvió HTTP {(int)response.StatusCode} al descargar adjunto.");
        }

        using var document =
            JsonDocument.Parse(
                await response.Content
                    .ReadAsStringAsync(
                        cancellationToken));

        var root =
            document.RootElement;

        var type =
            root.TryGetProperty(
                "@odata.type",
                out var typeElement)
                ? typeElement.GetString()
                : null;

        if (!string.Equals(
                type,
                "#microsoft.graph.fileAttachment",
                StringComparison
                    .OrdinalIgnoreCase))
        {
            return null;
        }

        var isInline =
            root.TryGetProperty(
                "isInline",
                out var inlineElement)
            &&
            inlineElement.ValueKind ==
                JsonValueKind.True;

        if (isInline)
        {
            return null;
        }

        var name =
            root.TryGetProperty(
                "name",
                out var nameElement)
                ? nameElement.GetString()
                : null;

        var contentType =
            root.TryGetProperty(
                "contentType",
                out var typeNameElement)
                ? typeNameElement.GetString()
                : null;

        var contentBytes =
            root.TryGetProperty(
                "contentBytes",
                out var bytesElement)
                ? bytesElement.GetString()
                : null;

        if (string.IsNullOrWhiteSpace(
                name) ||
            string.IsNullOrWhiteSpace(
                contentBytes) ||
            !IsAllowedExtension(
                name))
        {
            return null;
        }

        byte[] bytes;

        try
        {
            bytes =
                Convert.FromBase64String(
                    contentBytes);
        }
        catch (FormatException)
        {
            return null;
        }

        if (bytes.LongLength <=
                0 ||
            bytes.LongLength >
                MaxAttachmentBytes)
        {
            return null;
        }

        return new IncomingHelpdeskAttachment(
            attachmentId,
            name,
            contentType
                ??
                "application/octet-stream",
            bytes);
    }

    // ============================================================
    // TOKEN
    // ============================================================

    private static async Task<string>
        GetTokenAsync(
            HttpClient client,
            string tenant,
            string clientId,
            string secret,
            CancellationToken cancellationToken)
    {
        using var request =
            new HttpRequestMessage(
                HttpMethod.Post,
                $"https://login.microsoftonline.com/" +
                $"{Uri.EscapeDataString(tenant)}/oauth2/v2.0/token")
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
                                secret,

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

        if (!response
            .IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Microsoft Entra rechazó la autenticación del buzón. HTTP {(int)response.StatusCode}.");
        }

        using var document =
            JsonDocument.Parse(
                await response.Content
                    .ReadAsStringAsync(
                        cancellationToken));

        if (!document.RootElement
                .TryGetProperty(
                    "access_token",
                    out var token) ||
            string.IsNullOrWhiteSpace(
                token.GetString()))
        {
            throw new InvalidOperationException(
                "Microsoft Entra no devolvió access_token.");
        }

        return token.GetString()!;
    }

    // ============================================================
    // HELPERS
    // ============================================================

    private string ResolveCursorDirectory()
    {
        var configured =
            _configuration[
                "HelpdeskMail:CursorDirectory"];

        if (!string.IsNullOrWhiteSpace(
                configured))
        {
            return Path.GetFullPath(
                configured);
        }

        return Path.Combine(
            Environment.GetFolderPath(
                Environment.SpecialFolder
                    .CommonApplicationData),
            "TitanMDM",
            "MailCursors");
    }

    private static bool IsAllowedExtension(
        string fileName)
    {
        var extension =
            Path.GetExtension(
                    fileName)
                .ToLowerInvariant();

        return extension
            is ".pdf"
            or ".png"
            or ".jpg"
            or ".jpeg";
    }

    private static void EnsureGraphUrl(
        string url)
    {
        if (!Uri.TryCreate(
                url,
                UriKind.Absolute,
                out var uri) ||
            uri.Scheme !=
                Uri.UriSchemeHttps ||
            !string.Equals(
                uri.Host,
                "graph.microsoft.com",
                StringComparison
                    .OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "URL de Microsoft Graph no válida.");
        }
    }

    private static async Task
        ReloadMailSettingsAsync(
            TitanMdmDbContext db,
           HelpdeskMailSettings settings,
            CancellationToken cancellationToken)
    {
        try
        {
            await db.Entry(
                    settings)
                .ReloadAsync(
                    cancellationToken);
        }
        catch
        {
            /*
             * Runtime status is diagnostic only.
             * Never mask the original mail exception.
             */
        }
    }

    private static async Task
        TrySaveRuntimeStatusAsync(
            TitanMdmDbContext db,
            CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(
                cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            /*
             * An administrator may have edited mail settings
             * simultaneously. Configuration wins over diagnostics.
             */
        }
    }

    private sealed record GraphInboundMessage(
        IncomingHelpdeskEmail Message,
        IReadOnlyList<
            IncomingHelpdeskAttachment> Attachments,
        int SkippedAttachments);

    private sealed record GraphAttachmentResult(
        IReadOnlyList<
            IncomingHelpdeskAttachment> Items,
        int Skipped);
}