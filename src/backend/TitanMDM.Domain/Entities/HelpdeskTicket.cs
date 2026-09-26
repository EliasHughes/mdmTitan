namespace TitanMDM.Domain.Entities;

public sealed class HelpdeskTicket
{
    private HelpdeskTicket()
    {
    }

    public HelpdeskTicket(
        Guid organizationId,
        string number,
        string subject,
        string description,
        string type,
        string priority,
        string category,
        string source,
        Guid requesterUserId,
        Guid? deviceId,
        Guid? queueId)
    {
        if (organizationId == Guid.Empty)
            throw new ArgumentException("OrganizationId is required.", nameof(organizationId));
        if (string.IsNullOrWhiteSpace(number))
            throw new ArgumentException("Number is required.", nameof(number));
        if (string.IsNullOrWhiteSpace(subject))
            throw new ArgumentException("Subject is required.", nameof(subject));

        Id = Guid.NewGuid();
        OrganizationId = organizationId;
        Number = number.Trim();
        Subject = subject.Trim();
        Description = (description ?? string.Empty).Trim();
        Type = string.IsNullOrWhiteSpace(type) ? "incident" : type.Trim().ToLowerInvariant();
        Priority = string.IsNullOrWhiteSpace(priority) ? "medium" : priority.Trim().ToLowerInvariant();
        Category = string.IsNullOrWhiteSpace(category) ? "general" : category.Trim();
        Source = string.IsNullOrWhiteSpace(source) ? "console" : source.Trim().ToLowerInvariant();
        Status = "new";
        RequesterUserId = requesterUserId;
        DeviceId = deviceId;
        QueueId = queueId;
        CreatedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid OrganizationId { get; private set; }
    public string Number { get; private set; } = string.Empty;
    public string Subject { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string Type { get; private set; } = "incident";
    public string Priority { get; private set; } = "medium";
    public string Status { get; private set; } = "new";
    public string Category { get; private set; } = "general";
    public string Source { get; private set; } = "console";
    public Guid RequesterUserId { get; private set; }
    public Guid? AssigneeUserId { get; private set; }
    public Guid? DeviceId { get; private set; }
    public Guid? QueueId { get; private set; }
    public Guid? RemoteSessionId { get; private set; }
    public string? EntraObjectId { get; private set; }
    public string? EntraUserPrincipalName { get; private set; }
    public DateTime? FirstResponseDueAtUtc { get; private set; }
    public DateTime? ResolveDueAtUtc { get; private set; }
    public DateTime? FirstRespondedAtUtc { get; private set; }
    public DateTime? ResolvedAtUtc { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    public void Assign(Guid assigneeUserId)
    {
        AssigneeUserId = assigneeUserId;
        if (Status == "new")
            Status = "open";
        Touch();
    }

    public void Transition(string status)
    {
        if (string.IsNullOrWhiteSpace(status))
            throw new ArgumentException("Status is required.", nameof(status));

        Status = status.Trim().ToLowerInvariant();
        if (Status is "resolved" or "closed")
            ResolvedAtUtc ??= DateTime.UtcNow;
        Touch();
    }

    public void MarkFirstResponse()
    {
        FirstRespondedAtUtc ??= DateTime.UtcNow;
        Touch();
    }

    public void LinkDevice(Guid? deviceId)
    {
        DeviceId = deviceId;
        Touch();
    }

    public void LinkRemoteSession(Guid remoteSessionId)
    {
        RemoteSessionId = remoteSessionId;
        Touch();
    }

    public void LinkEntraRequester(string? objectId, string? upn)
    {
        EntraObjectId = string.IsNullOrWhiteSpace(objectId) ? null : objectId.Trim();
        EntraUserPrincipalName = string.IsNullOrWhiteSpace(upn) ? null : upn.Trim().ToLowerInvariant();
        Touch();
    }

    public void ApplySla(DateTime firstResponseDue, DateTime resolveDue)
    {
        FirstResponseDueAtUtc = firstResponseDue;
        ResolveDueAtUtc = resolveDue;
        Touch();
    }

    private void Touch()
    {
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
