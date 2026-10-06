namespace TitanMDM.Domain.Entities;

public sealed class HelpdeskMailSettings
{
    private HelpdeskMailSettings()
    {
    }

    public HelpdeskMailSettings(
        Guid organizationId)
    {
        if (organizationId ==
            Guid.Empty)
        {
            throw new ArgumentException(
                "OrganizationId is required.",
                nameof(organizationId));
        }

        OrganizationId =
            organizationId;

        InboundEnabled =
            false;

        OutboundEnabled =
            false;

        InboundPollSeconds =
            60;

        OutboundPollSeconds =
            20;

        BatchSize =
            25;

        MaxAttempts =
            8;

        Revision =
            0;

        UpdatedAtUtc =
            DateTime.UtcNow;
    }

    public Guid OrganizationId
    {
        get;
        private set;
    }

    public string? Mailbox
    {
        get;
        private set;
    }

    /*
     * Usuario técnico utilizado como actor
     * para tickets creados desde correo.
     */
    public Guid? ActorUserId
    {
        get;
        private set;
    }

    public bool InboundEnabled
    {
        get;
        private set;
    }

    public bool OutboundEnabled
    {
        get;
        private set;
    }

    public int InboundPollSeconds
    {
        get;
        private set;
    }

    public int OutboundPollSeconds
    {
        get;
        private set;
    }

    public int BatchSize
    {
        get;
        private set;
    }

    public int MaxAttempts
    {
        get;
        private set;
    }

    // ============================================================
    // INBOUND RUNTIME STATUS
    // ============================================================

    public DateTime? LastInboundAttemptAtUtc
    {
        get;
        private set;
    }

    public DateTime? LastInboundSuccessAtUtc
    {
        get;
        private set;
    }

    public string? LastInboundError
    {
        get;
        private set;
    }

    // ============================================================
    // OUTBOUND RUNTIME STATUS
    // ============================================================

    public DateTime? LastOutboundAttemptAtUtc
    {
        get;
        private set;
    }

    public DateTime? LastOutboundSuccessAtUtc
    {
        get;
        private set;
    }

    public string? LastOutboundError
    {
        get;
        private set;
    }

    public int Revision
    {
        get;
        private set;
    }

    public DateTime UpdatedAtUtc
    {
        get;
        private set;
    }

    // ============================================================
    // CONFIGURATION
    // ============================================================

    public void Configure(
        string? mailbox,
        Guid? actorUserId,
        bool inboundEnabled,
        bool outboundEnabled,
        int inboundPollSeconds,
        int outboundPollSeconds,
        int batchSize,
        int maxAttempts)
    {
        var normalizedMailbox =
            string.IsNullOrWhiteSpace(
                mailbox)
                ? null
                : mailbox
                    .Trim()
                    .ToLowerInvariant();

        if (normalizedMailbox is not null &&
            normalizedMailbox.Length >
                320)
        {
            throw new ArgumentException(
                "El correo del buzón no puede exceder 320 caracteres.");
        }

        if ((inboundEnabled ||
             outboundEnabled)
            &&
            string.IsNullOrWhiteSpace(
                normalizedMailbox))
        {
            throw new ArgumentException(
                "Debes configurar el buzón antes de habilitar el correo.");
        }

        if (inboundEnabled &&
            (
                !actorUserId.HasValue
                ||
                actorUserId.Value ==
                    Guid.Empty
            ))
        {
            throw new ArgumentException(
                "Debes seleccionar un usuario técnico para procesar el correo entrante.");
        }

        if (inboundPollSeconds
            is < 30 or > 3600)
        {
            throw new ArgumentException(
                "El intervalo de correo entrante debe estar entre 30 y 3600 segundos.");
        }

        if (outboundPollSeconds
            is < 10 or > 3600)
        {
            throw new ArgumentException(
                "El intervalo de correo saliente debe estar entre 10 y 3600 segundos.");
        }

        if (batchSize
            is < 1 or > 100)
        {
            throw new ArgumentException(
                "El tamaño de lote debe estar entre 1 y 100.");
        }

        if (maxAttempts
            is < 1 or > 20)
        {
            throw new ArgumentException(
                "Los reintentos deben estar entre 1 y 20.");
        }

        Mailbox =
            normalizedMailbox;

        ActorUserId =
            actorUserId;

        InboundEnabled =
            inboundEnabled;

        OutboundEnabled =
            outboundEnabled;

        InboundPollSeconds =
            inboundPollSeconds;

        OutboundPollSeconds =
            outboundPollSeconds;

        BatchSize =
            batchSize;

        MaxAttempts =
            maxAttempts;

        Revision++;

        UpdatedAtUtc =
            DateTime.UtcNow;
    }

    // ============================================================
    // RUNTIME STATUS
    // ============================================================

    public void MarkInboundAttempt()
    {
        LastInboundAttemptAtUtc =
            DateTime.UtcNow;
    }

    public void MarkInboundSuccess()
    {
        var now =
            DateTime.UtcNow;

        LastInboundAttemptAtUtc =
            now;

        LastInboundSuccessAtUtc =
            now;

        LastInboundError =
            null;
    }

    public void MarkInboundFailure(
        string? error)
    {
        LastInboundAttemptAtUtc =
            DateTime.UtcNow;

        LastInboundError =
            NormalizeError(
                error);
    }

    public void MarkOutboundAttempt()
    {
        LastOutboundAttemptAtUtc =
            DateTime.UtcNow;
    }

    public void MarkOutboundSuccess()
    {
        var now =
            DateTime.UtcNow;

        LastOutboundAttemptAtUtc =
            now;

        LastOutboundSuccessAtUtc =
            now;

        LastOutboundError =
            null;
    }

    public void MarkOutboundFailure(
        string? error)
    {
        LastOutboundAttemptAtUtc =
            DateTime.UtcNow;

        LastOutboundError =
            NormalizeError(
                error);
    }

    private static string NormalizeError(
        string? value)
    {
        var result =
            string.IsNullOrWhiteSpace(
                value)
                ? "Error desconocido."
                : value.Trim();

        return result[
            ..Math.Min(
                result.Length,
                2000)];
    }
}