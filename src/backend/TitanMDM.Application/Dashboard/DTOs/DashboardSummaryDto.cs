namespace TitanMDM.Application.Dashboard.DTOs;

public sealed class DashboardSummaryDto
{
    public DeviceSummaryDto Devices { get; init; } = new();

    public PlatformSummaryDto Platforms { get; init; } = new();

    public ComplianceSummaryDto Compliance { get; init; } = new();

    public CommandSummaryDto Commands { get; init; } = new();

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

public sealed class CommandSummaryDto
{
    public int Total { get; init; }

    public int Pending { get; init; }

    public int Queued { get; init; }

    public int Dispatching { get; init; }

    public int Sent { get; init; }

    public int Delivered { get; init; }

    public int Executing { get; init; }

    public int Success { get; init; }

    public int Failed { get; init; }

    public int Timeout { get; init; }

    public int Cancelled { get; init; }

    public int Active { get; init; }

    public int Problems { get; init; }
}