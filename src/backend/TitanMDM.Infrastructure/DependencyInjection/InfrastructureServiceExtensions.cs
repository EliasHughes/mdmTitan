using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using TitanMDM.Application.Interfaces;
using TitanMDM.Domain.Entities;
using TitanMDM.Infrastructure.Authentication;
using TitanMDM.Infrastructure.Persistence;
using TitanMDM.Infrastructure.Persistence.Seed;
using TitanMDM.Application.Dashboard.Interfaces;
using TitanMDM.Infrastructure.Dashboard;
using TitanMDM.Application.Devices;
using TitanMDM.Infrastructure.Devices;
using TitanMDM.Application.Enrollment;
using TitanMDM.Infrastructure.Enrollment;
using TitanMDM.Application.Enrollment.DeviceRegistration;
using TitanMDM.Application.Devices.Agent;
using TitanMDM.Infrastructure.Devices.Agent;
using TitanMDM.Application.Commands;
using TitanMDM.Infrastructure.Commands;
using TitanMDM.Application.Commands.Agent;
using TitanMDM.Application.Policies;
using TitanMDM.Infrastructure.Policies;
using TitanMDM.Application.AndroidEnterprise;
using TitanMDM.Infrastructure.Android;
using TitanMDM.Application.Android.Policies;
using TitanMDM.Infrastructure.Android.Policies;

namespace TitanMDM.Infrastructure.DependencyInjection;

public static class InfrastructureServiceExtensions
{
    public static IServiceCollection AddTitanMdmInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString =
            configuration.GetConnectionString(
                "TitanMdmDatabase");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "Connection string 'TitanMdmDatabase' was not found.");
        }

        services.AddDbContext<TitanMdmDbContext>(
            options =>
            {
                options.UseSqlServer(
                    connectionString,
                    sqlOptions =>
                    {
                        sqlOptions.EnableRetryOnFailure(
                            maxRetryCount: 5,
                            maxRetryDelay:
                                TimeSpan.FromSeconds(10),
                            errorNumbersToAdd: null);
                    });
            });

        services.Configure<JwtOptions>(
            configuration.GetSection(
                JwtOptions.SectionName));

        var jwtOptions =
            configuration
                .GetSection(JwtOptions.SectionName)
                .Get<JwtOptions>()
            ?? throw new InvalidOperationException(
                "JWT configuration was not found.");

        if (string.IsNullOrWhiteSpace(
                jwtOptions.SigningKey) ||
            jwtOptions.SigningKey.Length < 32)
        {
            throw new InvalidOperationException(
                "JWT signing key must contain at least 32 characters.");
        }

        services
            .AddAuthentication(
                JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(
                options =>
                {
                    options.TokenValidationParameters =
                        new TokenValidationParameters
                        {
                            ValidateIssuer = true,
                            ValidIssuer =
                                jwtOptions.Issuer,

                            ValidateAudience = true,
                            ValidAudience =
                                jwtOptions.Audience,

                            ValidateIssuerSigningKey = true,
                            IssuerSigningKey =
                                new SymmetricSecurityKey(
                                    Encoding.UTF8.GetBytes(
                                        jwtOptions.SigningKey)),

                            ValidateLifetime = true,

                            ClockSkew =
                                TimeSpan.FromSeconds(30)
                        };
                });

        services.AddAuthorization();

        services.AddScoped<
            IPasswordHasher<User>,
            PasswordHasher<User>>();

        services.AddScoped<
            ITokenService,
            JwtTokenService>();

        services.AddScoped<
    IAuthenticationService,
    AuthenticationService>();

    services.AddScoped<
    IDashboardService,
    DashboardService>();

    services.AddScoped<
    IEnrollmentService,
    EnrollmentService>();

    services.AddScoped<
    IDeviceRegistrationService,
    DeviceRegistrationService>();

    services.AddScoped<
    IDeviceCommandService,
    DeviceCommandService>();

    services.AddScoped<
    IDeviceCommandAgentService,
    DeviceCommandAgentService>();

    services.AddScoped<
    IDeviceAuthenticator,
    DeviceAuthenticator>();

    services.AddScoped<IDeviceAgentService, DeviceAgentService>();

    services.AddScoped<IDeviceQueryService, DeviceQueryService>();

    services.AddScoped<
    IPolicyService,
    PolicyService>();

 services
    .AddOptions<AndroidManagementOptions>()
    .Bind(
        configuration.GetSection(
            AndroidManagementOptions.SectionName));

services.AddSingleton<
    IGoogleAndroidAccessTokenProvider,
    GoogleAndroidAccessTokenProvider>();

services.AddHttpClient<
    AndroidManagementClient>();

// ============================================================
// ANDROID ENTERPRISE
// ============================================================

services.AddScoped<
    IAndroidEnterpriseService,
    AndroidEnterpriseService>();

services.AddScoped<
    IAndroidDeviceSyncService,
    AndroidDeviceSyncService>();

// ============================================================
// ANDROID POLICY ENGINE
// ============================================================

services.AddScoped<
    IAndroidPolicyCompiler,
    AndroidPolicyCompiler>();

services.AddScoped<
    IAndroidPolicyPublisher,
    AndroidPolicyPublisher>();

services.AddScoped<
    IAndroidPolicyAssignmentService,
    AndroidPolicyAssignmentService>();
    
services.AddScoped<TitanMdmSeeder>();



return services;
    }
}