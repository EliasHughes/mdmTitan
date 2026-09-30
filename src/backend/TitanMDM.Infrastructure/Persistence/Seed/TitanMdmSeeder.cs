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

    private sealed record Definition(
        string Code,
        string Name,
        string Module,
        string Description);

    private static readonly Definition[] Definitions =
    {
        new("dashboard.view", "Ver dashboard", "Dashboard", "Permite visualizar el dashboard principal."),
        new("workspace.windows.view", "Acceder a Windows Management", "Workspaces", "Permite acceder al espacio de trabajo Windows."),
        new("workspace.android.view", "Acceder a Android Management", "Workspaces", "Permite acceder al espacio de trabajo Android."),
        new("workspace.administration.view", "Acceder a Administración", "Workspaces", "Permite acceder al espacio de administración de TitanMDM."),
        new("dashboard.global.view", "Ver dashboard general", "Dashboard", "Permite visualizar métricas combinadas de todas las plataformas."),
        new("devices.view", "Ver dispositivos", "Devices", "Permite consultar los dispositivos administrados."),
        new("devices.create", "Registrar dispositivos", "Devices", "Permite registrar y preparar nuevos dispositivos."),
        new("devices.update", "Modificar dispositivos", "Devices", "Permite modificar información administrativa de dispositivos."),
        new("devices.delete", "Eliminar dispositivos", "Devices", "Permite retirar registros de dispositivos."),
        new("devices.commands", "Ejecutar comandos", "Devices", "Permite enviar comandos remotos a dispositivos."),
        new("enrollment.view", "Ver enrolamiento", "Enrollment", "Permite consultar métodos y procesos de enrolamiento."),
        new("enrollment.manage", "Administrar enrolamiento", "Enrollment", "Permite crear y administrar procesos de enrolamiento."),
        new("policies.view", "Ver políticas", "Policies", "Permite consultar políticas de administración."),
        new("policies.manage", "Administrar políticas", "Policies", "Permite crear, modificar, asignar y retirar políticas."),
        new("apps.view", "Ver aplicaciones", "Applications", "Permite consultar el catálogo de aplicaciones."),
        new("apps.manage", "Administrar aplicaciones", "Applications", "Permite cargar, distribuir, actualizar y retirar aplicaciones."),
        new("compliance.view", "Ver cumplimiento", "Compliance", "Permite consultar el estado de cumplimiento."),
        new("compliance.manage", "Administrar cumplimiento", "Compliance", "Permite configurar reglas y acciones de cumplimiento."),
        new("security.view", "Ver seguridad", "Security", "Permite consultar eventos y estado de seguridad."),
        new("security.manage", "Administrar seguridad", "Security", "Permite administrar controles y acciones de seguridad."),
        new("kiosk.view", "Ver modo kiosco", "Kiosk", "Permite consultar configuraciones de modo kiosco."),
        new("kiosk.manage", "Administrar modo kiosco", "Kiosk", "Permite crear y aplicar configuraciones de modo kiosco."),
        new("geofencing.view", "Ver geocercas", "Geofencing", "Permite consultar geocercas configuradas."),
        new("geofencing.manage", "Administrar geocercas", "Geofencing", "Permite crear, modificar y asignar geocercas."),
        new("remote.view", "Ver soporte remoto", "RemoteSupport", "Permite consultar sesiones de soporte remoto."),
        new("remote.manage", "Administrar soporte remoto", "RemoteSupport", "Permite iniciar y administrar sesiones remotas."),
        new("reports.view", "Ver reportes", "Reports", "Permite consultar reportes."),
        new("reports.export", "Exportar reportes", "Reports", "Permite exportar información y reportes."),
        new("users.view", "Ver usuarios", "Users", "Permite consultar usuarios administrativos."),
        new("users.manage", "Administrar usuarios", "Users", "Permite crear, modificar, activar y desactivar usuarios."),
        new("roles.view", "Ver roles", "Roles", "Permite consultar roles y permisos."),
        new("roles.manage", "Administrar roles", "Roles", "Permite crear roles y asignar permisos."),
        new("audit.view", "Ver auditoría", "Audit", "Permite consultar el registro de auditoría."),
        new("settings.view", "Ver configuración", "Settings", "Permite consultar la configuración de TitanMDM."),
        new("settings.manage", "Administrar configuración", "Settings", "Permite modificar la configuración global de TitanMDM."),
        new("workspace.helpdesk.view", "Acceder a Mesa de Ayuda", "Workspaces", "Permite acceder al espacio de trabajo de Mesa de Ayuda."),
        new("helpdesk.view", "Ver mesa de ayuda", "Helpdesk", "Permite visualizar el workspace de Mesa de Ayuda."),
        new("helpdesk.manage", "Administrar mesa de ayuda", "Helpdesk", "Permite configurar Entra ID y la mesa de ayuda."),
        new("tickets.view", "Ver tickets", "Helpdesk", "Permite consultar tickets de la mesa de ayuda."),
        new("tickets.create", "Crear tickets", "Helpdesk", "Permite crear tickets."),
        new("tickets.assign", "Asignar tickets", "Helpdesk", "Permite asignar tickets a administradores Titan existentes."),
        new("tickets.comment", "Comentar tickets", "Helpdesk", "Permite agregar comentarios y notas internas."),
        new("tickets.close", "Cerrar tickets", "Helpdesk", "Permite resolver y cerrar tickets."),

        new("workspace.ponches.view", "Acceder a Ponches", "Ponches", "Acceder a Ponches."),
        new("ponches.manage", "Administrar todo Ponches", "Ponches", "Administrar todo Ponches."),
        new("ponches.dashboard.view", "Ver dashboard", "Ponches", "Ver dashboard."),
        new("ponches.records.view", "Ver ponches", "Ponches", "Ver ponches."),
        new("ponches.history.view", "Ver historial SQL", "Ponches", "Ver historial SQL."),
        new("ponches.remote.create", "Registrar ponche remoto", "Ponches", "Registrar ponche remoto."),
        new("ponches.devices.view", "Ver relojes", "Ponches", "Ver relojes."),
        new("ponches.devices.manage", "Administrar relojes", "Ponches", "Administrar relojes."),
        new("ponches.employees.view", "Ver empleados", "Ponches", "Ver empleados."),
        new("ponches.collaborators.view", "Ver colaboradores", "Ponches", "Ver colaboradores."),
        new("ponches.collaborators.manage", "Editar colaboradores", "Ponches", "Editar colaboradores."),
        new("ponches.collaborators.sync", "Sincronizar colaboradores y biometría", "Ponches", "Sincronizar colaboradores y biometría."),
        new("ponches.schedules.view", "Ver horarios", "Ponches", "Ver horarios."),
        new("ponches.schedules.manage", "Administrar horarios", "Ponches", "Administrar horarios."),
        new("ponches.inventory.view", "Ver inventario biométrico", "Ponches", "Ver inventario biométrico."),
        new("ponches.inventory.manage", "Administrar inventario biométrico", "Ponches", "Administrar inventario biométrico."),
        new("ponches.bulk.execute", "Ejecutar operaciones masivas", "Ponches", "Ejecutar operaciones masivas."),
        new("ponches.reports.view", "Ver reportes de asistencia", "Ponches", "Ver reportes de asistencia."),
        new("ponches.export", "Exportar Excel y PDF", "Ponches", "Exportar Excel y PDF."),
        new("ponches.sync.view", "Ver historial de sincronización", "Ponches", "Ver historial de sincronización."),
        new("ponches.sync.run", "Ejecutar sincronización", "Ponches", "Ejecutar sincronización."),
        new("ponches.settings.view", "Ver configuración de Ponches", "Ponches", "Ver configuración de Ponches."),
        new("ponches.settings.manage", "Editar configuración de Ponches", "Ponches", "Editar configuración de Ponches."),
        new("ponches.users.view", "Acceder a usuarios desde Ponches", "Ponches", "Acceder a usuarios desde Ponches."),
        new("ponches.advanced-reports.view", "Ver reportes avanzados", "Ponches", "Ver reportes avanzados."),
        new("ponches.fiorella.use", "Usar Fiorella", "Ponches", "Usar Fiorella."),
    };

    public async Task SeedAsync(
        CancellationToken cancellationToken = default)
    {
        await _dbContext.Database.MigrateAsync(cancellationToken);

        var organization = await _dbContext.Organizations
            .FirstOrDefaultAsync(
                x => x.Code == "TITANMDM",
                cancellationToken);

        if (organization is null)
        {
            organization = new Organization("TitanMDM", "TITANMDM");

            organization.UpdateInformation(
                "TitanMDM",
                "Plataforma empresarial de administración y seguridad de dispositivos.",
                null,
                "Dominican Republic",
                "America/Santo_Domingo");

            _dbContext.Organizations.Add(organization);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        var codes = Definitions.Select(x => x.Code).ToArray();

        var permissions = await _dbContext.Permissions
            .Where(x => codes.Contains(x.Code))
            .ToListAsync(cancellationToken);

        foreach (var definition in Definitions)
        {
            if (permissions.Any(x => x.Code == definition.Code))
                continue;

            var permission = new Permission(
                definition.Code,
                definition.Name,
                definition.Module,
                definition.Description);

            _dbContext.Permissions.Add(permission);
            permissions.Add(permission);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        var role = await _dbContext.Roles.FirstOrDefaultAsync(
            x => x.OrganizationId == organization.Id &&
                 x.Name == "SuperAdmin",
            cancellationToken);

        if (role is null)
        {
            role = new Role(organization.Id, "SuperAdmin");

            role.SetDescription(
                "Administrador principal con acceso total a TitanMDM.");

            role.MarkAsSystemRole();
            _dbContext.Roles.Add(role);

            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        // Solo los SuperAdmin del sistema reciben automáticamente
        // los permisos nuevos. Los demás roles se configuran en la UI.
        var adminRoles = await _dbContext.Roles
            .Where(x => x.IsSystemRole && x.Name == "SuperAdmin")
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        foreach (var roleId in adminRoles)
        {
            var owned = (
                await _dbContext.RolePermissions
                    .Where(x => x.RoleId == roleId)
                    .Select(x => x.PermissionId)
                    .ToListAsync(cancellationToken)
            ).ToHashSet();

            foreach (var permission in permissions.Where(x => x.IsActive))
            {
                if (!owned.Contains(permission.Id))
                {
                    _dbContext.RolePermissions.Add(
                        new RolePermission(roleId, permission.Id));
                }
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        var user = await _dbContext.Users.FirstOrDefaultAsync(
            x => x.OrganizationId == organization.Id &&
                 x.Email == "superadmin@titanmdm.local",
            cancellationToken);

        if (user is null)
        {
            var password = Environment.GetEnvironmentVariable(
                "TITAN_BOOTSTRAP_PASSWORD");

            if (string.IsNullOrWhiteSpace(password) ||
                password.Length < 12)
            {
                throw new InvalidOperationException(
                    "Primera instalación: configura TITAN_BOOTSTRAP_PASSWORD " +
                    "con al menos 12 caracteres. Las instalaciones con el " +
                    "administrador existente no necesitan esta variable.");
            }

            user = new User(
                organization.Id,
                "Titan",
                "Administrator",
                "superadmin@titanmdm.local");

            user.SetPasswordHash(
                _passwordHasher.HashPassword(user, password));

            _dbContext.Users.Add(user);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        var assigned = await _dbContext.UserRoles.AnyAsync(
            x => x.UserId == user.Id && x.RoleId == role.Id,
            cancellationToken);

        if (!assigned)
        {
            _dbContext.UserRoles.Add(
                new UserRole(user.Id, role.Id, null));

            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }
}