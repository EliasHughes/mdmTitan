import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ClipboardList,
  Plus,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react'
import apiClient from '../../api/apiClient'
import { useAuth } from '../../auth/AuthContext'
import { HelpdeskCreateRequest } from './HelpdeskCreateRequest'
import './HelpdeskPages.css'
import './HelpdeskWorkPage.css'

type View = 'mine' | 'unassigned' | 'all'

type Ticket = {
  id: string
  number: string
  subject: string
  status: string
  priority: string
  category: string
  requesterName: string
  assigneeName: string | null
  updatedAtUtc: string
  slaBreached: boolean
}

type Result = {
  items: Ticket[]
  total: number
}

type Workload = {
  assignedToMe: number
  unassigned: number
  active: number
  agents: {
    userId: string
    name: string
    openTickets: number
    isAvailable: boolean
    capacity: number
  }[]
}

const STATUS: Record<string, string> = {
  new: 'Nuevo',
  open: 'Abierto',
  inprogress: 'En proceso',
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

function date(value: string) {
  const parsed = new Date(
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : value + 'Z',
  )

  return Number.isNaN(parsed.getTime())
    ? '—'
    : new Intl.DateTimeFormat('es-DO', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(parsed)
}

export function HelpdeskInboxPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [view, setView] = useState<View>('mine')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [workload, setWorkload] = useState<Workload | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [workloadError, setWorkloadError] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const canCreate =
    user?.permissions?.includes('tickets.create') ?? false

  const pages = Math.max(1, Math.ceil(total / 25))

  const open = (id: string) =>
    navigate(`/helpdesk/tickets/${id}?workspace=helpdesk`)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const { data } = await apiClient.get<Result>(
        '/helpdesk/workload/tickets',
        {
          params: {
            view,
            search: search || undefined,
            status: status || undefined,
            priority: priority || undefined,
            page,
            pageSize: 25,
          },
        },
      )

      setTickets(data.items)
      setTotal(data.total)
    } catch {
      setTickets([])
      setTotal(0)
      setError('No se pudieron cargar las solicitudes.')
    } finally {
      setLoading(false)
    }
  }, [view, search, status, priority, page])

  const loadWorkload = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Workload>(
        '/helpdesk/workload',
      )

      setWorkload(data)
      setWorkloadError(false)
    } catch {
      setWorkload(null)
      setWorkloadError(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadWorkload()
  }, [loadWorkload])

  const refresh = () => {
    void load()
    void loadWorkload()
  }

  const apply = () => {
    setSearch(input.trim())
    setPage(1)
  }

  return (
    <main className="titan-page helpdesk-page helpdesk-inbox helpdesk-work">
      <header className="helpdesk-inbox__header">
        <div>
          <span className="helpdesk-inbox__eyebrow">
            <ClipboardList size={15} /> Operación TIC
          </span>
          <h1>Mesa de ayuda</h1>
          <p>Atiende solicitudes y revisa los casos sin asignar.</p>
        </div>

        <div className="helpdesk-inbox__header-actions">
          <button
            className="helpdesk-ui-button helpdesk-ui-button--secondary"
            onClick={() =>
              navigate('/helpdesk/centro/kpis?workspace=helpdesk')
            }
          >
            KPI
          </button>

          <button
            className="helpdesk-ui-button helpdesk-ui-button--secondary"
            onClick={() =>
              navigate('/helpdesk/centro/graficos?workspace=helpdesk')
            }
          >
            Gráficos
          </button>

          <button
            className="helpdesk-ui-button helpdesk-ui-button--secondary"
            disabled={loading}
            onClick={refresh}
          >
            <RefreshCw size={16} /> Actualizar
          </button>

          {canCreate && (
            <button
              className="helpdesk-ui-button helpdesk-ui-button--primary"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={16} /> Nuevo ticket
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="helpdesk-inbox__error" role="alert">
          {error}
          <button onClick={refresh}>Reintentar</button>
        </div>
      )}

      {workloadError && (
        <div className="helpdesk-inbox__error" role="alert">
          La carga del equipo no está disponible.
        </div>
      )}

      <nav
        className="helpdesk-work__tabs"
        aria-label="Bandejas de tickets"
      >
        {([
          ['mine', 'Mi trabajo', workload?.assignedToMe],
          ['unassigned', 'Sin asignar', workload?.unassigned],
          ['all', 'Todas', workload?.active],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            className={view === key ? 'is-active' : ''}
            aria-pressed={view === key}
            onClick={() => {
              setView(key)
              setPage(1)
            }}
          >
            {label}
            {count !== undefined && <strong>{count}</strong>}
          </button>
        ))}
      </nav>

      <div className="helpdesk-work__layout">
        <section
          className="helpdesk-inbox__panel"
          aria-label="Solicitudes"
        >
          <div className="helpdesk-inbox__panel-heading">
            <div>
              <h2>
                {view === 'mine'
                  ? 'Asignadas a mí'
                  : view === 'unassigned'
                    ? 'Sin asignar'
                    : 'Todas las solicitudes'}
              </h2>
              <p>Abre un caso para atenderlo y consultar su historial.</p>
            </div>
            <span className="helpdesk-inbox__total">
              {total} resultados
            </span>
          </div>

          <div className="helpdesk-inbox__filters">
            <label className="helpdesk-inbox__search">
              <Search size={17} />
              <span className="sr-only">Buscar</span>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') apply()
                }}
                placeholder="Número, asunto o categoría"
              />
            </label>

            <label>
              <span className="sr-only">Estado</span>
              <select
                value={status}
                onChange={e => {
                  setStatus(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">Todos los estados</option>
                {Object.entries(STATUS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="sr-only">Prioridad</span>
              <select
                value={priority}
                onChange={e => {
                  setPriority(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">Todas las prioridades</option>
                {Object.entries(PRIORITY).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>

            <button
              className="helpdesk-ui-button helpdesk-ui-button--secondary"
              onClick={apply}
            >
              Buscar
            </button>

            <button
              className="helpdesk-inbox__clear"
              onClick={() => {
                setInput('')
                setSearch('')
                setStatus('')
                setPriority('')
                setPage(1)
              }}
            >
              Limpiar
            </button>
          </div>

          <div className="helpdesk-inbox__table-wrap">
            <table className="helpdesk-inbox__table">
              <thead>
                <tr>
                  <th>Solicitud</th>
                  <th>Estado</th>
                  <th>Prioridad</th>
                  <th>Solicitante</th>
                  <th>Asignado</th>
                  <th>Actualizado</th>
                  <th><span className="sr-only">Abrir</span></th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="helpdesk-inbox__empty">
                      Cargando…
                    </td>
                  </tr>
                ) : !tickets.length ? (
                  <tr>
                    <td colSpan={7} className="helpdesk-inbox__empty">
                      <ClipboardList size={27} />
                      <strong>Sin solicitudes en esta vista</strong>
                      <span>Prueba otros filtros.</span>
                    </td>
                  </tr>
                ) : tickets.map(item => (
                  <tr key={item.id}>
                    <td>
                      <button
                        className="helpdesk-inbox__ticket-link"
                        onClick={() => open(item.id)}
                      >
                        <span>{item.number}</span>
                        <strong>{item.subject}</strong>
                        {item.slaBreached && <small>SLA vencido</small>}
                      </button>
                    </td>
                    <td>
                      <span
                        className={
                          `helpdesk-inbox__badge ` +
                          `helpdesk-inbox__badge--${item.status}`
                        }
                      >
                        {STATUS[item.status] ?? item.status}
                      </span>
                    </td>
                    <td>{PRIORITY[item.priority] ?? item.priority}</td>
                    <td>{item.requesterName}</td>
                    <td>{item.assigneeName ?? 'Sin asignar'}</td>
                    <td>{date(item.updatedAtUtc)}</td>
                    <td>
                      <button
                        className="helpdesk-inbox__open"
                        aria-label={`Abrir ${item.number}`}
                        onClick={() => open(item.id)}
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
            <span>Página {page} de {pages}</span>

            <button
              disabled={loading || page <= 1}
              onClick={() => setPage(x => x - 1)}
            >
              Anterior
            </button>

            <button
              disabled={loading || page >= pages}
              onClick={() => setPage(x => x + 1)}
            >
              Siguiente
            </button>
          </footer>
        </section>

        <aside
          className="helpdesk-work__agents"
          aria-label="Carga del equipo"
        >
          <div>
            <Users size={19} />
            <div>
              <h2>Equipo TIC</h2>
              <p>Casos activos por agente</p>
            </div>
          </div>

          {!workload ? (
            <p>
              {workloadError
                ? 'Carga no disponible.'
                : 'Cargando equipo…'}
            </p>
          ) : !workload.agents.length ? (
            <p>Todavía no hay agentes configurados.</p>
          ) : workload.agents.map(agent => (
            <article key={agent.userId}>
              <div>
                <strong>{agent.name}</strong>
                <span
                  className={agent.isAvailable ? 'is-available' : ''}
                >
                  {agent.isAvailable ? 'Disponible' : 'No disponible'}
                </span>
              </div>
              <p>
                {agent.openTickets} activos · capacidad {agent.capacity}
              </p>
            </article>
          ))}

          <button
            className="helpdesk-ui-button helpdesk-ui-button--secondary"
            onClick={() =>
              navigate('/helpdesk/operations?workspace=helpdesk')
            }
          >
            Configurar equipo
          </button>
        </aside>
      </div>

      {showCreate && canCreate && (
        <HelpdeskCreateRequest
          console
          onCancel={() => setShowCreate(false)}
          onCreated={id => {
            setShowCreate(false)
            open(id)
          }}
        />
      )}
    </main>
  )
}