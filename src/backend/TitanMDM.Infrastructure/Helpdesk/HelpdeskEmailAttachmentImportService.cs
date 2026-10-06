using System.Security.Cryptography;
using System.Text;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

using TitanMDM.Domain.Entities;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Infrastructure.Helpdesk;

public sealed record IncomingHelpdeskAttachment(
    string SourceId,
    string FileName,
    string ContentType,
    byte[] Content);

public sealed class HelpdeskEmailAttachmentImportService
{
    public const long MaxAttachmentBytes =
        10L * 1024L * 1024L;

    private readonly TitanMdmDbContext
        _db;

    private readonly string
        _root;

    public HelpdeskEmailAttachmentImportService(
        TitanMdmDbContext db,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        _db =
            db;

        var configured =
            configuration[
                "HelpdeskAttachments:StoragePath"];

        _root =
            string.IsNullOrWhiteSpace(
                configured)
                ? Path.Combine(
                    environment.ContentRootPath,
                    "App_Data",
                    "helpdesk-attachments")
                : Path.GetFullPath(
                    configured);
    }

    public async Task<int> ImportAsync(
        Guid organizationId,
        Guid ticketId,
        Guid uploadedByUserId,
        string internetMessageId,
        IReadOnlyCollection<
            IncomingHelpdeskAttachment> attachments,
        CancellationToken cancellationToken = default)
    {
        if (organizationId ==
            Guid.Empty)
        {
            throw new ArgumentException(
                "OrganizationId is required.",
                nameof(organizationId));
        }

        if (ticketId ==
            Guid.Empty)
        {
            throw new ArgumentException(
                "TicketId is required.",
                nameof(ticketId));
        }

        if (uploadedByUserId ==
            Guid.Empty)
        {
            throw new ArgumentException(
                "UploadedByUserId is required.",
                nameof(uploadedByUserId));
        }

        if (string.IsNullOrWhiteSpace(
                internetMessageId))
        {
            throw new ArgumentException(
                "InternetMessageId is required.",
                nameof(internetMessageId));
        }

        if (attachments is null ||
            attachments.Count == 0)
        {
            return 0;
        }

        var ticketExists =
            await _db.HelpdeskTickets
                .AsNoTracking()
                .AnyAsync(
                    x =>
                        x.OrganizationId ==
                            organizationId
                        &&
                        x.Id ==
                            ticketId,
                    cancellationToken);

        if (!ticketExists)
        {
            throw new InvalidOperationException(
                "El ticket asociado al correo no existe.");
        }

        var directory =
            Path.Combine(
                _root,
                organizationId
                    .ToString("N"),
                ticketId
                    .ToString("N"));

        Directory.CreateDirectory(
            directory);

        var imported =
            0;

        foreach (var attachment
                 in attachments)
        {
            cancellationToken
                .ThrowIfCancellationRequested();

            if (attachment.Content is null ||
                attachment.Content.LongLength <= 0 ||
                attachment.Content.LongLength >
                    MaxAttachmentBytes)
            {
                continue;
            }

            var normalized =
                NormalizeAttachment(
                    attachment);

            if (normalized is null)
            {
                continue;
            }

            /*
             * StorageName is deterministic.
             *
             * Same email + same Graph attachment id =
             * same StorageName.
             *
             * This protects us against duplicate delta delivery.
             */
            var storageName =
                BuildStorageName(
                    internetMessageId,
                    attachment.SourceId);

            var alreadyExists =
                await _db
                    .Set<HelpdeskTicketAttachment>()
                    .AsNoTracking()
                    .AnyAsync(
                        x =>
                            x.OrganizationId ==
                                organizationId
                            &&
                            x.TicketId ==
                                ticketId
                            &&
                            x.StorageName ==
                                storageName,
                        cancellationToken);

            if (alreadyExists)
            {
                continue;
            }

            var path =
                Path.Combine(
                    directory,
                    storageName);

            /*
             * Validate bytes BEFORE writing them permanently.
             */
            if (!HasValidSignature(
                    normalized.Extension,
                    attachment.Content))
            {
                continue;
            }

            var createdFile =
                false;

            try
            {
                /*
                 * CreateNew prevents overwriting an attachment
                 * if another worker gets here first.
                 */
                try
                {
                    await using var stream =
                        new FileStream(
                            path,
                            FileMode.CreateNew,
                            FileAccess.Write,
                            FileShare.None,
                            bufferSize:
                                81920,
                            useAsync:
                                true);

                    await stream.WriteAsync(
                        attachment.Content,
                        cancellationToken);

                    createdFile =
                        true;
                }
                catch (IOException)
                {
                    /*
                     * Another worker may already have written
                     * the deterministic file.
                     */
                }

                var duplicateAfterWrite =
                    await _db
                        .Set<HelpdeskTicketAttachment>()
                        .AsNoTracking()
                        .AnyAsync(
                            x =>
                                x.OrganizationId ==
                                    organizationId
                                &&
                                x.TicketId ==
                                    ticketId
                                &&
                                x.StorageName ==
                                    storageName,
                            cancellationToken);

                if (duplicateAfterWrite)
                {
                    continue;
                }

                if (!File.Exists(
                        path))
                {
                    continue;
                }

                var entity =
                    new HelpdeskTicketAttachment(
                        organizationId,
                        ticketId,
                        uploadedByUserId,
                        normalized.FileName,
                        storageName,
                        normalized.ContentType,
                        attachment.Content
                            .LongLength,
                        isInternal:
                            false);

                _db.Set<
                        HelpdeskTicketAttachment>()
                    .Add(
                        entity);

                _db.HelpdeskTicketEvents
                    .Add(
                        new HelpdeskTicketEvent(
                            organizationId,
                            ticketId,
                            uploadedByUserId,
                            "attachment_received_by_email",
                            $"Adjunto recibido por correo: {normalized.FileName}."));

                try
                {
                    await _db.SaveChangesAsync(
                        cancellationToken);

                    imported++;
                }
                catch (DbUpdateException)
                {
                    /*
                     * Unique StorageName wins if another worker
                     * inserted it concurrently.
                     */
                    _db.ChangeTracker
                        .Clear();

                    var winner =
                        await _db
                            .Set<HelpdeskTicketAttachment>()
                            .AsNoTracking()
                            .AnyAsync(
                                x =>
                                    x.OrganizationId ==
                                        organizationId
                                    &&
                                    x.TicketId ==
                                        ticketId
                                    &&
                                    x.StorageName ==
                                        storageName,
                                cancellationToken);

                    if (!winner)
                    {
                        throw;
                    }
                }
            }
            catch
            {
                /*
                 * Remove orphan file only if no DB row exists.
                 */
                if (createdFile)
                {
                    var persisted =
                        await _db
                            .Set<HelpdeskTicketAttachment>()
                            .AsNoTracking()
                            .AnyAsync(
                                x =>
                                    x.OrganizationId ==
                                        organizationId
                                    &&
                                    x.TicketId ==
                                        ticketId
                                    &&
                                    x.StorageName ==
                                        storageName,
                                CancellationToken.None);

                    if (!persisted &&
                        File.Exists(
                            path))
                    {
                        File.Delete(
                            path);
                    }
                }

                throw;
            }
        }

        return imported;
    }

    private static NormalizedAttachment?
        NormalizeAttachment(
            IncomingHelpdeskAttachment attachment)
    {
        if (string.IsNullOrWhiteSpace(
                attachment.FileName)
            ||
            string.IsNullOrWhiteSpace(
                attachment.SourceId))
        {
            return null;
        }

        var fileName =
            Path.GetFileName(
                attachment.FileName)
                .Trim();

        if (string.IsNullOrWhiteSpace(
                fileName))
        {
            return null;
        }

        if (fileName.Length >
            180)
        {
            fileName =
                fileName[
                    ^180..];
        }

        var extension =
            Path.GetExtension(
                    fileName)
                .ToLowerInvariant();

        var contentType =
            extension switch
            {
                ".pdf" =>
                    "application/pdf",

                ".png" =>
                    "image/png",

                ".jpg" or ".jpeg" =>
                    "image/jpeg",

                _ =>
                    null
            };

        if (contentType is null)
        {
            return null;
        }

        return new NormalizedAttachment(
            fileName,
            extension,
            contentType);
    }

    private static string BuildStorageName(
        string internetMessageId,
        string sourceId)
    {
        var source =
            $"{internetMessageId.Trim()}|{sourceId.Trim()}";

        var hash =
            Convert.ToHexString(
                SHA256.HashData(
                    Encoding.UTF8.GetBytes(
                        source)));

        /*
         * 64 chars + ".bin" = 68.
         * Column supports 80.
         */
        return hash +
               ".bin";
    }

    private static bool HasValidSignature(
        string extension,
        byte[] bytes)
    {
        if (bytes.Length <
            3)
        {
            return false;
        }

        return extension switch
        {
            ".pdf" =>
                bytes.Length >=
                    5
                &&
                bytes.AsSpan(
                        0,
                        5)
                    .SequenceEqual(
                        "%PDF-"u8),

            ".png" =>
                bytes.Length >=
                    8
                &&
                bytes.AsSpan(
                        0,
                        8)
                    .SequenceEqual(
                        new byte[]
                        {
                            137,
                            80,
                            78,
                            71,
                            13,
                            10,
                            26,
                            10
                        }),

            ".jpg" or ".jpeg" =>
                bytes[0] ==
                    0xFF
                &&
                bytes[1] ==
                    0xD8
                &&
                bytes[2] ==
                    0xFF,

            _ =>
                false
        };
    }

    private sealed record NormalizedAttachment(
        string FileName,
        string Extension,
        string ContentType);
}