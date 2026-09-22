using Microsoft.Extensions.Options;
using TitanMDM.WindowsAgent;
using TitanMDM.WindowsAgent.Configuration;
using TitanMDM.WindowsAgent.Execution;
using TitanMDM.WindowsAgent.Services;
using TitanMDM.WindowsAgent.Storage;

var builder =
    Host.CreateApplicationBuilder(args);

builder.Services.AddWindowsService(
    options =>
    {
        options.ServiceName =
            "TitanMDM Windows Agent";
    });

builder.Logging.AddEventLog(
    settings =>
    {
        settings.SourceName =
            "TitanMDM Windows Agent";
    });

builder.Services.Configure<AgentOptions>(
    builder.Configuration.GetSection(
        AgentOptions.SectionName));

builder.Services.AddSingleton<
    DeviceIdentityStore>();

builder.Services.AddSingleton<
    WindowsDeviceInfoProvider>();

builder.Services.AddSingleton<
    WindowsInventoryProvider>();

builder.Services.AddSingleton<
    WindowsSecurityProvider>();

builder.Services.AddSingleton<
    WindowsComplianceProvider>();

builder.Services.AddSingleton<
    WindowsActionExecutor>();

builder.Services.AddSingleton<
    ICommandExecutor,
    CommandExecutor>();

builder.Services.AddHttpClient<
    EnrollmentService>(
        (serviceProvider, client) =>
        {
            var options =
                serviceProvider
                    .GetRequiredService<
                        IOptions<AgentOptions>>()
                    .Value;

            client.BaseAddress =
                new Uri(
                    options.ServerUrl);

            client.Timeout =
                TimeSpan.FromSeconds(
                    options.RequestTimeoutSeconds);
        });

builder.Services.AddHttpClient<
    TitanMdmApiClient>(
        (serviceProvider, client) =>
        {
            var options =
                serviceProvider
                    .GetRequiredService<
                        IOptions<AgentOptions>>()
                    .Value;

            client.BaseAddress =
                new Uri(
                    options.ServerUrl);

            client.Timeout =
                TimeSpan.FromSeconds(
                    options.RequestTimeoutSeconds);
        });

builder.Services.AddHostedService<
    Worker>();

builder.Services.AddHostedService<
    HeartbeatBackgroundService>();

var host =
    builder.Build();

host.Run();