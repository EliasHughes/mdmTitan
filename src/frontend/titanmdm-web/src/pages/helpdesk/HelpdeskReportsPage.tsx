import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Clock3,
  Download,
  RefreshCw,
  Ticket,
  UserRoundX,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import apiClient from '../../api/apiClient'
import './HelpdeskPages.css'
import './HelpdeskReportsPage.css'

interface Count {
  label: string
  count: number
}

interface AgentCount extends Count {
  resolved: number
}

interface DailyCount {
  date: string
  count: number
}

interface Summary {
  from: string
  to: string
  total: number
  unresolved: number
  unassigned: number
  overdueFirstResponse: number
  overdueResolution: number
  averageFirstResponseHours: number | null
  averageResolutionHours: number | null
  byStatus: Count[]
  byPriority: Count[]
  byCategory: Count[]
  bySource: Count[]
  byAgent: AgentCount[]
  daily: DailyCount[]
  generatedAtUtc: string
}

const COLORS = [
  '#648fee',
  '#81c7ae',
  '#ad98ee',
  '#e7b76e',
  '#e78383',
  '#78b9dc',
]

const STATUS: Record<string, string> = {
  new: 'Nuevo',
  open: 'En proceso',
  pendinguser: 'En espera del usuario',
  resolved: 'Resuelto',
  closed: 'Cerrado',
}

const PRIORITY: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
}

function dateInput(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function initialFrom() {
  const date = new Date()
  date.setDate(date.getDate() - 29)
  return dateInput(date)
}

function localized(
  data: Count[],
  labels: Record<string, string>,
) {
  return data.map((item) => ({
    ...item,
    label:
      labels[item.label] ?? item.label,
  }))
}

function DistributionChart({
  title,
  description,
  data,
  type = 'bar',
}: {
  title: string
  description: string
  data: Count[]
  type?: 'bar' | 'donut'
}) {
  return (
    <section className="hd-report__chart-card">
      <header>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>

      <div className="hd-report__chart">
        {data.length === 0 ? (
          <div className="hd-report__empty">
            Sin datos en el período
            seleccionado.
          </div>
        ) : type === 'donut' ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="label"
                innerRadius={65}
                outerRadius={105}
                paddingAngle={3}
              >
                {data.map((item, index) => (
                  <Cell
                    key={`${item.label}-${index}`}
                    fill={
                      COLORS[
                        index % COLORS.length
                      ]
                    }
                  />
                ))}
              </Pie>

              <Tooltip />
              <Legend
                verticalAlign="bottom"
                height={36}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <BarChart
              data={data}
              margin={{
                top: 12,
                right: 15,
                bottom: 24,
                left: 0,
              }}
            >
              <CartesianGrid
                stroke="#e9eef7"
                strokeDasharray="3 3"
                vertical={false}
              />

              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-18}
                textAnchor="end"
                height={60}
              />

              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11 }}
              />

              <Tooltip />

              <Bar
                dataKey="count"
                name="Tickets"
                fill="#7198ee"
                radius={[7, 7, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}

export function HelpdeskReportsPage() {
  const [from, setFrom] =
    useState(initialFrom)
  const [to, setTo] = useState(() =>
    dateInput(new Date()),
  )
  const [summary, setSummary] =
    useState<Summary | null>(null)
  const [loading, setLoading] =
    useState(true)
  const [exporting, setExporting] =
    useState(false)
  const [error, setError] = useState('')

  const validRange =
    Boolean(from && to) && from <= to

  const load = useCallback(async () => {
    if (!validRange) {
      setError(
        'Selecciona un rango de fechas válido.',
      )
      return
    }

    setLoading(true)
    setError('')

    try {
      const response =
        await apiClient.get<Summary>(
          '/helpdesk/reports/summary',
          {
            params: { from, to },
          },
        )

      setSummary(response.data)
    } catch {
      setSummary(null)
      setError(
        'No se pudieron cargar los indicadores.',
      )
    } finally {
      setLoading(false)
    }
  }, [from, to, validRange])

  useEffect(() => {
    void load()
  }, [load])

  async function exportCsv() {
    if (
      !validRange ||
      exporting ||
      !summary
    ) {
      return
    }

    setExporting(true)
    setError('')

    try {
      const response =
        await apiClient.get<Blob>(
          '/helpdesk/reports/tickets.csv',
          {
            params: { from, to },
            responseType: 'blob',
          },
        )

      const url = URL.createObjectURL(
        response.data,
      )

      const anchor =
        document.createElement('a')

      anchor.href = url
      anchor.download =
        `titanmdm-helpdesk-${from}-${to}.csv`

      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()

      window.setTimeout(
        () => URL.revokeObjectURL(url),
        1000,
      )
    } catch {
      setError(
        'No se pudo descargar el reporte CSV.',
      )
    } finally {
      setExporting(false)
    }
  }

  const metrics = useMemo(() => {
    if (!summary) return []

    return [
      {
        title: 'Tickets creados',
        value: summary.total,
        icon: Ticket,
        tone: 'blue',
      },
      {
        title: 'Sin resolver',
        value: summary.unresolved,
        icon: Clock3,
        tone: 'violet',
      },
      {
        title: 'Sin asignar',
        value: summary.unassigned,
        icon: UserRoundX,
        tone: 'amber',
      },
      {
        title: 'SLA vencidos',
        value:
          summary.overdueFirstResponse +
          summary.overdueResolution,
        icon: AlertTriangle,
        tone: 'red',
      },
    ]
  }, [summary])

  const statusData = summary
    ? localized(summary.byStatus, STATUS)
    : []

  const priorityData = summary
    ? localized(
        summary.byPriority,
        PRIORITY,
      )
    : []

  return (
    <main className="titan-page helpdesk-page hd-report">
      <header className="hd-report__header">
        <div>
          <span className="helpdesk-inbox__eyebrow">
            <BarChart3 size={16} />
            Mesa de ayuda · Análisis
          </span>

          <h1>Gráficos y KPI</h1>

          <p>
            Indicadores de tickets creados
            en el período seleccionado.
            Las fechas del servidor se
            evalúan en UTC.
          </p>
        </div>

        <Link
          to="/helpdesk?workspace=helpdesk"
          className="helpdesk-ui-button helpdesk-ui-button--secondary"
        >
          <ArrowLeft size={16} />
          Volver a la bandeja
        </Link>
      </header>

      <section
        className="hd-report__filters"
        aria-label="Período del reporte"
      >
        <label>
          Desde
          <input
            type="date"
            value={from}
            onChange={(event) =>
              setFrom(event.target.value)
            }
          />
        </label>

        <label>
          Hasta
          <input
            type="date"
            value={to}
            onChange={(event) =>
              setTo(event.target.value)
            }
          />
        </label>

        <button
          type="button"
          className="helpdesk-ui-button helpdesk-ui-button--primary"
          disabled={loading || !validRange}
          onClick={() => void load()}
        >
          <RefreshCw size={16} />
          {loading
            ? 'Cargando…'
            : 'Actualizar'}
        </button>

        <button
          type="button"
          className="helpdesk-ui-button helpdesk-ui-button--secondary"
          disabled={
            exporting ||
            !summary ||
            !validRange
          }
          onClick={() => void exportCsv()}
        >
          <Download size={16} />
          {exporting
            ? 'Exportando…'
            : 'Exportar CSV'}
        </button>
      </section>

      {error && (
        <div
          className="helpdesk-inbox__error"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading && !summary && (
        <p role="status">
          Cargando indicadores…
        </p>
      )}

      {summary && (
        <>
          <section
            className="hd-report__metrics"
            aria-label="Indicadores"
          >
            {metrics.map((metric) => {
              const Icon = metric.icon

              return (
                <article
                  key={metric.title}
                  className={
                    `hd-report__metric ` +
                    `hd-report__metric--${metric.tone}`
                  }
                >
                  <span>
                    <Icon size={20} />
                  </span>

                  <strong>
                    {metric.value}
                  </strong>

                  <small>
                    {metric.title}
                  </small>
                </article>
              )
            })}
          </section>

          <section
            className="hd-report__timing"
            aria-label="Tiempos promedio"
          >
            <article>
              <span>
                Primera respuesta
              </span>

              <strong>
                {summary
                  .averageFirstResponseHours ===
                null
                  ? '—'
                  : `${
                      summary.averageFirstResponseHours
                    } h`}
              </strong>
            </article>

            <article>
              <span>
                Resolución
              </span>

              <strong>
                {summary
                  .averageResolutionHours ===
                null
                  ? '—'
                  : `${
                      summary.averageResolutionHours
                    } h`}
              </strong>
            </article>
          </section>

          <div className="hd-report__grid">
            <DistributionChart
              title="Por prioridad"
              description="Nivel asignado al crear el caso"
              data={priorityData}
              type="donut"
            />

            <DistributionChart
              title="Por estado"
              description="Situación actual de las solicitudes"
              data={statusData}
              type="donut"
            />

            <DistributionChart
              title="Por categoría"
              description="Casos más frecuentes"
              data={summary.byCategory}
            />

            <DistributionChart
              title="Por origen"
              description="Canal de creación"
              data={summary.bySource}
            />
          </div>

          <section className="hd-report__chart-card hd-report__chart-card--wide">
            <header>
              <h2>
                Tendencia de solicitudes
              </h2>
              <p>
                Tickets creados por día
              </p>
            </header>

            <div className="hd-report__chart">
              {summary.daily.length ===
              0 ? (
                <div className="hd-report__empty">
                  Sin datos para
                  este período.
                </div>
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <LineChart
                    data={summary.daily}
                    margin={{
                      top: 14,
                      right: 18,
                      bottom: 18,
                      left: 0,
                    }}
                  >
                    <CartesianGrid
                      stroke="#e9eef7"
                      strokeDasharray="3 3"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="date"
                      tick={{
                        fontSize: 10,
                      }}
                    />

                    <YAxis
                      allowDecimals={
                        false
                      }
                    />

                    <Tooltip />

                    <Line
                      dataKey="count"
                      name="Tickets"
                      type="monotone"
                      stroke="#4d79e5"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{
                        r: 5,
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section className="hd-report__agents">
            <header>
              <h2>
                Actividad por agente
              </h2>
              <p>
                Asignaciones del período
                y tickets resueltos
                o cerrados
              </p>
            </header>

            {summary.byAgent.length ===
            0 ? (
              <div className="hd-report__empty">
                No hay asignaciones
                en el período.
              </div>
            ) : (
              <div className="hd-report__table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Agente</th>
                      <th>Asignados</th>
                      <th>Resueltos</th>
                    </tr>
                  </thead>

                  <tbody>
                    {summary.byAgent.map(
                      (agent) => (
                        <tr
                          key={
                            agent.label
                          }
                        >
                          <td>
                            {
                              agent.label
                            }
                          </td>

                          <td>
                            {
                              agent.count
                            }
                          </td>

                          <td>
                            {
                              agent.resolved
                            }
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}