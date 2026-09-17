using Microsoft.Extensions.Options;
using TitanMDM.WindowsAgent;
using TitanMDM.WindowsAgent.Configuration;
using TitanMDM.WindowsAgent.Execution;
using TitanMDM.WindowsAgent.Services;
using TitanMDM.WindowsAgent.Storage;

var builder =
    Host.CreateApplicationBuilder(args);

builder.Services.Configure<AgentOptions>(
    builder.Configuration.GetSection(
        AgentOptions.SectionName));

builder.Services.AddSingleton<
    DeviceIdentityStore>();

builder.Services.AddSingleton<
    WindowsDeviceInfoProvider>();

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

builder.Services.AddHostedService<Worker>();

var host =
    builder.Build();

host.Run();