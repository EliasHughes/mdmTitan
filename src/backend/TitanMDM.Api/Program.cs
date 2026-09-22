using TitanMDM.Api.Hubs;
using TitanMDM.Api.Services;
using TitanMDM.Infrastructure.DependencyInjection;
using TitanMDM.Infrastructure.Persistence.Seed;


var builder =
    WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.AddOpenApi();

builder.Services.AddSignalR();

builder.Services.AddSingleton<
    RemoteSupportNotifier>();

builder.Services.AddSingleton<
    RemoteHostTokenService>();

builder.Services.AddTitanMdmInfrastructure(
    builder.Configuration);

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

using (var scope =
       app.Services.CreateScope())
{
    var seeder =
        scope.ServiceProvider
            .GetRequiredService<
                TitanMdmSeeder>();

    await seeder.SeedAsync();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors(
    "TitanMdmFrontend");

app.UseAuthentication();

app.UseAuthorization();

app.MapControllers();

app.MapHub<RemoteSupportHub>(
    RemoteSupportHub.Route);

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

                utc =
                    DateTime.UtcNow
            }));

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

                utc =
                    DateTime.UtcNow
            }));

app.Run();

public partial class Program
{
}