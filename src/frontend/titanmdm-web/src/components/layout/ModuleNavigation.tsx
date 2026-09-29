import {
  BarChart3,
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
import { useAuth } from '../../auth/AuthContext'
import { useWorkspace } from '../../workspace/WorkspaceContext'
import './ModuleNavigation.css'

interface ModuleLink {
  label: string
  path: string
  icon: LucideIcon
  permissions?: string[]
}

const windowsLinks: ModuleLink[] = [
  {
    label: 'Resumen',
    path:
      '/dashboard?workspace=windows',
    icon: Monitor,
    permissions: [
      'dashboard.view',
    ],
  },
  {
    label: 'Dispositivos',
    path:
      '/devices?workspace=windows',
    icon: Monitor,
    permissions: [
      'devices.view',
    ],
  },
  {
    label: 'Grupos',
    path:
      '/groups?workspace=windows',
    icon: Users,
    permissions: [
      'devices.view',
    ],
  },
  {
    label: 'Inscripción',
    path:
      '/enrollment?workspace=windows',
    icon: Smartphone,
    permissions: [
      'enrollment.view',
    ],
  },
  {
    label: 'Políticas',
    path:
      '/policies?workspace=windows',
    icon: ClipboardList,
    permissions: [
      'policies.view',
    ],
  },
  {
    label: 'Aplicaciones',
    path:
      '/apps?workspace=windows',
    icon: Package,
    permissions: [
      'apps.view',
    ],
  },
  {
    label: 'Seguridad',
    path:
      '/security?workspace=windows',
    icon: Shield,
    permissions: [
      'security.view',
    ],
  },
  {
    label: 'Soporte remoto',
    path:
      '/remote?workspace=windows',
    icon: Headphones,
    permissions: [
      'remote.view',
    ],
  },
  {
    label: 'Reportes',
    path:
      '/reports?workspace=windows',
    icon: FileBarChart,
    permissions: [
      'reports.view',
    ],
  },
]

const androidLinks: ModuleLink[] = [
  {
    label: 'Resumen',
    path:
      '/dashboard?workspace=android',
    icon: BarChart3,
    permissions: [
      'dashboard.view',
    ],
  },
  {
    label: 'Dispositivos',
    path:
      '/devices?workspace=android',
    icon: Smartphone,
    permissions: [
      'devices.view',
    ],
  },
  {
    label: 'Inscripción',
    path:
      '/enrollment?workspace=android',
    icon: Smartphone,
    permissions: [
      'enrollment.view',
    ],
  },
  {
    label: 'Políticas',
    path:
      '/policies?workspace=android',
    icon: ClipboardList,
    permissions: [
      'policies.view',
    ],
  },
  {
    label: 'Aplicaciones',
    path:
      '/apps?workspace=android',
    icon: Package,
    permissions: [
      'apps.view',
    ],
  },
  {
    label: 'Kiosk',
    path:
      '/kiosk?workspace=android',
    icon: Cog,
    permissions: [
      'kiosk.view',
    ],
  },
]

const helpdeskLinks: ModuleLink[] = [
  {
    label: 'Bandeja TIC',
    path:
      '/helpdesk?workspace=helpdesk',
    icon: ClipboardList,
    permissions: [
      'helpdesk.view',
      'tickets.view',
    ],
  },
  {
    label: 'Mis solicitudes',
    path:
      '/my-support?workspace=helpdesk',
    icon: UserRound,
    permissions: [
      'tickets.create',
      'tickets.view',
    ],
  },
  {
    label: 'Gráficos y KPI',
    path:
      '/helpdesk/reportes?workspace=helpdesk',
    icon: BarChart3,
    permissions: [
      'helpdesk.view',
      'tickets.view',
    ],
  },
  {
    label: 'Zonas y agentes',
    path:
      '/helpdesk/operations?workspace=helpdesk',
    icon: Users,
    permissions: [
      'helpdesk.manage',
      'settings.manage',
    ],
  },
  {
    label: 'Especialidades',
    path:
      '/helpdesk/especialidades?workspace=helpdesk',
    icon: Sparkles,
    permissions: [
      'helpdesk.manage',
      'settings.manage',
    ],
  },
  {
    label: 'Avance',
    path:
      '/helpdesk/avance?workspace=helpdesk',
    icon: MapPin,
    permissions: [
      'helpdesk.view',
      'tickets.view',
    ],
  },
]

const adminLinks: ModuleLink[] = [
  {
    label: 'General',
    path:
      '/settings?workspace=administration',
    icon: Settings,
    permissions: [
      'settings.view',
    ],
  },
  {
    label: 'Usuarios',
    path:
      '/users?workspace=administration',
    icon: Users,
    permissions: [
      'users.view',
    ],
  },
  {
    label: 'Roles',
    path:
      '/roles?workspace=administration',
    icon: Shield,
    permissions: [
      'roles.view',
    ],
  },
  {
    label: 'Auditoría',
    path:
      '/audit?workspace=administration',
    icon: ScrollText,
    permissions: [
      'audit.view',
    ],
  },
  {
    label: 'Entra ID',
    path:
      '/helpdesk/entra?workspace=administration',
    icon: UserRound,
    permissions: [
      'helpdesk.manage',
      'settings.manage',
    ],
  },
]

export function ModuleNavigation() {
  const { hasPermission } = useAuth()
  const { activeWorkspaceId } =
    useWorkspace()
  const location = useLocation()

  const workspace =
    location.pathname.startsWith(
      '/my-support',
    ) ||
    location.pathname.startsWith(
      '/helpdesk',
    )
      ? location.pathname.startsWith(
          '/helpdesk/entra',
        )
        ? 'administration'
        : 'helpdesk'
      : activeWorkspaceId

  const config =
    workspace === 'windows'
      ? {
          title: 'Windows',
          links: windowsLinks,
        }
      : workspace === 'android'
        ? {
            title: 'Android',
            links: androidLinks,
          }
        : workspace === 'helpdesk'
          ? {
              title:
                'Mesa de ayuda',
              links:
                helpdeskLinks,
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

  if (!config) return null

  const visible = config.links.filter(
    (item) =>
      !item.permissions ||
      item.permissions.some(
        hasPermission,
      ),
  )

  if (visible.length === 0)
    return null

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
        {visible.map((item) => {
          const Icon = item.icon
          const pathname =
            item.path.split('?')[0]

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={
                pathname ===
                  '/helpdesk' ||
                pathname ===
                  '/dashboard' ||
                pathname ===
                  '/settings'
              }
              className={
                location.pathname ===
                pathname
                  ? 'module-navigation__link module-navigation__link--active'
                  : 'module-navigation__link'
              }
            >
              <Icon size={15} />
              {item.label}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}