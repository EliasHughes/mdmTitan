import { lazy, Suspense } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import '../../ponches-original/ponches-original.css'

const screens = {
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

const sections: {
  id: Screen | 'users'
  label: string
  manage?: boolean
}[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'records', label: 'Ponches' },
  { id: 'db-records', label: 'Historial SQL', manage: true },
  { id: 'remote-punch', label: 'Ponche remoto', manage: true },
  { id: 'devices', label: 'Dispositivos' },
  { id: 'employees', label: 'Empleados' },
  { id: 'collaborators', label: 'Colaboradores' },
  { id: 'schedules', label: 'Horarios' },
  { id: 'biometric', label: 'Inventario biométrico' },
  { id: 'bulk', label: 'Operaciones masivas', manage: true },
  { id: 'reports', label: 'Reportes', manage: true },
  { id: 'export', label: 'Exportar datos', manage: true },
  { id: 'sync-history', label: 'Historial Sync' },
  { id: 'users', label: 'Usuarios', manage: true },
  { id: 'settings', label: 'Configuración', manage: true },
  {
    id: 'advanced-reports',
    label: 'Reportes avanzados',
    manage: true,
  },
]

export function PonchesPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const canManage = hasPermission('settings.manage')

  const requested = params.get('section') ?? 'dashboard'
  const current: Screen =
    requested in screens
      ? (requested as Screen)
      : 'dashboard'

  const CurrentScreen = screens[current]

  return (
    <div className="ponches-original min-h-full">
      <nav
        className="flex flex-wrap gap-2 border-b border-rose-100 bg-white px-5 py-3"
        aria-label="Módulos de Ponches"
      >
        {sections
          .filter((item) => !item.manage || canManage)
          .map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`rounded-xl px-3 py-2 text-sm ${
                current === id
                  ? 'bg-[#c8102e] text-white'
                  : 'border border-rose-100 bg-white text-zinc-700 hover:bg-rose-50'
              }`}
              onClick={() =>
                id === 'users'
                  ? navigate('/users?workspace=administration')
                  : setParams(
                      id === 'dashboard'
                        ? {}
                        : { section: id },
                    )
              }
            >
              {label}
            </button>
          ))}
      </nav>

      <div className="p-5">
        <Suspense
          fallback={
            <p className="text-zinc-500">
              Cargando módulo de Ponches…
            </p>
          }
        >
          <CurrentScreen />
        </Suspense>
      </div>
    </div>
  )
}