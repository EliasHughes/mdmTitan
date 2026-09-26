import {
  Headphones,
  MonitorCog,
  Settings,
  Smartphone,
  type LucideIcon,
} from 'lucide-react'

/*
 * ================================================================
 * TITAN MODULE IDENTIFIERS
 * ================================================================
 */

export type TitanModuleId =
  | 'windows'
  | 'android'
  | 'helpdesk'
  | 'administration'

/*
 * ================================================================
 * MODULE THEME
 * ================================================================
 */

export interface TitanModuleTheme {
  primary: string
  primaryDark: string
  soft: string
  border: string
  gradient: string
}

/*
 * ================================================================
 * MODULE DEFINITION
 * ================================================================
 */

export interface TitanModuleDefinition {
  id: TitanModuleId

  title: string

  shortTitle: string

  description: string

  path: string

  icon: LucideIcon

  /*
   * El usuario necesita al menos uno
   * de estos permisos.
   */
  permissions: string[]

  /*
   * Define si el módulo está disponible.
   */
  enabled: boolean

  /*
   * Texto opcional mostrado en la tarjeta.
   */
  badge?: string

  theme: TitanModuleTheme
}

/*
 * ================================================================
 * WINDOWS
 * ================================================================
 */

const windowsModule:
  TitanModuleDefinition = {
    id: 'windows',

    title:
      'Windows Management',

    shortTitle:
      'Windows',

    description:
      'Administración, inventario, políticas, seguridad y soporte remoto para equipos Windows.',

    path:
      '/dashboard?workspace=windows',

    icon:
      MonitorCog,

    permissions: [
  'workspace.windows.view',
],

    enabled:
      true,

    badge:
      'MDM',

    theme: {
      primary:
        '#2563eb',

      primaryDark:
        '#1d4ed8',

      soft:
        '#eff6ff',

      border:
        '#bfdbfe',

      gradient:
        'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    },
  }

/*
 * ================================================================
 * ANDROID
 * ================================================================
 */

const androidModule:
  TitanModuleDefinition = {
    id: 'android',

    title:
      'Android Management',

    shortTitle:
      'Android',

    description:
      'Administración de Android Enterprise, aplicaciones, políticas, seguridad y modo kiosk.',

    path:
      '/dashboard?workspace=android',

    icon:
      Smartphone,

    permissions: [
  'workspace.android.view',
],

    enabled:
      true,

    badge:
      'Enterprise',

    theme: {
      primary:
        '#16a34a',

      primaryDark:
        '#15803d',

      soft:
        '#f0fdf4',

      border:
        '#bbf7d0',

      gradient:
        'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
    },
  }

/*
 * ================================================================
 * HELP DESK
 * ================================================================
 */

const helpDeskModule:
  TitanModuleDefinition = {
    id: 'helpdesk',

    title:
      'Mesa de Ayuda',

    shortTitle:
      'Help Desk',

    description:
      'Gestión de incidentes, solicitudes, SLA, base de conocimiento y atención al usuario.',

    path:
      '/helpdesk',

    icon:
      Headphones,

    permissions: [
      'helpdesk.view',
      'tickets.view',
    ],

    enabled:
      true,

    badge:
      'Entra ID',

    theme: {
      primary:
        '#7656d6',

      primaryDark:
        '#6045bb',

      soft:
        '#f5f3ff',

      border:
        '#ddd6fe',

      gradient:
        'linear-gradient(135deg, #8064dc 0%, #6045bb 100%)',
    },
  }

/*
 * ================================================================
 * ADMINISTRATION
 * ================================================================
 */

const administrationModule:
  TitanModuleDefinition = {
    id: 'administration',

    title:
      'Administración',

    shortTitle:
      'Administración',

    description:
      'Usuarios, roles, permisos, auditoría y configuración global de TitanMDM.',

    path:
      '/users?workspace=administration',

    icon:
      Settings,

    permissions: [
  'workspace.administration.view',
],

    enabled:
      true,

    badge:
      'Sistema',

    theme: {
      primary:
        '#475569',

      primaryDark:
        '#334155',

      soft:
        '#f8fafc',

      border:
        '#cbd5e1',

      gradient:
        'linear-gradient(135deg, #64748b 0%, #334155 100%)',
    },
  }

/*
 * ================================================================
 * MODULE REGISTRY
 * ================================================================
 */

export const titanModules:
  TitanModuleDefinition[] = [
    windowsModule,
    androidModule,
    helpDeskModule,
    administrationModule,
  ]

/*
 * ================================================================
 * HELPERS
 * ================================================================
 */

export function getTitanModule(
  moduleId: TitanModuleId,
):
  TitanModuleDefinition | undefined {
  return titanModules.find(
    module =>
      module.id ===
      moduleId,
  )
}

export function getEnabledModules():
  TitanModuleDefinition[] {
  return titanModules.filter(
    module =>
      module.enabled,
  )
}