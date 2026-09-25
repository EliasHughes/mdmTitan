namespace TitanMDM.Domain.Entities;

public sealed class SoftwarePackage
{
    private SoftwarePackage()
    {
    }

    public SoftwarePackage(
        Guid organizationId,
        string name,
        string version,
        string packageType,
        string originalFileName,
        string storedFileName,
        string relativePath,
        string sha256,
        long sizeBytes,
        string? installArguments,
        Guid createdByUserId)
    {
        if (organizationId == Guid.Empty)
            throw new ArgumentException(
                "OrganizationId is required.");

        if (createdByUserId == Guid.Empty)
            throw new ArgumentException(
                "CreatedByUserId is required.");

        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException(
                "Name is required.");

        if (string.IsNullOrWhiteSpace(version))
            throw new ArgumentException(
                "Version is required.");

        if (string.IsNullOrWhiteSpace(packageType))
            throw new ArgumentException(
                "PackageType is required.");

        if (string.IsNullOrWhiteSpace(originalFileName))
            throw new ArgumentException(
                "OriginalFileName is required.");

        if (string.IsNullOrWhiteSpace(storedFileName))
            throw new ArgumentException(
                "StoredFileName is required.");

        if (string.IsNullOrWhiteSpace(relativePath))
            throw new ArgumentException(
                "RelativePath is required.");

        if (string.IsNullOrWhiteSpace(sha256))
            throw new ArgumentException(
                "Sha256 is required.");

        Id = Guid.NewGuid();

        OrganizationId = organizationId;

        Name = name.Trim();

        Version = version.Trim();

        PackageType =
            packageType
                .Trim()
                .ToUpperInvariant();

        OriginalFileName =
            originalFileName.Trim();

        StoredFileName =
            storedFileName.Trim();

        RelativePath =
            relativePath.Trim();

        Sha256 =
            sha256
                .Trim()
                .ToUpperInvariant();

        SizeBytes =
            Math.Max(
                sizeBytes,
                0);

        InstallArguments =
            Normalize(
                installArguments);

        CreatedByUserId =
            createdByUserId;

        IsActive = true;

        CreatedAtUtc =
            DateTime.UtcNow;

        UpdatedAtUtc =
            DateTime.UtcNow;
    }

    public Guid Id { get; private set; }

    public Guid OrganizationId
    {
        get;
        private set;
    }

    public string Name
    {
        get;
        private set;
    } = string.Empty;

    public string Version
    {
        get;
        private set;
    } = string.Empty;

    public string PackageType
    {
        get;
        private set;
    } = string.Empty;

    public string OriginalFileName
    {
        get;
        private set;
    } = string.Empty;

    public string StoredFileName
    {
        get;
        private set;
    } = string.Empty;

    public string RelativePath
    {
        get;
        private set;
    } = string.Empty;

    public string Sha256
    {
        get;
        private set;
    } = string.Empty;

    public long SizeBytes
    {
        get;
        private set;
    }

    public string? InstallArguments
    {
        get;
        private set;
    }

    public Guid CreatedByUserId
    {
        get;
        private set;
    }

    public bool IsActive
    {
        get;
        private set;
    }

    public DateTime CreatedAtUtc
    {
        get;
        private set;
    }

    public DateTime UpdatedAtUtc
    {
        get;
        private set;
    }

    public void Disable()
    {
        IsActive = false;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Enable()
    {
        IsActive = true;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    private static string? Normalize(
        string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }
}