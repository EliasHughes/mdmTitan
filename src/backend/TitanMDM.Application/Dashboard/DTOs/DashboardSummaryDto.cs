namespace TitanMDM.Application.Dashboard.DTOs;

public sealed class DashboardSummaryDto
{
    public DeviceSummaryDto Devices { get; init; } = new();

    public PlatformSummaryDto Platforms { get; init; } = new();

    public ComplianceSummaryDto Compliance { get; init; } = new();

    public SystemStatusDto System { get; init; } = new();

    public DateTime GeneratedAtUtc { get; init; }
}

public sealed class DeviceSummaryDto
{
    public int Total { get; init; }

    public int Online { get; init; }

    public int Offline { get; init; }

    public int Pending { get; init; }

    public int Enrolling { get; init; }

    public int Quarantined { get; init; }

    public int Retired { get; init; }

    public int Managed { get; init; }
}

public sealed class PlatformSummaryDto
{
    public int Windows { get; init; }

    public int Android { get; init; }

    public int Unknown { get; init; }
}

public sealed class ComplianceSummaryDto
{
    public int Compliant { get; init; }

    public int NonCompliant { get; init; }

    public int Evaluating { get; init; }

    public int Quarantined { get; init; }

    public int Unknown { get; init; }

    public decimal? CompliancePercentage { get; init; }
}

public sealed class SystemStatusDto
{
    public string Api { get; init; } =
        "Operational";

    public string Database { get; init; } =
        "Connected";
}