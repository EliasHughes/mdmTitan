import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
  Download,
  Gauge,
  MapPin,
  RefreshCw,
  RotateCcw,
  Ticket,
  Timer,
  UserRoundX,
  Users,
  Workflow,
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

import { Link } from 'react-router-dom'

import apiClient from '../../api/apiClient'

import './HelpdeskPages.css'
import './HelpdeskReportsPage.css'

interface Count {
  label: string
  count: number
}

interface SiteCount extends Count {
  resolved: number
}

interface AgentCount extends Count {
  resolved: number
  active: number
  resolutionRate: number
  slaBreached: number
}

interface DailyCount {
  date: string
  created: number
  resolved: number
}

interface SlaMetric {
  evaluated: number
  met: number
  breached: number
  compliancePercent: number
}

interface AutomationMetrics {
  autoAssigned: number
  autoHandovers: number
  classifications: number
  classificationReviews: number
  escalations: number
  reminders: number
  overdueAlerts: number
  reopened: number
}

interface Summary {
  from: string
  to: string

  total: number
  resolved: number
  unresolved: number
  currentBacklog: number
  unassigned: number
  pendingUser: number

  overdueFirstResponse: number
  overdueResolution: number

  averageFirstResponseHours:
    | number
    | null

  medianFirstResponseHours:
    | number
    | null

  averageResolutionHours:
    | number
    | null

  medianResolutionHours:
    | number
    | null

  firstResponseSla: SlaMetric
  resolutionSla: SlaMetric

  byStatus: Count[]
  byPriority: Count[]
  byCategory: Count[]
  bySource: Count[]

  bySite: SiteCount[]
  byAgent: AgentCount[]

  backlogAging: Count[]

  daily: DailyCount[]

  automation: AutomationMetrics

  generatedAtUtc: string
}

const COLORS = [
  '#5575ee',
  '#23a978',
  '#8b6be8',
  '#e7a83e',
  '#e15c64',
  '#3fa8d9',
]

const STATUS: Record<string, string> = {
  new: 'Nuevo',
  open: 'Abierto',
  inprogress: 'En proceso',
  pendinguser: 'Espera usuario',
  resolved: 'Resuelto',
  closed: 'Cerrado',
}

const PRIORITY: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
}

const SOURCE: Record<string, string> = {
  console: 'TitanMDM',
  email: 'Correo',
  portal: 'Portal',
  api: 'API',
}

function dateInput(
  date: Date,
) {
  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1,
    ).padStart(
      2,
      '0',
    ),
    String(
      date.getDate(),
    ).padStart(
      2,
      '0',
    ),
  ].join('-')
}

function initialFrom() {
  const date =
    new Date()

  date.setDate(
    date.getDate() -
      29,
  )

  return dateInput(
    date,
  )
}

function localized(
  data: Count[],
  labels: Record<
    string,
    string
  >,
) {
  return data.map(
    item => ({
      ...item,

      label:
        labels[
          item.label
        ] ??
        item.label,
    }),
  )
}

function hours(
  value:
    | number
    | null,
) {
  if (
    value ===
    null
  ) {
    return '—'
  }

  if (
    value <
    1
  ) {
    return `${Math.round(
      value * 60,
    )} min`
  }

  return `${value.toFixed(
    1,
  )} h`
}

function percent(
  value: number,
) {
  return `${value.toFixed(
    1,
  )}%`
}

function SlaCard({
  title,
  metric,
}: {
  title: string
  metric: SlaMetric
}) {
  const width =
    Math.max(
      0,
      Math.min(
        100,
        metric
          .compliancePercent,
      ),
    )

  return (
    <article className="hd-kpi__sla-card">
      <div className="hd-kpi__sla-head">
        <div>
          <span>
            {title}
          </span>

          <strong>
            {percent(
              metric
                .compliancePercent,
            )}
          </strong>
        </div>

        <Gauge
          size={25}
        />
      </div>

      <div className="hd-kpi__progress">
        <span
          style={{
            width:
              `${width}%`,
          }}
        />
      </div>

      <div className="hd-kpi__sla-foot">
        <span>
          <b>
            {
              metric.met
            }
          </b>{' '}
          dentro de SLA
        </span>

        <span>
          <b>
            {
              metric.breached
            }
          </b>{' '}
          vencidos
        </span>

        <span>
          {
            metric.evaluated
          }{' '}
          evaluados
        </span>
      </div>
    </article>
  )
}

function HorizontalChart({
  title,
  description,
  data,
}: {
  title: string
  description: string
  data: Count[]
}) {
  return (
    <section className="hd-kpi__panel">
      <header>
        <h2>
          {title}
        </h2>

        <p>
          {description}
        </p>
      </header>

      <div className="hd-kpi__chart hd-kpi__chart--bar">
        {data.length ===
        0 ? (
          <div className="hd-kpi__empty">
            No hay información
            para este período.
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <BarChart
              data={data}
              layout="vertical"
              margin={{
                top: 8,
                right: 25,
                bottom: 8,
                left: 12,
              }}
            >
              <CartesianGrid
                stroke="#edf1f7"
                horizontal={false}
              />

              <XAxis
                type="number"
                allowDecimals={false}
              />

              <YAxis
                type="category"
                dataKey="label"
                width={135}
                tick={{
                  fontSize: 11,
                }}
              />

              <Tooltip />

              <Bar
                dataKey="count"
                name="Tickets"
                fill="#5979ef"
                radius={[
                  0,
                  7,
                  7,
                  0,
                ]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}

function DistributionChart({
  title,
  description,
  data,
}: {
  title: string
  description: string
  data: Count[]
}) {
  return (
    <section className="hd-kpi__panel">
      <header>
        <h2>
          {title}
        </h2>

        <p>
          {description}
        </p>
      </header>

      <div className="hd-kpi__chart">
        {data.length ===
        0 ? (
          <div className="hd-kpi__empty">
            Sin datos.
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="label"
                innerRadius={75}
                outerRadius={112}
                paddingAngle={2}
              >
                {data.map(
                  (
                    item,
                    index,
                  ) => (
                    <Cell
                      key={
                        `${item.label}-${index}`
                      }
                      fill={
                        COLORS[
                          index %
                            COLORS.length
                        ]
                      }
                    />
                  ),
                )}
              </Pie>

              <Tooltip />

              <Legend
                verticalAlign="bottom"
                height={42}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}

export function HelpdeskReportsPage() {
  const [from, setFrom] =
    useState(
      initialFrom,
    )

  const [to, setTo] =
    useState(
      () =>
        dateInput(
          new Date(),
        ),
    )

  const [
    summary,
    setSummary,
  ] =
    useState<
      Summary | null
    >(
      null,
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    )

  const [
    exporting,
    setExporting,
  ] =
    useState(
      false,
    )

  const [
    error,
    setError,
  ] =
    useState(
      '',
    )

  const validRange =
    Boolean(
      from &&
        to,
    )
    &&
    from <= to

  const load =
    useCallback(
      async () => {
        if (
          !validRange
        ) {
          setError(
            'Selecciona un rango de fechas válido.',
          )

          return
        }

        setLoading(
          true,
        )

        setError(
          '',
        )

        try {
          const response =
            await apiClient.get<Summary>(
              '/helpdesk/reports/summary',
              {
                params: {
                  from,
                  to,
                },
              },
            )

          setSummary(
            response.data,
          )
        } catch {
          setSummary(
            null,
          )

          setError(
            'No se pudieron cargar los KPI de Helpdesk.',
          )
        } finally {
          setLoading(
            false,
          )
        }
      },
      [
        from,
        to,
        validRange,
      ],
    )

  useEffect(
    () => {
      void load()
    },
    [
      load,
    ],
  )

  async function exportCsv() {
    if (
      !validRange
      ||
      exporting
      ||
      !summary
    ) {
      return
    }

    setExporting(
      true,
    )

    setError(
      '',
    )

    try {
      const response =
        await apiClient.get<Blob>(
          '/helpdesk/reports/tickets.csv',
          {
            params: {
              from,
              to,
            },

            responseType:
              'blob',
          },
        )

      const url =
        URL.createObjectURL(
          response.data,
        )

      const anchor =
        document.createElement(
          'a',
        )

      anchor.href =
        url

      anchor.download =
        `titanmdm-helpdesk-${from}-${to}.csv`

      document.body
        .appendChild(
          anchor,
        )

      anchor.click()

      anchor.remove()

      window.setTimeout(
        () =>
          URL.revokeObjectURL(
            url,
          ),
        1000,
      )
    } catch {
      setError(
        'No se pudo descargar el reporte.',
      )
    } finally {
      setExporting(
        false,
      )
    }
  }

  const statusData =
    summary
      ? localized(
          summary.byStatus,
          STATUS,
        )
      : []

  const priorityData =
    summary
      ? localized(
          summary.byPriority,
          PRIORITY,
        )
      : []

  const sourceData =
    summary
      ? localized(
          summary.bySource,
          SOURCE,
        )
      : []

  const mainMetrics =
    useMemo(
      () => {
        if (
          !summary
        ) {
          return []
        }

        return [
          {
            title:
              'Tickets período',

            value:
              summary.total,

            detail:
              `${summary.resolved} resueltos`,

            icon:
              Ticket,

            tone:
              'blue',
          },

          {
            title:
              'Backlog actual',

            value:
              summary.currentBacklog,

            detail:
              `${summary.unassigned} sin técnico`,

            icon:
              Activity,

            tone:
              'violet',
          },

          {
            title:
              'Sin asignar',

            value:
              summary.unassigned,

            detail:
              'Requieren routing',

            icon:
              UserRoundX,

            tone:
              'amber',
          },

          {
            title:
              'SLA vencidos',

            value:
              summary
                .overdueFirstResponse
              +
              summary
                .overdueResolution,

            detail:
              'Requieren atención',

            icon:
              AlertTriangle,

            tone:
              'red',
          },

          {
            title:
              'En espera usuario',

            value:
              summary.pendingUser,

            detail:
              'SLA pausado',

            icon:
              Clock3,

            tone:
              'cyan',
          },

          {
            title:
              'Autoasignados',

            value:
              summary
                .automation
                .autoAssigned,

            detail:
              'Asignados por TitanMDM',

            icon:
              Workflow,

            tone:
              'green',
          },

          {
            title:
              'Escalados',

            value:
              summary
                .automation
                .escalations,

            detail:
              'Automatización SLA',

            icon:
              Bot,

            tone:
              'purple',
          },

          {
            title:
              'Reabiertos',

            value:
              summary
                .automation
                .reopened,

            detail:
              'Casos reactivados',

            icon:
              RotateCcw,

            tone:
              'slate',
          },
        ]
      },
      [
        summary,
      ],
    )

  return (
    <main className="titan-page helpdesk-page hd-kpi">
      <header className="hd-kpi__hero">
        <div>
          <span className="hd-kpi__eyebrow">
            <Gauge
              size={15}
            />
            TITANMDM SERVICE INTELLIGENCE
          </span>

          <h1>
            KPI y rendimiento
          </h1>

          <p>
            Analiza volumen,
            cumplimiento SLA,
            tiempos de atención,
            carga por localidad,
            desempeño técnico
            y automatizaciones
            ejecutadas.
          </p>
        </div>

        <Link
          to="/helpdesk?workspace=helpdesk"
          className="helpdesk-ui-button helpdesk-ui-button--secondary"
        >
          <ArrowLeft
            size={16}
          />
          Bandeja TIC
        </Link>
      </header>

      <section className="hd-kpi__filters">
        <label>
          Desde

          <input
            type="date"
            value={from}
            onChange={
              event =>
                setFrom(
                  event
                    .target
                    .value,
                )
            }
          />
        </label>

        <label>
          Hasta

          <input
            type="date"
            value={to}
            onChange={
              event =>
                setTo(
                  event
                    .target
                    .value,
                )
            }
          />
        </label>

        <button
          type="button"
          className="helpdesk-ui-button helpdesk-ui-button--primary"
          disabled={
            loading ||
            !validRange
          }
          onClick={
            () =>
              void load()
          }
        >
          <RefreshCw
            size={16}
          />

          {loading
            ? 'Actualizando…'
            : 'Actualizar'}
        </button>

        <button
          type="button"
          className="helpdesk-ui-button helpdesk-ui-button--secondary"
          disabled={
            exporting ||
            !summary
          }
          onClick={
            () =>
              void exportCsv()
          }
        >
          <Download
            size={16}
          />

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

      {summary && (
        <>
          <section className="hd-kpi__metrics">
            {mainMetrics.map(
              metric => {
                const Icon =
                  metric.icon

                return (
                  <article
                    key={
                      metric.title
                    }
                    className={
                      `hd-kpi__metric hd-kpi__metric--${metric.tone}`
                    }
                  >
                    <span className="hd-kpi__metric-icon">
                      <Icon
                        size={20}
                      />
                    </span>

                    <div>
                      <small>
                        {
                          metric.title
                        }
                      </small>

                      <strong>
                        {
                          metric.value
                        }
                      </strong>

                      <p>
                        {
                          metric.detail
                        }
                      </p>
                    </div>
                  </article>
                )
              },
            )}
          </section>

          <section className="hd-kpi__sla-grid">
            <SlaCard
              title="SLA primera respuesta"
              metric={
                summary.firstResponseSla
              }
            />

            <SlaCard
              title="SLA resolución"
              metric={
                summary.resolutionSla
              }
            />
          </section>

          <section className="hd-kpi__time-grid">
            <article>
              <Timer
                size={20}
              />

              <span>
                Promedio primera respuesta
              </span>

              <strong>
                {hours(
                  summary
                    .averageFirstResponseHours,
                )}
              </strong>
            </article>

            <article>
              <Clock3
                size={20}
              />

              <span>
                Mediana primera respuesta
              </span>

              <strong>
                {hours(
                  summary
                    .medianFirstResponseHours,
                )}
              </strong>
            </article>

            <article>
              <Timer
                size={20}
              />

              <span>
                Promedio resolución
              </span>

              <strong>
                {hours(
                  summary
                    .averageResolutionHours,
                )}
              </strong>
            </article>

            <article>
              <CheckCircle2
                size={20}
              />

              <span>
                Mediana resolución
              </span>

              <strong>
                {hours(
                  summary
                    .medianResolutionHours,
                )}
              </strong>
            </article>
          </section>

          <section className="hd-kpi__panel hd-kpi__panel--wide">
            <header>
              <h2>
                Flujo de tickets
              </h2>

              <p>
                Creación versus resolución
                diaria. Permite identificar
                crecimiento real del backlog.
              </p>
            </header>

            <div className="hd-kpi__chart hd-kpi__chart--trend">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <LineChart
                  data={
                    summary.daily
                  }
                  margin={{
                    top: 15,
                    right: 24,
                    bottom: 10,
                    left: 0,
                  }}
                >
                  <CartesianGrid
                    stroke="#edf1f7"
                    strokeDasharray="4 4"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="date"
                    tick={{
                      fontSize: 10,
                    }}
                  />

                  <YAxis
                    allowDecimals={false}
                  />

                  <Tooltip />

                  <Legend />

                  <Line
                    type="monotone"
                    dataKey="created"
                    name="Creados"
                    stroke="#5476ee"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{
                      r: 5,
                    }}
                  />

                  <Line
                    type="monotone"
                    dataKey="resolved"
                    name="Resueltos"
                    stroke="#28a879"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{
                      r: 5,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="hd-kpi__two">
            <DistributionChart
              title="Estado de la mesa"
              description="Distribución de los tickets del período"
              data={
                statusData
              }
            />

            <DistributionChart
              title="Canales de entrada"
              description="Cómo están llegando las solicitudes"
              data={
                sourceData
              }
            />
          </div>

          <div className="hd-kpi__two">
            <HorizontalChart
              title="Categorías con mayor demanda"
              description="Permite identificar áreas que consumen más soporte"
              data={
                summary.byCategory
              }
            />

            <HorizontalChart
              title="Antigüedad del backlog"
              description="Edad actual de todos los tickets abiertos"
              data={
                summary.backlogAging
              }
            />
          </div>

          <div className="hd-kpi__two">
            <HorizontalChart
              title="Tickets por localidad"
              description="Distribución Multi-Site de la demanda"
              data={
                summary.bySite
              }
            />

            <DistributionChart
              title="Prioridad"
              description="Distribución por criticidad"
              data={
                priorityData
              }
            />
          </div>

          <section className="hd-kpi__panel hd-kpi__panel--wide">
            <header>
              <h2>
                Automatización TitanMDM
              </h2>

              <p>
                Acciones realizadas automáticamente
                durante el período seleccionado.
              </p>
            </header>

            <div className="hd-kpi__automation">
              <article>
                <Workflow />
                <strong>
                  {
                    summary
                      .automation
                      .autoAssigned
                  }
                </strong>
                <span>
                  Autoasignaciones
                </span>
              </article>

              <article>
                <Users />
                <strong>
                  {
                    summary
                      .automation
                      .autoHandovers
                  }
                </strong>
                <span>
                  Relevos
                </span>
              </article>

              <article>
                <Bot />
                <strong>
                  {
                    summary
                      .automation
                      .classifications
                  }
                </strong>
                <span>
                  Clasificaciones IA
                </span>
              </article>

              <article>
                <AlertTriangle />
                <strong>
                  {
                    summary
                      .automation
                      .escalations
                  }
                </strong>
                <span>
                  Escalamientos SLA
                </span>
              </article>

              <article>
                <Clock3 />
                <strong>
                  {
                    summary
                      .automation
                      .reminders
                  }
                </strong>
                <span>
                  Recordatorios
                </span>
              </article>

              <article>
                <RotateCcw />
                <strong>
                  {
                    summary
                      .automation
                      .reopened
                  }
                </strong>
                <span>
                  Reaperturas
                </span>
              </article>
            </div>
          </section>

          <section className="hd-kpi__panel hd-kpi__panel--wide">
            <header>
              <h2>
                Rendimiento por técnico
              </h2>

              <p>
                Volumen atendido, resolución
                y eventos de incumplimiento SLA.
              </p>
            </header>

            <div className="hd-kpi__table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      Técnico
                    </th>

                    <th>
                      Asignados
                    </th>

                    <th>
                      Activos
                    </th>

                    <th>
                      Resueltos
                    </th>

                    <th>
                      Tasa resolución
                    </th>

                    <th>
                      SLA vencidos
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {summary
                    .byAgent
                    .map(
                      agent => (
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
                              agent.active
                            }
                          </td>

                          <td>
                            {
                              agent.resolved
                            }
                          </td>

                          <td>
                            {percent(
                              agent.resolutionRate,
                            )}
                          </td>

                          <td>
                            {
                              agent.slaBreached
                            }
                          </td>
                        </tr>
                      ),
                    )}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="hd-kpi__footer">
            <MapPin
              size={14}
            />

            Datos generados por
            TitanMDM a las{' '}

            {new Date(
              summary.generatedAtUtc,
            ).toLocaleString()}
          </footer>
        </>
      )}
    </main>
  )
}