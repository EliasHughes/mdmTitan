using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TitanMDM.Domain.Entities;

namespace TitanMDM.Infrastructure.Persistence.Configurations;

public sealed class HelpdeskAutomationSettingsConfiguration
    : IEntityTypeConfiguration<HelpdeskAutomationSettings>
{
    public void Configure(
        EntityTypeBuilder<HelpdeskAutomationSettings> builder)
    {
        builder.ToTable("HelpdeskAutomationSettings");

        builder.HasKey(x => x.OrganizationId);

        builder.Property(x => x.Revision)
            .IsConcurrencyToken();

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(x => x.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}