
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TitanMDM.Application.Helpdesk;
using TitanMDM.Domain.Entities;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Infrastructure.Helpdesk;

public sealed class EntraIdDirectoryService : IEntraIdDirectoryService
{
    private readonly TitanMdmDbContext _db;
    private readonly IHttpClientFactory _httpClientFactory;

    public EntraIdDirectoryService(
        TitanMdmDbContext db,
        IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<EntraIdSettingsDto> GetSettingsAsync(
        Guid organizationId,
        CancellationToken cancellationToken = default)
    {
        var settings = await GetOrCreateSettingsAsync(organizationId, cancellationToken);
        return Map(settings);
    }

    public async Task<EntraIdSettingsDto> SaveSettingsAsync(
        Guid organizationId,
        SaveEntraIdSettingsRequest request,
        CancellationToken cancellationToken = default)
    {
        var settings = await GetOrCreateSettingsAsync(organizationId, cancellationToken);

        var secret = string.IsNullOrWhiteSpace(request.ClientSecret)
            ? settings.ClientSecretProtected
            : Protect(request.ClientSecret);

        settings.Configure(
            request.TenantId,
            request.ClientId,
            secret,
            request.AllowedGroupIds,
            request.SyncRequestersOnly,
            request.IsEnabled);

        await _db.SaveChangesAsync(cancellationToken);
        return Map(settings);
    }

    public async Task<EntraSyncResultDto> SyncDirectoryAsync(
        Guid organizationId,
        CancellationToken cancellationToken = default)
    {
        var settings = await GetOrCreateSettingsAsync(organizationId, cancellationToken);

        if (!settings.IsEnabled)
            throw new InvalidOperationException("Entra ID no está habilitado.");

        if (string.IsNullOrWhiteSpace(settings.TenantId) ||
            string.IsNullOrWhiteSpace(settings.ClientId) ||
            string.IsNullOrWhiteSpace(settings.ClientSecretProtected))
        {
            throw new InvalidOperationException("Falta Tenant ID, Client ID o Client Secret.");
        }

        var token = await RequestTokenAsync(settings, cancellationToken);
        var graphUsers = await FetchUsersAsync(token, settings.AllowedGroupIds, cancellationToken);

        var existing = await _db.EntraDirectoryUsers
            .Where(x => x.OrganizationId == organizationId)
            .ToListAsync(cancellationToken);

        var byObjectId = existing.ToDictionary(x => x.EntraObjectId, StringComparer.OrdinalIgnoreCase);

        var titanUsers = await _db.Users
            .Where(x => x.OrganizationId == organizationId)
            .ToListAsync(cancellationToken);

        var imported = 0;
        var updated = 0;
        var linked = 0;

        foreach (var graphUser in graphUsers)
        {
            var linkedUser = titanUsers.FirstOrDefault(x =>
                string.Equals(x.Email, graphUser.Mail, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(x.Email, graphUser.UserPrincipalName, StringComparison.OrdinalIgnoreCase));

            if (linkedUser is not null)
                linked++;

            if (byObjectId.TryGetValue(graphUser.Id, out var current))
            {
                current.Update(
                    graphUser.DisplayName,
                    graphUser.Mail,
                    graphUser.JobTitle,
                    graphUser.Department,
                    linkedUser?.Id,
                    graphUser.AccountEnabled);
                updated++;
            }
            else
            {
                var created = new EntraDirectoryUser(
                    organizationId,
                    graphUser.Id,
                    graphUser.DisplayName,
                    graphUser.UserPrincipalName,
                    graphUser.Mail);

                created.Update(
                    graphUser.DisplayName,
                    graphUser.Mail,
                    graphUser.JobTitle,
                    graphUser.Department,
                    linkedUser?.Id,
                    graphUser.AccountEnabled);

                _db.EntraDirectoryUsers.Add(created);
                imported++;
            }
        }

        settings.MarkSync($"ok imported={imported} updated={updated}");
        await _db.SaveChangesAsync(cancellationToken);

        return new EntraSyncResultDto(imported, updated, linked, settings.LastSyncStatus ?? "ok");
    }

    public async Task<IReadOnlyList<EntraDirectoryUserDto>> SearchDirectoryAsync(
        Guid organizationId,
        string? search,
        CancellationToken cancellationToken = default)
    {
        var query = _db.EntraDirectoryUsers
            .AsNoTracking()
            .Where(x => x.OrganizationId == organizationId && x.IsActive);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x =>
                x.DisplayName.Contains(term) ||
                x.UserPrincipalName.Contains(term) ||
                (x.Mail != null && x.Mail.Contains(term)));
        }

        var rows = await query
            .OrderBy(x => x.DisplayName)
            .Take(50)
            .ToListAsync(cancellationToken);

        return rows.Select(x => new EntraDirectoryUserDto(
            x.Id,
            x.EntraObjectId,
            x.DisplayName,
            x.UserPrincipalName,
            x.Mail,
            x.JobTitle,
            x.Department,
            x.LinkedTitanUserId,
            x.IsActive)).ToList();
    }

    private async Task<EntraIdSettings> GetOrCreateSettingsAsync(
        Guid organizationId,
        CancellationToken cancellationToken)
    {
        var settings = await _db.EntraIdSettings
            .FirstOrDefaultAsync(x => x.OrganizationId == organizationId, cancellationToken);

        if (settings is not null)
            return settings;

        settings = new EntraIdSettings(organizationId);
        _db.EntraIdSettings.Add(settings);
        await _db.SaveChangesAsync(cancellationToken);
        return settings;
    }

    private static EntraIdSettingsDto Map(EntraIdSettings settings) =>
        new(
            settings.IsEnabled,
            settings.TenantId,
            settings.ClientId,
            !string.IsNullOrWhiteSpace(settings.ClientSecretProtected),
            settings.AllowedGroupIds,
            settings.SyncRequestersOnly,
            settings.LastSyncAtUtc,
            settings.LastSyncStatus);

    private static string Protect(string secret) =>
        Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(secret));

    private static string Unprotect(string secret) =>
        System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(secret));

    private async Task<string> RequestTokenAsync(
        EntraIdSettings settings,
        CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient("entra-id");
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://login.microsoftonline.com/{settings.TenantId}/oauth2/v2.0/token")
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = settings.ClientId!,
                ["client_secret"] = Unprotect(settings.ClientSecretProtected!),
                ["grant_type"] = "client_credentials",
                ["scope"] = "https://graph.microsoft.com/.default"
            })
        };

        using var response = await client.SendAsync(request, cancellationToken);
        var payload = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Entra token error: {payload}");

        using var doc = JsonDocument.Parse(payload);
        return doc.RootElement.GetProperty("access_token").GetString()
               ?? throw new InvalidOperationException("Token Entra vacío.");
    }

    private async Task<List<GraphUser>> FetchUsersAsync(
        string token,
        string? allowedGroupIds,
        CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient("entra-id");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var urls = new List<string>();
        if (string.IsNullOrWhiteSpace(allowedGroupIds))
        {
            urls.Add("https://graph.microsoft.com/v1.0/users?$select=id,displayName,userPrincipalName,mail,jobTitle,department,accountEnabled&$top=999");
        }
        else
        {
            foreach (var groupId in allowedGroupIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                urls.Add($"https://graph.microsoft.com/v1.0/groups/{groupId}/members/microsoft.graph.user?$select=id,displayName,userPrincipalName,mail,jobTitle,department,accountEnabled&$top=999");
            }
        }

        var results = new Dictionary<string, GraphUser>(StringComparer.OrdinalIgnoreCase);
        foreach (var startUrl in urls)
        {
            var url = startUrl;
            while (!string.IsNullOrWhiteSpace(url))
            {
                using var response = await client.GetAsync(url, cancellationToken);
                var payload = await response.Content.ReadAsStringAsync(cancellationToken);
                if (!response.IsSuccessStatusCode)
                    throw new InvalidOperationException($"Graph error: {payload}");

                using var doc = JsonDocument.Parse(payload);
                if (doc.RootElement.TryGetProperty("value", out var value))
                {
                    foreach (var item in value.EnumerateArray())
                    {
                        var id = item.GetProperty("id").GetString();
                        if (string.IsNullOrWhiteSpace(id))
                            continue;

                        results[id] = new GraphUser(
                            id,
                            item.TryGetProperty("displayName", out var dn) ? dn.GetString() ?? id : id,
                            item.TryGetProperty("userPrincipalName", out var upn) ? upn.GetString() ?? id : id,
                            item.TryGetProperty("mail", out var mail) ? mail.GetString() : null,
                            item.TryGetProperty("jobTitle", out var title) ? title.GetString() : null,
                            item.TryGetProperty("department", out var dept) ? dept.GetString() : null,
                            !item.TryGetProperty("accountEnabled", out var enabled) || enabled.ValueKind != JsonValueKind.False);
                    }
                }

                url = doc.RootElement.TryGetProperty("@odata.nextLink", out var next)
                    ? next.GetString()
                    : null;
            }
        }

        return results.Values.ToList();
    }

    private sealed record GraphUser(
        string Id,
        string DisplayName,
        string UserPrincipalName,
        string? Mail,
        string? JobTitle,
        string? Department,
        bool AccountEnabled);
}
