import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, RefreshCw } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import apiClient from '../../api/apiClient'
import './HelpdeskPages.css'

type Count = {
  label: string
  count: number
}

type AgentCount = Count & {
  resolved: number
}

type DailyCount = {
  date: string
  count: number
}

type Summary = {
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

function Chart({
  title,
  data,
}: {
  title: string
  data: Count[]
}) {
  return (
    <section className="helpdesk-monitoring__chart-card">
      <div className="helpdesk-monitoring__heading">
        <h2>{title}</h2>
      </div>

      <div
        className="helpdesk-monitoring__chart"
        style={{ height: 260 }}
      >
        {data.length === 0 ? (
          <p className="helpdesk-monitoring__no-data">
            Sin datos en el período seleccionado.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{
                top: 12,
                right: 12,
                bottom: 20,
                left: 0,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={55}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11 }}
              />
              <Tooltip />
              <Bar
                dataKey="count"
                name="Tickets"
                fill="#4f6df5"
                radius={[5, 5, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}

export function HelpdeskReportsPage() {
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(() => dateInput(new Date()))
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    if (!from || !to || from > to) {
      setError('Selecciona un rango de fechas válido.')
      return
    }

    try {
      setLoading(true)
      setError('')

      const response = await apiClient.get<Summary>(
        '/helpdesk/reports/summary',
        { params: { from, to } },
      )

      setSummary(response.data)
    } catch {
      setError('No se pudo cargar el reporte.')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    void load()
  }, [load])

  async function exportCsv() {
    if (!from || !to || from > to) {
      setError('Selecciona un rango de fechas válido.')
      return
    }

    try {
      setExporting(true)
      setError('')

      const response = await apiClient.get<Blob>(
        '/helpdesk/reports/tickets.csv',
        {
          params: { from, to },
          responseType: 'blob',
        },
      )

      const url = URL.createObjectURL(response.data)
      const anchor = document.createElement('a')

      anchor.href = url
      anchor.download =
        `titanmdm-helpdesk-${from}-${to}.csv`

      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError('No se pudo exportar el CSV.')
    } finally {
      setExporting(false)
    }
  }

  const metrics = summary
    ? [
        ['Tickets creados', summary.total],
        ['Sin resolver', summary.unresolved],
        ['Sin asignar', summary.unassigned],
        [
          'Primera respuesta vencida',
          summary.overdueFirstResponse,
        ],
        [
          'Resolución vencida',
          summary.overdueResolution,
        ],
        [
          'Promedio primera respuesta',
          summary.averageFirstResponseHours === null
            ? '—'
            : `${summary.averageFirstResponseHours} h`,
        ],
        [
          'Promedio resolución',
          summary.averageResolutionHours === null
            ? '—'
            : `${summary.averageResolutionHours} h`,
        ],
      ]
    : []

  return (
    <main className="helpdesk-progress">
      <header className="helpdesk-progress__hero">
        <div>
          <p className="helpdesk-progress__eyebrow">
            TitanMDM · Mesa de Ayuda
          </p>
          <h1>Reportes operativos</h1>
          <p>
            Tickets creados durante el período seleccionado.
            Las fechas se evalúan en UTC.
          </p>
        </div>

        <Link
          to="/helpdesk?workspace=helpdesk"
          className="helpdesk-progress__back"
        >
          Volver a la bandeja
        </Link>
      </header>

      <section
        className="titan-section-card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'end',
          gap: 14,
        }}
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
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>

        <button
          type="button"
          onClick={() => void exportCsv()}
          disabled={exporting || !summary}
        >
          <Download size={16} />
          {exporting ? 'Exportando...' : 'Exportar CSV'}
        </button>
      </section>

      {error && (
        <p role="alert" className="reports-error">
          {error}
        </p>
      )}

      {summary && (
        <>
          <section
            className="helpdesk-progress__summary"
            aria-label="Indicadores del período"
          >
            {metrics.map(([label, value]) => (
              <article
                key={label}
                className="helpdesk-progress__stat"
              >
                <strong>{value}</strong>
                <span>{label}</span>
              </article>
            ))}
          </section>

          <div className="helpdesk-monitoring">
            <Chart
              title="Tickets por estado"
              data={summary.byStatus}
            />
            <Chart
              title="Tickets por prioridad"
              data={summary.byPriority}
            />
            <Chart
              title="Categorías principales"
              data={summary.byCategory}
            />
            <Chart
              title="Origen de los tickets"
              data={summary.bySource}
            />
          </div>

          <section className="titan-section-card">
            <h2>Tickets por agente</h2>

            {summary.byAgent.length === 0 ? (
              <p>Sin tickets en este período.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Agente</th>
                      <th>Asignados</th>
                      <th>Resueltos o cerrados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byAgent.map((agent) => (
                      <tr key={agent.label}>
                        <td>{agent.label}</td>
                        <td>{agent.count}</td>
                        <td>{agent.resolved}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="titan-section-card">
            <h2>Tickets creados por día</h2>

            {summary.daily.length === 0 ? (
              <p>Sin tickets en este período.</p>
            ) : (
              <div style={{ height: 260 }}>
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart data={summary.daily}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      name="Tickets"
                      fill="#20a785"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}