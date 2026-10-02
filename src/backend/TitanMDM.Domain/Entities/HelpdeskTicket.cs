namespace TitanMDM.Domain.Entities;

public sealed class HelpdeskTicket
{
    private HelpdeskTicket() { }

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

        Type = string.IsNullOrWhiteSpace(type)
            ? "incident"
            : type.Trim().ToLowerInvariant();

        Priority = string.IsNullOrWhiteSpace(priority)
            ? "medium"
            : priority.Trim().ToLowerInvariant();

        Category = string.IsNullOrWhiteSpace(category)
            ? "general"
            : category.Trim();

        Source = string.IsNullOrWhiteSpace(source)
            ? "console"
            : source.Trim().ToLowerInvariant();

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

    public Guid? RequestedTeamId { get; private set; }
    public Guid? RemoteSessionId { get; private set; }

    public string? EntraObjectId { get; private set; }
    public string? EntraUserPrincipalName { get; private set; }

    public DateTime? FirstResponseDueAtUtc { get; private set; }
    public DateTime? ResolveDueAtUtc { get; private set; }
    public DateTime? FirstRespondedAtUtc { get; private set; }
    public DateTime? ResolvedAtUtc { get; private set; }

    public Guid? SiteId
        {
            get;
            private set;
        }

        public Guid? SiteLocationId
        {
            get;
            private set;
        }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    public DateTime? SlaPausedAtUtc { get; private set; }
    public DateTime? SuspendedFirstResponseDueAtUtc { get; private set; }
    public DateTime? SuspendedResolveDueAtUtc { get; private set; }

    public long TotalSlaPausedSeconds { get; private set; }
    public long FirstResponsePausedSeconds { get; private set; }

    public string? ExternalRequesterName { get; private set; }
    public string? ExternalRequesterEmail { get; private set; }

    public void SelectGroup(Guid teamId)
    {
        if (teamId == Guid.Empty)
            throw new ArgumentException("Selecciona un grupo válido.");

        RequestedTeamId = teamId;
        Touch();
    }

    public void Assign(Guid assigneeUserId)
    {
        AssigneeUserId = assigneeUserId;

        if (Status == "new")
            Status = "open";

        Touch();
    }

    public void Transition(string status)
    {
        status = (status ?? "").Trim().ToLowerInvariant();

        if (status is not (
            "new" or "open" or "inprogress" or
            "pendinguser" or "resolved" or "closed"))
        {
            throw new ArgumentException("Estado de ticket inválido.");
        }

        var now = DateTime.UtcNow;

        if (status == "pendinguser" && SlaPausedAtUtc is null)
        {
            SlaPausedAtUtc = now;
            SuspendedFirstResponseDueAtUtc = FirstResponseDueAtUtc;
            SuspendedResolveDueAtUtc = ResolveDueAtUtc;

            FirstResponseDueAtUtc = null;
            ResolveDueAtUtc = null;
        }
        else if (status != "pendinguser" && SlaPausedAtUtc.HasValue)
        {
            var elapsed = now - SlaPausedAtUtc.Value;

            if (elapsed < TimeSpan.Zero)
                elapsed = TimeSpan.Zero;

            TotalSlaPausedSeconds += (long)elapsed.TotalSeconds;

            if (FirstRespondedAtUtc is null)
                FirstResponsePausedSeconds += (long)elapsed.TotalSeconds;

            FirstResponseDueAtUtc =
                SuspendedFirstResponseDueAtUtc?.Add(elapsed);

            ResolveDueAtUtc =
                SuspendedResolveDueAtUtc?.Add(elapsed);

            SuspendedFirstResponseDueAtUtc = null;
            SuspendedResolveDueAtUtc = null;
            SlaPausedAtUtc = null;
        }

        Status = status;

        if (Status is "resolved" or "closed")
            ResolvedAtUtc ??= now;
        else
            ResolvedAtUtc = null;

        Touch();
    }

    public void Reclassify(string category)
    {
        if (string.IsNullOrWhiteSpace(category) ||
            category.Trim().Length > 80)
        {
            throw new ArgumentException("Categoría inválida.");
        }

        Category = category.Trim().ToLowerInvariant();
        Touch();
    }

    public void MarkFirstResponse()
    {
        if (FirstRespondedAtUtc is null && SlaPausedAtUtc.HasValue)
        {
            FirstResponsePausedSeconds += (long)Math.Max(
                0,
                (DateTime.UtcNow - SlaPausedAtUtc.Value).TotalSeconds);
        }

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
        EntraObjectId = string.IsNullOrWhiteSpace(objectId)
            ? null
            : objectId.Trim();

        EntraUserPrincipalName = string.IsNullOrWhiteSpace(upn)
            ? null
            : upn.Trim().ToLowerInvariant();

        Touch();
    }

    public void SetEmailRequester(string name, string email)
    {
        if (string.IsNullOrWhiteSpace(email) || email.Length > 320)
        {
            throw new ArgumentException(
                "Valid requester email is required.",
                nameof(email));
        }

        ExternalRequesterName = string.IsNullOrWhiteSpace(name)
            ? email.Trim()[..Math.Min(email.Trim().Length, 200)]
            : name.Trim()[..Math.Min(name.Trim().Length, 200)];

        ExternalRequesterEmail = email.Trim().ToLowerInvariant();
        Touch();
    }

    public void ApplySla(
        DateTime firstResponseDue,
        DateTime resolveDue)
    {
        if (SlaPausedAtUtc.HasValue)
        {
            SuspendedFirstResponseDueAtUtc = firstResponseDue;
            SuspendedResolveDueAtUtc = resolveDue;
        }
        else
        {
            FirstResponseDueAtUtc = firstResponseDue;
            ResolveDueAtUtc = resolveDue;
        }

        Touch();
    }

    private void Touch()
    {
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void AssignSite(
    Guid? siteId,
    Guid? siteLocationId = null)
{
    if (
        !siteId.HasValue
        &&
        siteLocationId.HasValue)
    {
        throw new InvalidOperationException(
            "No se puede asignar una ubicación sin una localidad.");
    }

    SiteId =
        siteId;

    SiteLocationId =
        siteLocationId;

    Touch();
}
}