namespace TitanMDM.Domain.Entities;

public sealed class HelpdeskAutomationSettings
{
    private HelpdeskAutomationSettings() { }

    public HelpdeskAutomationSettings(Guid organizationId) =>
        OrganizationId = organizationId;

    public Guid OrganizationId { get; private set; }

    public bool ClassificationEnabled { get; private set; }

    public int EscalationDelayMinutes { get; private set; } = 120;

    public int ReopenDays { get; private set; } = 7;

    public int Revision { get; private set; }

    public DateTime UpdatedAtUtc { get; private set; } =
        DateTime.UtcNow;

    public void Configure(
        bool classification,
        int escalation,
        int reopen)
    {
        if (escalation is < 15 or > 1440 ||
            reopen is < 1 or > 30)
        {
            throw new ArgumentException(
                "Escalamiento: entre 15 y 1440 minutos; " +
                "reapertura: entre 1 y 30 días.");
        }

        ClassificationEnabled = classification;
        EscalationDelayMinutes = escalation;
        ReopenDays = reopen;
        UpdatedAtUtc = DateTime.UtcNow;
        Revision++;
    }
}