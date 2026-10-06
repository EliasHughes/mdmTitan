using TitanMDM.Domain.Entities;

namespace TitanMDM.UnitTests;

public sealed class HelpdeskMailSettingsTests
{
    [Fact]
    public void Constructor_ShouldCreateSafeDefaults()
    {
        var organizationId =
            Guid.NewGuid();

        var settings =
            new HelpdeskMailSettings(
                organizationId);

        Assert.Equal(
            organizationId,
            settings.OrganizationId);

        Assert.False(
            settings.InboundEnabled);

        Assert.False(
            settings.OutboundEnabled);

        Assert.Equal(
            60,
            settings.InboundPollSeconds);

        Assert.Equal(
            20,
            settings.OutboundPollSeconds);

        Assert.Equal(
            25,
            settings.BatchSize);

        Assert.Equal(
            8,
            settings.MaxAttempts);

        Assert.Equal(
            0,
            settings.Revision);

        Assert.Null(
            settings.Mailbox);

        Assert.Null(
            settings.ActorUserId);
    }

    [Fact]
    public void Configure_ShouldNormalizeMailbox()
    {
        var settings =
            new HelpdeskMailSettings(
                Guid.NewGuid());

        settings.Configure(
            " HELPDESK@EXAMPLE.COM ",
            Guid.NewGuid(),
            inboundEnabled: true,
            outboundEnabled: true,
            inboundPollSeconds: 60,
            outboundPollSeconds: 20,
            batchSize: 25,
            maxAttempts: 8);

        Assert.Equal(
            "helpdesk@example.com",
            settings.Mailbox);
    }

    [Fact]
    public void Configure_ShouldIncrementRevision()
    {
        var settings =
            new HelpdeskMailSettings(
                Guid.NewGuid());

        settings.Configure(
            "helpdesk@example.com",
            Guid.NewGuid(),
            inboundEnabled: true,
            outboundEnabled: true,
            inboundPollSeconds: 60,
            outboundPollSeconds: 20,
            batchSize: 25,
            maxAttempts: 8);

        Assert.Equal(
            1,
            settings.Revision);

        settings.Configure(
            "helpdesk@example.com",
            Guid.NewGuid(),
            inboundEnabled: true,
            outboundEnabled: true,
            inboundPollSeconds: 90,
            outboundPollSeconds: 30,
            batchSize: 50,
            maxAttempts: 10);

        Assert.Equal(
            2,
            settings.Revision);
    }

    [Fact]
    public void EnabledMail_ShouldRequireMailbox()
    {
        var settings =
            new HelpdeskMailSettings(
                Guid.NewGuid());

        Assert.Throws<
            ArgumentException>(
            () =>
                settings.Configure(
                    null,
                    Guid.NewGuid(),
                    inboundEnabled: true,
                    outboundEnabled: false,
                    inboundPollSeconds: 60,
                    outboundPollSeconds: 20,
                    batchSize: 25,
                    maxAttempts: 8));
    }

    [Fact]
    public void InboundMail_ShouldRequireActor()
    {
        var settings =
            new HelpdeskMailSettings(
                Guid.NewGuid());

        Assert.Throws<
            ArgumentException>(
            () =>
                settings.Configure(
                    "helpdesk@example.com",
                    null,
                    inboundEnabled: true,
                    outboundEnabled: false,
                    inboundPollSeconds: 60,
                    outboundPollSeconds: 20,
                    batchSize: 25,
                    maxAttempts: 8));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(29)]
    [InlineData(3601)]
    public void InvalidInboundPoll_ShouldFail(
        int seconds)
    {
        var settings =
            new HelpdeskMailSettings(
                Guid.NewGuid());

        Assert.Throws<
            ArgumentException>(
            () =>
                settings.Configure(
                    "helpdesk@example.com",
                    Guid.NewGuid(),
                    inboundEnabled: true,
                    outboundEnabled: true,
                    inboundPollSeconds: seconds,
                    outboundPollSeconds: 20,
                    batchSize: 25,
                    maxAttempts: 8));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(9)]
    [InlineData(3601)]
    public void InvalidOutboundPoll_ShouldFail(
        int seconds)
    {
        var settings =
            new HelpdeskMailSettings(
                Guid.NewGuid());

        Assert.Throws<
            ArgumentException>(
            () =>
                settings.Configure(
                    "helpdesk@example.com",
                    Guid.NewGuid(),
                    inboundEnabled: true,
                    outboundEnabled: true,
                    inboundPollSeconds: 60,
                    outboundPollSeconds: seconds,
                    batchSize: 25,
                    maxAttempts: 8));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(101)]
    public void InvalidBatchSize_ShouldFail(
        int batchSize)
    {
        var settings =
            new HelpdeskMailSettings(
                Guid.NewGuid());

        Assert.Throws<
            ArgumentException>(
            () =>
                settings.Configure(
                    "helpdesk@example.com",
                    Guid.NewGuid(),
                    inboundEnabled: true,
                    outboundEnabled: true,
                    inboundPollSeconds: 60,
                    outboundPollSeconds: 20,
                    batchSize: batchSize,
                    maxAttempts: 8));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(21)]
    public void InvalidMaxAttempts_ShouldFail(
        int maxAttempts)
    {
        var settings =
            new HelpdeskMailSettings(
                Guid.NewGuid());

        Assert.Throws<
            ArgumentException>(
            () =>
                settings.Configure(
                    "helpdesk@example.com",
                    Guid.NewGuid(),
                    inboundEnabled: true,
                    outboundEnabled: true,
                    inboundPollSeconds: 60,
                    outboundPollSeconds: 20,
                    batchSize: 25,
                    maxAttempts: maxAttempts));
    }

    [Fact]
    public void MarkInboundSuccess_ShouldClearError()
    {
        var settings =
            new HelpdeskMailSettings(
                Guid.NewGuid());

        settings.MarkInboundFailure(
            "Graph failed.");

        Assert.NotNull(
            settings.LastInboundError);

        settings.MarkInboundSuccess();

        Assert.Null(
            settings.LastInboundError);

        Assert.NotNull(
            settings.LastInboundSuccessAtUtc);

        Assert.NotNull(
            settings.LastInboundAttemptAtUtc);
    }

    [Fact]
    public void MarkOutboundSuccess_ShouldClearError()
    {
        var settings =
            new HelpdeskMailSettings(
                Guid.NewGuid());

        settings.MarkOutboundFailure(
            "Send failed.");

        Assert.NotNull(
            settings.LastOutboundError);

        settings.MarkOutboundSuccess();

        Assert.Null(
            settings.LastOutboundError);

        Assert.NotNull(
            settings.LastOutboundSuccessAtUtc);

        Assert.NotNull(
            settings.LastOutboundAttemptAtUtc);
    }

    [Fact]
    public void RuntimeStatus_ShouldNotChangeRevision()
    {
        var settings =
            new HelpdeskMailSettings(
                Guid.NewGuid());

        settings.Configure(
            "helpdesk@example.com",
            Guid.NewGuid(),
            inboundEnabled: true,
            outboundEnabled: true,
            inboundPollSeconds: 60,
            outboundPollSeconds: 20,
            batchSize: 25,
            maxAttempts: 8);

        var revision =
            settings.Revision;

        settings.MarkInboundAttempt();
        settings.MarkInboundSuccess();
        settings.MarkOutboundAttempt();
        settings.MarkOutboundSuccess();

        Assert.Equal(
            revision,
            settings.Revision);
    }

    [Fact]
    public void RuntimeError_ShouldBeTruncated()
    {
        var settings =
            new HelpdeskMailSettings(
                Guid.NewGuid());

        var longError =
            new string(
                'x',
                5000);

        settings.MarkInboundFailure(
            longError);

        Assert.NotNull(
            settings.LastInboundError);

        Assert.Equal(
            2000,
            settings.LastInboundError!
                .Length);
    }
}