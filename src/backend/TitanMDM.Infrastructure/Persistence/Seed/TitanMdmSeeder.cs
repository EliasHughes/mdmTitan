using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TitanMDM.Domain.Entities;

namespace TitanMDM.Infrastructure.Persistence.Seed;

public sealed class TitanMdmSeeder
{
    private readonly TitanMdmDbContext _dbContext;
    private readonly IPasswordHasher<User> _passwordHasher;

    public TitanMdmSeeder(
        TitanMdmDbContext dbContext,
        IPasswordHasher<User> passwordHasher)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
    }

    public async Task SeedAsync(
        CancellationToken cancellationToken = default)
    {
        await EnsureDatabaseAsync(cancellationToken);

        var organization =
            await EnsureOrganizationAsync(cancellationToken);

        var permissions =
            await EnsurePermissionsAsync(cancellationToken);

        var superAdminRole =
            await EnsureSuperAdminRoleAsync(
                organization.Id,
                cancellationToken);

        await EnsureRolePermissionsAsync(
            superAdminRole.Id,
            permissions,
            cancellationToken);

        var superAdminUser =
            await EnsureSuperAdminUserAsync(
                organization.Id,
                cancellationToken);

        await EnsureUserRoleAsync(
            superAdminUser.Id,
            superAdminRole.Id,
            cancellationToken);
    }

    private async Task EnsureDatabaseAsync(
        CancellationToken cancellationToken)
    {
        await _dbContext.Database.MigrateAsync(
            cancellationToken);
    }

    private async Task<Organization> EnsureOrganizationAsync(
        CancellationToken cancellationToken)
    {
        const string organizationCode = "TITANMDM";

        var organization =
            await _dbContext.Organizations
                .FirstOrDefaultAsync(
                    x => x.Code == organizationCode,
                    cancellationToken);

        if (organization is not null)
        {
            return organization;
        }

        organization =
            new Organization(
                "TitanMDM",
                organizationCode);

        organization.UpdateInformation(
            "TitanMDM",
            "Plataforma empresarial de administración y seguridad de dispositivos.",
            null,
            "Dominican Republic",
            "America/Santo_Domingo");

        _dbContext.Organizations.Add(
            organization);

        await _dbContext.SaveChangesAsync(
            cancellationToken);

        return organization;
    }

    private async Task<List<Permission>> EnsurePermissionsAsync(
        CancellationToken cancellationToken)
    {
        var definitions =
            new List<PermissionDefinition>
            {
                // Dashboard
                new(
                    "dashboard.view",
                    "Ver dashboard",
                    "Dashboard",
                    "Permite visualizar el dashboard principal."),

                /*
 * ================================================================
 * WORKSPACES
 * ================================================================
 */

            new(
                "workspace.windows.view",
                "Acceder a Windows Management",
                "Workspaces",
                "Permite acceder al espacio de trabajo Windows."),

            new(
                "workspace.android.view",
                "Acceder a Android Management",
                "Workspaces",
                "Permite acceder al espacio de trabajo Android."),

            new(
                "workspace.administration.view",
                "Acceder a Administración",
                "Workspaces",
                "Permite acceder al espacio de administración de TitanMDM."),

            /*
            * Dashboard general.
            *
            * dashboard.view permite utilizar dashboard.
            * dashboard.global.view permite ver información combinada
            * Windows + Android.
            */

            new(
                "dashboard.global.view",
                "Ver dashboard general",
                "Dashboard",
                "Permite visualizar métricas combinadas de todas las plataformas."),

                // Devices
                new(
                    "devices.view",
                    "Ver dispositivos",
                    "Devices",
                    "Permite consultar los dispositivos administrados."),

                new(
                    "devices.create",
                    "Registrar dispositivos",
                    "Devices",
                    "Permite registrar y preparar nuevos dispositivos."),

                new(
                    "devices.update",
                    "Modificar dispositivos",
                    "Devices",
                    "Permite modificar información administrativa de dispositivos."),

                new(
                    "devices.delete",
                    "Eliminar dispositivos",
                    "Devices",
                    "Permite retirar registros de dispositivos."),

                new(
                    "devices.commands",
                    "Ejecutar comandos",
                    "Devices",
                    "Permite enviar comandos remotos a dispositivos."),

                // Enrollment
                new(
                    "enrollment.view",
                    "Ver enrolamiento",
                    "Enrollment",
                    "Permite consultar métodos y procesos de enrolamiento."),

                new(
                    "enrollment.manage",
                    "Administrar enrolamiento",
                    "Enrollment",
                    "Permite crear y administrar procesos de enrolamiento."),

                // Policies
                new(
                    "policies.view",
                    "Ver políticas",
                    "Policies",
                    "Permite consultar políticas de administración."),

                new(
                    "policies.manage",
                    "Administrar políticas",
                    "Policies",
                    "Permite crear, modificar, asignar y retirar políticas."),

                // Applications
                new(
                    "apps.view",
                    "Ver aplicaciones",
                    "Applications",
                    "Permite consultar el catálogo de aplicaciones."),

                new(
                    "apps.manage",
                    "Administrar aplicaciones",
                    "Applications",
                    "Permite cargar, distribuir, actualizar y retirar aplicaciones."),

                // Compliance
                new(
                    "compliance.view",
                    "Ver cumplimiento",
                    "Compliance",
                    "Permite consultar el estado de cumplimiento."),

                new(
                    "compliance.manage",
                    "Administrar cumplimiento",
                    "Compliance",
                    "Permite configurar reglas y acciones de cumplimiento."),

                // Security
                new(
                    "security.view",
                    "Ver seguridad",
                    "Security",
                    "Permite consultar eventos y estado de seguridad."),

                new(
                    "security.manage",
                    "Administrar seguridad",
                    "Security",
                    "Permite administrar controles y acciones de seguridad."),

                // Kiosk
                new(
                    "kiosk.view",
                    "Ver modo kiosco",
                    "Kiosk",
                    "Permite consultar configuraciones de modo kiosco."),

                new(
                    "kiosk.manage",
                    "Administrar modo kiosco",
                    "Kiosk",
                    "Permite crear y aplicar configuraciones de modo kiosco."),

                // Geofencing
                new(
                    "geofencing.view",
                    "Ver geocercas",
                    "Geofencing",
                    "Permite consultar geocercas configuradas."),

                new(
                    "geofencing.manage",
                    "Administrar geocercas",
                    "Geofencing",
                    "Permite crear, modificar y asignar geocercas."),

                // Remote support
                new(
                    "remote.view",
                    "Ver soporte remoto",
                    "RemoteSupport",
                    "Permite consultar sesiones de soporte remoto."),

                new(
                    "remote.manage",
                    "Administrar soporte remoto",
                    "RemoteSupport",
                    "Permite iniciar y administrar sesiones remotas."),

                // Reports
                new(
                    "reports.view",
                    "Ver reportes",
                    "Reports",
                    "Permite consultar reportes."),

                new(
                    "reports.export",
                    "Exportar reportes",
                    "Reports",
                    "Permite exportar información y reportes."),

                // Users
                new(
                    "users.view",
                    "Ver usuarios",
                    "Users",
                    "Permite consultar usuarios administrativos."),

                new(
                    "users.manage",
                    "Administrar usuarios",
                    "Users",
                    "Permite crear, modificar, activar y desactivar usuarios."),

                // Roles
                new(
                    "roles.view",
                    "Ver roles",
                    "Roles",
                    "Permite consultar roles y permisos."),

                new(
                    "roles.manage",
                    "Administrar roles",
                    "Roles",
                    "Permite crear roles y asignar permisos."),

                // Audit
                new(
                    "audit.view",
                    "Ver auditoría",
                    "Audit",
                    "Permite consultar el registro de auditoría."),

                // Settings
                new(
                    "settings.view",
                    "Ver configuración",
                    "Settings",
                    "Permite consultar la configuración de TitanMDM."),

                new(
                    "settings.manage",
                    "Administrar configuración",
                    "Settings",
                    "Permite modificar la configuración global de TitanMDM.")

                 
                new(
                    "workspace.helpdesk.view",
                    "Acceder a Mesa de Ayuda",
                    "Workspaces",
                    "Permite acceder al espacio de trabajo de Mesa de Ayuda."),

                new(
                    "helpdesk.view",
                    "Ver mesa de ayuda",
                    "Helpdesk",
                    "Permite visualizar el workspace de Mesa de Ayuda."),

                new(
                    "helpdesk.manage",
                    "Administrar mesa de ayuda",
                    "Helpdesk",
                    "Permite configurar Entra ID y la mesa de ayuda."),

                new(
                    "tickets.view",
                    "Ver tickets",
                    "Helpdesk",
                    "Permite consultar tickets de la mesa de ayuda."),

                new(
                    "tickets.create",
                    "Crear tickets",
                    "Helpdesk",
                    "Permite crear tickets."),

                new(
                    "tickets.assign",
                    "Asignar tickets",
                    "Helpdesk",
                    "Permite asignar tickets a administradores Titan existentes."),

                new(
                    "tickets.comment",
                    "Comentar tickets",
                    "Helpdesk",
                    "Permite agregar comentarios y notas internas."),

                new(
                    "tickets.close",
                    "Cerrar tickets",
                    "Helpdesk",
                    "Permite resolver y cerrar tickets."),
            };

        var permissionCodes =
            definitions
                .Select(x => x.Code)
                .ToList();

        var existingPermissions =
            await _dbContext.Permissions
                .Where(
                    x => permissionCodes.Contains(x.Code))
                .ToListAsync(cancellationToken);

        foreach (var definition in definitions)
        {
            var exists =
                existingPermissions.Any(
                    x => x.Code == definition.Code);

            if (exists)
            {
                continue;
            }

            var permission =
                new Permission(
                    definition.Code,
                    definition.Name,
                    definition.Module,
                    definition.Description);

            _dbContext.Permissions.Add(
                permission);
        }

        await _dbContext.SaveChangesAsync(
            cancellationToken);

        return await _dbContext.Permissions
            .Where(
                x => permissionCodes.Contains(x.Code))
            .ToListAsync(cancellationToken);
    }

    private async Task<Role> EnsureSuperAdminRoleAsync(
        Guid organizationId,
        CancellationToken cancellationToken)
    {
        const string roleName = "SuperAdmin";

        var role =
            await _dbContext.Roles
                .FirstOrDefaultAsync(
                    x =>
                        x.OrganizationId == organizationId &&
                        x.Name == roleName,
                    cancellationToken);

        if (role is not null)
        {
            return role;
        }

        role =
            new Role(
                organizationId,
                roleName);

        role.SetDescription(
            "Administrador principal con acceso total a TitanMDM.");

        role.MarkAsSystemRole();

        _dbContext.Roles.Add(
            role);

        await _dbContext.SaveChangesAsync(
            cancellationToken);

        return role;
    }

    private async Task EnsureRolePermissionsAsync(
        Guid roleId,
        IReadOnlyCollection<Permission> permissions,
        CancellationToken cancellationToken)
    {
        var currentPermissionIds =
            await _dbContext.RolePermissions
                .Where(x => x.RoleId == roleId)
                .Select(x => x.PermissionId)
                .ToListAsync(cancellationToken);

        foreach (var permission in permissions)
        {
            if (currentPermissionIds.Contains(permission.Id))
            {
                continue;
            }

            var rolePermission =
                new RolePermission(
                    roleId,
                    permission.Id);

            _dbContext.RolePermissions.Add(
                rolePermission);
        }

        await _dbContext.SaveChangesAsync(
            cancellationToken);
    }

    private async Task<User> EnsureSuperAdminUserAsync(
        Guid organizationId,
        CancellationToken cancellationToken)
    {
        const string email =
            "superadmin@titanmdm.local";

        var user =
            await _dbContext.Users
                .FirstOrDefaultAsync(
                    x =>
                        x.OrganizationId == organizationId &&
                        x.Email == email,
                    cancellationToken);

        if (user is not null)
        {
            return user;
        }

        user =
            new User(
                organizationId,
                "Titan",
                "Administrator",
                email);

        var passwordHash =
            _passwordHasher.HashPassword(
                user,
                "TitanMDM@2026!");

        user.SetPasswordHash(
            passwordHash);

        _dbContext.Users.Add(
            user);

        await _dbContext.SaveChangesAsync(
            cancellationToken);

        return user;
    }

    private async Task EnsureUserRoleAsync(
        Guid userId,
        Guid roleId,
        CancellationToken cancellationToken)
    {
        var exists =
            await _dbContext.UserRoles
                .AnyAsync(
                    x =>
                        x.UserId == userId &&
                        x.RoleId == roleId,
                    cancellationToken);

        if (exists)
        {
            return;
        }

        var userRole =
            new UserRole(
                userId,
                roleId,
                null);

        _dbContext.UserRoles.Add(
            userRole);

        await _dbContext.SaveChangesAsync(
            cancellationToken);
    }

    private sealed record PermissionDefinition(
        string Code,
        string Name,
        string Module,
        string? Description = null);
}