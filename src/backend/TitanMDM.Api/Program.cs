using TitanMDM.Api.Hubs;
using TitanMDM.Api.Services;
using TitanMDM.Infrastructure.DependencyInjection;
using TitanMDM.Infrastructure.Persistence.Seed;

var builder =
    WebApplication.CreateBuilder(
        args);

/*
 * ================================================================
 * CONTROLLERS / OPENAPI
 * ================================================================
 */

builder.Services.AddControllers();

builder.Services.AddOpenApi();

/*
 * ================================================================
 * SIGNALR
 * ================================================================
 *
 * Remote Support transmite frames JPEG en Base64 desde
 * TitanMDM.RemoteHost hacia el Hub.
 *
 * El límite por defecto de SignalR es demasiado pequeño para una
 * captura de escritorio.
 *
 * Mouse y teclado funcionan porque sus mensajes pesan pocos bytes,
 * pero un frame 1080p comprimido puede superar fácilmente decenas
 * o cientos de KB.
 *
 * Para la fase actual permitimos hasta 8 MB por mensaje.
 *
 * Más adelante optimizaremos:
 *
 * - resolución dinámica
 * - calidad JPEG adaptativa
 * - FPS dinámico
 * - delta frames
 * - chunking si fuera necesario
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
 * REMOTE SUPPORT SERVICES
 * ================================================================
 */

builder.Services.AddSingleton<
    RemoteSupportNotifier>();

builder.Services.AddSingleton<
    RemoteHostTokenService>();

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

builder.Services.AddCors(
    options =>
    {
        options.AddPolicy(
            "TitanMdmFrontend",
            policy =>
            {
                policy
                    .WithOrigins(
                        "http://localhost:3020")
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
    });

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
 * API
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
                    "http://localhost:3020",

                health =
                    "/api/health",

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

                remoteFrameMaxMessageBytes =
                    8 * 1024 * 1024,

                utc =
                    DateTime.UtcNow
            }));

app.Run();

public partial class Program
{
}