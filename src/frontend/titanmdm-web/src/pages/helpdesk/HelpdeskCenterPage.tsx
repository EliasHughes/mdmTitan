import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import { Link, useLocation } from 'react-router-dom'
import axios from 'axios'
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { useAuth } from '../../auth/AuthContext'
import { HelpdeskRequestTemplates } from './HelpdeskRequestTemplates'
import './HelpdeskCenterPage.css'

interface Settings {
  classificationEnabled: boolean
  escalationDelayMinutes: number
  reopenDays: number
  revision: number
  modelConfigured: boolean
}

interface Count {
  label: string
  count: number
}

interface Analytics {
  total: number
  resolved: number
  active: number
  paused: number
  unassigned: number
  firstOverdue: number
  resolutionOverdue: number
  averageFirstResponseHours: number | null
  averageResolutionHours: number | null
  escalations24h: number
  byStatus: Count[]
  byCategory: Count[]
  byZone: Count[]
  byAgent: Count[]
  daily: { date: string; count: number }[]
  alerts: {
    id: string
    ticketId: string
    number: string
    eventType: string
    summary: string
    createdAtUtc: string
  }[]
}

interface Readiness {
  zones: number
  groups: number
  availableMemberships: number
  activeSchedules: number
  activeTemplates: number
  unlocatedUsers: number
  assistantUsers: number
}

function message(ex: unknown) {
  return axios.isAxiosError(ex) &&
    typeof ex.response?.data?.message === 'string'
    ? ex.response.data.message
    : 'No se pudo completar la operación.'
}

export function HelpdeskCenterPage() {
  const location = useLocation()

  const section =
    location.pathname.split('/').filter(Boolean).at(-1) ??
    'configuracion'

  const { hasPermission } = useAuth()
  const manager =
    hasPermission('helpdesk.manage') ||
    hasPermission('settings.manage')

  const [settings, setSettings] =
    useState<Settings | null>(null)
  const [data, setData] = useState<Analytics | null>(null)
  const [readiness, setReadiness] =
    useState<Readiness | null>(null)

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [filters, setFilters] =
    useState({ from: '', to: '' })

  const [version, setVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    setLoading(true)
    setError('')
    setSuccess('')
    setData(null)
    setReadiness(null)
    setSettings(null)

    const endpoint =
      section === 'configuracion'
        ? 'settings'
        : section === 'preparacion'
          ? 'readiness'
          : 'analytics'

    void apiClient
      .get(`/helpdesk/closure/${endpoint}`, {
        signal: controller.signal,
        params: {
          ...(filters.from ? { from: filters.from } : {}),
          ...(filters.to ? { to: filters.to } : {}),
        },
      })
      .then(result => {
        if (controller.signal.aborted) return

        if (endpoint === 'settings') {
          setSettings(result.data)
        } else if (endpoint === 'readiness') {
          setReadiness(result.data)
        } else {
          setData(result.data)
        }
      })
      .catch(ex => {
        if (!controller.signal.aborted) {
          setError(message(ex))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [section, filters, version])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!settings || saving) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const result = await apiClient.put<Settings>(
        '/helpdesk/closure/settings',
        settings,
      )
      setSettings(result.data)
      setSuccess('Configuración guardada.')
    } catch (ex) {
      setError(message(ex))
    } finally {
      setSaving(false)
    }
  }

  const statusNames: Record<string, string> = {
    new: 'Recibido',
    open: 'Abierto',
    inprogress: 'En proceso',
    pendinguser: 'Espera del usuario',
    resolved: 'Resuelto',
    closed: 'Cerrado',
  }

  const statusData =
    data?.byStatus.map(item => ({
      ...item,
      label: statusNames[item.label] ?? item.label,
    })) ?? []

  const metrics = data
    ? [
        ['Tickets', data.total],
        ['Activos', data.active],
        ['Resueltos o cerrados', data.resolved],
        ['En espera del usuario', data.paused],
        ['Sin técnico', data.unassigned],
        ['Primera respuesta vencida', data.firstOverdue],
        ['Resolución vencida', data.resolutionOverdue],
        [
          'Primera respuesta media (h)',
          data.averageFirstResponseHours?.toFixed(2) ?? '—',
        ],
        [
          'Resolución media (h)',
          data.averageResolutionHours?.toFixed(2) ?? '—',
        ],
        [
          'Escalamientos internos · últimas 24 h',
          data.escalations24h,
        ],
      ]
    : []

  return (
    <main className="titan-page hdc">
      <header>
        <h1>Centro de operación de Helpdesk</h1>
        <p>
          Configuración, preparación y métricas en
          pantallas separadas.
        </p>
      </header>

      <nav
        className="hdc-nav"
        aria-label="Centro de Helpdesk"
      >
        <Link to="/helpdesk/centro/alertas?workspace=helpdesk">
          Automatización y revisión
        </Link>
        <Link to="/helpdesk/centro/kpis?workspace=helpdesk">
          KPI
        </Link>
        <Link to="/helpdesk/centro/graficos?workspace=helpdesk">
          Gráficos
        </Link>

        {manager && (
          <>
            <Link to="/helpdesk/centro/configuracion?workspace=helpdesk">
              Configuración
            </Link>
            <Link to="/helpdesk/centro/preparacion?workspace=helpdesk">
              Preparación
            </Link>
          </>
        )}

        <Link to="/helpdesk/seguimiento?workspace=helpdesk">
          Seguimiento SLA
        </Link>

        <button
          type="button"
          disabled={loading || saving}
          onClick={() => setVersion(value => value + 1)}
        >
          Actualizar
        </button>
      </nav>

      {error && (
        <p className="hdc-error" role="alert">{error}</p>
      )}
      {success && <p role="status">{success}</p>}
      {loading && <p role="status">Cargando…</p>}

      {section === 'configuracion' &&
        settings &&
        manager && (
          <>
            <section className="hdc-card">
              <h2>Reglas de automatización</h2>

              <form onSubmit={event => void save(event)}>
                <label className="hdc-check">
                  <input
                    type="checkbox"
                    checked={settings.classificationEnabled}
                    disabled={
                      saving ||
                      (!settings.modelConfigured &&
                        !settings.classificationEnabled)
                    }
                    onChange={event =>
                      setSettings({
                        ...settings,
                        classificationEnabled:
                          event.target.checked,
                      })
                    }
                  />
                  Clasificar automáticamente casos de
                  categoría General
                </label>

                <p>
                  Requiere modelo habilitado en el servidor
                  y acceso a Titan concedido al solicitante.
                  Los resultados ambiguos quedan para revisión.
                </p>

                {!settings.modelConfigured && (
                  <p>
                    La conexión y el modelo de Ollama siguen
                    pendientes de configuración. La clasificación
                    permanece disponible para habilitarla después.
                  </p>
                )}

                <label>
                  Minutos de SLA vencido antes de escalar
                  a coordinación
                  <input
                    type="number"
                    min={15}
                    max={1440}
                    required
                    disabled={saving}
                    value={settings.escalationDelayMinutes}
                    onChange={event =>
                      setSettings({
                        ...settings,
                        escalationDelayMinutes:
                          Number(event.target.value),
                      })
                    }
                  />
                </label>

                <label>
                  Días para que el solicitante pueda reabrir
                  <input
                    type="number"
                    min={1}
                    max={30}
                    required
                    disabled={saving}
                    value={settings.reopenDays}
                    onChange={event =>
                      setSettings({
                        ...settings,
                        reopenDays:
                          Number(event.target.value),
                      })
                    }
                  />
                </label>

                <button disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar reglas'}
                </button>
              </form>
            </section>

            <section className="hdc-card">
              <h2>Administración de la mesa</h2>
              <div className="hdc-nav">
                <Link to="/helpdesk/operations?workspace=helpdesk">
                  Zonas, técnicos y ubicación de usuarios
                </Link>
                <Link to="/helpdesk/especialidades?workspace=helpdesk">
                  Grupos, tareas, cobertura y turnos
                </Link>
                <Link to="/helpdesk/cobertura?workspace=helpdesk">
                  Validación de cobertura
                </Link>
                <Link to="/roles?workspace=administration">
                  Roles y permisos
                </Link>
              </div>
              <p>
                Las categorías se administran en las tareas
                de los grupos. Esta pantalla centraliza los
                accesos existentes.
              </p>
            </section>

            <section className="hdc-card">
              <h2>Catálogo de plantillas</h2>
              <HelpdeskRequestTemplates
                onApply={() =>
                  setSuccess(
                    'Vista previa aplicada. Para crear el ' +
                      'ticket utiliza Mis solicitudes.',
                  )
                }
              />
            </section>
          </>
        )}

      {section === 'preparacion' && readiness && (
        <section className="hdc-card">
          <h2>Indicadores de configuración</h2>

          <div className="hdc-metrics">
            {Object.entries(readiness).map(([key, value]) => (
              <article key={key}>
                <span>
                  {{
                    zones: 'Zonas activas',
                    groups: 'Grupos activos',
                    availableMemberships:
                      'Membresías disponibles',
                    activeSchedules: 'Turnos habilitados',
                    activeTemplates: 'Plantillas activas',
                    unlocatedUsers: 'Usuarios sin ubicación',
                    assistantUsers:
                      'Usuarios con Titan habilitado',
                  }[key] ?? key}
                </span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>

          <p>
            Son indicadores, no una certificación funcional.
            Completa la ubicación de los usuarios y valida
            la cobertura antes de activar el correo.
          </p>
        </section>
      )}

      {['kpis', 'graficos', 'alertas'].includes(section) && (
        <>
          <form
            className="hdc-filters"
            onSubmit={event => {
              event.preventDefault()

              if (from && to && from > to) {
                setError('El inicio debe ser anterior al fin.')
                return
              }

              setFilters({ from, to })
            }}
          >
            <label>
              Desde
              <input
                type="date"
                value={from}
                onChange={event => setFrom(event.target.value)}
              />
            </label>
            <label>
              Hasta
              <input
                type="date"
                value={to}
                onChange={event => setTo(event.target.value)}
              />
            </label>

            <button disabled={loading}>Aplicar filtros</button>

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setFrom('')
                setTo('')
                setFilters({ from: '', to: '' })
              }}
            >
              Todo el histórico
            </button>
          </form>

          <p>
            Sin fechas se utiliza todo el histórico.
            Los filtros se aplican a la fecha de creación
            del ticket.
          </p>
        </>
      )}

      {section === 'alertas' && data && (
        <section className="hdc-card">
          <h2>Automatización · últimas 24 horas</h2>
          <p>
            Escalamientos y clasificaciones son registros
            internos; no son correos enviados.
          </p>

          {!data.alerts.length && (
            <p>No hay registros para este alcance.</p>
          )}

          {data.alerts.map(item => (
            <article key={item.id}>
              <Link
                to={`/helpdesk/tickets/${item.ticketId}?workspace=helpdesk`}
              >
                {item.number}
              </Link>
              <p>{item.summary}</p>
              <small>{item.createdAtUtc} UTC</small>
              <hr />
            </article>
          ))}
        </section>
      )}

      {section === 'kpis' && data && (
        <div className="hdc-metrics">
          {metrics.map(([label, value]) => (
            <article key={String(label)}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      )}

      {section === 'graficos' && data && (
        <div className="hdc-charts">
          {[
            ['Por zona actual del solicitante', data.byZone],
            ['Por técnico asignado', data.byAgent],
          ].map(([title, rows]) => (
            <section className="hdc-card" key={String(title)}>
              <h2>{String(title)}</h2>
              <p>
                La zona corresponde a la ubicación actual,
                no a una ubicación histórica del ticket.
              </p>

              <div className="hdc-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={rows as Count[]}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={110}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      name="Tickets"
                      fill="#16a34a"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          ))}

          <section className="hdc-card">
            <h2>Tickets por estado</h2>

            {!data.total ? (
              <p>No hay tickets en este período.</p>
            ) : (
              <div className="hdc-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="count"
                      nameKey="label"
                      fill="#7656d6"
                      label
                    />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="hdc-card">
            <h2>Tickets por categoría</h2>
            <div className="hdc-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byCategory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name="Tickets"
                    fill="#7656d6"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="hdc-card">
            <h2>Tickets por día · UTC</h2>
            <div className="hdc-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.daily.map(item => ({
                    ...item,
                    date: item.date.slice(0, 10),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line
                    dataKey="count"
                    name="Tickets"
                    stroke="#2563eb"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}