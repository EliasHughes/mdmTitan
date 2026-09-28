using Microsoft.EntityFrameworkCore;
using TitanMDM.Application.Helpdesk;
using TitanMDM.Domain.Entities;
using TitanMDM.Infrastructure.Persistence;
using System.Security.Cryptography;
using System.Text;

namespace TitanMDM.Infrastructure.Helpdesk;

public sealed record IncomingHelpdeskEmail(
    string Mailbox,
    string InternetMessageId,
    string? ConversationId,
    string FromEmail,
    string? FromName,
    string Subject,
    string Body);

public sealed class HelpdeskEmailImportService
{
    private readonly TitanMdmDbContext _db;
    private readonly IHelpdeskService _tickets;

    public HelpdeskEmailImportService(
        TitanMdmDbContext db,
        IHelpdeskService tickets)
    {
        _db = db;
        _tickets = tickets;
    }

    public async Task<Guid> ImportAsync(
        Guid organizationId,
        Guid mailboxActorUserId,
        IncomingHelpdeskEmail message,
        CancellationToken cancellationToken = default)
    {
        if (organizationId == Guid.Empty ||
            mailboxActorUserId == Guid.Empty)
        {
            throw new ArgumentException(
                "Organization and mailbox actor are required.");
        }

       if (string.IsNullOrWhiteSpace(message.InternetMessageId) ||
    message.InternetMessageId.Trim().Length > 998 ||
    string.IsNullOrWhiteSpace(message.FromEmail) ||
    message.FromEmail.Trim().Length > 320 ||
    string.IsNullOrWhiteSpace(message.Mailbox) ||
    message.Mailbox.Trim().Length > 320 ||
    message.ConversationId?.Trim().Length > 512)
        {
            throw new ArgumentException(
                "Mail identity and sender are invalid.");
        }

        var mailbox = message.Mailbox.Trim().ToLowerInvariant();
        var fromEmail = message.FromEmail.Trim().ToLowerInvariant();
        var internetMessageId = message.InternetMessageId.Trim();

        var messageKey = Convert.ToHexString(
            SHA256.HashData(
                Encoding.UTF8.GetBytes(internetMessageId)));

        var subject = string.IsNullOrWhiteSpace(message.Subject)
            ? "Solicitud recibida por correo"
            : message.Subject.Trim();

        var body = string.IsNullOrWhiteSpace(message.Body)
            ? "Mensaje sin contenido de texto."
            : message.Body.Trim();

        subject = subject[..Math.Min(subject.Length, 250)];
        body = body[..Math.Min(body.Length, 4000)];

        await using var transaction =
            await _db.Database.BeginTransactionAsync(cancellationToken);

        var existing = await _db.HelpdeskEmailMessages
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.OrganizationId == organizationId &&
                     x.Mailbox == mailbox &&
                     x.MessageKey == messageKey,
                cancellationToken);

        if (existing is not null)
            return existing.TicketId;

        var actorExists = await _db.Users.AnyAsync(
            x => x.OrganizationId == organizationId &&
                 x.Id == mailboxActorUserId &&
                 x.IsActive,
            cancellationToken);

        if (!actorExists)
        {
            throw new InvalidOperationException(
                "El usuario técnico del buzón no existe o está inactivo.");
        }

        var requester = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.OrganizationId == organizationId &&
                     x.Email == fromEmail &&
                     x.IsActive,
                cancellationToken);

        HelpdeskTicket? ticket = null;

        if (!string.IsNullOrWhiteSpace(message.ConversationId))
        {
            var matchingIds = await _db.HelpdeskEmailMessages
                .AsNoTracking()
                .Where(x =>
                    x.OrganizationId == organizationId &&
                    x.Mailbox == mailbox &&
                    x.ConversationId == message.ConversationId)
                .Select(x => x.TicketId)
                .Distinct()
                .Take(2)
                .ToListAsync(cancellationToken);

            if (matchingIds.Count == 1)
            {
                ticket = await _db.HelpdeskTickets
                    .FirstOrDefaultAsync(
                        x => x.OrganizationId == organizationId &&
                             x.Id == matchingIds[0],
                        cancellationToken);
            }
        }

        if (ticket is null)
        {
            var created = await _tickets.CreateTicketAsync(
                organizationId,
                mailboxActorUserId,
                new CreateHelpdeskTicketRequest(
                    subject,
                    body,
                    "incident",
                    "medium",
                    "general",
                    "email",
                    null,
                    requester?.Id ?? mailboxActorUserId,
                    null),
                cancellationToken);

            ticket = await _db.HelpdeskTickets.FirstAsync(
                x => x.Id == created.Id,
                cancellationToken);

            ticket.SetEmailRequester(
                message.FromName ?? fromEmail,
                fromEmail);
        }
        else
        {
            var comment = new HelpdeskTicketComment(
                organizationId,
                ticket.Id,
                requester?.Id ?? mailboxActorUserId,
                body,
                false);

            comment.SetEmailAuthor(
                message.FromName ?? fromEmail,
                fromEmail);

            _db.HelpdeskTicketComments.Add(comment);

            _db.HelpdeskTicketEvents.Add(
                new HelpdeskTicketEvent(
                    organizationId,
                    ticket.Id,
                    mailboxActorUserId,
                    "email_reply",
                    $"Respuesta por correo de {fromEmail}."));

            if (ticket.Status == "new")
                ticket.Transition("open");
        }

        _db.HelpdeskEmailMessages.Add(
            new HelpdeskEmailMessage(
                organizationId,
                ticket.Id,
                mailbox,
                message.InternetMessageId,
                message.ConversationId));

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return ticket.Id;
    }
}