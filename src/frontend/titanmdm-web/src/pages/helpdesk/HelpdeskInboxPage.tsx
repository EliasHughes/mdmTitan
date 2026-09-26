import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Clock3,
  Headphones,
  Plus,
  RefreshCw,
  Search,
  Ticket,
  UserRoundX,
  X,
} from 'lucide-react'
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
import { helpdeskApi, type HelpdeskTicketListItem } from '../../api/helpdeskApi'
import { useAuth } from '../../auth/AuthContext'
import './HelpdeskPages.css'

const PAGE_SIZE = 25

const STATUS_LABELS: Record<string, string> = {
  new: 'Nuevo',
  open: 'Abierto',
  pendinguser: 'Pendiente usuario',
  resolved: 'Resuelto',
  closed: 'Cerrado',
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
}

const ALERT_LABELS: Record<string, string> = {
  unassigned_reminder: 'Sin asignar',
  first_response_warning: 'Primera respuesta próxima',
  first_response_overdue: 'Primera respuesta vencida',
  resolution_warning: 'Resolución próxima',
  resolution_overdue: 'Resolución vencida',
}

interface CountByStatus {
  status: string
  count: number
}

interface CountByPriority {
  priority: string
  count: number
}

interface CountByCategory {
  category: string
  count: number
}

interface MonitoringSummary {
  total: number
  active: number
  unassigned: number
  overdueFirstResponse: number
  overdueResolution: number
  byStatus: CountByStatus[]
  byPriority: CountByPriority[]
  byCategory: CountByCategory[]
  generatedAtUtc: string
}

interface MonitoringAlert {
  id: string
  ticketId: string
  number: string
  subject: string
  eventType: string
  summary: string
  createdAtUtc: string
}

const dateFormatter = new Intl.DateTimeFormat('es-DO', {
  dateStyle: 'short',
  timeStyle: 'short',
})

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
}

export function HelpdeskInboxPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [tickets, setTickets] = useState<HelpdeskTicketListItem[]>([])
  const [summary, setSummary] = useState<MonitoringSummary | null>(null)
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [monitoringError, setMonitoringError] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('incident')
  const [priority, setPriority] = useState('medium')
  const [category, setCategory] = useState('general')

  const canCreate = user?.permissions?.includes('tickets.create') ?? false
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const lastRow = Math.min(page * PAGE_SIZE, total)

  const loadTickets = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await helpdeskApi.getTickets({
        search: search || undefined,
        status: status || undefined,
        priority: priorityFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      setTickets(result.items)
      setTotal(result.total)
    } catch {
      setTickets([])
      setTotal(0)
      setError('No fue posible cargar los tickets.')
    } finally {
      setLoading(false)
    }
  }, [search, status, priorityFilter, page])

  const loadMonitoring = useCallback(async () => {
    try {
      const [summaryResponse, alertsResponse] = await Promise.all([
        apiClient.get<MonitoringSummary>('/helpdesk/monitoring/summary'),
        apiClient.get<MonitoringAlert[]>('/helpdesk/monitoring/alerts', {
          params: { limit: 8 },
        }),
      ])

      setSummary(summaryResponse.data)
      setAlerts(alertsResponse.data)
      setMonitoringError(false)
    } catch {
      setMonitoringError(true)
    }
  }, [])

  useEffect(() => {
    void loadTickets()
  }, [loadTickets])

  useEffect(() => {
    void loadMonitoring()
  }, [loadMonitoring])

  function refresh() {
    void loadTickets()
    void loadMonitoring()
  }

  function applySearch() {
    setPage(1)
    setSearch(searchInput.trim())
  }

  function resetFilters() {
    setSearchInput('')
    setSearch('')
    setStatus('')
    setPriorityFilter('')
    setPage(1)
  }

  async function createTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!subject.trim() || !description.trim() || creating) return

    setCreating(true)
    setError(null)

    try {
      const created = await helpdeskApi.createTicket({
        subject: subject.trim(),
        description: description.trim(),
        type,
        priority,
        category: category.trim() || 'general',
        source: 'console',
      })

      setShowCreate(false)
      navigate(`/helpdesk/tickets/${created.id}?workspace=helpdesk`)
    } catch {
      setError('No se pudo crear el ticket. Revisa los datos e inténtalo de nuevo.')
    } finally {
      setCreating(false)
    }
  }

  const statusChart = summary?.byStatus.map((item) => ({
    name: STATUS_LABELS[item.status] ?? item.status,
    tickets: item.count,
  })) ?? []

  const priorityChart = summary?.byPriority.map((item) => ({
    name: PRIORITY_LABELS[item.priority] ?? item.priority,
    tickets: item.count,
  })) ?? []

  return (
    <main className="titan-page helpdesk-page helpdesk-inbox">
      <header className="helpdesk-inbox__header">
        <div>
          <span className="helpdesk-inbox__eyebrow">
            <Headphones size={15} />
            Operación TIC
          </span>
          <h1>Mesa de ayuda</h1>
          <p>Tickets, cumplimiento y alertas del equipo de soporte.</p>
        </div>

        <div className="helpdesk-inbox__header-actions">
          <button
            type="button"
            className="helpdesk-ui-button helpdesk-ui-button--secondary"
            onClick={refresh}
            disabled={loading}
          >

          <button
            type="button"
            className="helpdesk-ui-button helpdesk-ui-button--secondary"
            onClick={() => navigate('/helpdesk/avance')}
          >
            Ver avance del proyecto
          </button>

            <RefreshCw size={16} />
            Actualizar
          </button>
          {canCreate && (
            <button
              type="button"
              className="helpdesk-ui-button helpdesk-ui-button--primary"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={16} />
              Nuevo ticket
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="helpdesk-inbox__error" role="alert">
          <AlertCircle size={17} />
          {error}
          <button type="button" onClick={refresh}>Reintentar</button>
        </div>
      )}

      {monitoringError && (
        <div className="helpdesk-inbox__error" role="alert">
          <AlertCircle size={17} />
          Los KPI y alertas no están disponibles. Comprueba que el backend tenga
          HelpdeskMonitoringController y vuelve a actualizar.
        </div>
      )}

      <section className="helpdesk-inbox__metrics" aria-label="Indicadores de mesa de ayuda">
        <article className="helpdesk-metric">
          <span className="helpdesk-metric__icon helpdesk-metric__icon--blue">
            <Ticket size={19} />
          </span>
          <div><span>Total de tickets</span><strong>{summary?.total ?? '—'}</strong></div>
        </article>

        <article className="helpdesk-metric">
          <span className="helpdesk-metric__icon helpdesk-metric__icon--violet">
            <Clock3 size={19} />
          </span>
          <div><span>Tickets activos</span><strong>{summary?.active ?? '—'}</strong></div>
        </article>

        <article className="helpdesk-metric">
          <span className="helpdesk-metric__icon helpdesk-metric__icon--amber">
            <UserRoundX size={19} />
          </span>
          <div><span>Sin asignar</span><strong>{summary?.unassigned ?? '—'}</strong></div>
        </article>

        <article className="helpdesk-metric">
          <span className="helpdesk-metric__icon helpdesk-metric__icon--green">
            <AlertCircle size={19} />
          </span>
          <div>
            <span>SLA vencidos</span>
            <strong>
              {summary
                ? summary.overdueFirstResponse + summary.overdueResolution
                : '—'}
            </strong>
          </div>
        </article>
      </section>

      <div className="helpdesk-monitoring">
        <section className="helpdesk-monitoring__chart-card">
          <div className="helpdesk-monitoring__heading">
            <h2>Tickets por estado</h2>
            <p>Distribución de todos los casos de la organización</p>
          </div>
          <div className="helpdesk-monitoring__chart">
            {statusChart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChart} margin={{ top: 8, right: 12, left: -22, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf1f7" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="tickets" fill="#5867e8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="helpdesk-monitoring__no-data">Sin datos para mostrar</div>
            )}
          </div>
        </section>

        <section className="helpdesk-monitoring__chart-card">
          <div className="helpdesk-monitoring__heading">
            <h2>Prioridad de los casos</h2>
            <p>Distribución por nivel de atención</p>
          </div>
          <div className="helpdesk-monitoring__chart">
            {priorityChart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityChart} margin={{ top: 8, right: 12, left: -22, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf1f7" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="tickets" fill="#8b78e6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="helpdesk-monitoring__no-data">Sin datos para mostrar</div>
            )}
          </div>
        </section>
      </div>

      <section className="helpdesk-monitoring__alerts">
        <div className="helpdesk-monitoring__heading">
          <h2>Alertas recientes</h2>
          <p>Tickets sin atender y plazos de servicio próximos o vencidos</p>
        </div>
        {alerts.length === 0 ? (
          <p className="helpdesk-monitoring__no-alerts">No hay alertas registradas.</p>
        ) : (
          <div className="helpdesk-monitoring__alert-list">
            {alerts.map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => navigate(`/helpdesk/tickets/${alert.ticketId}?workspace=helpdesk`)}
              >
                <span className="helpdesk-monitoring__alert-icon">
                  <AlertCircle size={16} />
                </span>
                <span className="helpdesk-monitoring__alert-text">
                  <strong>{ALERT_LABELS[alert.eventType] ?? 'Alerta'} · {alert.number}</strong>
                  <small>{alert.subject} — {alert.summary}</small>
                </span>
                <time>{formatDate(alert.createdAtUtc)}</time>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="helpdesk-inbox__panel" aria-label="Bandeja de tickets">
        <div className="helpdesk-inbox__panel-heading">
          <div>
            <h2>Bandeja de tickets</h2>
            <p>Busca y abre casos para atenderlos.</p>
          </div>
          <span className="helpdesk-inbox__total">{total} resultados</span>
        </div>

        <div className="helpdesk-inbox__filters">
          <label className="helpdesk-inbox__search">
            <Search size={17} />
            <span className="sr-only">Buscar tickets</span>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applySearch()
              }}
              placeholder="Número, asunto o categoría"
            />
          </label>

          <label>
            <span className="sr-only">Filtrar por estado</span>
            <select
              value={status}
              onChange={(event) => {
                setPage(1)
                setStatus(event.target.value)
              }}
            >
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="sr-only">Filtrar por prioridad</span>
            <select
              value={priorityFilter}
              onChange={(event) => {
                setPage(1)
                setPriorityFilter(event.target.value)
              }}
            >
              <option value="">Todas las prioridades</option>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="helpdesk-ui-button helpdesk-ui-button--secondary"
            onClick={applySearch}
          >
            Buscar
          </button>
          <button type="button" className="helpdesk-inbox__clear" onClick={resetFilters}>
            Limpiar
          </button>
        </div>

        <div className="helpdesk-inbox__table-wrap">
          <table className="helpdesk-inbox__table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Estado</th>
                <th>Prioridad</th>
                <th>Solicitante</th>
                <th>Asignado</th>
                <th>Dispositivo</th>
                <th>Creado</th>
                <th><span className="sr-only">Abrir</span></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="helpdesk-inbox__empty">Cargando tickets…</td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="helpdesk-inbox__empty">
                    <Ticket size={28} />
                    <strong>No hay tickets con estos filtros</strong>
                    <span>Prueba otra búsqueda o crea el primer caso.</span>
                  </td>
                </tr>
              ) : tickets.map((item) => (
                <tr key={item.id}>
                  <td>
                    <button
                      type="button"
                      className="helpdesk-inbox__ticket-link"
                      onClick={() => navigate(`/helpdesk/tickets/${item.id}?workspace=helpdesk`)}
                    >
                      <span>{item.number}</span>
                      <strong>{item.subject}</strong>
                      {item.slaBreached && <small>SLA vencido</small>}
                    </button>
                  </td>
                  <td>
                    <span className={`helpdesk-inbox__badge helpdesk-inbox__badge--${item.status}`}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </td>
                  <td>{PRIORITY_LABELS[item.priority] ?? item.priority}</td>
                  <td>{item.requesterName}</td>
                  <td>{item.assigneeName ?? 'Sin asignar'}</td>
                  <td>{item.deviceName ?? '—'}</td>
                  <td>{formatDate(item.createdAtUtc)}</td>
                  <td>
                    <button
                      type="button"
                      className="helpdesk-inbox__open"
                      aria-label={`Abrir ${item.number}`}
                      onClick={() => navigate(`/helpdesk/tickets/${item.id}?workspace=helpdesk`)}
                    >
                      <ArrowRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="helpdesk-inbox__footer">
          <span>{firstRow}–{lastRow} de {total}</span>
          <div>
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </button>
            <span>Página {page} de {pageCount}</span>
            <button
              type="button"
              disabled={page >= pageCount || loading}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </button>
          </div>
        </footer>
      </section>

      {showCreate && (
        <div
          className="helpdesk-inbox__overlay"
          onMouseDown={() => setShowCreate(false)}
        >
          <section
            className="helpdesk-inbox__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="helpdesk-create-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="helpdesk-inbox__eyebrow">Nuevo caso</span>
                <h2 id="helpdesk-create-title">Crear ticket</h2>
                <p>Registra el problema y su clasificación inicial.</p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setShowCreate(false)}
              >
                <X size={19} />
              </button>
            </header>

            <form onSubmit={(event) => void createTicket(event)}>
              <label>
                Asunto
                <input
                  autoFocus
                  required
                  maxLength={250}
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Resumen claro del problema"
                />
              </label>

              <label>
                Descripción
                <textarea
                  required
                  maxLength={4000}
                  rows={5}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Qué ocurre, desde cuándo y cuál es el impacto"
                />
              </label>

              <div className="helpdesk-inbox__form-grid">
                <label>
                  Tipo
                  <select value={type} onChange={(event) => setType(event.target.value)}>
                    <option value="incident">Incidente</option>
                    <option value="request">Solicitud</option>
                  </select>
                </label>
                <label>
                  Prioridad
                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value)}
                  >
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Categoría
                <input
                  maxLength={80}
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                />
              </label>

              <div className="helpdesk-inbox__dialog-actions">
                <button
                  type="button"
                  className="helpdesk-ui-button helpdesk-ui-button--secondary"
                  onClick={() => setShowCreate(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="helpdesk-ui-button helpdesk-ui-button--primary"
                  disabled={creating}
                >
                  <Plus size={16} />
                  {creating ? 'Creando…' : 'Crear ticket'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}