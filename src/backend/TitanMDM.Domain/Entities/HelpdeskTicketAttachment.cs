namespace TitanMDM.Domain.Entities;

public sealed class HelpdeskTicketAttachment
{
    private HelpdeskTicketAttachment()
    {
    }

    public HelpdeskTicketAttachment(
        Guid organizationId,
        Guid ticketId,
        Guid uploadedByUserId,
        string fileName,
        string storageName,
        string contentType,
        long sizeBytes,
        bool isInternal)
    {
        if (organizationId == Guid.Empty ||
            ticketId == Guid.Empty ||
            uploadedByUserId == Guid.Empty)
        {
            throw new ArgumentException(
                "Organización, ticket y usuario son obligatorios.");
        }

        if (string.IsNullOrWhiteSpace(fileName) ||
            string.IsNullOrWhiteSpace(storageName) ||
            sizeBytes <= 0)
        {
            throw new ArgumentException(
                "El archivo adjunto no es válido.");
        }

        Id = Guid.NewGuid();
        OrganizationId = organizationId;
        TicketId = ticketId;
        UploadedByUserId = uploadedByUserId;
        FileName = fileName.Trim();
        StorageName = storageName.Trim();
        ContentType = contentType.Trim();
        SizeBytes = sizeBytes;
        IsInternal = isInternal;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid OrganizationId { get; private set; }
    public Guid TicketId { get; private set; }
    public Guid UploadedByUserId { get; private set; }
    public string FileName { get; private set; } =
        string.Empty;
    public string StorageName { get; private set; } =
        string.Empty;
    public string ContentType { get; private set; } =
        string.Empty;
    public long SizeBytes { get; private set; }
    public bool IsInternal { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
}