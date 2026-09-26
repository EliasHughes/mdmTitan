import {
  AppWindow,
  ClipboardCheck,
  FileBarChart,
  Gauge,
  Home,
  MapPinned,
  MonitorSmartphone,
  Network,
  PackageOpen,
  RadioTower,
  ScrollText,
  Settings,
  ShieldCheck,
  Smartphone,
  UserCog,
  Users,
  Workflow,
  Inbox,
  CloudCog,
  type LucideIcon,
} from 'lucide-react'

import type {
  TitanModuleId,
} from './moduleRegistry'

/*
 * ================================================================
 * CONTRACT
 * ================================================================
 */

export interface WorkspaceNavigationItem {
  label: string

  path: string

  permission?: string

  icon: LucideIcon
}

/*
 * ================================================================
 * GLOBAL
 * ================================================================
 */

export const globalNavigation:
  WorkspaceNavigationItem[] = [
    {
      label:
        'Titan Workspace',

      path:
        '/',

      icon:
        Home,
    },
  ]

/*
 * ================================================================
 * WINDOWS
 * ================================================================
 */

const windowsNavigation:
  WorkspaceNavigationItem[] = [
    {
      label:
        'Dashboard',

      path:
        '/dashboard?workspace=windows',

      permission:
        'dashboard.view',

      icon:
        Gauge,
    },

    {
      label:
        'Dispositivos',

      path:
        '/devices?platform=Windows&workspace=windows',

      permission:
        'devices.view',

      icon:
        MonitorSmartphone,
    },

    {
      label:
        'Grupos y Flota',

      path:
        '/groups?workspace=windows',

      permission:
        'devices.view',

      icon:
        Network,
    },

    {
      label:
        'Inscripción',

      path:
        '/enrollment?workspace=windows',

      permission:
        'enrollment.view',

      icon:
        Smartphone,
    },

    {
      label:
        'Políticas',

      path:
        '/policies?workspace=windows',

      permission:
        'policies.view',

      icon:
        ClipboardCheck,
    },

    {
      label:
        'Seguridad',

      path:
        '/security?workspace=windows',

      permission:
        'security.view',

      icon:
        ShieldCheck,
    },

    {
      label:
        'Cumplimiento',

      path:
        '/compliance?workspace=windows',

      permission:
        'compliance.view',

      icon:
        ShieldCheck,
    },

    {
      label:
        'Automatización',

      path:
        '/automation?workspace=windows',

      permission:
        'devices.commands',

      icon:
        Workflow,
    },

    {
      label:
        'Soporte remoto',

      path:
        '/remote?workspace=windows',

      permission:
        'remote.view',

      icon:
        RadioTower,
    },

    {
      label:
        'Reportes',

      path:
        '/reports?workspace=windows',

      permission:
        'reports.view',

      icon:
        FileBarChart,
    },
  ]

/*
 * ================================================================
 * ANDROID
 * ================================================================
 */

const androidNavigation:
  WorkspaceNavigationItem[] = [
    {
      label:
        'Dashboard',

      path:
        '/dashboard?workspace=android',

      permission:
        'dashboard.view',

      icon:
        Gauge,
    },

    {
      label:
        'Dispositivos',

      path:
        '/devices?platform=Android&workspace=android',

      permission:
        'devices.view',

      icon:
        Smartphone,
    },

    {
      label:
        'Inscripción',

      path:
        '/enrollment?workspace=android',

      permission:
        'enrollment.view',

      icon:
        Smartphone,
    },

    {
      label:
        'Políticas',

      path:
        '/policies?workspace=android',

      permission:
        'policies.view',

      icon:
        ClipboardCheck,
    },

    {
      label:
        'Aplicaciones',

      path:
        '/apps?workspace=android',

      permission:
        'apps.view',

      icon:
        AppWindow,
    },

    {
      label:
        'Seguridad',

      path:
        '/security?workspace=android',

      permission:
        'security.view',

      icon:
        ShieldCheck,
    },

    {
      label:
        'Cumplimiento',

      path:
        '/compliance?workspace=android',

      permission:
        'compliance.view',

      icon:
        ShieldCheck,
    },

    {
      label:
        'Kiosk',

      path:
        '/kiosk?workspace=android',

      permission:
        'kiosk.view',

      icon:
        PackageOpen,
    },

    {
      label:
        'Geofencing',

      path:
        '/geofencing?workspace=android',

      permission:
        'geofencing.view',

      icon:
        MapPinned,
    },

    {
      label:
        'Reportes',

      path:
        '/reports?workspace=android',

      permission:
        'reports.view',

      icon:
        FileBarChart,
    },
  ]

/*
 * ================================================================
 * ADMINISTRATION
 * ================================================================
 */

const administrationNavigation:
  WorkspaceNavigationItem[] = [
    {
      label:
        'Dashboard general',

      path:
        '/dashboard?workspace=global',

      permission:
        'dashboard.global.view',

      icon:
        Gauge,
    },

    {
      label:
        'Usuarios',

      path:
        '/users?workspace=administration',

      permission:
        'users.view',

      icon:
        Users,
    },

    {
      label:
        'Roles y permisos',

      path:
        '/roles?workspace=administration',

      permission:
        'roles.view',

      icon:
        UserCog,
    },

    {
      label:
        'Auditoría',

      path:
        '/audit?workspace=administration',

      permission:
        'audit.view',

      icon:
        ScrollText,
    },

    {
      label:
        'Configuración',

      path:
        '/settings?workspace=administration',

      permission:
        'settings.view',

      icon:
        Settings,
    },
  ]

/*
 * ================================================================
 * HELP DESK
 * ================================================================
 */

const helpDeskNavigation: WorkspaceNavigationItem[] = [
  {
    label: 'Inbox',
    path: '/helpdesk?workspace=helpdesk',
    permission: 'tickets.view',
    icon: Inbox,
  },
  {
    label: 'Entra ID',
    path: '/helpdesk/entra?workspace=helpdesk',
    permission: 'helpdesk.manage',
    icon: CloudCog,
  },
]

/*
 * ================================================================
 * REGISTRY
 * ================================================================
 */

const navigationByWorkspace:
  Record<
    TitanModuleId,
    WorkspaceNavigationItem[]
  > = {
    windows:
      windowsNavigation,

    android:
      androidNavigation,

    administration:
      administrationNavigation,

    helpdesk:
      helpDeskNavigation,
  }

/*
 * ================================================================
 * RESOLVER
 * ================================================================
 */

export function getWorkspaceNavigation(
  workspaceId:
    TitanModuleId | null,
):
  WorkspaceNavigationItem[] {
  if (
    !workspaceId
  ) {
    return [
      ...globalNavigation,
    ]
  }

  return [
    ...globalNavigation,

    ...navigationByWorkspace[
      workspaceId
    ],
  ]
}