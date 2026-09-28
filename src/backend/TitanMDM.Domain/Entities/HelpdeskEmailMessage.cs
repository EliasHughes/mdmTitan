namespace TitanMDM.Domain.Entities;

public sealed class HelpdeskEmailMessage
{
    private HelpdeskEmailMessage()
    {
    }

    public HelpdeskEmailMessage(
        Guid organizationId,
        Guid ticketId,
        string mailbox,
        string internetMessageId,
        string? conversationId)
    {
        if (organizationId == Guid.Empty || ticketId == Guid.Empty)
            throw new ArgumentException(
                "Organization and ticket are required.");

        if (string.IsNullOrWhiteSpace(mailbox) ||
            string.IsNullOrWhiteSpace(internetMessageId))
            throw new ArgumentException(
                "Mailbox and message ID are required.");

        Id = Guid.NewGuid();
        OrganizationId = organizationId;
        TicketId = ticketId;
        Mailbox = mailbox.Trim().ToLowerInvariant();
        InternetMessageId = internetMessageId.Trim();
        ConversationId = string.IsNullOrWhiteSpace(conversationId)
            ? null
            : conversationId.Trim();
        ImportedAtUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid OrganizationId { get; private set; }
    public Guid TicketId { get; private set; }
    public string Mailbox { get; private set; } = string.Empty;
    public string InternetMessageId { get; private set; } = string.Empty;
    public string? ConversationId { get; private set; }
    public DateTime ImportedAtUtc { get; private set; }
}