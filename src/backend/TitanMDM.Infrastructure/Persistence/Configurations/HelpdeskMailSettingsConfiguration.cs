using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

using TitanMDM.Domain.Entities;

namespace TitanMDM.Infrastructure.Persistence.Configurations;

public sealed class HelpdeskMailSettingsConfiguration
    : IEntityTypeConfiguration<HelpdeskMailSettings>
{
    public void Configure(
        EntityTypeBuilder<HelpdeskMailSettings> builder)
    {
        builder.ToTable(
            "HelpdeskMailSettings");

        builder.HasKey(
            x =>
                x.OrganizationId);

        builder.Property(
                x =>
                    x.Mailbox)
            .HasMaxLength(
                320);

        builder.Property(
                x =>
                    x.InboundEnabled)
            .IsRequired();

        builder.Property(
                x =>
                    x.OutboundEnabled)
            .IsRequired();

        builder.Property(
                x =>
                    x.InboundPollSeconds)
            .IsRequired();

        builder.Property(
                x =>
                    x.OutboundPollSeconds)
            .IsRequired();

        builder.Property(
                x =>
                    x.BatchSize)
            .IsRequired();

        builder.Property(
                x =>
                    x.MaxAttempts)
            .IsRequired();

        builder.Property(
                x =>
                    x.LastInboundError)
            .HasMaxLength(
                2000);

        builder.Property(
                x =>
                    x.LastOutboundError)
            .HasMaxLength(
                2000);

        builder.Property(
                x =>
                    x.Revision)
            .IsConcurrencyToken();

        builder.Property(
                x =>
                    x.UpdatedAtUtc)
            .IsRequired();

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(
                x =>
                    x.OrganizationId)
            .OnDelete(
                DeleteBehavior.Restrict);

        /*
         * No FK deliberadamente para ActorUserId.
         *
         * El actor puede cambiar/desactivarse y no queremos
         * que eliminar o modificar el usuario destruya
         * la configuración histórica del buzón.
         *
         * La API valida que el usuario sea válido y activo.
         */
        builder.HasIndex(
            x =>
                x.ActorUserId);
    }
}