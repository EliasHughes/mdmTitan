using Microsoft.EntityFrameworkCore;
using TitanMDM.Domain.Entities;

namespace TitanMDM.Infrastructure.Persistence;

public sealed class TitanMdmDbContext : DbContext
{
    public TitanMdmDbContext(
        DbContextOptions<TitanMdmDbContext> options)
        : base(options)
    {
    }

    public DbSet<Organization> Organizations =>
        Set<Organization>();

    public DbSet<Department> Departments =>
        Set<Department>();

    public DbSet<User> Users =>
        Set<User>();

    public DbSet<Role> Roles =>
        Set<Role>();

    public DbSet<Permission> Permissions =>
        Set<Permission>();

    public DbSet<UserRole> UserRoles =>
        Set<UserRole>();

    public DbSet<RolePermission> RolePermissions =>
        Set<RolePermission>();

    public DbSet<RefreshToken> RefreshTokens =>
        Set<RefreshToken>();

    public DbSet<Device> Devices =>
        Set<Device>();

    public DbSet<DeviceCommand> DeviceCommands =>
    Set<DeviceCommand>();

    public DbSet<Policy> Policies =>
    Set<Policy>();

    public DbSet<PolicyVersion> PolicyVersions =>
    Set<PolicyVersion>();

    public DbSet<DevicePolicyAssignment>
    DevicePolicyAssignments =>
        Set<DevicePolicyAssignment>();

    public DbSet<AndroidEnterpriseConfiguration>
    AndroidEnterpriseConfigurations =>
        Set<AndroidEnterpriseConfiguration>();

    public DbSet<AndroidEnrollment>
    AndroidEnrollments =>
        Set<AndroidEnrollment>();
    
    public DbSet<DeviceCredential> DeviceCredentials =>
    Set<DeviceCredential>();

    public DbSet<EnrollmentToken> EnrollmentTokens =>
    Set<EnrollmentToken>();


    protected override void OnModelCreating(
        ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(TitanMdmDbContext).Assembly);
    }
}