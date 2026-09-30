import { lazy, Suspense } from 'react'

import {
  useNavigate,
  useSearchParams,
} from 'react-router-dom'

import { useAuth } from '../../auth/AuthContext'
import '../../ponches-original/ponches-original.css'

const screens = {
  mirror: lazy(
    () => import('../../ponches-original/pages/ClockMirror'),
  ),
  dashboard: lazy(
    () => import('../../ponches-original/pages/Dashboard'),
  ),
  records: lazy(
    () => import('../../ponches-original/pages/Records'),
  ),
  'db-records': lazy(
    () => import('../../ponches-original/pages/SqlHistory'),
  ),
  'remote-punch': lazy(
    () => import('../../ponches-original/pages/RemotePunch'),
  ),
  devices: lazy(
    () => import('../../ponches-original/pages/Devices'),
  ),
  employees: lazy(
    () => import('../../ponches-original/pages/Employees'),
  ),
  collaborators: lazy(
    () => import('../../ponches-original/pages/Collaborators'),
  ),
  schedules: lazy(
    () => import('../../ponches-original/pages/Schedules'),
  ),
  biometric: lazy(
    () => import('../../ponches-original/pages/Inventory'),
  ),
  bulk: lazy(
    () => import('../../ponches-original/pages/BulkOps'),
  ),
  reports: lazy(
    () => import('../../ponches-original/pages/Overtime'),
  ),
  export: lazy(
    () => import('../../ponches-original/pages/DataExport'),
  ),
  'sync-history': lazy(
    () => import('../../ponches-original/pages/SyncHistory'),
  ),
  settings: lazy(
    () => import('../../ponches-original/pages/Settings'),
  ),
  'advanced-reports': lazy(
    () => import('../../ponches-original/pages/AdvancedReports'),
  ),
} as const

type Screen = keyof typeof screens

type Section = {
  id: Screen | 'users'
  label: string
  permission: string
}

const sections: Section[] = [
  {
    id: 'mirror',
    label: 'Escritura en relojes',
    permission: 'ponches.collaborators.sync',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    permission: 'ponches.dashboard.view',
  },
  {
    id: 'records',
    label: 'Ponches',
    permission: 'ponches.records.view',
  },
  {
    id: 'db-records',
    label: 'Historial SQL',
    permission: 'ponches.history.view',
  },
  {
    id: 'remote-punch',
    label: 'Ponche remoto',
    permission: 'ponches.remote.create',
  },
  {
    id: 'devices',
    label: 'Dispositivos',
    permission: 'ponches.devices.view',
  },
  {
    id: 'employees',
    label: 'Empleados',
    permission: 'ponches.employees.view',
  },
  {
    id: 'collaborators',
    label: 'Colaboradores',
    permission: 'ponches.collaborators.view',
  },
  {
    id: 'schedules',
    label: 'Horarios',
    permission: 'ponches.schedules.view',
  },
  {
    id: 'biometric',
    label: 'Inventario biométrico',
    permission: 'ponches.inventory.view',
  },
  {
    id: 'bulk',
    label: 'Operaciones masivas',
    permission: 'ponches.bulk.execute',
  },
  {
    id: 'reports',
    label: 'Reportes',
    permission: 'ponches.reports.view',
  },
  {
    id: 'export',
    label: 'Exportar datos',
    permission: 'ponches.export',
  },
  {
    id: 'sync-history',
    label: 'Historial Sync',
    permission: 'ponches.sync.view',
  },
  {
    id: 'users',
    label: 'Usuarios',
    permission: 'ponches.users.view',
  },
  {
    id: 'settings',
    label: 'Configuración',
    permission: 'ponches.settings.view',
  },
  {
    id: 'advanced-reports',
    label: 'Reportes avanzados',
    permission: 'ponches.advanced-reports.view',
  },
]

export function PonchesPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

  const manage = hasPermission('ponches.manage')

  const allowed = sections.filter(
    (item) =>
      (manage || hasPermission(item.permission)) &&
      (
        item.id !== 'users' ||
        hasPermission('users.view')
      ),
  )

  const requested =
    params.get('section') ?? 'dashboard'

  const current = allowed.find(
    (item) =>
      item.id === requested &&
      item.id !== 'users',
  )

  const fallback = allowed.find(
    (item) => item.id !== 'users',
  )

  const screen = current?.id as Screen | undefined

  const CurrentScreen = screen
    ? screens[screen]
    : null

  return (
    <div className="ponches-original min-h-full">
      <nav
        className={
          'flex flex-wrap gap-2 border-b ' +
          'border-rose-100 bg-white px-5 py-3'
        }
        aria-label="Módulos de Ponches"
      >
        {allowed.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={
              `rounded-xl px-3 py-2 text-sm ${
                screen === id
                  ? 'bg-[#c8102e] text-white'
                  : 'border border-rose-100 bg-white text-zinc-700 hover:bg-rose-50'
              }`
            }
            onClick={() =>
              id === 'users'
                ? navigate(
                    '/users?workspace=administration',
                  )
                : setParams({ section: id })
            }
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="p-5">
        {CurrentScreen ? (
          <Suspense
            fallback={
              <p className="text-zinc-500">
                Cargando módulo…
              </p>
            }
          >
            <CurrentScreen />
          </Suspense>
        ) : (
          <div
            role="alert"
            className={
              'rounded-2xl border border-rose-100 ' +
              'bg-white p-6'
            }
          >
            <h2 className="text-lg font-semibold">
              Pantalla no autorizada
            </h2>

            <p className="mt-2 text-sm text-zinc-600">
              Tu rol no tiene acceso a esta pantalla.
              Selecciona una opción disponible.
            </p>

            {fallback && (
              <button
                type="button"
                className={
                  'mt-4 rounded-xl bg-[#c8102e] ' +
                  'px-4 py-2 text-white'
                }
                onClick={() =>
                  setParams({
                    section: fallback.id,
                  })
                }
              >
                Abrir {fallback.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}