import {
  BarChart3,
  Building2,
  ClipboardList,
  Cog,
  FileBarChart,
  Headphones,
  Inbox,
  MapPin,
  Monitor,
  Package,
  Plus,
  ScrollText,
  Settings,
  Shield,
  Smartphone,
  Sparkles,
  UserRound,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

import {
  NavLink,
  useLocation,
} from 'react-router-dom'

import {
  useAuth,
} from '../../auth/AuthContext'

import {
  canCreateHelpdeskRequest,
  canManageHelpdesk,
  canUseHelpdeskConsole,
  helpdeskPermissions,
} from '../../auth/helpdeskAccess'

import {
  useWorkspace,
} from '../../workspace/WorkspaceContext'

import './ModuleNavigation.css'

interface ModuleLink {
  label: string
  path: string
  icon: LucideIcon
  permissions?: string[]
}

const link = (
  label: string,
  path: string,
  icon: LucideIcon,
  ...permissions: string[]
): ModuleLink => ({
  label,
  path,
  icon,
  permissions,
})

// ============================================================
// WINDOWS
// ============================================================

const windowsLinks:
  ModuleLink[] = [
    link(
      'Resumen',
      '/dashboard?workspace=windows',
      Monitor,
      'dashboard.view',
    ),

    link(
      'Dispositivos',
      '/devices?workspace=windows',
      Monitor,
      'devices.view',
    ),

    link(
      'Grupos',
      '/groups?workspace=windows',
      Users,
      'devices.view',
    ),

    link(
      'Inscripción',
      '/enrollment?workspace=windows',
      Smartphone,
      'enrollment.view',
    ),

    link(
      'Políticas',
      '/policies?workspace=windows',
      ClipboardList,
      'policies.view',
    ),

    link(
      'Aplicaciones',
      '/apps?workspace=windows',
      Package,
      'apps.view',
    ),

    link(
      'Seguridad',
      '/security?workspace=windows',
      Shield,
      'security.view',
    ),

    link(
      'Soporte remoto',
      '/remote?workspace=windows',
      Headphones,
      'remote.view',
    ),

    link(
      'Reportes',
      '/reports?workspace=windows',
      FileBarChart,
      'reports.view',
    ),
  ]

// ============================================================
// ANDROID
// ============================================================

const androidLinks:
  ModuleLink[] = [
    link(
      'Resumen',
      '/dashboard?workspace=android',
      BarChart3,
      'dashboard.view',
    ),

    link(
      'Dispositivos',
      '/devices?workspace=android',
      Smartphone,
      'devices.view',
    ),

    link(
      'Inscripción',
      '/enrollment?workspace=android',
      Smartphone,
      'enrollment.view',
    ),

    link(
      'Políticas',
      '/policies?workspace=android',
      ClipboardList,
      'policies.view',
    ),

    link(
      'Aplicaciones',
      '/apps?workspace=android',
      Package,
      'apps.view',
    ),

    link(
      'Kiosk',
      '/kiosk?workspace=android',
      Cog,
      'kiosk.view',
    ),

    link(
      'Geofencing',
      '/geofencing?workspace=android',
      MapPin,
      'geofencing.view',
    ),
  ]

// ============================================================
// COLLABORATOR PORTAL
//
// SOLO DOS OPCIONES.
// ============================================================

const requesterLinks:
  ModuleLink[] = [
    link(
      'Crear ticket',
      '/my-support/new?workspace=helpdesk',
      Plus,
      helpdeskPermissions
        .requestCreate,
    ),

    link(
      'Mis tickets',
      '/my-support?workspace=helpdesk',
      Inbox,
      helpdeskPermissions
        .requestOwnView,
    ),
  ]

// ============================================================
// HELP DESK TIC
// ============================================================

const helpdeskLinks:
  ModuleLink[] = [
    link(
      'Mi trabajo',
      '/helpdesk?workspace=helpdesk',
      ClipboardList,
      helpdeskPermissions
        .inboxMyWork,
    ),

    link(
      'Sin asignar',
      '/helpdesk?view=unassigned&workspace=helpdesk',
      Inbox,
      helpdeskPermissions
        .inboxUnassigned,
    ),

    link(
      'Todos',
      '/helpdesk?view=all&workspace=helpdesk',
      ClipboardList,
      helpdeskPermissions
        .inboxAll,
    ),

    link(
      'Kanban',
      '/helpdesk?view=kanban&workspace=helpdesk',
      Workflow,
      helpdeskPermissions
        .kanbanView,
    ),

    link(
      'Mis solicitudes',
      '/my-support?workspace=helpdesk',
      UserRound,
      helpdeskPermissions
        .requestOwnView,
    ),

    link(
      'SLA',
      '/helpdesk/seguimiento?workspace=helpdesk',
      Headphones,
      helpdeskPermissions
        .slaView,
    ),

    link(
      'KPI',
      '/helpdesk/centro/kpis?workspace=helpdesk',
      BarChart3,
      helpdeskPermissions
        .kpiView,
    ),

    link(
      'Gráficos',
      '/helpdesk/centro/graficos?workspace=helpdesk',
      BarChart3,
      helpdeskPermissions
        .analyticsView,
    ),

    link(
      'Automatización',
      '/helpdesk/centro/alertas?workspace=helpdesk',
      Sparkles,
      helpdeskPermissions
        .automationView,
    ),

    link(
      'Reportes',
      '/helpdesk/reportes?workspace=helpdesk',
      FileBarChart,
      helpdeskPermissions
        .reportsView,
    ),
  ]

// ============================================================
// HELPDESK ADMINISTRATION
// ============================================================

const helpdeskAdminLinks:
  ModuleLink[] = [
    link(
      'Sites',
      '/helpdesk/operations?tab=sites&workspace=helpdesk',
      Building2,
      helpdeskPermissions
        .sitesView,
    ),

    link(
      'Grupos',
      '/helpdesk/especialidades?workspace=helpdesk',
      Users,
      helpdeskPermissions
        .groupsView,
    ),

    link(
      'Técnicos',
      '/helpdesk/operations?tab=technicians&workspace=helpdesk',
      Headphones,
      helpdeskPermissions
        .techniciansView,
    ),

    link(
      'Turnos',
      '/helpdesk/especialidades?tab=schedules&workspace=helpdesk',
      Workflow,
      helpdeskPermissions
        .schedulesView,
    ),

    link(
      'Categorías',
      '/helpdesk/especialidades?tab=categories&workspace=helpdesk',
      ClipboardList,
      helpdeskPermissions
        .categoriesView,
    ),

    link(
      'Plantillas',
      '/helpdesk/centro/configuracion?tab=templates&workspace=helpdesk',
      FileBarChart,
      helpdeskPermissions
        .templatesView,
    ),

    link(
      'Configuración',
      '/helpdesk/centro/configuracion?workspace=helpdesk',
      Settings,
      helpdeskPermissions
        .adminAccess,
    ),
  ]

// ============================================================
// TITAN ADMINISTRATION
// ============================================================

const adminLinks:
  ModuleLink[] = [
    link(
      'General',
      '/settings?workspace=administration',
      Settings,
      'settings.view',
    ),

    link(
      'Usuarios',
      '/users?workspace=administration',
      Users,
      'users.view',
    ),

    link(
      'Roles',
      '/roles?workspace=administration',
      Shield,
      'roles.view',
    ),

    link(
      'Localidades',
      '/sites?workspace=administration',
      Building2,
      'sites.view',
    ),

    link(
      'Auditoría',
      '/audit?workspace=administration',
      ScrollText,
      'audit.view',
    ),

    link(
      'Entra ID',
      '/helpdesk/entra?workspace=administration',
      UserRound,
      helpdeskPermissions
        .adminAccess,
    ),
  ]

export function ModuleNavigation() {
  const {
    hasPermission,
  } =
    useAuth()

  const {
    activeWorkspaceId,
  } =
    useWorkspace()

  const location =
    useLocation()

  if (
    location.pathname ===
      '/ponches'
    ||
    location.pathname
      .startsWith(
        '/ponches/',
      )
  ) {
    return null
  }

  const staff =
    canUseHelpdeskConsole(
      hasPermission,
    )

  const helpdeskAdmin =
    canManageHelpdesk(
      hasPermission,
    )

  const workspace =
    location.pathname
      .startsWith(
        '/my-support',
      )
    ||
    location.pathname
      .startsWith(
        '/helpdesk',
      )
      ? 'helpdesk'
      : location.pathname
          .startsWith(
            '/sites',
          )
        ? 'administration'
        : activeWorkspaceId

  let config:
    {
      title: string
      links: ModuleLink[]
    }
    | null =
      null

  if (
    workspace ===
    'windows'
  ) {
    config = {
      title:
        'Windows',

      links:
        windowsLinks,
    }
  }
  else if (
    workspace ===
    'android'
  ) {
    config = {
      title:
        'Android',

      links:
        androidLinks,
    }
  }
  else if (
    workspace ===
    'helpdesk'
  ) {
    if (
      staff
    ) {
      config = {
        title:
          helpdeskAdmin
            ? 'Mesa de ayuda · Administración'
            : 'Mesa de ayuda · TIC',

        links: [
          ...helpdeskLinks,

          ...(
            helpdeskAdmin
              ? helpdeskAdminLinks
              : []
          ),
        ],
      }
    }
    else {
      config = {
        title:
          'Mesa de ayuda',

        links:
          requesterLinks,
      }
    }
  }
  else if (
    workspace ===
    'administration'
  ) {
    config = {
      title:
        'Configuración',

      links:
        adminLinks,
    }
  }

  if (
    !config
  ) {
    return null
  }

  const visible =
    config.links
      .filter(
        item =>
          !item.permissions
            ?.length
          ||
          item.permissions
            .some(
              hasPermission,
            ),
      )

  /*
   * Compatibilidad inicial:
   *
   * mientras asignamos los permisos nuevos
   * en RolesPage, permitimos que el portal
   * muestre Crear ticket cuando tenga
   * tickets.create antiguo.
   */
  if (
    workspace ===
      'helpdesk'
    &&
    !staff
    &&
    canCreateHelpdeskRequest(
      hasPermission,
    )
    &&
    !visible.some(
      item =>
        item.path.startsWith(
          '/my-support/new',
        ),
    )
  ) {
    visible.unshift(
      requesterLinks[0],
    )
  }

  if (
    !visible.length
  ) {
    return null
  }

  return (
    <nav
      className="module-navigation"
      aria-label={
        `Opciones de ${config.title}`
      }
    >
      <span
        className="module-navigation__title"
      >
        {config.title}
      </span>

      <div
        className="module-navigation__links"
      >
        {visible.map(
          item => {
            const Icon =
              item.icon

            const pathname =
              item.path
                .split('?')[0]

            const active =
              location.pathname ===
              pathname

            return (
              <NavLink
                key={
                  item.path
                }
                to={
                  item.path
                }
                end
                className={
                  active
                    ? 'module-navigation__link module-navigation__link--active'
                    : 'module-navigation__link'
                }
              >
                <Icon
                  size={15}
                />

                {item.label}
              </NavLink>
            )
          },
        )}
      </div>
    </nav>
  )
}