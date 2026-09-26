using Microsoft.EntityFrameworkCore;
using TitanMDM.Domain.Entities;
using TitanMDM.Domain.Automation;

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

    public DbSet<AndroidPolicyPublication>
        AndroidPolicyPublications =>
            Set<AndroidPolicyPublication>();

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

    public DbSet<DeviceCredential> DeviceCredentials =>
        Set<DeviceCredential>();

    public DbSet<DeviceCommand> DeviceCommands =>
        Set<DeviceCommand>();

    public DbSet<DeviceApplication> DeviceApplications =>
        Set<DeviceApplication>();

    public DbSet<EnrollmentToken> EnrollmentTokens =>
        Set<EnrollmentToken>();

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

    public DbSet<AndroidEnterpriseSignupSession>
        AndroidEnterpriseSignupSessions =>
            Set<AndroidEnterpriseSignupSession>();

    public DbSet<AndroidEnrollment>
        AndroidEnrollments =>
            Set<AndroidEnrollment>();

    public DbSet<AndroidDevice>
        AndroidDevices =>
            Set<AndroidDevice>();

    public DbSet<DeviceSecurityPosture>
    DeviceSecurityPostures =>
        Set<DeviceSecurityPosture>();

    public DbSet<DeviceGroup> DeviceGroups =>
        Set<DeviceGroup>();

    public DbSet<DeviceGroupMember>
        DeviceGroupMembers =>
        Set<DeviceGroupMember>();

    public DbSet<DeviceLocation> DeviceLocations =>
    Set<DeviceLocation>();

    public DbSet<Geofence> Geofences =>
        Set<Geofence>();

    public DbSet<GeofenceDeviceAssignment>
        GeofenceDeviceAssignments =>
            Set<GeofenceDeviceAssignment>();

    public DbSet<AutomationRule>
    AutomationRules =>
        Set<AutomationRule>();

    public DbSet<AutomationExecution>
    AutomationExecutions =>
        Set<AutomationExecution>();

    public DbSet<LostModeSession>
        LostModeSessions =>
            Set<LostModeSession>();
        
    public DbSet<GeofenceDeviceState>
    GeofenceDeviceStates =>
        Set<GeofenceDeviceState>();

    public DbSet<GeofenceEvent>
    GeofenceEvents =>
        Set<GeofenceEvent>();

    public DbSet<RemoteSession>
    RemoteSessions =>
        Set<RemoteSession>();

    public DbSet<RemoteSessionEvent>
    RemoteSessionEvents =>
        Set<RemoteSessionEvent>();

    public DbSet<SoftwarePackage>
    SoftwarePackages =>
        Set<SoftwarePackage>();

    public DbSet<SoftwareDeployment>
    SoftwareDeployments =>
        Set<SoftwareDeployment>();

    public DbSet<HelpdeskTicket> HelpdeskTickets =>
        Set<HelpdeskTicket>();

    public DbSet<HelpdeskTicketComment> HelpdeskTicketComments =>
        Set<HelpdeskTicketComment>();

    public DbSet<HelpdeskTicketEvent> HelpdeskTicketEvents =>
        Set<HelpdeskTicketEvent>();

    public DbSet<HelpdeskQueue> HelpdeskQueues =>
        Set<HelpdeskQueue>();

    public DbSet<EntraIdSettings> EntraIdSettings =>
        Set<EntraIdSettings>();

    public DbSet<EntraDirectoryUser> EntraDirectoryUsers =>
        Set<EntraDirectoryUser>();

    protected override void OnModelCreating(
        ModelBuilder modelBuilder)
    {
        base.OnModelCreating(
            modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(TitanMdmDbContext).Assembly);
    }
}