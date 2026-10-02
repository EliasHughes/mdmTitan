using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace TitanMDM.Infrastructure.Persistence;

public sealed class TitanMdmDbContextFactory
    : IDesignTimeDbContextFactory<TitanMdmDbContext>
{
    public TitanMdmDbContext CreateDbContext(
        string[] args)
    {
        var apiDirectory =
            ResolveApiDirectory();

        var environment =
            Environment.GetEnvironmentVariable(
                "ASPNETCORE_ENVIRONMENT")
            ?? "Development";

        var configurationBuilder =
            new ConfigurationBuilder()
                .SetBasePath(apiDirectory)
                .AddJsonFile(
                    "appsettings.json",
                    optional: false,
                    reloadOnChange: false)
                .AddJsonFile(
                    $"appsettings.{environment}.json",
                    optional: true,
                    reloadOnChange: false)
                .AddEnvironmentVariables();

        var configuration =
            configurationBuilder.Build();

        var connectionString =
            ResolveConnectionString(
                configuration,
                args);

        var databaseOptions =
            configuration
                .GetSection(DatabaseOptions.SectionName)
                .Get<DatabaseOptions>()
            ?? new DatabaseOptions();

        var options =
            new DbContextOptionsBuilder<TitanMdmDbContext>();

        options.UseSqlServer(
            connectionString,
            sql =>
            {
                sql.CommandTimeout(
                    Math.Max(
                        30,
                        databaseOptions.CommandTimeoutSeconds));

                sql.EnableRetryOnFailure(
                    maxRetryCount:
                        Math.Max(
                            0,
                            databaseOptions.MaxRetryCount),
                    maxRetryDelay:
                        TimeSpan.FromSeconds(
                            Math.Max(
                                1,
                                databaseOptions.MaxRetryDelaySeconds)),
                    errorNumbersToAdd:
                        null);
            });

        return new TitanMdmDbContext(
            options.Options);
    }

    private static string ResolveApiDirectory()
    {
        var current =
            new DirectoryInfo(
                Directory.GetCurrentDirectory());

        while (current is not null)
        {
            var directApi =
                Path.Combine(
                    current.FullName,
                    "src",
                    "backend",
                    "TitanMDM.Api");

            if (Directory.Exists(directApi))
            {
                return directApi;
            }

            var siblingApi =
                Path.Combine(
                    current.FullName,
                    "TitanMDM.Api");

            if (Directory.Exists(siblingApi))
            {
                return siblingApi;
            }

            current = current.Parent;
        }

        throw new DirectoryNotFoundException(
            "TitanMDM.Api directory could not be resolved. " +
            "Run dotnet ef from the TitanMDM repository or backend directory.");
    }

    private static string ResolveConnectionString(
        IConfiguration configuration,
        string[] args)
    {
        var argumentValue =
            GetArgumentValue(
                args,
                "--connection");

        if (!string.IsNullOrWhiteSpace(
                argumentValue))
        {
            return argumentValue;
        }

        var configured =
            configuration.GetConnectionString(
                "TitanMdmDatabase");

        if (!string.IsNullOrWhiteSpace(
                configured))
        {
            return configured;
        }

        throw new InvalidOperationException(
            "ConnectionStrings:TitanMdmDatabase is not configured for " +
            "EF Core design-time operations. " +
            "Use the environment variable " +
            "'ConnectionStrings__TitanMdmDatabase' or pass " +
            "'--connection <connection-string>' after '--'.");
    }

    private static string? GetArgumentValue(
        IReadOnlyList<string> args,
        string name)
    {
        for (var index = 0;
             index < args.Count - 1;
             index++)
        {
            if (!string.Equals(
                    args[index],
                    name,
                    StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            return args[index + 1];
        }

        return null;
    }
}