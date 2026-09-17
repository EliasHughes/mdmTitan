import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  Activity,
  CheckCircle2,
  Laptop,
  Monitor,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  Wifi,
  WifiOff,
} from 'lucide-react'

import {
  dashboardApi,
  type DashboardSummary,
} from '../api/dashboardApi'

import './DashboardPage.css'

const initialSummary: DashboardSummary = {
  totalDevices: 0,
  onlineDevices: 0,
  offlineDevices: 0,
  compliantDevices: 0,
  nonCompliantDevices: 0,
  androidDevices: 0,
  windowsDevices: 0,
  pendingEnrollmentDevices: 0,
}

export function DashboardPage() {
  const [summary, setSummary] =
    useState<DashboardSummary>(
      initialSummary,
    )

  const [isLoading, setIsLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  const loadDashboard = useCallback(
  async () => {
    try {
      setIsLoading(true)
      setError(null)

      const data =
        await dashboardApi.getSummary()

      setSummary(data)
    } catch (loadError) {
      console.error(
        'Dashboard loading error:',
        loadError,
      )

      setError(
        'No fue posible obtener los datos del dashboard.',
      )
    } finally {
      setIsLoading(false)
    }
  },
  [],
)

  useEffect(() => {
  document.title =
    'Dashboard | TitanMDM'

  void loadDashboard()
}, [loadDashboard])

  return (
    <div className="dashboard-page">
      <section className="dashboard-heading">
        <div>
          <span className="dashboard-heading__eyebrow">
            TITANMDM ENTERPRISE
          </span>

          <h1>
            Dashboard
          </h1>

          <p>
            Estado general de los
            dispositivos administrados
            por TitanMDM.
          </p>
        </div>

        <button
          type="button"
          className="dashboard-refresh-button"
          onClick={() =>
            void loadDashboard()
          }
          disabled={isLoading}
        >
          <RefreshCw
            size={17}
            className={
              isLoading
                ? 'is-spinning'
                : ''
            }
          />

          Actualizar
        </button>
      </section>

      {error && (
        <div className="dashboard-error">
          <ShieldAlert size={20} />

          <div>
            <strong>
              No se pudo cargar el
              dashboard
            </strong>

            <span>
              {error}
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadDashboard()
            }
          >
            Reintentar
          </button>
        </div>
      )}

      <section className="dashboard-stats-grid">
        <article className="dashboard-stat-card">
          <div className="dashboard-stat-card__icon">
            <Monitor size={22} />
          </div>

          <div>
            <span>
              Dispositivos
            </span>

            <strong>
              {isLoading
                ? '...'
                : summary.totalDevices}
            </strong>

            <small>
              Total administrado
            </small>
          </div>
        </article>

        <article className="dashboard-stat-card">
          <div className="dashboard-stat-card__icon">
            <Wifi size={22} />
          </div>

          <div>
            <span>
              En línea
            </span>

            <strong>
              {isLoading
                ? '...'
                : summary.onlineDevices}
            </strong>

            <small>
              Comunicación activa
            </small>
          </div>
        </article>

        <article className="dashboard-stat-card">
          <div className="dashboard-stat-card__icon">
            <WifiOff size={22} />
          </div>

          <div>
            <span>
              Fuera de línea
            </span>

            <strong>
              {isLoading
                ? '...'
                : summary.offlineDevices}
            </strong>

            <small>
              Sin comunicación
            </small>
          </div>
        </article>

        <article className="dashboard-stat-card">
          <div className="dashboard-stat-card__icon">
            <CheckCircle2 size={22} />
          </div>

          <div>
            <span>
              Cumplimiento
            </span>

            <strong>
              {isLoading
                ? '...'
                : summary.compliantDevices}
            </strong>

            <small>
              Dispositivos conformes
            </small>
          </div>
        </article>
      </section>

      <section className="dashboard-secondary-grid">
        <article className="dashboard-panel">
          <div className="dashboard-panel__header">
            <div>
              <h2>
                Plataformas
              </h2>

              <p>
                Distribución de dispositivos
                administrados.
              </p>
            </div>

            <Laptop size={20} />
          </div>

          <div className="platform-list">
            <div className="platform-item">
              <div className="platform-item__icon">
                <Smartphone size={21} />
              </div>

              <div className="platform-item__content">
                <div>
                  <strong>
                    Android
                  </strong>

                  <span>
                    {summary.androidDevices}
                  </span>
                </div>

                <small>
                  Dispositivos Android
                </small>
              </div>
            </div>

            <div className="platform-item">
              <div className="platform-item__icon">
                <Monitor size={21} />
              </div>

              <div className="platform-item__content">
                <div>
                  <strong>
                    Windows
                  </strong>

                  <span>
                    {summary.windowsDevices}
                  </span>
                </div>

                <small>
                  Dispositivos Windows
                </small>
              </div>
            </div>
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel__header">
            <div>
              <h2>
                Estado de seguridad
              </h2>

              <p>
                Resumen actual de
                cumplimiento.
              </p>
            </div>

            <Activity size={20} />
          </div>

          <div className="security-summary">
            <div>
              <span>
                Conformes
              </span>

              <strong>
                {summary.compliantDevices}
              </strong>
            </div>

            <div>
              <span>
                No conformes
              </span>

              <strong>
                {
                  summary
                    .nonCompliantDevices
                }
              </strong>
            </div>

            <div>
              <span>
                Inscripción pendiente
              </span>

              <strong>
                {
                  summary
                    .pendingEnrollmentDevices
                }
              </strong>
            </div>
          </div>
        </article>
      </section>
    </div>
  )
}