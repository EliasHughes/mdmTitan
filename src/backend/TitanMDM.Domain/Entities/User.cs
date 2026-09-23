namespace TitanMDM.Domain.Entities;

public sealed class User
{
    private User()
    {
    }

    public User(
        Guid organizationId,
        string firstName,
        string lastName,
        string email)
    {
        if (organizationId == Guid.Empty)
            throw new ArgumentException(
                "OrganizationId is required.",
                nameof(organizationId));

        if (string.IsNullOrWhiteSpace(firstName))
            throw new ArgumentException(
                "First name is required.",
                nameof(firstName));

        if (string.IsNullOrWhiteSpace(lastName))
            throw new ArgumentException(
                "Last name is required.",
                nameof(lastName));

        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException(
                "Email is required.",
                nameof(email));

        Id = Guid.NewGuid();
        OrganizationId = organizationId;

        FirstName = firstName.Trim();
        LastName = lastName.Trim();
        Email = email.Trim().ToLowerInvariant();

        IsActive = true;
        MfaEnabled = false;

        CreatedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }

    public Guid OrganizationId { get; private set; }

    public Guid? DepartmentId { get; private set; }

    public string FirstName { get; private set; } = string.Empty;

    public string LastName { get; private set; } = string.Empty;

    public string Email { get; private set; } = string.Empty;

    public string? PasswordHash { get; private set; }

    public string? JobTitle { get; private set; }

    public bool IsActive { get; private set; }

    public bool MfaEnabled { get; private set; }

    public DateTime? LastLoginAtUtc { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    public DateTime UpdatedAtUtc { get; private set; }

    public string FullName =>
        $"{FirstName} {LastName}".Trim();

    /*
 * ================================================================
 * PROFILE
 * ================================================================
 */

public void UpdateProfile(
    string firstName,
    string lastName)
{
    if (
        string.IsNullOrWhiteSpace(
            firstName))
    {
        throw new ArgumentException(
            "First name is required.",
            nameof(firstName));
    }

    if (
        string.IsNullOrWhiteSpace(
            lastName))
    {
        throw new ArgumentException(
            "Last name is required.",
            nameof(lastName));
    }

    FirstName =
        firstName.Trim();

    LastName =
        lastName.Trim();

    UpdatedAtUtc =
        DateTime.UtcNow;
}

    public void SetDepartment(Guid? departmentId)
    {
        DepartmentId = departmentId;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SetJobTitle(string? jobTitle)
    {
        JobTitle = jobTitle?.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SetPasswordHash(string passwordHash)
    {
        if (string.IsNullOrWhiteSpace(passwordHash))
            throw new ArgumentException(
                "Password hash cannot be empty.",
                nameof(passwordHash));

        PasswordHash = passwordHash;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void EnableMfa()
    {
        MfaEnabled = true;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void DisableMfa()
    {
        MfaEnabled = false;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void RegisterLogin()
    {
        LastLoginAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Activate()
    {
        IsActive = true;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}