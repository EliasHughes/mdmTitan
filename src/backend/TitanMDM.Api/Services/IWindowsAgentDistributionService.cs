namespace TitanMDM.Api.Services;

public interface IWindowsAgentDistributionService
{
    string GetPackagePath();

    string GetPackageFileName();

    Task<string> GetPackageSha256Async(
        CancellationToken cancellationToken =
            default);

    Task<string> BuildBootstrapScriptAsync(
        string enrollmentToken,
        string deploymentMode,
        CancellationToken cancellationToken =
            default);
}