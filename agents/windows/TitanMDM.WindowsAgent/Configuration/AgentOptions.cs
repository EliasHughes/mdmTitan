namespace TitanMDM.WindowsAgent.Configuration;

public sealed class AgentOptions
{
    public const string SectionName =
        "TitanMDM";

    public string ServerUrl { get; set; } =
        "http://localhost:8020";

    public string? EnrollmentToken { get; set; }

    public int HeartbeatIntervalSeconds
    {
        get;
        set;
    } = 60;

    public int CommandPollingIntervalSeconds
    {
        get;
        set;
    } = 10;

    public int RequestTimeoutSeconds
    {
        get;
        set;
    } = 30;
}