using TitanMDM.Api.Hubs;
using TitanMDM.Api.Services;
using TitanMDM.Infrastructure.DependencyInjection;
using TitanMDM.Infrastructure.Persistence.Seed;
using TitanMDM.Api.RemoteSupport;

var builder =
    WebApplication.CreateBuilder(
        args);

/*
 * ================================================================
 * CONTROLLERS / OPENAPI
 * ================================================================
 */

builder.Services
    .AddControllers();

builder.Services
    .AddOpenApi();

/*
 * ================================================================
 * SIGNALR
 * ================================================================
 */

builder.Services
    .AddSignalR(
        options =>
        {
            options.MaximumReceiveMessageSize =
                8 * 1024 * 1024;

            options.EnableDetailedErrors =
                true;

            options.KeepAliveInterval =
                TimeSpan.FromSeconds(
                    10);

            options.ClientTimeoutInterval =
                TimeSpan.FromSeconds(
                    30);
        });

/*
 * ================================================================
 * REMOTE SUPPORT
 * ================================================================
 */

builder.Services
    .AddSingleton<
        RemoteSupportNotifier>();

builder.Services
    .AddSingleton<
        RemoteHostTokenService>();

/*
 * ================================================================
 * WINDOWS AGENT DISTRIBUTION
 * ================================================================
 *
 * IMPORTANTE:
 * Todos los servicios deben registrarse ANTES de builder.Build().
 * ================================================================
 */

builder.Services
    .Configure<
        WindowsAgentDistributionOptions>(
            builder.Configuration
                .GetSection(
                    WindowsAgentDistributionOptions
                        .SectionName));

builder.Services
    .AddSingleton<
        IWindowsAgentDistributionService,
        WindowsAgentDistributionService>();

/*
 * ================================================================
 * IDENTITY / SESSION SECURITY
 * ================================================================
 */

builder.Services
    .AddScoped<
        SessionSecurityService>();

builder.Services.AddSingleton<RemoteSupportConnectionRegistry>();

builder.Services.AddScoped<RemoteSupportParticipantService>();

builder.Services.AddScoped<RemoteControlLeaseService>();

/*
 * ================================================================
 * INFRASTRUCTURE
 * ================================================================
 */

builder.Services
    .AddTitanMdmInfrastructure(
        builder.Configuration);

/*
 * ================================================================
 * CORS
 * ================================================================
 */

builder.Services
    .AddCors(
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

/*
 * ================================================================
 * BUILD
 * ================================================================
 *
 * A PARTIR DE AQUÍ NO se modifica builder.Services.
 * ================================================================
 */

var app =
    builder.Build();

/*
 * ================================================================
 * DATABASE SEED
 * ================================================================
 */

using (
    var scope =
        app.Services
            .CreateScope())
{
    var seeder =
        scope.ServiceProvider
            .GetRequiredService<
                TitanMdmSeeder>();

    await seeder
        .SeedAsync();
}

/*
 * ================================================================
 * DEVELOPMENT
 * ================================================================
 */

if (
    app.Environment
        .IsDevelopment())
{
    app.MapOpenApi();
}

/*
 * ================================================================
 * HTTP PIPELINE
 * ================================================================
 */

app.UseCors(
    "TitanMdmFrontend");

app.UseAuthentication();

app.UseAuthorization();

/*
 * ================================================================
 * API CONTROLLERS
 * ================================================================
 */

app.MapControllers();

/*
 * ================================================================
 * SIGNALR HUB
 * ================================================================
 */

app.MapHub<
    RemoteSupportHub>(
        RemoteSupportHub.Route);

/*
 * ================================================================
 * ROOT
 * ================================================================
 */

app.MapGet(
    "/",
    () =>
        Results.Ok(
            new
            {
                application =
                    "TitanMDM",

                service =
                    "TitanMDM.Api",

                version =
                    "1.0.0",

                status =
                    "Running",

                frontend =
                    "http://172.21.20.14:3020",

                health =
                    "/api/health",

                windowsAgentPackage =
                    "/api/enrollment/windows/package",

                windowsInstaller =
                    "/api/enrollment/windows/installer",

                remoteSupportHub =
                    RemoteSupportHub.Route,

                remoteFrameMaxMessageBytes =
                    8 * 1024 * 1024,

                utc =
                    DateTime.UtcNow
            }));

/*
 * ================================================================
 * HEALTH
 * ================================================================
 */

app.MapGet(
    "/api/health",
    () =>
        Results.Ok(
            new
            {
                service =
                    "TitanMDM.Api",

                status =
                    "Healthy",

                database =
                    "TitanMDM",

                signalR =
                    "Enabled",

                remoteSupport =
                    "Enabled",

                windowsAgentDistribution =
                    "Enabled",

                remoteFrameMaxMessageBytes =
                    8 * 1024 * 1024,

                utc =
                    DateTime.UtcNow
            }));

/*
 * ================================================================
 * START
 * ================================================================
 */

app.Run();

public partial class Program
{
}