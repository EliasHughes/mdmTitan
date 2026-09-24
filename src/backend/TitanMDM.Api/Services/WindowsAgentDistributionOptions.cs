namespace TitanMDM.Api.Services;

public sealed class WindowsAgentDistributionOptions
{
    public const string SectionName =
        "WindowsAgentDistribution";

    public string PublicServerUrl
    {
        get;
        set;
    } =
        string.Empty;

    public string PackagePath
    {
        get;
        set;
    } =
        "../../../artifacts/windows-agent/TitanMDM-WindowsAgent-x64.zip";

    public string PackageFileName
    {
        get;
        set;
    } =
        "TitanMDM-WindowsAgent-x64.zip";
}