using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text.Json;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using TitanMDM.Domain.Entities;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/helpdesk/mail")]
public sealed class HelpdeskMailSettingsController
    : ControllerBase
{
    private readonly TitanMdmDbContext
        _db;

    private readonly IHttpClientFactory
        _httpClientFactory;

    private readonly IDataProtector
        _protector;

    public HelpdeskMailSettingsController(
        TitanMdmDbContext db,
        IHttpClientFactory httpClientFactory,
        IDataProtectionProvider dataProtectionProvider)
    {
        _db =
            db;

        _httpClientFactory =
            httpClientFactory;

        _protector =
            dataProtectionProvider
                .CreateProtector(
                    "TitanMDM.Helpdesk.Entra.ClientSecret.v1");
    }

    // ============================================================
    // GET SETTINGS + STATUS
    // ============================================================

    [HttpGet]
    public async Task<IActionResult>
        Get(
            CancellationToken cancellationToken)
    {
        if (!CanViewMail())
        {
            return Forbid();
        }

        var organizationId =
            GetOrganizationId();

        if (!organizationId.HasValue)
        {
            return Unauthorized();
        }

        var settings =
            await _db.HelpdeskMailSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x =>
                        x.OrganizationId ==
                            organizationId.Value,
                    cancellationToken)
            ??
            new HelpdeskMailSettings(
                organizationId.Value);

        var actorName =
            settings.ActorUserId.HasValue
                ? await _db.Users
                    .AsNoTracking()
                    .Where(
                        x =>
                            x.OrganizationId ==
                                organizationId.Value
                            &&
                            x.Id ==
                                settings.ActorUserId.Value)
                    .Select(
                        x =>
                            (
                                x.FirstName +
                                " " +
                                x.LastName
                            )
                            .Trim())
                    .FirstOrDefaultAsync(
                        cancellationToken)
                : null;

        var pending =
            await _db
                .Set<HelpdeskOutboundEmail>()
                .AsNoTracking()
                .CountAsync(
                    x =>
                        x.OrganizationId ==
                            organizationId.Value
                        &&
                        x.Status ==
                            HelpdeskOutboundEmail
                                .PendingStatus,
                    cancellationToken);

        var retry =
            await _db
                .Set<HelpdeskOutboundEmail>()
                .AsNoTracking()
                .CountAsync(
                    x =>
                        x.OrganizationId ==
                            organizationId.Value
                        &&
                        x.Status ==
                            HelpdeskOutboundEmail
                                .RetryStatus,
                    cancellationToken);

        var sending =
            await _db
                .Set<HelpdeskOutboundEmail>()
                .AsNoTracking()
                .CountAsync(
                    x =>
                        x.OrganizationId ==
                            organizationId.Value
                        &&
                        x.Status ==
                            HelpdeskOutboundEmail
                                .SendingStatus,
                    cancellationToken);

        var deadLetter =
            await _db
                .Set<HelpdeskOutboundEmail>()
                .AsNoTracking()
                .CountAsync(
                    x =>
                        x.OrganizationId ==
                            organizationId.Value
                        &&
                        x.Status ==
                            HelpdeskOutboundEmail
                                .DeadLetterStatus,
                    cancellationToken);

        var sent =
            await _db
                .Set<HelpdeskOutboundEmail>()
                .AsNoTracking()
                .CountAsync(
                    x =>
                        x.OrganizationId ==
                            organizationId.Value
                        &&
                        x.Status ==
                            HelpdeskOutboundEmail
                                .SentStatus,
                    cancellationToken);

        var received =
            await _db.HelpdeskEmailMessages
                .AsNoTracking()
                .CountAsync(
                    x =>
                        x.OrganizationId ==
                            organizationId.Value,
                    cancellationToken);

        return Ok(
            new
            {
                settings.Mailbox,
                settings.ActorUserId,

                actorName,

                settings.InboundEnabled,
                settings.OutboundEnabled,

                settings.InboundPollSeconds,
                settings.OutboundPollSeconds,

                settings.BatchSize,
                settings.MaxAttempts,

                settings.LastInboundAttemptAtUtc,
                settings.LastInboundSuccessAtUtc,
                settings.LastInboundError,

                settings.LastOutboundAttemptAtUtc,
                settings.LastOutboundSuccessAtUtc,
                settings.LastOutboundError,

                settings.Revision,
                settings.UpdatedAtUtc,

                statistics =
                    new
                    {
                        received,
                        sent,
                        pending,
                        retry,
                        sending,
                        deadLetter
                    }
            });
    }

    // ============================================================
    // SAVE
    // ============================================================

    [HttpPut]
    public async Task<IActionResult>
        Save(
            [FromBody]
            SaveMailSettingsRequest request,
            CancellationToken cancellationToken)
    
    {
        if (!CanManageMail())
        {
            return Forbid();
        }

        var organizationId =
            GetOrganizationId();

        if (!organizationId.HasValue)
        {
            return Unauthorized();
        }

        var settings =
            await _db.HelpdeskMailSettings
                .FirstOrDefaultAsync(
                    x =>
                        x.OrganizationId ==
                            organizationId.Value,
                    cancellationToken);

        if ((settings?.Revision ?? 0) !=
            request.Revision)
        {
            return Conflict(
                new
                {
                    message =
                        "La configuración cambió. Actualiza la pantalla antes de guardar."
                });
        }

        if (request.ActorUserId.HasValue)
        {
            var actorValid =
                await _db.Users
                    .AsNoTracking()
                    .AnyAsync(
                        x =>
                            x.OrganizationId ==
                                organizationId.Value
                            &&
                            x.Id ==
                                request.ActorUserId.Value
                            &&
                            x.IsActive,
                        cancellationToken);

            if (!actorValid)
            {
                return BadRequest(
                    new
                    {
                        message =
                            "El usuario técnico seleccionado no existe o está inactivo."
                    });
            }
        }

        if (settings is null)
        {
            settings =
                new HelpdeskMailSettings(
                    organizationId.Value);

            _db.HelpdeskMailSettings
                .Add(
                    settings);
        }

        try
        {
            settings.Configure(
                request.Mailbox,
                request.ActorUserId,
                request.InboundEnabled,
                request.OutboundEnabled,
                request.InboundPollSeconds,
                request.OutboundPollSeconds,
                request.BatchSize,
                request.MaxAttempts);

            await _db.SaveChangesAsync(
                cancellationToken);

            return await Get(
                cancellationToken);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(
                new
                {
                    message =
                        exception.Message
                });
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(
                new
                {
                    message =
                        "Otro administrador modificó la configuración. Actualiza antes de guardar."
                });
        }
    }

    // ============================================================
    // GRAPH DIAGNOSTIC
    // ============================================================

    [HttpPost("test")]
    public async Task<IActionResult>
        Test(
            CancellationToken cancellationToken)
    {
        if (!CanManageMail())
        {
            return Forbid();
        }

        var organizationId =
            GetOrganizationId();

        if (!organizationId.HasValue)
        {
            return Unauthorized();
        }

        var mailSettings =
            await _db.HelpdeskMailSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x =>
                        x.OrganizationId ==
                            organizationId.Value,
                    cancellationToken);

        if (mailSettings is null ||
            string.IsNullOrWhiteSpace(
                mailSettings.Mailbox))
        {
            return BadRequest(
                new
                {
                    message =
                        "Configura primero el buzón de Helpdesk."
                });
        }

        var entra =
            await _db.EntraIdSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x =>
                        x.OrganizationId ==
                            organizationId.Value,
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
            return Conflict(
                new
                {
                    message =
                        "Entra ID no está configurado o habilitado para esta organización."
                });
        }

        try
        {
            var client =
                _httpClientFactory
                    .CreateClient(
                        "entra-id");

            var secret =
                _protector.Unprotect(
                    entra.ClientSecretProtected);

            var token =
                await GetAccessTokenAsync(
                    client,
                    entra.TenantId,
                    entra.ClientId,
                    secret,
                    cancellationToken);

            /*
             * Reading Inbox verifies:
             *
             * - Tenant/client/secret
             * - Microsoft Graph connectivity
             * - mailbox existence
             * - application Mail.Read permission
             */
            var endpoint =
                $"https://graph.microsoft.com/v1.0/users/" +
                $"{Uri.EscapeDataString(mailSettings.Mailbox)}" +
                "/mailFolders/inbox" +
                "?$select=id,displayName,totalItemCount,unreadItemCount";

            using var graphRequest =
                new HttpRequestMessage(
                    HttpMethod.Get,
                    endpoint);

            graphRequest.Headers.Authorization =
                new AuthenticationHeaderValue(
                    "Bearer",
                    token);

            using var response =
                await client.SendAsync(
                    graphRequest,
                    cancellationToken);

            var content =
                await response.Content
                    .ReadAsStringAsync(
                        cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                return StatusCode(
                    StatusCodes
                        .Status502BadGateway,
                    new
                    {
                        success =
                            false,

                        message =
                            $"Microsoft Graph devolvió HTTP {(int)response.StatusCode}.",

                        inboundVerified =
                            false,

                        outboundConfigured =
                            mailSettings
                                .OutboundEnabled
                    });
            }

            using var json =
                JsonDocument.Parse(
                    content);

            var root =
                json.RootElement;

            return Ok(
                new
                {
                    success =
                        true,

                    message =
                        "Conexión al buzón validada correctamente.",

                    mailbox =
                        mailSettings.Mailbox,

                    inbox =
                        root.TryGetProperty(
                            "displayName",
                            out var displayName)
                            ? displayName.GetString()
                            : "Inbox",

                    totalItemCount =
                        root.TryGetProperty(
                            "totalItemCount",
                            out var total)
                        &&
                        total.TryGetInt32(
                            out var totalValue)
                            ? totalValue
                            : 0,

                    unreadItemCount =
                        root.TryGetProperty(
                            "unreadItemCount",
                            out var unread)
                        &&
                        unread.TryGetInt32(
                            out var unreadValue)
                            ? unreadValue
                            : 0,

                    inboundVerified =
                        true,

                    /*
                     * Sending is deliberately not tested here
                     * because a diagnostic endpoint should not
                     * send unsolicited email.
                     */
                    outboundConfigured =
                        mailSettings
                            .OutboundEnabled
                });
        }
        catch (Exception exception)
        {
            return StatusCode(
                StatusCodes
                    .Status502BadGateway,
                new
                {
                    success =
                        false,

                    message =
                        exception.Message,

                    inboundVerified =
                        false,

                    outboundConfigured =
                        mailSettings
                            .OutboundEnabled
                });
        }
    }

    // ============================================================
    // AVAILABLE ACTORS
    // ============================================================

    [HttpGet("actors")]
    public async Task<IActionResult>
        Actors(
            CancellationToken cancellationToken)
    {
        if (!CanManageMail())
        {
            return Forbid();
        }

        var organizationId =
            GetOrganizationId();

        if (!organizationId.HasValue)
        {
            return Unauthorized();
        }

        var users =
            await _db.Users
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                            organizationId.Value
                        &&
                        x.IsActive)
                .OrderBy(
                    x =>
                        x.FirstName)
                .ThenBy(
                    x =>
                        x.LastName)
                .Select(
                    x =>
                        new
                        {
                            x.Id,

                            name =
                                (
                                    x.FirstName +
                                    " " +
                                    x.LastName
                                )
                                .Trim(),

                            x.Email
                        })
                .ToListAsync(
                    cancellationToken);

        return Ok(
            users);
    }

    // ============================================================
    // HELPERS
    // ============================================================

    private Guid?
        GetOrganizationId()
    {
        var value =
            User.FindFirstValue(
                "organization_id")
            ??
            User.FindFirstValue(
                "organizationId");

        return Guid.TryParse(
            value,
            out var organizationId)
                ? organizationId
                : null;
    }

    private bool CanViewMail()
{
    return HasAnyPermission(
        "helpdesk.mail.view",
        "helpdesk.mail.manage",
        "helpdesk.admin.access",
        "helpdesk.manage",
        "settings.manage");
}
    private bool CanManageMail()
    {
        return HasAnyPermission(
            "helpdesk.mail.manage",
            "helpdesk.admin.access",
            "helpdesk.manage",
            "settings.manage");
    }

    private bool HasAnyPermission(
        params string[] permissions)
    {
        return User.Claims.Any(
            claim =>
                claim.Type ==
                    "permission"
                &&
                permissions.Any(
                    permission =>
                        string.Equals(
                            claim.Value,
                            permission,
                            StringComparison.OrdinalIgnoreCase)));
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

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Microsoft Entra rechazó la autenticación. HTTP {(int)response.StatusCode}.");
        }

        var content =
            await response.Content
                .ReadAsStringAsync(
                    cancellationToken);

        using var json =
            JsonDocument.Parse(
                content);

        if (!json.RootElement
                .TryGetProperty(
                    "access_token",
                    out var token)
            ||
            string.IsNullOrWhiteSpace(
                token.GetString()))
        {
            throw new InvalidOperationException(
                "Microsoft Entra no devolvió access_token.");
        }

        return token.GetString()!;
    }

    public sealed record SaveMailSettingsRequest(
        string? Mailbox,
        Guid? ActorUserId,
        bool InboundEnabled,
        bool OutboundEnabled,
        int InboundPollSeconds,
        int OutboundPollSeconds,
        int BatchSize,
        int MaxAttempts,
        int Revision);
}