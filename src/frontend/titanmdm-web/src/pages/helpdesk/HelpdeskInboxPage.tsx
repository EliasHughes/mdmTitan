import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Headphones,
  Plus,
  RefreshCw,
  Search,
  Ticket,
  X,
} from 'lucide-react'
import { helpdeskApi, type HelpdeskTicketListItem } from '../../api/helpdeskApi'
import { useAuth } from '../../auth/AuthContext'
import './HelpdeskPages.css'

const PAGE_SIZE = 25

const STATUS_LABELS: Record<string, string> = {
  new: 'Nuevo',
  open: 'Abierto',
  pendinguser: 'Pendiente del usuario',
  resolved: 'Resuelto',
  closed: 'Cerrado',
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
}

const dateFormatter = new Intl.DateTimeFormat('es-DO', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export function HelpdeskInboxPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [tickets, setTickets] = useState<HelpdeskTicketListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [loading, setLoading] = useState(true)
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

  const load = useCallback(async () => {
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
      setError('No se pudieron cargar los tickets. Comprueba que la API y la base de datos estén disponibles.')
    } finally {
      setLoading(false)
    }
  }, [page, priorityFilter, search, status])

  useEffect(() => {
    void load()
  }, [load])

  const pageMetrics = useMemo(() => ({
    active: tickets.filter((item) => !['resolved', 'closed'].includes(item.status)).length,
    breached: tickets.filter((item) => item.slaBreached).length,
    unassigned: tickets.filter((item) => !item.assigneeUserId).length,
  }), [tickets])

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
      setError('No se pudo crear el ticket. Revisa los datos y vuelve a intentarlo.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="titan-page helpdesk-page helpdesk-inbox">
      <header className="helpdesk-inbox__header">
        <div>
          <span className="helpdesk-inbox__eyebrow">
            <Headphones size={15} aria-hidden="true" />
            Centro de soporte
          </span>
          <h1>Mesa de ayuda</h1>
          <p>Atiende solicitudes, consulta el historial y trabaja con el contexto de cada dispositivo.</p>
        </div>
        <div className="helpdesk-inbox__header-actions">
          <button
            type="button"
            className="helpdesk-ui-button helpdesk-ui-button--secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Actualizar
          </button>
          {canCreate && (
            <button
              type="button"
              className="helpdesk-ui-button helpdesk-ui-button--primary"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={17} aria-hidden="true" />
              Nuevo ticket
            </button>
          )}
        </div>
      </header>

      <div className="helpdesk-inbox__metrics" aria-label="Resumen de la página actual">
        <article className="helpdesk-metric">
          <span className="helpdesk-metric__icon helpdesk-metric__icon--blue">
            <Ticket size={19} aria-hidden="true" />
          </span>
          <div>
            <span>Tickets encontrados</span>
            <strong>{total}</strong>
          </div>
        </article>
        <article className="helpdesk-metric">
          <span className="helpdesk-metric__icon helpdesk-metric__icon--violet">
            <Clock3 size={19} aria-hidden="true" />
          </span>
          <div>
            <span>Activos en esta página</span>
            <strong>{pageMetrics.active}</strong>
          </div>
        </article>
        <article className="helpdesk-metric">
          <span className="helpdesk-metric__icon helpdesk-metric__icon--amber">
            <AlertCircle size={19} aria-hidden="true" />
          </span>
          <div>
            <span>SLA vencido en esta página</span>
            <strong>{pageMetrics.breached}</strong>
          </div>
        </article>
        <article className="helpdesk-metric">
          <span className="helpdesk-metric__icon helpdesk-metric__icon--green">
            <CheckCircle2 size={19} aria-hidden="true" />
          </span>
          <div>
            <span>Sin asignar en esta página</span>
            <strong>{pageMetrics.unassigned}</strong>
          </div>
        </article>
      </div>

      {error && (
        <div className="helpdesk-inbox__error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
          <button type="button" onClick={() => void load()}>Reintentar</button>
        </div>
      )}

      <section className="helpdesk-inbox__panel" aria-label="Bandeja de tickets">
        <div className="helpdesk-inbox__panel-heading">
          <div>
            <h2>Bandeja de tickets</h2>
            <p>Filtra y abre un ticket para ver su conversación y sus acciones.</p>
          </div>
          <span className="helpdesk-inbox__total">{total} resultados</span>
        </div>

        <div className="helpdesk-inbox__filters">
          <label className="helpdesk-inbox__search">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Buscar tickets</span>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applySearch()
              }}
              placeholder="Buscar número, asunto o categoría"
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
                    <Ticket size={28} aria-hidden="true" />
                    <strong>No hay tickets con estos filtros</strong>
                    <span>Prueba otra búsqueda o crea un ticket para comenzar.</span>
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
                  <td>{dateFormatter.format(new Date(item.createdAtUtc))}</td>
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
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
              Anterior
            </button>
            <span>Página {page} de {pageCount}</span>
            <button type="button" disabled={page >= pageCount || loading} onClick={() => setPage(page + 1)}>
              Siguiente
            </button>
          </div>
        </footer>
      </section>

      {showCreate && (
        <div className="helpdesk-inbox__overlay" onMouseDown={() => setShowCreate(false)}>
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
                <p>Registra el problema y asigna su clasificación inicial.</p>
              </div>
              <button type="button" aria-label="Cerrar" onClick={() => setShowCreate(false)}>
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
                  placeholder="Qué sucede, desde cuándo y cuál es el impacto"
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
                  <select value={priority} onChange={(event) => setPriority(event.target.value)}>
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
                  placeholder="general"
                />
              </label>
              <div className="helpdesk-inbox__dialog-actions">
                <button type="button" className="helpdesk-ui-button helpdesk-ui-button--secondary" onClick={() => setShowCreate(false)}>
                  Cancelar
                </button>
                <button type="submit" className="helpdesk-ui-button helpdesk-ui-button--primary" disabled={creating}>
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