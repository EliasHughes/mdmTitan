import {
  BarChart3,
  Building2,
  ClipboardList,
  Cog,
  FileBarChart,
  Headphones,
  MapPin,
  Monitor,
  Package,
  ScrollText,
  Settings,
  Shield,
  Smartphone,
  Sparkles,
  UserRound,
  Users,
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
  canUseHelpdeskConsole,
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
// HELPDESK
// ============================================================

const helpdeskLinks:
  ModuleLink[] = [
    link(
      'Bandeja TIC',
      '/helpdesk?workspace=helpdesk',
      ClipboardList,
      'helpdesk.view',
      'tickets.view',
    ),

    link(
      'Mis solicitudes',
      '/my-support?workspace=helpdesk',
      UserRound,
    ),

    link(
      'Seguimiento SLA',
      '/helpdesk/seguimiento?workspace=helpdesk',
      Headphones,
      'tickets.comment',
      'tickets.assign',
      'helpdesk.manage',
      'settings.manage',
    ),

    link(
      'KPI',
      '/helpdesk/centro/kpis?workspace=helpdesk',
      BarChart3,
      'helpdesk.view',
      'helpdesk.manage',
      'settings.manage',
    ),

    link(
      'Gráficos',
      '/helpdesk/centro/graficos?workspace=helpdesk',
      BarChart3,
      'helpdesk.view',
      'tickets.view',
    ),

    link(
      'Automatización',
      '/helpdesk/centro/alertas?workspace=helpdesk',
      Sparkles,
      'helpdesk.view',
      'helpdesk.manage',
      'settings.manage',
    ),

    link(
      'Configuración Helpdesk',
      '/helpdesk/centro/configuracion?workspace=helpdesk',
      Settings,
      'helpdesk.manage',
      'settings.manage',
    ),

    link(
      'Zonas y agentes',
      '/helpdesk/operations?workspace=helpdesk',
      Users,
      'helpdesk.manage',
      'settings.manage',
    ),

    link(
      'Grupos, tareas y turnos',
      '/helpdesk/especialidades?workspace=helpdesk',
      Sparkles,
      'helpdesk.manage',
      'settings.manage',
    ),
  ]

// ============================================================
// REQUESTER
// ============================================================

const requesterLinks:
  ModuleLink[] = [
    link(
      'Mis solicitudes',
      '/my-support?workspace=helpdesk',
      UserRound,
    ),
  ]

// ============================================================
// ADMINISTRATION
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
      'helpdesk.manage',
      'settings.manage',
    ),
  ]

// ============================================================
// COMPONENT
// ============================================================

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

  // Ponches tiene navegación propia.
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

  // ==========================================================
  // DETERMINE WORKSPACE
  // ==========================================================

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
      ? location.pathname
          .startsWith(
            '/helpdesk/entra',
          )
        ? 'administration'
        : 'helpdesk'
      : location.pathname
          .startsWith(
            '/sites',
          )
        ? 'administration'
        : activeWorkspaceId

  // ==========================================================
  // NAVIGATION CONFIG
  // ==========================================================

  const config =
    workspace ===
    'windows'
      ? {
          title:
            'Windows',

          links:
            windowsLinks,
        }
      : workspace ===
          'android'
        ? {
            title:
              'Android',

            links:
              androidLinks,
          }
        : workspace ===
            'helpdesk'
          ? {
              title:
                staff
                  ? 'Mesa de ayuda · TIC'
                  : 'Mis solicitudes',

              links:
                staff
                  ? helpdeskLinks
                  : requesterLinks,
            }
          : workspace ===
              'administration'
            ? {
                title:
                  'Configuración',

                links:
                  adminLinks,
              }
            : null

  if (!config) {
    return null
  }

  // ==========================================================
  // RBAC FILTER
  // ==========================================================

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

  if (!visible.length) {
    return null
  }

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <nav
      className="module-navigation"
      aria-label={
        `Opciones de ${config.title}`
      }
    >
      <span className="module-navigation__title">
        {config.title}
      </span>

      <div className="module-navigation__links">
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
                end={
                  [
                    '/helpdesk',
                    '/dashboard',
                    '/settings',
                    '/sites',
                  ]
                    .includes(
                      pathname,
                    )
                }
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