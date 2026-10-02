using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;

using TitanMDM.Api.Hubs;
using TitanMDM.Api.RemoteSupport;
using TitanMDM.Api.Security;
using TitanMDM.Api.Services;

using TitanMDM.Infrastructure.DependencyInjection;
using TitanMDM.Infrastructure.Persistence;
using TitanMDM.Infrastructure.Persistence.Bootstrap;

var builder = WebApplication.CreateBuilder(args);

// ================================================================
// ENVIRONMENT / CONFIGURATION
// ================================================================

var environment =
    builder.Environment;

var configuration =
    builder.Configuration;

var isDevelopment =
    environment.IsDevelopment();

var applicationName =
    configuration["Application:Name"]
    ?? "TitanMDM";

var applicationVersion =
    configuration["Application:Version"]
    ?? "1.0.0";

var frontendUrl =
    configuration["Application:FrontendUrl"];

// ================================================================
// DATA PROTECTION
// ================================================================

var keyRingPath =
    configuration["DataProtection:KeyRingPath"];

if (string.IsNullOrWhiteSpace(keyRingPath))
{
    keyRingPath =
        Path.Combine(
            Environment.GetFolderPath(
                Environment.SpecialFolder.CommonApplicationData),
            "TitanMDM",
            "DataProtectionKeys");
}

Directory.CreateDirectory(
    keyRingPath);

builder.Services
    .AddDataProtection()
    .SetApplicationName(
        "TitanMDM")
    .PersistKeysToFileSystem(
        new DirectoryInfo(
            keyRingPath));

// ================================================================
// MVC / API
// ================================================================

builder.Services.AddControllers(
    options =>
    {
        options.Filters.Add<
            HelpdeskAudienceFilter>();
    });

if (isDevelopment)
{
    builder.Services.AddOpenApi();
}

// ================================================================
// SIGNALR
// ================================================================

builder.Services.AddSignalR(
    options =>
    {
        options.MaximumReceiveMessageSize =
            configuration.GetValue<long?>(
                "SignalR:MaximumReceiveMessageSizeBytes")
            ?? 8L * 1024L * 1024L;

        options.EnableDetailedErrors =
            isDevelopment &&
            configuration.GetValue<bool>(
                "SignalR:EnableDetailedErrors");

        options.KeepAliveInterval =
            TimeSpan.FromSeconds(
                configuration.GetValue<int?>(
                    "SignalR:KeepAliveSeconds")
                ?? 10);

        options.ClientTimeoutInterval =
            TimeSpan.FromSeconds(
                configuration.GetValue<int?>(
                    "SignalR:ClientTimeoutSeconds")
                ?? 30);
    });

// ================================================================
// TITAN SERVICES
// ================================================================

builder.Services.AddSingleton<
    RemoteSupportNotifier>();

builder.Services.AddSingleton<
    RemoteHostTokenService>();

builder.Services.Configure<
    WindowsAgentDistributionOptions>(
        configuration.GetSection(
            WindowsAgentDistributionOptions
                .SectionName));

builder.Services.AddSingleton<
    IWindowsAgentDistributionService,
    WindowsAgentDistributionService>();

builder.Services.AddScoped<
    SessionSecurityService>();

builder.Services.AddScoped<
    RbacAuditFilter>();

builder.Services.AddSingleton<
    RemoteSupportConnectionRegistry>();

builder.Services.AddScoped<
    RemoteSupportParticipantService>();

builder.Services.AddScoped<
    RemoteControlLeaseService>();

builder.Services.AddHostedService<
    HelpdeskMonitoringService>();

builder.Services.AddHostedService<
    HelpdeskRoutingWorker>();

builder.Services.AddHostedService<
    HelpdeskMailWorker>();

builder.Services.AddTitanMdmInfrastructure(
    configuration);

builder.Services.AddScoped<
    RbacAuditFilter>();

builder.Services.AddTitanAuthorization();
// ================================================================
// ENTRA ID
// ================================================================

if (configuration.GetValue<bool>(
        "EntraLogin:Enabled"))
{
    var tenantId =
        configuration[
            "EntraLogin:TenantId"];

    var clientId =
        configuration[
            "EntraLogin:ClientId"];

    var clientSecret =
        configuration[
            "EntraLogin:ClientSecret"];

    if (!Guid.TryParse(
            tenantId,
            out _)
        ||
        !Guid.TryParse(
            clientId,
            out _)
        ||
        string.IsNullOrWhiteSpace(
            clientSecret))
    {
        throw new InvalidOperationException(
            "EntraLogin está habilitado pero TenantId, ClientId " +
            "o ClientSecret no tienen una configuración válida.");
    }

    builder.Services
        .AddAuthentication()
        .AddCookie(
            "TitanEntraTemp",
            options =>
            {
                options.Cookie.Name =
                    "__TitanEntraTemp";

                options.Cookie.HttpOnly =
                    true;

                options.Cookie.SameSite =
                    SameSiteMode.Lax;

                options.Cookie.Path =
                    "/api/auth/entra";

                options.Cookie.SecurePolicy =
                    isDevelopment
                        ? CookieSecurePolicy
                            .SameAsRequest
                        : CookieSecurePolicy
                            .Always;

                options.ExpireTimeSpan =
                    TimeSpan.FromMinutes(
                        2);

                options.SlidingExpiration =
                    false;
            })
        .AddOpenIdConnect(
            "TitanEntraOidc",
            options =>
            {
                options.Authority =
                    $"https://login.microsoftonline.com/{tenantId}/v2.0";

                options.ClientId =
                    clientId;

                options.ClientSecret =
                    clientSecret;

                options.SignInScheme =
                    "TitanEntraTemp";

                options.CallbackPath =
                    "/signin-entra";

                options.ResponseType =
                    "code";

                options.RequireHttpsMetadata =
                    true;

                options.SaveTokens =
                    false;

                options.MapInboundClaims =
                    false;

                options.Scope.Clear();

                options.Scope.Add(
                    "openid");

                options.Scope.Add(
                    "profile");

                options.Scope.Add(
                    "email");

                options
                    .TokenValidationParameters
                    .ValidateIssuer =
                        true;

                options
                    .TokenValidationParameters
                    .ValidateAudience =
                        true;

                options
                    .TokenValidationParameters
                    .NameClaimType =
                        "name";
            });
}

// ================================================================
// CORS
// ================================================================

var allowedOrigins =
    configuration
        .GetSection(
            "Cors:AllowedOrigins")
        .Get<string[]>()
    ?? Array.Empty<string>();

builder.Services.AddCors(
    options =>
    {
        options.AddPolicy(
            "TitanMdmFrontend",
            policy =>
            {
                if (allowedOrigins.Length == 0)
                {
                    if (!isDevelopment)
                    {
                        throw new InvalidOperationException(
                            "Cors:AllowedOrigins debe contener al menos " +
                            "un origen en ambientes no Development.");
                    }

                    allowedOrigins =
                    [
                        "http://localhost:3020"
                    ];
                }

                policy
                    .WithOrigins(
                        allowedOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
    });

// ================================================================
// FORWARDED HEADERS - IIS / REVERSE PROXY
// ================================================================

builder.Services.Configure<
    ForwardedHeadersOptions>(
        options =>
        {
            options.ForwardedHeaders =
                ForwardedHeaders
                    .XForwardedFor |
                ForwardedHeaders
                    .XForwardedProto;
        });

// ================================================================
// BUILD
// ================================================================

var app =
    builder.Build();

// ================================================================
// DATABASE BOOTSTRAP
// ================================================================

using (var scope =
       app.Services.CreateScope())
{
    var bootstrapper =
        scope.ServiceProvider
            .GetRequiredService<
                DatabaseBootstrapper>();

    await bootstrapper
        .BootstrapAsync();
}

// ================================================================
// HTTP PIPELINE
// ================================================================

app.UseForwardedHeaders();

if (!app.Environment
        .IsDevelopment())
{
    app.UseHsts();

    if (configuration.GetValue(
            "Security:RequireHttps",
            true))
    {
        app.UseHttpsRedirection();
    }
}

if (app.Environment
        .IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors(
    "TitanMdmFrontend");

app.UseAuthentication();

app.UseAuthorization();

// ================================================================
// API
// ================================================================

app.MapControllers();

// ================================================================
// SIGNALR
// ================================================================

app.MapHub<
    RemoteSupportHub>(
        RemoteSupportHub.Route);

// ================================================================
// ROOT INFORMATION ENDPOINT
// ================================================================

app.MapGet(
    "/",
    () =>
    {
        return Results.Ok(
            new
            {
                application =
                    applicationName,

                service =
                    "TitanMDM.Api",

                version =
                    applicationVersion,

                environment =
                    environment.EnvironmentName,

                status =
                    "Running",

                frontend =
                    frontendUrl,

                health =
                    "/api/health",

                readiness =
                    "/api/health/ready",

                liveness =
                    "/api/health/live",

                windowsAgentPackage =
                    "/api/enrollment/windows/package",

                windowsInstaller =
                    "/api/enrollment/windows/installer",

                remoteSupportHub =
                    RemoteSupportHub.Route,

                utc =
                    DateTime.UtcNow
            });
    });

// ================================================================
// LIVENESS
// ================================================================

app.MapGet(
    "/api/health/live",
    () =>
    {
        return Results.Ok(
            new
            {
                service =
                    "TitanMDM.Api",

                status =
                    "Alive",

                utc =
                    DateTime.UtcNow
            });
    });

// ================================================================
// READINESS
// ================================================================

app.MapGet(
    "/api/health/ready",
    async (
        TitanMdmDbContext dbContext,
        CancellationToken cancellationToken) =>
    {
        try
        {
            var databaseAvailable =
                await dbContext
                    .Database
                    .CanConnectAsync(
                        cancellationToken);

            if (!databaseAvailable)
            {
                return Results.Json(
                    new
                    {
                        service =
                            "TitanMDM.Api",

                        status =
                            "Unhealthy",

                        database =
                            "Unavailable",

                        utc =
                            DateTime.UtcNow
                    },
                    statusCode:
                        StatusCodes
                            .Status503ServiceUnavailable);
            }

            return Results.Ok(
                new
                {
                    service =
                        "TitanMDM.Api",

                    status =
                        "Ready",

                    database =
                        "Available",

                    utc =
                        DateTime.UtcNow
                });
        }
        catch
        {
            return Results.Json(
                new
                {
                    service =
                        "TitanMDM.Api",

                    status =
                        "Unhealthy",

                    database =
                        "Unavailable",

                    utc =
                        DateTime.UtcNow
                },
                statusCode:
                    StatusCodes
                        .Status503ServiceUnavailable);
        }
    });

// ================================================================
// COMPATIBILITY HEALTH ENDPOINT
// ================================================================

app.MapGet(
    "/api/health",
    async (
        TitanMdmDbContext dbContext,
        CancellationToken cancellationToken) =>
    {
        bool databaseAvailable;

        try
        {
            databaseAvailable =
                await dbContext
                    .Database
                    .CanConnectAsync(
                        cancellationToken);
        }
        catch
        {
            databaseAvailable =
                false;
        }

        var status =
            databaseAvailable
                ? "Healthy"
                : "Unhealthy";

        var response =
            new
            {
                service =
                    "TitanMDM.Api",

                status,

                database =
                    databaseAvailable
                        ? "Available"
                        : "Unavailable",

                signalR =
                    "Enabled",

                remoteSupport =
                    "Enabled",

                windowsAgentDistribution =
                    "Enabled",

                utc =
                    DateTime.UtcNow
            };

        return databaseAvailable
            ? Results.Ok(
                response)
            : Results.Json(
                response,
                statusCode:
                    StatusCodes
                        .Status503ServiceUnavailable);
    });

app.Run();

public partial class Program
{
}