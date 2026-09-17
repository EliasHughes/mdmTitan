namespace TitanMDM.Domain.Entities;

public sealed class Role
{
    private Role()
    {
    }

    public Role(
        Guid organizationId,
        string name)
    {
        if (organizationId == Guid.Empty)
            throw new ArgumentException(
                "OrganizationId is required.",
                nameof(organizationId));

        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException(
                "Role name is required.",
                nameof(name));

        Id = Guid.NewGuid();
        OrganizationId = organizationId;

        Name = name.Trim();

        IsSystemRole = false;
        IsActive = true;

        CreatedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }

    public Guid OrganizationId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public string? Description { get; private set; }

    public bool IsSystemRole { get; private set; }

    public bool IsActive { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    public DateTime UpdatedAtUtc { get; private set; }

    public void SetDescription(string? description)
    {
        Description = description?.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkAsSystemRole()
    {
        IsSystemRole = true;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}