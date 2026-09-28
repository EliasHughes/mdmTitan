using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using TitanMDM.Infrastructure.Helpdesk;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Api.Services;

public sealed class HelpdeskMailWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly IHttpClientFactory _clients;
    private readonly IDataProtector _protector;
    private readonly IConfiguration _config;
    private readonly ILogger<HelpdeskMailWorker> _logger;

    public HelpdeskMailWorker(
        IServiceScopeFactory scopes,
        IHttpClientFactory clients,
        IDataProtectionProvider protection,
        IConfiguration config,
        ILogger<HelpdeskMailWorker> logger)
    {
        _scopes = scopes;
        _clients = clients;
        _protector = protection.CreateProtector(
            "TitanMDM.Helpdesk.Entra.ClientSecret.v1");
        _config = config;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            if (_config.GetValue<bool>("HelpdeskMail:Enabled"))
            {
                try
                {
                    await SyncAsync(stoppingToken);
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
                        "No se pudo sincronizar el buzón de mesa de ayuda.");
                }
            }

            var seconds = Math.Clamp(
                _config.GetValue("HelpdeskMail:PollSeconds", 60),
                30,
                3600);

            try
            {
                await Task.Delay(
                    TimeSpan.FromSeconds(seconds),
                    stoppingToken);
            }
            catch (OperationCanceledException)
                when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }

    private async Task SyncAsync(CancellationToken ct)
    {
        var mailbox = _config["HelpdeskMail:Mailbox"]?
            .Trim()
            .ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(mailbox) ||
            !Guid.TryParse(
                _config["HelpdeskMail:OrganizationId"],
                out var organizationId) ||
            !Guid.TryParse(
                _config["HelpdeskMail:ActorUserId"],
                out var actorUserId))
        {
            throw new InvalidOperationException(
                "Configure HelpdeskMail:Mailbox, OrganizationId y ActorUserId.");
        }

        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider
            .GetRequiredService<TitanMdmDbContext>();
        var importer = scope.ServiceProvider
            .GetRequiredService<HelpdeskEmailImportService>();

        var settings = await db.EntraIdSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.OrganizationId == organizationId,
                ct);

        if (settings is null ||
            !settings.IsEnabled ||
            string.IsNullOrWhiteSpace(settings.TenantId) ||
            string.IsNullOrWhiteSpace(settings.ClientId) ||
            string.IsNullOrWhiteSpace(settings.ClientSecretProtected))
        {
            throw new InvalidOperationException(
                "Configure y habilite Entra ID para esta organización.");
        }

        var client = _clients.CreateClient("entra-id");
        var token = await GetTokenAsync(
            client,
            settings.TenantId,
            settings.ClientId,
            _protector.Unprotect(settings.ClientSecretProtected),
            ct);

        var cursorDirectory = _config["HelpdeskMail:CursorDirectory"];

        if (string.IsNullOrWhiteSpace(cursorDirectory))
        {
            cursorDirectory = Path.Combine(
                Environment.GetFolderPath(
                    Environment.SpecialFolder.CommonApplicationData),
                "TitanMDM",
                "MailCursors");
        }

        Directory.CreateDirectory(cursorDirectory);

        var mailboxKey = Convert.ToHexString(
            SHA256.HashData(
                Encoding.UTF8.GetBytes(mailbox)))[..16];

        var cursorFile = Path.Combine(
            cursorDirectory,
            $"{organizationId:N}-{mailboxKey}-helpdesk-mail.txt");

        var initialUrl =
            $"https://graph.microsoft.com/v1.0/users/" +
            $"{Uri.EscapeDataString(mailbox)}" +
            "/mailFolders/inbox/messages/delta" +
            "?$select=id,internetMessageId,conversationId,from,subject,body" +
            "&$top=50";

        var url = File.Exists(cursorFile)
            ? (await File.ReadAllTextAsync(cursorFile, ct)).Trim()
            : initialUrl;

        if (string.IsNullOrWhiteSpace(url))
            url = initialUrl;

        while (!ct.IsCancellationRequested)
        {
            EnsureGraphUrl(url);

            using var request = new HttpRequestMessage(
                HttpMethod.Get,
                url);

            request.Headers.Authorization =
                new AuthenticationHeaderValue("Bearer", token);

            request.Headers.TryAddWithoutValidation(
                "Prefer",
                "outlook.body-content-type=\"text\"");

            using var response = await client.SendAsync(request, ct);

            if (!response.IsSuccessStatusCode)
            {
                throw new InvalidOperationException(
                    $"Graph devolvió HTTP {(int)response.StatusCode} " +
                    "al consultar el buzón.");
            }

            using var document = JsonDocument.Parse(
                await response.Content.ReadAsStringAsync(ct));

            foreach (var item in document.RootElement
                         .GetProperty("value")
                         .EnumerateArray())
            {
                if (item.TryGetProperty("@removed", out _) ||
                    !item.TryGetProperty("id", out var id) ||
                    id.GetString() is not { Length: > 0 } graphId)
                {
                    continue;
                }

                var message = await GetMessageAsync(
                    client,
                    token,
                    mailbox,
                    graphId,
                    ct);

                if (message is null)
                    continue;

                await importer.ImportAsync(
                    organizationId,
                    actorUserId,
                    message,
                    ct);
            }

            var next = document.RootElement.TryGetProperty(
                "@odata.nextLink",
                out var nextLink)
                ? nextLink.GetString()
                : null;

            var delta = document.RootElement.TryGetProperty(
                "@odata.deltaLink",
                out var deltaLink)
                ? deltaLink.GetString()
                : null;

            var checkpoint = next ?? delta
                ?? throw new InvalidOperationException(
                    "Graph no devolvió un cursor.");

            EnsureGraphUrl(checkpoint);

            var temporaryFile = cursorFile + ".tmp";

            await File.WriteAllTextAsync(
                temporaryFile,
                checkpoint,
                ct);

            File.Move(
                temporaryFile,
                cursorFile,
                overwrite: true);

            if (next is null)
                break;

            url = next;
        }
    }

    private static async Task<IncomingHelpdeskEmail?> GetMessageAsync(
        HttpClient client,
        string token,
        string mailbox,
        string graphId,
        CancellationToken ct)
    {
        var url =
            $"https://graph.microsoft.com/v1.0/users/" +
            $"{Uri.EscapeDataString(mailbox)}/messages/" +
            $"{Uri.EscapeDataString(graphId)}" +
            "?$select=internetMessageId,conversationId,from,subject,body";

        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            url);

        request.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

        request.Headers.TryAddWithoutValidation(
            "Prefer",
            "outlook.body-content-type=\"text\"");

        using var response = await client.SendAsync(request, ct);

        if (response.StatusCode == HttpStatusCode.NotFound)
            return null;

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Graph devolvió HTTP {(int)response.StatusCode} " +
                "al leer un mensaje.");
        }

        using var document = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync(ct));

        var root = document.RootElement;

        if (!root.TryGetProperty("from", out var fromElement) ||
            fromElement.ValueKind != JsonValueKind.Object ||
            !fromElement.TryGetProperty(
                "emailAddress",
                out var from))
        {
            return null;
        }

        var sender = from.TryGetProperty(
            "address",
            out var address)
            ? address.GetString()?.Trim()
            : null;

        if (string.IsNullOrWhiteSpace(sender) ||
            string.Equals(
                sender,
                mailbox,
                StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var internetId = root.TryGetProperty(
            "internetMessageId",
            out var id)
            ? id.GetString()
            : null;

        if (string.IsNullOrWhiteSpace(internetId))
        {
            throw new InvalidOperationException(
                "Un correo no tiene internetMessageId.");
        }

        return new IncomingHelpdeskEmail(
            mailbox,
            internetId,
            root.TryGetProperty(
                "conversationId",
                out var conversation)
                ? conversation.GetString()
                : null,
            sender,
            from.TryGetProperty("name", out var name)
                ? name.GetString()
                : null,
            root.TryGetProperty("subject", out var subject)
                ? subject.GetString() ?? ""
                : "",
            root.TryGetProperty("body", out var body) &&
            body.ValueKind == JsonValueKind.Object &&
            body.TryGetProperty("content", out var content)
                ? content.GetString() ?? ""
                : "");
    }

    private static async Task<string> GetTokenAsync(
        HttpClient client,
        string tenant,
        string clientId,
        string secret,
        CancellationToken ct)
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://login.microsoftonline.com/" +
            $"{Uri.EscapeDataString(tenant)}/oauth2/v2.0/token")
        {
            Content = new FormUrlEncodedContent(
                new Dictionary<string, string>
                {
                    ["client_id"] = clientId,
                    ["client_secret"] = secret,
                    ["grant_type"] = "client_credentials",
                    ["scope"] =
                        "https://graph.microsoft.com/.default"
                })
        };

        using var response = await client.SendAsync(
            request,
            ct);

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Entra rechazó el token del buzón " +
                $"(HTTP {(int)response.StatusCode}).");
        }

        using var document = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync(ct));

        return document.RootElement
            .GetProperty("access_token")
            .GetString()!;
    }

    private static void EnsureGraphUrl(string url)
    {
        if (!Uri.TryCreate(
                url,
                UriKind.Absolute,
                out var uri) ||
            uri.Scheme != Uri.UriSchemeHttps ||
            !string.Equals(
                uri.Host,
                "graph.microsoft.com",
                StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "Cursor de Microsoft Graph no válido.");
        }
    }
}