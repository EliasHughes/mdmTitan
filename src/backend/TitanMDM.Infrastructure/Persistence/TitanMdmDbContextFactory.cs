using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace TitanMDM.Infrastructure.Persistence;

public sealed class TitanMdmDbContextFactory
    : IDesignTimeDbContextFactory<TitanMdmDbContext>
{
    public TitanMdmDbContext CreateDbContext(string[] args)
    {
        var apiDirectory = Path.GetFullPath(
            Path.Combine(
                Directory.GetCurrentDirectory(),
                "TitanMDM.Api"));

        if (!Directory.Exists(apiDirectory))
        {
            apiDirectory = Directory.GetCurrentDirectory();
        }

        var environment =
            Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
            ?? "Development";

        var configuration = new ConfigurationBuilder()
            .SetBasePath(apiDirectory)
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile(
                $"appsettings.{environment}.json",
                optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString =
            configuration.GetConnectionString("TitanMdmDatabase");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "No se encontró ConnectionStrings:TitanMdmDatabase. " +
                $"Revisa los appsettings de {apiDirectory}.");
        }

        var options = new DbContextOptionsBuilder<TitanMdmDbContext>()
            .UseSqlServer(connectionString)
            .Options;

        return new TitanMdmDbContext(options);
    }
}