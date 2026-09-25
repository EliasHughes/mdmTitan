import {
  Activity,
  CheckCircle2,
  Download,
  Laptop,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  WifiOff,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  reportsApi,
} from '../../api/reportsApi'

import type {
  ReportBreakdown,
  ReportsOverview,
} from '../../types/reports'

import './ReportsPage.css'

export function ReportsPage() {
  const [
    data,
    setData,
  ] =
    useState<
      ReportsOverview | null
    >(null)

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null)

  const load =
    useCallback(
      async () => {
        try {
          setLoading(true)
          setError(null)

          setData(
            await reportsApi
              .getOverview(),
          )
        } catch {
          setError(
            'No fue posible cargar los reportes.',
          )
        } finally {
          setLoading(false)
        }
      },
      [],
    )

  useEffect(
    () => {
      void load()
    },
    [
      load,
    ],
  )

  if (
    loading
    &&
    !data
  ) {
    return (
      <div className="reports-loading">
        <RefreshCw
          size={20}
        />

        Cargando reportes...
      </div>
    )
  }

  if (!data) {
    return (
      <div className="reports-error">
        {error
        ??
        'Reportes no disponibles.'}
      </div>
    )
  }

  return (
    <div className="reports-page">
      <header className="reports-header">
        <div>
          <span>
            TITANMDM REPORTING
          </span>

          <h1>
            Reportes
          </h1>

          <p>
            Visión operacional de flota,
            comandos, seguridad y cumplimiento.
          </p>
        </div>

        <div className="reports-actions">
          <button
            type="button"
            onClick={() =>
              void load()
            }
          >
            <RefreshCw
              size={16}
            />

            Actualizar
          </button>

          <button
            type="button"
            className="primary"
            onClick={() =>
              void reportsApi
                .exportDevicesCsv()
            }
          >
            <Download
              size={16}
            />

            Exportar dispositivos
          </button>
        </div>
      </header>

      {error && (
        <div className="reports-error">
          {error}
        </div>
      )}

      <section className="reports-stats">
        <Stat
          icon={
            <Laptop
              size={20}
            />
          }
          label="Dispositivos"
          value={
            data.fleet
              .totalDevices
          }
        />

        <Stat
          icon={
            <Monitor
              size={20}
            />
          }
          label="Online"
          value={
            data.fleet
              .onlineDevices
          }
          good
        />

        <Stat
          icon={
            <WifiOff
              size={20}
            />
          }
          label="Offline"
          value={
            data.fleet
              .offlineDevices
          }
        />

        <Stat
          icon={
            <CheckCircle2
              size={20}
            />
          }
          label="Compliant"
          value={
            data.fleet
              .compliantDevices
          }
          good
        />

        <Stat
          icon={
            <ShieldCheck
              size={20}
            />
          }
          label="Security Score"
          value={
            `${data.security.averageComplianceScore}%`
          }
        />
      </section>

      <div className="reports-grid">
        <article className="reports-panel">
          <header>
            <strong>
              Plataformas
            </strong>

            <span>
              Distribución de la flota
            </span>
          </header>

          <div className="reports-platforms">
            <div>
              <Monitor
                size={23}
              />

              <strong>
                {data.fleet
                  .windowsDevices}
              </strong>

              <span>
                Windows
              </span>
            </div>

            <div>
              <Smartphone
                size={23}
              />

              <strong>
                {data.fleet
                  .androidDevices}
              </strong>

              <span>
                Android
              </span>
            </div>
          </div>
        </article>

        <article className="reports-panel">
          <header>
            <strong>
              Gestión
            </strong>

            <span>
              Estado administrativo
            </span>
          </header>

          <div className="reports-metrics">
            <Metric
              label="Administrados"
              value={
                data.fleet
                  .managedDevices
              }
            />

            <Metric
              label="No administrados"
              value={
                data.fleet
                  .unmanagedDevices
              }
            />

            <Metric
              label="No conformes"
              value={
                data.fleet
                  .nonCompliantDevices
              }
            />

            <Metric
              label="Cuarentena"
              value={
                data.fleet
                  .quarantinedDevices
              }
            />
          </div>
        </article>

        <article className="reports-panel reports-command-panel">
          <header>
            <strong>
              Comandos — últimos 30 días
            </strong>

            <span>
              Rendimiento operacional
            </span>
          </header>

          <div className="reports-command-score">
            <div>
              <Activity
                size={22}
              />

              <strong>
                {data.commands
                  .successRate}%
              </strong>

              <span>
                tasa de éxito
              </span>
            </div>

            <div className="reports-metrics">
              <Metric
                label="Total"
                value={
                  data.commands
                    .totalLast30Days
                }
              />

              <Metric
                label="Exitosos"
                value={
                  data.commands
                    .successful
                }
              />

              <Metric
                label="Fallidos"
                value={
                  data.commands
                    .failed
                }
              />

              <Metric
                label="Timeout"
                value={
                  data.commands
                    .timeout
                }
              />

              <Metric
                label="Activos"
                value={
                  data.commands
                    .active
                }
              />
            </div>
          </div>
        </article>
      </div>

      <div className="reports-grid reports-grid-three">
        <Breakdown
          title="Sistemas operativos"
          items={
            data.operatingSystems
          }
        />

        <Breakdown
          title="Departamentos"
          items={
            data.departments
          }
        />

        <Breakdown
          title="Comandos más usados"
          items={
            data.commandTypes
          }
        />
      </div>

      <footer className="reports-generated">
        Generado:{' '}
        {new Date(
          data.generatedAtUtc,
        ).toLocaleString()}
      </footer>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  good = false,
}: {
  icon:
    React.ReactNode

  label: string

  value:
    string |
    number

  good?: boolean
}) {
  return (
    <article
      className={
        good
          ? 'reports-stat good'
          : 'reports-stat'
      }
    >
      {icon}

      <div>
        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>
      </div>
    </article>
  )
}

function Metric({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="reports-metric">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  )
}

function Breakdown({
  title,
  items,
}: {
  title: string

  items:
    ReportBreakdown[]
}) {
  const maximum =
    Math.max(
      ...items.map(
        item =>
          item.value,
      ),
      1,
    )

  return (
    <article className="reports-panel">
      <header>
        <strong>
          {title}
        </strong>
      </header>

      <div className="reports-breakdown">
        {items.length ===
        0 ? (
          <div className="reports-empty">
            Sin datos.
          </div>
        ) : (
          items.map(
            item => (
              <div
                key={item.label}
              >
                <div>
                  <span>
                    {item.label}
                  </span>

                  <strong>
                    {item.value}
                  </strong>
                </div>

                <div className="reports-bar">
                  <span
                    style={{
                      width:
                        `${
                          item.value
                          /
                          maximum
                          *
                          100
                        }%`,
                    }}
                  />
                </div>
              </div>
            ),
          )
        )}
      </div>
    </article>
  )
}