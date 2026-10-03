using System.Security.Cryptography;
using System.Text;

using Microsoft.EntityFrameworkCore;

using TitanMDM.Application.Helpdesk;
using TitanMDM.Domain.Entities;
using TitanMDM.Domain.Helpdesk;
using TitanMDM.Infrastructure.Persistence;

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
        ValidateInput(
            organizationId,
            mailboxActorUserId,
            message);

        var mailbox =
            NormalizeEmail(message.Mailbox);

        var fromEmail =
            NormalizeEmail(message.FromEmail);

        var internetMessageId =
            message.InternetMessageId
                .Trim();

        var conversationId =
            string.IsNullOrWhiteSpace(
                message.ConversationId)
                ? null
                : message.ConversationId.Trim();

        var messageKey =
            ComputeMessageKey(
                internetMessageId);

        var subject =
            NormalizeSubject(
                message.Subject);

        var body =
            NormalizeBody(
                message.Body);

        /*
         * ============================================================
         * FAST IDEMPOTENCY CHECK
         * ============================================================
         *
         * Este check evita trabajo innecesario en la mayoría
         * de los casos.
         *
         * NO sustituye la protección definitiva del índice único.
         */
        var alreadyImported =
            await FindImportedMessageAsync(
                organizationId,
                mailbox,
                messageKey,
                cancellationToken);

        if (alreadyImported is not null)
        {
            return alreadyImported.TicketId;
        }

        /*
         * ============================================================
         * VALIDATE MAILBOX ACTOR
         * ============================================================
         */

        var mailboxActorExists =
            await _db.Users
                .AsNoTracking()
                .AnyAsync(
                    x =>
                        x.OrganizationId ==
                            organizationId
                        &&
                        x.Id ==
                            mailboxActorUserId
                        &&
                        x.IsActive,
                    cancellationToken);

        if (!mailboxActorExists)
        {
            throw new InvalidOperationException(
                "El usuario técnico del buzón no existe o está inactivo.");
        }

        /*
         * ============================================================
         * RESOLVE REQUESTER
         * ============================================================
         */

        var requester =
            await _db.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x =>
                        x.OrganizationId ==
                            organizationId
                        &&
                        x.Email ==
                            fromEmail
                        &&
                        x.IsActive,
                    cancellationToken);

        await using var transaction =
            await _db.Database
                .BeginTransactionAsync(
                    cancellationToken);

        try
        {
            /*
             * Segundo check dentro de transacción.
             *
             * Reduce aún más la ventana de carrera antes
             * de intentar crear el registro.
             */
            var existingInsideTransaction =
                await FindImportedMessageAsync(
                    organizationId,
                    mailbox,
                    messageKey,
                    cancellationToken);

            if (existingInsideTransaction is not null)
            {
                await transaction.CommitAsync(
                    cancellationToken);

                return existingInsideTransaction.TicketId;
            }

            /*
             * ========================================================
             * LOCATE THREAD / TICKET
             * ========================================================
             */

            var ticket =
                await ResolveExistingTicketAsync(
                    organizationId,
                    mailbox,
                    conversationId,
                    cancellationToken);

            var isNewTicket =
                ticket is null;

            /*
             * ========================================================
             * CREATE NEW TICKET
             * ========================================================
             */

            if (ticket is null)
            {
                var created =
                    await _tickets
                        .CreateTicketAsync(
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
                                requester?.Id
                                    ?? mailboxActorUserId,
                                null),
                            cancellationToken);

                ticket =
                    await _db.HelpdeskTickets
                        .FirstAsync(
                            x =>
                                x.OrganizationId ==
                                    organizationId
                                &&
                                x.Id ==
                                    created.Id,
                            cancellationToken);

                ticket.SetEmailRequester(
                    message.FromName
                        ?? fromEmail,
                    fromEmail);

                _db.HelpdeskTicketEvents.Add(
                    new HelpdeskTicketEvent(
                        organizationId,
                        ticket.Id,
                        mailboxActorUserId,
                        "email_received",
                        $"Ticket creado desde correo de {fromEmail}."));
            }
            else
            {
                /*
                 * ====================================================
                 * EXISTING CONVERSATION -> PUBLIC COMMENT
                 * ====================================================
                 */

                var comment =
                    new HelpdeskTicketComment(
                        organizationId,
                        ticket.Id,
                        requester?.Id
                            ?? mailboxActorUserId,
                        body,
                        false);

                comment.SetEmailAuthor(
                    message.FromName
                        ?? fromEmail,
                    fromEmail);

                _db.HelpdeskTicketComments.Add(
                    comment);

                _db.HelpdeskTicketEvents.Add(
                    new HelpdeskTicketEvent(
                        organizationId,
                        ticket.Id,
                        mailboxActorUserId,
                        "email_reply",
                        $"Respuesta por correo de {fromEmail}."));

                /*
                 * ====================================================
                 * EMAIL CONTINUITY STATE RULES
                 * ====================================================
                 *
                 * Una respuesta del usuario significa que el caso
                 * vuelve a requerir atención.
                 */

                switch (ticket.Status)
                {
                    case HelpdeskTicketStatus.New:
                        ticket.Transition(
                            HelpdeskTicketStatus.Open);
                        break;

                    case HelpdeskTicketStatus.PendingUser:
                        ticket.Transition(
                            HelpdeskTicketStatus.Open);
                        break;

                    case HelpdeskTicketStatus.Resolved:
                    case HelpdeskTicketStatus.Closed:
                        ticket.Reopen();

                        _db.HelpdeskTicketEvents.Add(
                            new HelpdeskTicketEvent(
                                organizationId,
                                ticket.Id,
                                mailboxActorUserId,
                                "reopened_by_email",
                                "Ticket reabierto automáticamente por una respuesta de correo."));
                        break;

                    case HelpdeskTicketStatus.Open:
                    case HelpdeskTicketStatus.InProgress:
                        /*
                         * Ya está activo.
                         * No modificamos estado.
                         */
                        break;

                    default:
                        throw new InvalidOperationException(
                            $"Estado de Helpdesk inesperado: '{ticket.Status}'.");
                }
            }

            /*
             * ========================================================
             * REGISTER EMAIL IDENTITY
             * ========================================================
             *
             * Este registro es la fuente de idempotencia.
             */

            _db.HelpdeskEmailMessages.Add(
                new HelpdeskEmailMessage(
                    organizationId,
                    ticket.Id,
                    mailbox,
                    internetMessageId,
                    conversationId));

            await _db.SaveChangesAsync(
                cancellationToken);

            await transaction.CommitAsync(
                cancellationToken);

            return ticket.Id;
        }
        catch (DbUpdateException)
        {
            /*
             * ========================================================
             * CONCURRENT DUPLICATE PROTECTION
             * ========================================================
             *
             * Si dos workers procesan el mismo internetMessageId
             * simultáneamente, el índice único decide el ganador.
             *
             * Después del rollback comprobamos si el mensaje
             * ya quedó registrado por otra ejecución.
             */

            await transaction.RollbackAsync(
                CancellationToken.None);

            _db.ChangeTracker.Clear();

            var winner =
                await FindImportedMessageAsync(
                    organizationId,
                    mailbox,
                    messageKey,
                    cancellationToken);

            if (winner is not null)
            {
                return winner.TicketId;
            }

            throw;
        }
        catch
        {
            await transaction.RollbackAsync(
                CancellationToken.None);

            throw;
        }
    }

    private async Task<HelpdeskTicket?>
        ResolveExistingTicketAsync(
            Guid organizationId,
            string mailbox,
            string? conversationId,
            CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(
                conversationId))
        {
            return null;
        }

        /*
         * Una ConversationId debería pertenecer a un único ticket.
         *
         * Take(2) permite detectar inconsistencia de datos sin
         * cargar un conjunto innecesario.
         */
        var matchingTicketIds =
            await _db.HelpdeskEmailMessages
                .AsNoTracking()
                .Where(
                    x =>
                        x.OrganizationId ==
                            organizationId
                        &&
                        x.Mailbox ==
                            mailbox
                        &&
                        x.ConversationId ==
                            conversationId)
                .Select(
                    x =>
                        x.TicketId)
                .Distinct()
                .Take(2)
                .ToListAsync(
                    cancellationToken);

        if (matchingTicketIds.Count == 0)
        {
            return null;
        }

        if (matchingTicketIds.Count > 1)
        {
            throw new InvalidOperationException(
                "Una conversación de correo está asociada a más de un ticket. " +
                "Se requiere revisión administrativa.");
        }

        return await _db.HelpdeskTickets
            .FirstOrDefaultAsync(
                x =>
                    x.OrganizationId ==
                        organizationId
                    &&
                    x.Id ==
                        matchingTicketIds[0],
                cancellationToken);
    }

    private async Task<HelpdeskEmailMessage?>
        FindImportedMessageAsync(
            Guid organizationId,
            string mailbox,
            string messageKey,
            CancellationToken cancellationToken)
    {
        return await _db.HelpdeskEmailMessages
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x =>
                    x.OrganizationId ==
                        organizationId
                    &&
                    x.Mailbox ==
                        mailbox
                    &&
                    x.MessageKey ==
                        messageKey,
                cancellationToken);
    }

    private static void ValidateInput(
        Guid organizationId,
        Guid mailboxActorUserId,
        IncomingHelpdeskEmail message)
    {
        if (organizationId == Guid.Empty)
        {
            throw new ArgumentException(
                "OrganizationId is required.",
                nameof(organizationId));
        }

        if (mailboxActorUserId == Guid.Empty)
        {
            throw new ArgumentException(
                "Mailbox actor user is required.",
                nameof(mailboxActorUserId));
        }

        if (message is null)
        {
            throw new ArgumentNullException(
                nameof(message));
        }

        if (
            string.IsNullOrWhiteSpace(
                message.InternetMessageId)
            ||
            message.InternetMessageId
                .Trim()
                .Length >
                998)
        {
            throw new ArgumentException(
                "InternetMessageId inválido.",
                nameof(message));
        }

        if (
            string.IsNullOrWhiteSpace(
                message.FromEmail)
            ||
            message.FromEmail
                .Trim()
                .Length >
                320)
        {
            throw new ArgumentException(
                "Correo del remitente inválido.",
                nameof(message));
        }

        if (
            string.IsNullOrWhiteSpace(
                message.Mailbox)
            ||
            message.Mailbox
                .Trim()
                .Length >
                320)
        {
            throw new ArgumentException(
                "Buzón Helpdesk inválido.",
                nameof(message));
        }

        if (
            message.ConversationId?
                .Trim()
                .Length >
                512)
        {
            throw new ArgumentException(
                "ConversationId inválido.",
                nameof(message));
        }
    }

    private static string NormalizeEmail(
        string value)
    {
        return value
            .Trim()
            .ToLowerInvariant();
    }

    private static string NormalizeSubject(
        string? value)
    {
        var subject =
            string.IsNullOrWhiteSpace(
                value)
                ? "Solicitud recibida por correo"
                : value.Trim();

        return subject[
            ..Math.Min(
                subject.Length,
                250)];
    }

    private static string NormalizeBody(
        string? value)
    {
        var body =
            string.IsNullOrWhiteSpace(
                value)
                ? "Mensaje sin contenido de texto."
                : value.Trim();

        return body[
            ..Math.Min(
                body.Length,
                4000)];
    }

    private static string ComputeMessageKey(
        string internetMessageId)
    {
        return Convert.ToHexString(
            SHA256.HashData(
                Encoding.UTF8.GetBytes(
                    internetMessageId)));
    }
}