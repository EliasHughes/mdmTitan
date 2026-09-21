import {
  AppWindow,
  Boxes,
  MonitorSmartphone,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  applicationsApi,
  type ApplicationSummary,
} from '../../api/applicationsApi'

import './AppsPage.css'

type FilterType =
  | 'all'
  | 'user'
  | 'system'

export function AppsPage() {
  const [applications, setApplications] =
    useState<ApplicationSummary[]>([])

  const [search, setSearch] =
    useState('')

  const [filter, setFilter] =
    useState<FilterType>('all')

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  const loadApplications =
    useCallback(async () => {
      try {
        setLoading(true)
        setError(null)

        const systemApp =
          filter === 'system'
            ? true
            : filter === 'user'
              ? false
              : undefined

        const result =
          await applicationsApi.getAll({
            search:
              search.trim() || undefined,
            systemApp,
          })

        setApplications(result)
      } catch {
        setError(
          'No fue posible obtener el inventario de aplicaciones.',
        )
      } finally {
        setLoading(false)
      }
    }, [filter, search])

  useEffect(() => {
    const timeout =
      window.setTimeout(() => {
        void loadApplications()
      }, 250)

    return () =>
      window.clearTimeout(timeout)
  }, [loadApplications])

  const statistics =
    useMemo(() => {
      const system =
        applications.filter(
          (item) =>
            item.isSystemApp,
        ).length

      const user =
        applications.length -
        system

      const devices =
        applications.reduce(
          (total, item) =>
            total +
            item.deviceCount,
          0,
        )

      return {
        total: applications.length,
        system,
        user,
        devices,
      }
    }, [applications])

  return (
    <div className="apps-page">
      <header className="apps-header">
        <div>
          <span className="apps-eyebrow">
            TITANMDM ENTERPRISE
          </span>

          <h1>Aplicaciones</h1>

          <p>
            Inventario y administración centralizada
            de software de la flota.
          </p>
        </div>

        <button
          type="button"
          className="apps-refresh-button"
          onClick={() =>
            void loadApplications()
          }
          disabled={loading}
        >
          <RefreshCw size={16} />

          {loading
            ? 'Actualizando...'
            : 'Actualizar'}
        </button>
      </header>

      <section className="apps-stat-grid">
        <StatCard
          icon={<AppWindow size={20} />}
          title="Aplicaciones"
          value={statistics.total}
          description="Paquetes detectados"
        />

        <StatCard
          icon={<Smartphone size={20} />}
          title="Apps de usuario"
          value={statistics.user}
          description="Software instalado"
        />

        <StatCard
          icon={<ShieldCheck size={20} />}
          title="Sistema"
          value={statistics.system}
          description="Componentes Android"
        />

        <StatCard
          icon={<MonitorSmartphone size={20} />}
          title="Instalaciones"
          value={statistics.devices}
          description="Presencia en dispositivos"
        />
      </section>

      <section className="apps-panel">
        <div className="apps-panel-header">
          <div>
            <div className="apps-panel-title">
              <Boxes size={18} />

              <div>
                <strong>
                  Inventario de aplicaciones
                </strong>

                <span>
                  Software reportado por los
                  agentes TitanMDM.
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="apps-toolbar">
          <label className="apps-search">
            <Search size={17} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Buscar por aplicación o package..."
            />
          </label>

          <select
            value={filter}
            onChange={(event) =>
              setFilter(
                event.target
                  .value as FilterType,
              )
            }
          >
            <option value="all">
              Todas
            </option>

            <option value="user">
              Aplicaciones de usuario
            </option>

            <option value="system">
              Aplicaciones del sistema
            </option>
          </select>
        </div>

        {error && (
          <div className="apps-error">
            {error}
          </div>
        )}

        <div className="apps-table-wrapper">
          <table className="apps-table">
            <thead>
              <tr>
                <th>APLICACIÓN</th>
                <th>PACKAGE</th>
                <th>VERSIÓN</th>
                <th>TIPO</th>
                <th>DISPOSITIVOS</th>
                <th>HABILITADAS</th>
                <th>ÚLTIMA DETECCIÓN</th>
              </tr>
            </thead>

            <tbody>
              {!loading &&
                applications.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="apps-empty"
                    >
                      Todavía no existe
                      inventario de aplicaciones.
                      Ejecuta APP_INVENTORY
                      sobre un dispositivo Android.
                    </td>
                  </tr>
                )}

              {applications.map(
                (application) => (
                  <tr
                    key={`${application.packageName}-${application.versionCode}`}
                  >
                    <td>
                      <div className="app-name-cell">
                        <div className="app-icon">
                          <AppWindow
                            size={17}
                          />
                        </div>

                        <div>
                          <strong>
                            {
                              application.applicationName
                            }
                          </strong>

                          <span>
                            {
                              application.versionName ??
                              'Sin versión'
                            }
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="package-cell">
                      {
                        application.packageName
                      }
                    </td>

                    <td>
                      {application.versionName ??
                        'N/D'}
                    </td>

                    <td>
                      <span
                        className={
                          application.isSystemApp
                            ? 'app-badge system'
                            : 'app-badge user'
                        }
                      >
                        {application.isSystemApp
                          ? 'Sistema'
                          : 'Usuario'}
                      </span>
                    </td>

                    <td>
                      {
                        application.deviceCount
                      }
                    </td>

                    <td>
                      {
                        application.enabledCount
                      }
                    </td>

                    <td>
                      {new Date(
                        application.lastSeenAtUtc,
                      ).toLocaleString()}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  title: string
  value: number
  description: string
}

function StatCard({
  icon,
  title,
  value,
  description,
}: StatCardProps) {
  return (
    <article className="apps-stat-card">
      <div className="apps-stat-icon">
        {icon}
      </div>

      <div>
        <span>{title}</span>

        <strong>{value}</strong>

        <small>{description}</small>
      </div>
    </article>
  )
}