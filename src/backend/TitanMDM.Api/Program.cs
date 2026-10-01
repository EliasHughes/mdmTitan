using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using TitanMDM.Api.Hubs;
using TitanMDM.Api.RemoteSupport;
using TitanMDM.Api.Security;
using TitanMDM.Api.Services;
using TitanMDM.Infrastructure.DependencyInjection;
using TitanMDM.Infrastructure.Persistence.Seed;

var builder = WebApplication.CreateBuilder(args);

var keyRingPath =
    builder.Configuration["DataProtection:KeyRingPath"];

if (string.IsNullOrWhiteSpace(keyRingPath))
{
    keyRingPath = Path.Combine(
        Environment.GetFolderPath(
            Environment.SpecialFolder.CommonApplicationData),
        "TitanMDM",
        "DataProtectionKeys");
}

Directory.CreateDirectory(keyRingPath);

builder.Services
    .AddDataProtection()
    .SetApplicationName("TitanMDM")
    .PersistKeysToFileSystem(
        new DirectoryInfo(keyRingPath));

builder.Services.AddControllers(
    options =>
    {
        options.Filters.Add<HelpdeskAudienceFilter>();
    });

builder.Services.AddOpenApi();

builder.Services.AddSignalR(
    options =>
    {
        options.MaximumReceiveMessageSize =
            8 * 1024 * 1024;

        options.EnableDetailedErrors = true;

        options.KeepAliveInterval =
            TimeSpan.FromSeconds(10);

        options.ClientTimeoutInterval =
            TimeSpan.FromSeconds(30);
    });

builder.Services
    .AddSingleton<RemoteSupportNotifier>();

builder.Services
    .AddSingleton<RemoteHostTokenService>();

builder.Services
    .Configure<WindowsAgentDistributionOptions>(
        builder.Configuration.GetSection(
            WindowsAgentDistributionOptions.SectionName));

builder.Services
    .AddSingleton<
        IWindowsAgentDistributionService,
        WindowsAgentDistributionService>();

builder.Services
    .AddScoped<SessionSecurityService>();

builder.Services
    .AddSingleton<RemoteSupportConnectionRegistry>();

builder.Services
    .AddScoped<RemoteSupportParticipantService>();

builder.Services
    .AddScoped<RemoteControlLeaseService>();

builder.Services
    .AddHostedService<HelpdeskMonitoringService>();

builder.Services
    .AddHostedService<HelpdeskRoutingWorker>();

builder.Services
    .AddHostedService<HelpdeskMailWorker>();

builder.Services
    .AddTitanMdmInfrastructure(builder.Configuration);

if (builder.Configuration.GetValue<bool>(
        "EntraLogin:Enabled"))
{
    var tenantId =
        builder.Configuration["EntraLogin:TenantId"];

    var clientId =
        builder.Configuration["EntraLogin:ClientId"];

    var clientSecret =
        builder.Configuration["EntraLogin:ClientSecret"];

    if (!Guid.TryParse(tenantId, out _) ||
        !Guid.TryParse(clientId, out _) ||
        string.IsNullOrWhiteSpace(clientSecret))
    {
        throw new InvalidOperationException(
            "EntraLogin requiere TenantId, ClientId " +
            "y ClientSecret válidos.");
    }

    builder.Services
        .AddAuthentication()
        .AddCookie(
            "TitanEntraTemp",
            options =>
            {
                options.Cookie.Name =
                    "__TitanEntraTemp";

                options.Cookie.HttpOnly = true;

                options.Cookie.SameSite =
                    SameSiteMode.Lax;

                options.Cookie.Path =
                    "/api/auth/entra";

                options.Cookie.SecurePolicy =
                    CookieSecurePolicy.SameAsRequest;

                options.ExpireTimeSpan =
                    TimeSpan.FromMinutes(2);

                options.SlidingExpiration = false;
            })
        .AddOpenIdConnect(
            "TitanEntraOidc",
            options =>
            {
                options.Authority =
                    $"https://login.microsoftonline.com/{tenantId}/v2.0";

                options.ClientId = clientId;
                options.ClientSecret = clientSecret;

                options.SignInScheme =
                    "TitanEntraTemp";

                options.CallbackPath =
                    "/signin-entra";

                options.ResponseType = "code";
                options.RequireHttpsMetadata = true;
                options.SaveTokens = false;
                options.MapInboundClaims = false;

                options.Scope.Clear();
                options.Scope.Add("openid");
                options.Scope.Add("profile");
                options.Scope.Add("email");

                options.TokenValidationParameters
                    .ValidateIssuer = true;

                options.TokenValidationParameters
                    .ValidateAudience = true;

                options.TokenValidationParameters
                    .NameClaimType = "name";
            });
}

builder.Services.AddCors(
    options =>
    {
        options.AddPolicy(
            "TitanMdmFrontend",
            policy =>
            {
                policy
                    .WithOrigins(
                        "http://localhost:3020",
                        "http://172.21.20.14:3020")
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
    });

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var seeder = scope.ServiceProvider
        .GetRequiredService<TitanMdmSeeder>();

    await seeder.SeedAsync();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("TitanMdmFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapHub<RemoteSupportHub>(
    RemoteSupportHub.Route);

app.MapGet(
    "/",
    () => Results.Ok(
        new
        {
            application = "TitanMDM",
            service = "TitanMDM.Api",
            version = "1.0.0",
            status = "Running",

            frontend =
                "http://172.21.20.14:3020",

            health = "/api/health",

            windowsAgentPackage =
                "/api/enrollment/windows/package",

            windowsInstaller =
                "/api/enrollment/windows/installer",

            remoteSupportHub =
                RemoteSupportHub.Route,

            remoteFrameMaxMessageBytes =
                8 * 1024 * 1024,

            utc = DateTime.UtcNow
        }));

app.MapGet(
    "/api/health",
    () => Results.Ok(
        new
        {
            service = "TitanMDM.Api",
            status = "Healthy",
            database = "TitanMDM",
            signalR = "Enabled",
            remoteSupport = "Enabled",
            windowsAgentDistribution = "Enabled",

            remoteFrameMaxMessageBytes =
                8 * 1024 * 1024,

            utc = DateTime.UtcNow
        }));

app.Run();

public partial class Program
{
}