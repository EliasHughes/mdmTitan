import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ClipboardList,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react'
import apiClient from '../../api/apiClient'
import { helpdeskApi } from '../../api/helpdeskApi'
import { useAuth } from '../../auth/AuthContext'
import {
  HelpdeskCategorySelect,
} from './HelpdeskCategorySelect'
import './HelpdeskPages.css'
import './HelpdeskWorkPage.css'

type View =
  | 'mine'
  | 'unassigned'
  | 'all'

interface WorkTicket {
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

interface WorkResult {
  items: WorkTicket[]
  total: number
  page: number
  pageSize: number
}

interface AgentLoad {
  userId: string
  name: string
  openTickets: number
  isAvailable: boolean
  capacity: number
}

interface Workload {
  assignedToMe: number
  unassigned: number
  active: number
  agents: AgentLoad[]
}

const PAGE_SIZE = 25

const STATUS: Record<string, string> = {
  new: 'Nuevo',
  open: 'En proceso',
  pendinguser:
    'En espera del usuario',
  resolved: 'Resuelto',
  closed: 'Cerrado',
}

const PRIORITY: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
}

function formatDate(value: string) {
  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(
        'es-DO',
        {
          dateStyle: 'short',
          timeStyle: 'short',
        },
      ).format(date)
}

export function HelpdeskInboxPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [view, setView] =
    useState<View>('mine')
  const [tickets, setTickets] =
    useState<WorkTicket[]>([])
  const [workload, setWorkload] =
    useState<Workload | null>(null)
  const [total, setTotal] =
    useState(0)
  const [page, setPage] =
    useState(1)
  const [
    searchInput,
    setSearchInput,
  ] = useState('')
  const [search, setSearch] =
    useState('')
  const [status, setStatus] =
    useState('')
  const [
    priorityFilter,
    setPriorityFilter,
  ] = useState('')
  const [loading, setLoading] =
    useState(true)
  const [
    workloadError,
    setWorkloadError,
  ] = useState(false)
  const [error, setError] =
    useState('')
  const [
    showCreate,
    setShowCreate,
  ] = useState(false)
  const [creating, setCreating] =
    useState(false)
  const [subject, setSubject] =
    useState('')
  const [
    description,
    setDescription,
  ] = useState('')
  const [type, setType] =
    useState('incident')
  const [priority, setPriority] =
    useState('medium')
  const [category, setCategory] =
    useState('general')

  const canCreate =
    user?.permissions?.includes(
      'tickets.create',
    ) ?? false

  const pageCount = Math.max(
    1,
    Math.ceil(total / PAGE_SIZE),
  )

  const openTicket = (id: string) =>
    navigate(
      `/helpdesk/tickets/${id}?workspace=helpdesk`,
    )

  const loadTickets =
    useCallback(async () => {
      setLoading(true)
      setError('')

      try {
        const response =
          await apiClient.get<WorkResult>(
            '/helpdesk/workload/tickets',
            {
              params: {
                view,
                search:
                  search ||
                  undefined,
                status:
                  status ||
                  undefined,
                priority:
                  priorityFilter ||
                  undefined,
                page,
                pageSize:
                  PAGE_SIZE,
              },
            },
          )

        setTickets(
          response.data.items,
        )
        setTotal(
          response.data.total,
        )
      } catch {
        setTickets([])
        setTotal(0)
        setError(
          'No se pudieron cargar las solicitudes.',
        )
      } finally {
        setLoading(false)
      }
    }, [
      view,
      search,
      status,
      priorityFilter,
      page,
    ])

  const loadWorkload =
    useCallback(async () => {
      try {
        const response =
          await apiClient.get<Workload>(
            '/helpdesk/workload',
          )

        setWorkload(
          response.data,
        )
        setWorkloadError(
          false,
        )
      } catch {
        setWorkload(null)
        setWorkloadError(
          true,
        )
      }
    }, [])

  useEffect(() => {
    void loadTickets()
  }, [loadTickets])

  useEffect(() => {
    void loadWorkload()
  }, [loadWorkload])

  function refresh() {
    void loadTickets()
    void loadWorkload()
  }

  function changeView(
    next: View,
  ) {
    setView(next)
    setPage(1)
  }

  function applySearch() {
    setPage(1)
    setSearch(
      searchInput.trim(),
    )
  }

  function clearFilters() {
    setSearchInput('')
    setSearch('')
    setStatus('')
    setPriorityFilter('')
    setPage(1)
  }

  async function createTicket(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      !canCreate ||
      !subject.trim() ||
      !description.trim() ||
      creating
    ) {
      return
    }

    setCreating(true)
    setError('')

    try {
      const ticket =
        await helpdeskApi.createTicket({
          subject:
            subject.trim(),
          description:
            description.trim(),
          type,
          priority,
          category,
          source:
            'console',
        })

      setShowCreate(false)
      openTicket(ticket.id)
    } catch {
      setError(
        'No se pudo crear el ticket. Revisa los datos.',
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="titan-page helpdesk-page helpdesk-inbox helpdesk-work">
      <header className="helpdesk-inbox__header">
        <div>
          <span className="helpdesk-inbox__eyebrow">
            <ClipboardList size={15} />
            Operación TIC
          </span>

          <h1>
            Mesa de ayuda
          </h1>

          <p>
            Atiende solicitudes
            y revisa los casos
            sin asignar.
          </p>
        </div>

        <div className="helpdesk-inbox__header-actions">
          <button
            type="button"
            className="helpdesk-ui-button helpdesk-ui-button--secondary"
            onClick={() =>
              navigate(
                '/helpdesk/reportes?workspace=helpdesk',
              )
            }
          >
            Gráficos y KPI
          </button>

          <button
            type="button"
            className="helpdesk-ui-button helpdesk-ui-button--secondary"
            disabled={loading}
            onClick={refresh}
          >
            <RefreshCw
              size={16}
            />
            Actualizar
          </button>

          {canCreate && (
            <button
              type="button"
              className="helpdesk-ui-button helpdesk-ui-button--primary"
              onClick={() =>
                setShowCreate(
                  true,
                )
              }
            >
              <Plus size={16} />
              Nuevo ticket
            </button>
          )}
        </div>
      </header>

      {error && (
        <div
          className="helpdesk-inbox__error"
          role="alert"
        >
          {error}

          <button
            type="button"
            onClick={refresh}
          >
            Reintentar
          </button>
        </div>
      )}

      {workloadError && (
        <div
          className="helpdesk-inbox__error"
          role="alert"
        >
          La carga del equipo
          no está disponible.
        </div>
      )}

      <nav
        className="helpdesk-work__tabs"
        aria-label="Bandejas de tickets"
      >
        {(
          [
            [
              'mine',
              'Mi trabajo',
              workload
                ?.assignedToMe,
            ],
            [
              'unassigned',
              'Sin asignar',
              workload
                ?.unassigned,
            ],
            [
              'all',
              'Todas',
              workload
                ?.active,
            ],
          ] as const
        ).map(
          ([
            key,
            label,
            count,
          ]) => (
            <button
              type="button"
              key={key}
              className={
                view === key
                  ? 'is-active'
                  : ''
              }
              aria-pressed={
                view === key
              }
              onClick={() =>
                changeView(
                  key,
                )
              }
            >
              {label}

              {count !==
                undefined && (
                <strong>
                  {count}
                </strong>
              )}
            </button>
          ),
        )}
      </nav>

      <div className="helpdesk-work__layout">
        <section
          className="helpdesk-inbox__panel"
          aria-label="Solicitudes"
        >
          <div className="helpdesk-inbox__panel-heading">
            <div>
              <h2>
                {view ===
                'mine'
                  ? 'Asignadas a mí'
                  : view ===
                      'unassigned'
                    ? 'Sin asignar'
                    : 'Todas las solicitudes'}
              </h2>

              <p>
                Abre un caso
                para atenderlo
                y consultar su
                historial.
              </p>
            </div>

            <span className="helpdesk-inbox__total">
              {total}{' '}
              resultados
            </span>
          </div>

          <div className="helpdesk-inbox__filters">
            <label className="helpdesk-inbox__search">
              <Search
                size={17}
              />

              <span className="sr-only">
                Buscar
              </span>

              <input
                value={
                  searchInput
                }
                onChange={(
                  event,
                ) =>
                  setSearchInput(
                    event.target.value,
                  )
                }
                onKeyDown={(
                  event,
                ) => {
                  if (
                    event.key ===
                    'Enter'
                  ) {
                    applySearch()
                  }
                }}
                placeholder="Número, asunto o categoría"
              />
            </label>

            <label>
              <span className="sr-only">
                Estado
              </span>

              <select
                value={
                  status
                }
                onChange={(
                  event,
                ) => {
                  setStatus(
                    event.target.value,
                  )
                  setPage(
                    1,
                  )
                }}
              >
                <option value="">
                  Todos los
                  estados
                </option>

                {Object.entries(
                  STATUS,
                ).map(
                  ([
                    value,
                    label,
                  ]) => (
                    <option
                      key={
                        value
                      }
                      value={
                        value
                      }
                    >
                      {
                        label
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span className="sr-only">
                Prioridad
              </span>

              <select
                value={
                  priorityFilter
                }
                onChange={(
                  event,
                ) => {
                  setPriorityFilter(
                    event.target.value,
                  )
                  setPage(
                    1,
                  )
                }}
              >
                <option value="">
                  Todas las
                  prioridades
                </option>

                {Object.entries(
                  PRIORITY,
                ).map(
                  ([
                    value,
                    label,
                  ]) => (
                    <option
                      key={
                        value
                      }
                      value={
                        value
                      }
                    >
                      {
                        label
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            <button
              type="button"
              className="helpdesk-ui-button helpdesk-ui-button--secondary"
              onClick={
                applySearch
              }
            >
              Buscar
            </button>

            <button
              type="button"
              className="helpdesk-inbox__clear"
              onClick={
                clearFilters
              }
            >
              Limpiar
            </button>
          </div>

          <div className="helpdesk-inbox__table-wrap">
            <table className="helpdesk-inbox__table">
              <thead>
                <tr>
                  <th>
                    Solicitud
                  </th>
                  <th>
                    Estado
                  </th>
                  <th>
                    Prioridad
                  </th>
                  <th>
                    Solicitante
                  </th>
                  <th>
                    Asignado
                  </th>
                  <th>
                    Actualizado
                  </th>
                  <th>
                    <span className="sr-only">
                      Abrir
                    </span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={
                        7
                      }
                      className="helpdesk-inbox__empty"
                    >
                      Cargando…
                    </td>
                  </tr>
                ) : tickets
                    .length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={
                        7
                      }
                      className="helpdesk-inbox__empty"
                    >
                      <ClipboardList
                        size={
                          27
                        }
                      />

                      <strong>
                        Sin
                        solicitudes
                        en esta
                        vista
                      </strong>

                      <span>
                        Prueba
                        otros
                        filtros.
                      </span>
                    </td>
                  </tr>
                ) : (
                  tickets.map(
                    (
                      item,
                    ) => (
                      <tr
                        key={
                          item.id
                        }
                      >
                        <td>
                          <button
                            type="button"
                            className="helpdesk-inbox__ticket-link"
                            onClick={() =>
                              openTicket(
                                item.id,
                              )
                            }
                          >
                            <span>
                              {
                                item.number
                              }
                            </span>

                            <strong>
                              {
                                item.subject
                              }
                            </strong>

                            {item.slaBreached && (
                              <small>
                                SLA
                                vencido
                              </small>
                            )}
                          </button>
                        </td>

                        <td>
                          <span
                            className={
                              `helpdesk-inbox__badge ` +
                              `helpdesk-inbox__badge--${item.status}`
                            }
                          >
                            {STATUS[
                              item.status
                            ] ??
                              item.status}
                          </span>
                        </td>

                        <td>
                          {PRIORITY[
                            item.priority
                          ] ??
                            item.priority}
                        </td>

                        <td>
                          {
                            item.requesterName
                          }
                        </td>

                        <td>
                          {item.assigneeName ??
                            'Sin asignar'}
                        </td>

                        <td>
                          {formatDate(
                            item.updatedAtUtc,
                          )}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="helpdesk-inbox__open"
                            aria-label={
                              `Abrir ` +
                              item.number
                            }
                            onClick={() =>
                              openTicket(
                                item.id,
                              )
                            }
                          >
                            <ArrowRight
                              size={
                                17
                              }
                            />
                          </button>
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>

          <footer className="helpdesk-inbox__footer">
            <span>
              Página {page}
              {' '}de{' '}
              {pageCount}
            </span>

            <div>
              <button
                type="button"
                disabled={
                  page <=
                    1 ||
                  loading
                }
                onClick={() =>
                  setPage(
                    page - 1,
                  )
                }
              >
                Anterior
              </button>

              <button
                type="button"
                disabled={
                  page >=
                    pageCount ||
                  loading
                }
                onClick={() =>
                  setPage(
                    page + 1,
                  )
                }
              >
                Siguiente
              </button>
            </div>
          </footer>
        </section>

        <aside
          className="helpdesk-work__agents"
          aria-label="Carga del equipo"
        >
          <div>
            <Users
              size={19}
            />

            <div>
              <h2>
                Equipo TIC
              </h2>

              <p>
                Casos activos
                por agente
              </p>
            </div>
          </div>

          {!workload ? (
            <p>
              {workloadError
                ? 'Carga no disponible.'
                : 'Cargando equipo…'}
            </p>
          ) : workload
              .agents
              .length ===
            0 ? (
            <p>
              Todavía no
              hay agentes
              configurados.
            </p>
          ) : (
            workload.agents.map(
              (
                agent,
              ) => (
                <article
                  key={
                    agent.userId
                  }
                >
                  <div>
                    <strong>
                      {
                        agent.name
                      }
                    </strong>

                    <span
                      className={
                        agent.isAvailable
                          ? 'is-available'
                          : ''
                      }
                    >
                      {agent.isAvailable
                        ? 'Disponible'
                        : 'No disponible'}
                    </span>
                  </div>

                  <p>
                    {
                      agent.openTickets
                    }{' '}
                    activos ·
                    capacidad{' '}
                    {
                      agent.capacity
                    }
                  </p>
                </article>
              ),
            )
          )}

          <button
            type="button"
            className="helpdesk-ui-button helpdesk-ui-button--secondary"
            onClick={() =>
              navigate(
                '/helpdesk/operations?workspace=helpdesk',
              )
            }
          >
            Configurar
            equipo
          </button>
        </aside>
      </div>

      {showCreate &&
        canCreate && (
        <div
          className="helpdesk-inbox__overlay"
          onMouseDown={() =>
            setShowCreate(
              false,
            )
          }
        >
          <section
            className="helpdesk-inbox__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-ticket-title"
            onMouseDown={(
              event,
            ) =>
              event.stopPropagation()
            }
          >
            <header>
              <div>
                <h2 id="new-ticket-title">
                  Nuevo
                  ticket
                </h2>

                <p>
                  Registra
                  el caso
                  para su
                  asignación.
                </p>
              </div>

              <button
                type="button"
                aria-label="Cerrar"
                onClick={() =>
                  setShowCreate(
                    false,
                  )
                }
              >
                <X
                  size={
                    18
                  }
                />
              </button>
            </header>

            <form
              onSubmit={(
                event,
              ) =>
                void createTicket(
                  event,
                )
              }
            >
              <label>
                Asunto
                <input
                  required
                  maxLength={
                    250
                  }
                  value={
                    subject
                  }
                  onChange={(
                    event,
                  ) =>
                    setSubject(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                Descripción
                <textarea
                  required
                  maxLength={
                    4000
                  }
                  rows={
                    5
                  }
                  value={
                    description
                  }
                  onChange={(
                    event,
                  ) =>
                    setDescription(
                      event.target.value,
                    )
                  }
                />
              </label>

              <div className="helpdesk-inbox__form-grid">
                <label>
                  Tipo
                  <select
                    value={
                      type
                    }
                    onChange={(
                      event,
                    ) =>
                      setType(
                        event.target.value,
                      )
                    }
                  >
                    <option value="incident">
                      Incidente
                    </option>

                    <option value="request">
                      Solicitud
                    </option>
                  </select>
                </label>

                <label>
                  Prioridad
                  <select
                    value={
                      priority
                    }
                    onChange={(
                      event,
                    ) =>
                      setPriority(
                        event.target.value,
                      )
                    }
                  >
                    {Object.entries(
                      PRIORITY,
                    ).map(
                      ([
                        value,
                        label,
                      ]) => (
                        <option
                          key={
                            value
                          }
                          value={
                            value
                          }
                        >
                          {
                            label
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>

              <HelpdeskCategorySelect
                id="tic-ticket-category"
                value={
                  category
                }
                onChange={
                  setCategory
                }
                disabled={
                  creating
                }
              />

              <div className="helpdesk-inbox__dialog-actions">
                <button
                  type="button"
                  className="helpdesk-ui-button helpdesk-ui-button--secondary"
                  onClick={() =>
                    setShowCreate(
                      false,
                    )
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="helpdesk-ui-button helpdesk-ui-button--primary"
                  disabled={
                    creating
                  }
                >
                  <Plus
                    size={
                      16
                    }
                  />

                  {creating
                    ? 'Creando…'
                    : 'Crear ticket'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}