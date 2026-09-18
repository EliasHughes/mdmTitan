import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useNavigate } from 'react-router-dom'

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Laptop,
  Monitor,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
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
  devices: {
    total: 0,
    online: 0,
    offline: 0,
    pending: 0,
    enrolling: 0,
    quarantined: 0,
    retired: 0,
    managed: 0,
  },

  platforms: {
    windows: 0,
    android: 0,
    unknown: 0,
  },

  compliance: {
    compliant: 0,
    nonCompliant: 0,
    evaluating: 0,
    quarantined: 0,
    unknown: 0,
    compliancePercentage: null,
  },

  commands: {
  total: 0,
  pending: 0,
  queued: 0,
  dispatching: 0,
  sent: 0,
  delivered: 0,
  executing: 0,
  success: 0,
  failed: 0,
  timeout: 0,
  cancelled: 0,
  active: 0,
  problems: 0,
},

  system: {
    api: 'Unknown',
    database: 'Unknown',
  },

  generatedAtUtc: '',
}

export function DashboardPage() {
  const navigate = useNavigate()

  const [summary, setSummary] =
    useState<DashboardSummary>(
      initialSummary,
    )

  const [isLoading, setIsLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  const loadDashboard =
    useCallback(async () => {
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
    }, [])

  useEffect(() => {
    document.title =
      'Dashboard | TitanMDM'

    void loadDashboard()
  }, [loadDashboard])

  const managedPercentage =
    useMemo(() => {
      if (summary.devices.total === 0) {
        return 0
      }

      return Math.round(
        (
          summary.devices.managed /
          summary.devices.total
        ) * 100,
      )
    }, [
      summary.devices.managed,
      summary.devices.total,
    ])

  const onlinePercentage =
    useMemo(() => {
      if (summary.devices.total === 0) {
        return 0
      }

      return Math.round(
        (
          summary.devices.online /
          summary.devices.total
        ) * 100,
      )
    }, [
      summary.devices.online,
      summary.devices.total,
    ])

  const generatedAt =
    summary.generatedAtUtc
      ? new Date(
          summary.generatedAtUtc,
        ).toLocaleString()
      : '—'

  return (
    <div className="dashboard-page">
      <section className="dashboard-heading">
        <div>
          <span className="dashboard-heading__eyebrow">
            TITANMDM ENTERPRISE
          </span>

          <h1>
            Centro de administración
          </h1>

          <p>
            Estado operativo de dispositivos,
            plataformas, cumplimiento y servicios
            de TitanMDM.
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
              No se pudo cargar el dashboard
            </strong>

            <span>{error}</span>
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
        <button
          type="button"
          className="dashboard-stat-card"
          onClick={() =>
            navigate('/devices')
          }
        >
          <div className="dashboard-stat-card__icon">
            <Monitor size={22} />
          </div>

          <div>
            <span>Dispositivos</span>

            <strong>
              {isLoading
                ? '...'
                : summary.devices.total}
            </strong>

            <small>
              {summary.devices.managed}{' '}
              administrados
            </small>
          </div>
        </button>

        <button
          type="button"
          className="dashboard-stat-card"
          onClick={() =>
            navigate(
              '/devices?status=online',
            )
          }
        >
          <div className="dashboard-stat-card__icon">
            <Wifi size={22} />
          </div>

          <div>
            <span>En línea</span>

            <strong>
              {isLoading
                ? '...'
                : summary.devices.online}
            </strong>

            <small>
              {onlinePercentage}% del inventario
            </small>
          </div>
        </button>

        <button
          type="button"
          className="dashboard-stat-card"
          onClick={() =>
            navigate(
              '/devices?status=offline',
            )
          }
        >
          <div className="dashboard-stat-card__icon">
            <WifiOff size={22} />
          </div>

          <div>
            <span>Fuera de línea</span>

            <strong>
              {isLoading
                ? '...'
                : summary.devices.offline}
            </strong>

            <small>
              Sin comunicación
            </small>
          </div>
        </button>

        <button
          type="button"
          className="dashboard-stat-card"
          onClick={() =>
            navigate(
              '/compliance?status=noncompliant',
            )
          }
        >
          <div className="dashboard-stat-card__icon">
            <ShieldCheck size={22} />
          </div>

          <div>
            <span>Cumplimiento</span>

            <strong>
              {summary.compliance
                .compliancePercentage === null
                ? 'N/D'
                : `${summary.compliance.compliancePercentage}%`}
            </strong>

            <small>
              {
                summary.compliance
                  .compliant
              }{' '}
              conformes
            </small>
          </div>
        </button>
      </section>

      <section className="dashboard-secondary-grid">
        <article className="dashboard-panel">
          <div className="dashboard-panel__header">
            <div>
              <h2>
                Estado de dispositivos
              </h2>

              <p>
                Distribución operativa del
                inventario.
              </p>
            </div>

            <Activity size={20} />
          </div>

          <div className="security-summary">
            <div>
              <span>En línea</span>
              <strong>
                {summary.devices.online}
              </strong>
            </div>

            <div>
              <span>Fuera de línea</span>
              <strong>
                {summary.devices.offline}
              </strong>
            </div>

            <div>
              <span>Pendientes</span>
              <strong>
                {summary.devices.pending}
              </strong>
            </div>

            <div>
              <span>Inscribiendo</span>
              <strong>
                {summary.devices.enrolling}
              </strong>
            </div>

            <div>
              <span>Cuarentena</span>
              <strong>
                {summary.devices.quarantined}
              </strong>
            </div>

            <div>
              <span>Retirados</span>
              <strong>
                {summary.devices.retired}
              </strong>
            </div>
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel__header">
            <div>
              <h2>Plataformas</h2>

              <p>
                Sistemas operativos
                administrados.
              </p>
            </div>

            <Laptop size={20} />
          </div>

          <div className="platform-list">
            <button
              type="button"
              className="platform-item"
              onClick={() =>
                navigate(
                  '/devices?platform=windows',
                )
              }
            >
              <div className="platform-item__icon">
                <Monitor size={21} />
              </div>

              <div className="platform-item__content">
                <div>
                  <strong>Windows</strong>
                  <span>
                    {
                      summary.platforms
                        .windows
                    }
                  </span>
                </div>

                <small>
                  Equipos Windows
                </small>
              </div>
            </button>

            <button
              type="button"
              className="platform-item"
              onClick={() =>
                navigate(
                  '/devices?platform=android',
                )
              }
            >
              <div className="platform-item__icon">
                <Smartphone size={21} />
              </div>

              <div className="platform-item__content">
                <div>
                  <strong>Android</strong>
                  <span>
                    {
                      summary.platforms
                        .android
                    }
                  </span>
                </div>

                <small>
                  Equipos Android
                </small>
              </div>
            </button>
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel__header">
            <div>
              <h2>Cumplimiento</h2>

              <p>
                Estado de evaluación de los
                endpoints.
              </p>
            </div>

            <ShieldCheck size={20} />
          </div>

          <div className="security-summary">
            <div>
              <span>Conformes</span>
              <strong>
                {
                  summary.compliance
                    .compliant
                }
              </strong>
            </div>

            <div>
              <span>No conformes</span>
              <strong>
                {
                  summary.compliance
                    .nonCompliant
                }
              </strong>
            </div>

            <div>
              <span>Evaluando</span>
              <strong>
                {
                  summary.compliance
                    .evaluating
                }
              </strong>
            </div>

            <div>
              <span>Desconocido</span>
              <strong>
                {
                  summary.compliance
                    .unknown
                }
              </strong>
            </div>
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel__header">
            <div>
              <h2>
                Salud de plataforma
              </h2>

              <p>
                Disponibilidad de los servicios
                principales.
              </p>
            </div>

            <Server size={20} />
          </div>

          <div className="security-summary">
            <div>
              <span>
                <Server size={15} />
                API
              </span>

              <strong>
                {summary.system.api}
              </strong>
            </div>

            <div>
              <span>
                <Database size={15} />
                SQL Server
              </span>

              <strong>
                {summary.system.database}
              </strong>
            </div>

            <div>
              <span>
                Administración
              </span>

              <strong>
                {managedPercentage}%
              </strong>
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-secondary-grid">
        <article className="dashboard-panel">
          <div className="dashboard-panel__header">
            <div>
              <h2>
                Atención requerida
              </h2>

              <p>
                Estados que requieren revisión
                administrativa.
              </p>
            </div>

            <AlertTriangle size={20} />
          </div>

          <div className="security-summary">
            <div>
              <span>
                No conformes
              </span>

              <strong>
                {
                  summary.compliance
                    .nonCompliant
                }
              </strong>
            </div>

            <div>
              <span>
                Cuarentena
              </span>

              <strong>
                {
                  summary.devices
                    .quarantined
                }
              </strong>
            </div>

            <div>
              <span>
                Offline
              </span>

              <strong>
                {summary.devices.offline}
              </strong>
            </div>
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel__header">
            <div>
              <h2>
                Estado del inventario
              </h2>

              <p>
                Cobertura de administración
                TitanMDM.
              </p>
            </div>

            <CheckCircle2 size={20} />
          </div>

          <div className="security-summary">
            <div>
              <span>Total</span>
              <strong>
                {summary.devices.total}
              </strong>
            </div>

            <div>
              <span>Administrados</span>
              <strong>
                {summary.devices.managed}
              </strong>
            </div>

            <div>
              <span>
                Cobertura
              </span>
              <strong>
                {managedPercentage}%
              </strong>
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-secondary-grid">
  <article className="dashboard-panel">
    <div className="dashboard-panel__header">
      <div>
        <h2>
          Command Engine
        </h2>

        <p>
          Ejecución de acciones remotas
          sobre dispositivos.
        </p>
      </div>

      <Activity size={20} />
    </div>

    <div className="security-summary">
      <div>
        <span>Total</span>

        <strong>
          {summary.commands.total}
        </strong>
      </div>

      <div>
        <span>Activos</span>

        <strong>
          {summary.commands.active}
        </strong>
      </div>

      <div>
        <span>Ejecutando</span>

        <strong>
          {summary.commands.executing}
        </strong>
      </div>

      <div>
        <span>Correctos</span>

        <strong>
          {summary.commands.success}
        </strong>
      </div>

      <div>
        <span>Fallidos</span>

        <strong>
          {summary.commands.failed}
        </strong>
      </div>

      <div>
        <span>Timeout</span>

        <strong>
          {summary.commands.timeout}
        </strong>
      </div>
    </div>
  </article>

  <article className="dashboard-panel">
    <div className="dashboard-panel__header">
      <div>
        <h2>
          Cola de administración
        </h2>

        <p>
          Estado de entrega de comandos
          hacia los agentes.
        </p>
      </div>

      <Clock3 size={20} />
    </div>

    <div className="security-summary">
      <div>
        <span>Pendientes</span>

        <strong>
          {summary.commands.pending}
        </strong>
      </div>

      <div>
        <span>En cola</span>

        <strong>
          {summary.commands.queued}
        </strong>
      </div>

      <div>
        <span>Enviados</span>

        <strong>
          {summary.commands.sent}
        </strong>
      </div>

      <div>
        <span>Entregados</span>

        <strong>
          {summary.commands.delivered}
        </strong>
      </div>

      <div>
        <span>Problemas</span>

        <strong>
          {summary.commands.problems}
        </strong>
      </div>
    </div>
  </article>
</section>

      <footer className="dashboard-generated-at">
        <Clock3 size={14} />

        Última actualización:
        {' '}
        {generatedAt}
      </footer>
    </div>
  )
}