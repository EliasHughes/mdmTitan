using System.Text;

using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

using TitanMDM.Application.Android.Policies;
using TitanMDM.Application.AndroidEnterprise;
using TitanMDM.Application.Applications;
using TitanMDM.Application.Commands;
using TitanMDM.Application.Commands.Agent;
using TitanMDM.Application.Dashboard.Interfaces;
using TitanMDM.Application.Devices;
using TitanMDM.Application.Devices.Agent;
using TitanMDM.Application.Enrollment;
using TitanMDM.Application.Enrollment.DeviceRegistration;
using TitanMDM.Application.Interfaces;
using TitanMDM.Application.Policies;

using TitanMDM.Domain.Entities;

using TitanMDM.Infrastructure.Android;
using TitanMDM.Infrastructure.Android.Policies;
using TitanMDM.Infrastructure.Applications;
using TitanMDM.Infrastructure.Authentication;
using TitanMDM.Infrastructure.Commands;
using TitanMDM.Infrastructure.Dashboard;
using TitanMDM.Infrastructure.Devices;
using TitanMDM.Infrastructure.Devices.Agent;
using TitanMDM.Infrastructure.Enrollment;
using TitanMDM.Infrastructure.Persistence;
using TitanMDM.Infrastructure.Persistence.Seed;
using TitanMDM.Infrastructure.Policies;
using TitanMDM.Application.Security;
using TitanMDM.Infrastructure.Security;
using TitanMDM.Application.Groups;
using TitanMDM.Infrastructure.Groups;

using TitanMDM.Application.Location;
using TitanMDM.Application.LostMode;
using TitanMDM.Infrastructure.Location;
using TitanMDM.Infrastructure.LostMode;
using TitanMDM.Application.Automation;
using TitanMDM.Infrastructure.Automation;




namespace TitanMDM.Infrastructure.DependencyInjection;

public static class InfrastructureServiceExtensions
{
    public static IServiceCollection AddTitanMdmInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // ============================================================
        // DATABASE
        // ============================================================

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

        // ============================================================
        // JWT / AUTHENTICATION
        // ============================================================

        services.Configure<JwtOptions>(
            configuration.GetSection(
                JwtOptions.SectionName));

        var jwtOptions =
            configuration
                .GetSection(
                    JwtOptions.SectionName)
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

                            ValidateIssuerSigningKey =
                                true,

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

        // ============================================================
        // IDENTITY / AUTH
        // ============================================================

        services.AddScoped<
            IPasswordHasher<User>,
            PasswordHasher<User>>();

        services.AddScoped<
            ITokenService,
            JwtTokenService>();

        services.AddScoped<
            IAuthenticationService,
            AuthenticationService>();

        // ============================================================
        // DASHBOARD
        // ============================================================

        services.AddScoped<
            IDashboardService,
            DashboardService>();

        // ============================================================
        // ENROLLMENT
        // ============================================================

        services.AddScoped<
            IEnrollmentService,
            EnrollmentService>();

        services.AddScoped<
            IDeviceRegistrationService,
            DeviceRegistrationService>();

        // ============================================================
        // DEVICES
        // ============================================================

        services.AddScoped<
            IDeviceAuthenticator,
            DeviceAuthenticator>();

        services.AddScoped<
            IDeviceAgentService,
            DeviceAgentService>();

        services.AddScoped<
            IDeviceQueryService,
            DeviceQueryService>();

        // ============================================================
        // COMMAND ENGINE
        // ============================================================

        services.AddScoped<
            IDeviceCommandService,
            DeviceCommandService>();

        services.AddScoped<
            IDeviceCommandAgentService,
            DeviceCommandAgentService>();

        // ============================================================
        // APPLICATION INVENTORY
        // ============================================================

        services.AddScoped<
            IApplicationInventoryService,
            ApplicationInventoryService>();

        // ============================================================
        // POLICY ENGINE
        // ============================================================

        services.AddScoped<
            IPolicyService,
            PolicyService>();

        // ============================================================
        // GOOGLE ANDROID MANAGEMENT
        // ============================================================

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

        // ============================================================
        // SECURITY / COMPLIANCE
        // ============================================================

        services.AddScoped<
            ISecurityPostureService,
            SecurityPostureService>();

        
        // ============================================================
        // DEVICE GROUPS / FLEET MANAGEMENT
        // ============================================================

        services.AddScoped<
            IDeviceGroupService,
            DeviceGroupService>();
        
        // ============================================================
        // AUTOMATION ENGINE
        // ============================================================

        services.AddScoped<
            IAutomationService,
            AutomationService>();

        // ============================================================
        // LOST MODE / LOCATION / GEOFENCING
        // ============================================================

        services.AddScoped<
            IDeviceLocationService,
            DeviceLocationService>();

        services.AddScoped<
            ILostModeService,
            LostModeService>();

        services.AddScoped<
            IAutomationEventDispatcher,
            AutomationEventDispatcher>();

        services.AddHostedService<
            DeviceOfflineMonitor>();

        // ============================================================
        // DATABASE SEED
        // ============================================================

        services.AddScoped<
            TitanMdmSeeder>();

        return services;
    }
}