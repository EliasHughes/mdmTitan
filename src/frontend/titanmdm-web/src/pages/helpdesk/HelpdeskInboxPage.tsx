import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  useNavigate,
  useSearchParams,
} from 'react-router-dom'

import {
  ArrowRight,
  ClipboardList,
  LayoutGrid,
  Plus,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react'

import apiClient
  from '../../api/apiClient'

import {
  useAuth,
} from '../../auth/AuthContext'

import {
  helpdeskPermissions,
} from '../../auth/helpdeskAccess'

import {
  HelpdeskCreateRequest,
} from './HelpdeskCreateRequest'

import './HelpdeskPages.css'
import './HelpdeskWorkPage.css'

type View =
  | 'mine'
  | 'unassigned'
  | 'all'
  | 'kanban'

interface Ticket {
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

interface Result {
  items: Ticket[]
  total: number
  page: number
  pageSize: number
}

interface Workload {
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

const STATUS:
  Record<string, string> = {
    new:
      'Nuevo',

    open:
      'Abierto',

    inprogress:
      'En proceso',

    pendinguser:
      'Esperando usuario',

    resolved:
      'Resuelto',

    closed:
      'Cerrado',
  }

const PRIORITY:
  Record<string, string> = {
    low:
      'Baja',

    medium:
      'Media',

    high:
      'Alta',

    critical:
      'Crítica',

    urgent:
      'Urgente',
  }

const KANBAN_COLUMNS =
  [
    {
      key:
        'new',

      label:
        'Nuevos',
    },

    {
      key:
        'open',

      label:
        'Abiertos',
    },

    {
      key:
        'inprogress',

      label:
        'En proceso',
    },

    {
      key:
        'pendinguser',

      label:
        'Esperando usuario',
    },
  ] as const

function resolveView(
  value:
    string |
    null,
): View {
  return value ===
      'unassigned'
    ||
    value ===
      'all'
    ||
    value ===
      'kanban'
      ? value
      : 'mine'
}

function formatDate(
  value: string,
) {
  const parsed =
    new Date(
      /(?:Z|[+-]\d{2}:?\d{2})$/i
        .test(
          value,
        )
        ? value
        : value +
          'Z',
    )

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return '—'
  }

  return new Intl
    .DateTimeFormat(
      'es-DO',
      {
        dateStyle:
          'short',

        timeStyle:
          'short',
      },
    )
    .format(
      parsed,
    )
}

export function HelpdeskInboxPage() {
  const navigate =
    useNavigate()

  const [
    searchParams,
    setSearchParams,
  ] =
    useSearchParams()

  const {
    hasPermission,
  } =
    useAuth()

  /*
   * ============================================================
   * URL IS THE SOURCE OF TRUTH
   *
   * Previously this value was copied only once into local state.
   * Clicking the top navigation changed the URL but not the view.
   * ============================================================
   */

  const requestedView =
    resolveView(
      searchParams.get(
        'view',
      ),
    )

  const [
    view,
    setView,
  ] =
    useState<View>(
      requestedView,
    )

  const [
    tickets,
    setTickets,
  ] =
    useState<Ticket[]>(
      [],
    )

  const [
    workload,
    setWorkload,
  ] =
    useState<Workload | null>(
      null,
    )

  const [
    total,
    setTotal,
  ] =
    useState(
      0,
    )

  const [
    page,
    setPage,
  ] =
    useState(
      1,
    )

  const [
    input,
    setInput,
  ] =
    useState(
      '',
    )

  const [
    search,
    setSearch,
  ] =
    useState(
      '',
    )

  const [
    status,
    setStatus,
  ] =
    useState(
      '',
    )

  const [
    priority,
    setPriority,
  ] =
    useState(
      '',
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    )

  const [
    error,
    setError,
  ] =
    useState(
      '',
    )

  const [
    workloadError,
    setWorkloadError,
  ] =
    useState(
      false,
    )

  const [
    showCreate,
    setShowCreate,
  ] =
    useState(
      false,
    )

  /*
   * React Router keeps the component mounted when only query
   * parameters change. Keep local state synchronized explicitly.
   */
  useEffect(
    () => {
      if (
        requestedView !==
        view
      ) {
        setView(
          requestedView,
        )

        setPage(
          1,
        )
      }
    },
    [
      requestedView,
      view,
    ],
  )

  const canCreate =
    hasPermission(
      helpdeskPermissions
        .requestCreate,
    )
    ||
    hasPermission(
      'tickets.create',
    )
    ||
    hasPermission(
      helpdeskPermissions
        .adminAccess,
    )

  const canViewMine =
    hasPermission(
      helpdeskPermissions
        .inboxMyWork,
    )
    ||
    hasPermission(
      helpdeskPermissions
        .agentAccess,
    )
    ||
    hasPermission(
      helpdeskPermissions
        .adminAccess,
    )

  const canViewUnassigned =
    hasPermission(
      helpdeskPermissions
        .inboxUnassigned,
    )
    ||
    hasPermission(
      helpdeskPermissions
        .adminAccess,
    )

  const canViewAll =
    hasPermission(
      helpdeskPermissions
        .inboxAll,
    )
    ||
    hasPermission(
      helpdeskPermissions
        .adminAccess,
    )

  const canViewKanban =
    hasPermission(
      helpdeskPermissions
        .kanbanView,
    )
    ||
    hasPermission(
      helpdeskPermissions
        .agentAccess,
    )
    ||
    hasPermission(
      helpdeskPermissions
        .adminAccess,
    )

  const pageSize =
    view ===
      'kanban'
      ? 100
      : 25

  const pages =
    Math.max(
      1,
      Math.ceil(
        total /
        pageSize,
      ),
    )

  const openTicket =
    (
      id:
        string,
    ) =>
      navigate(
        `/helpdesk/tickets/${id}?workspace=helpdesk`,
      )

  const changeView =
    (
      next:
        View,
    ) => {
      setView(
        next,
      )

      setPage(
        1,
      )

      const params =
        new URLSearchParams(
          searchParams,
        )

      if (
        next ===
        'mine'
      ) {
        params.delete(
          'view',
        )
      }
      else {
        params.set(
          'view',
          next,
        )
      }

      params.set(
        'workspace',
        'helpdesk',
      )

      setSearchParams(
        params,
      )
    }

  const load =
    useCallback(
      async () => {
        setLoading(
          true,
        )

        setError(
          '',
        )

        try {
          const {
            data,
          } =
            await apiClient
              .get<Result>(
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
                      priority ||
                      undefined,

                    page,

                    pageSize,
                  },
                },
              )

          setTickets(
            data.items,
          )

          setTotal(
            data.total,
          )
        }
        catch {
          setTickets(
            [],
          )

          setTotal(
            0,
          )

          setError(
            'No se pudieron cargar las solicitudes.',
          )
        }
        finally {
          setLoading(
            false,
          )
        }
      },
      [
        view,
        search,
        status,
        priority,
        page,
        pageSize,
      ],
    )

  const loadWorkload =
    useCallback(
      async () => {
        try {
          const {
            data,
          } =
            await apiClient
              .get<Workload>(
                '/helpdesk/workload',
              )

          setWorkload(
            data,
          )

          setWorkloadError(
            false,
          )
        }
        catch {
          setWorkload(
            null,
          )

          setWorkloadError(
            true,
          )
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

  useEffect(
    () => {
      void loadWorkload()
    },
    [
      loadWorkload,
    ],
  )

  const refresh =
    () => {
      void load()
      void loadWorkload()
    }

  const apply =
    () => {
      setSearch(
        input.trim(),
      )

      setPage(
        1,
      )
    }

  const tabs =
    [
      canViewMine
        ? {
            key:
              'mine' as const,

            label:
              'Mi trabajo',

            count:
              workload
                ?.assignedToMe,
          }
        : null,

      canViewUnassigned
        ? {
            key:
              'unassigned' as const,

            label:
              'Sin asignar',

            count:
              workload
                ?.unassigned,
          }
        : null,

      canViewAll
        ? {
            key:
              'all' as const,

            label:
              'Todos',

            count:
              workload
                ?.active,
          }
        : null,

      canViewKanban
        ? {
            key:
              'kanban' as const,

            label:
              'Kanban',

            count:
              workload
                ?.active,
          }
        : null,
    ]
      .filter(
        Boolean,
      ) as {
        key:
          View

        label:
          string

        count:
          number |
          undefined
      }[]

  const kanban =
    useMemo(
      () =>
        KANBAN_COLUMNS.map(
          column => ({
            ...column,

            tickets:
              tickets.filter(
                ticket =>
                  ticket.status ===
                  column.key,
              ),
          }),
        ),
      [
        tickets,
      ],
    )

  return (
    <main
      className={
        'titan-page ' +
        'helpdesk-page ' +
        'helpdesk-inbox ' +
        'helpdesk-work'
      }
    >
      <header
        className="helpdesk-inbox__header"
      >
        <div>
          <span
            className="helpdesk-inbox__eyebrow"
          >
            {
              view ===
                'kanban'
                ? (
                  <LayoutGrid
                    size={15}
                  />
                )
                : (
                  <ClipboardList
                    size={15}
                  />
                )
            }

            OPERACIÓN TIC
          </span>

          <h1>
            {
              view ===
                'kanban'
                ? 'Tablero Kanban'
                : 'Bandeja de Mesa de Ayuda'
            }
          </h1>

          <p>
            {
              view ===
                'kanban'
                ? 'Visualiza el trabajo activo según su estado operativo.'
                : 'Atiende solicitudes, prioriza casos, controla el backlog y trabaja con tu equipo.'
            }
          </p>
        </div>

        <div
          className="helpdesk-inbox__header-actions"
        >
          <button
            type="button"
            className={
              'helpdesk-ui-button ' +
              'helpdesk-ui-button--secondary'
            }
            disabled={
              loading
            }
            onClick={
              refresh
            }
          >
            <RefreshCw
              size={16}
            />

            Actualizar
          </button>

          {canCreate && (
            <button
              type="button"
              className={
                'helpdesk-ui-button ' +
                'helpdesk-ui-button--primary'
              }
              onClick={
                () =>
                  setShowCreate(
                    true,
                  )
              }
            >
              <Plus
                size={16}
              />

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
            onClick={
              refresh
            }
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
        {tabs.map(
          tab => (
            <button
              key={
                tab.key
              }
              type="button"
              className={
                view ===
                  tab.key
                  ? 'is-active'
                  : ''
              }
              aria-pressed={
                view ===
                tab.key
              }
              onClick={
                () =>
                  changeView(
                    tab.key,
                  )
              }
            >
              {tab.label}

              {tab.count !==
                undefined && (
                <strong>
                  {tab.count}
                </strong>
              )}
            </button>
          ),
        )}
      </nav>

      <div
        className={
          view ===
            'kanban'
            ? 'helpdesk-work__layout helpdesk-work__layout--kanban'
            : 'helpdesk-work__layout'
        }
      >
        <section
          className="helpdesk-inbox__panel"
          aria-label="Solicitudes"
        >
          <div
            className="helpdesk-inbox__filters"
          >
            <label
              className="helpdesk-inbox__search"
            >
              <Search
                size={17}
              />

              <span
                className="sr-only"
              >
                Buscar
              </span>

              <input
                value={
                  input
                }
                onChange={
                  event =>
                    setInput(
                      event.target
                        .value,
                    )
                }
                onKeyDown={
                  event => {
                    if (
                      event.key ===
                      'Enter'
                    ) {
                      apply()
                    }
                  }
                }
                placeholder="Número, asunto o categoría"
              />
            </label>

            {view !==
              'kanban' && (
              <label>
                <span
                  className="sr-only"
                >
                  Estado
                </span>

                <select
                  value={
                    status
                  }
                  onChange={
                    event => {
                      setStatus(
                        event.target
                          .value,
                      )

                      setPage(
                        1,
                      )
                    }
                  }
                >
                  <option value="">
                    Todos los estados
                  </option>

                  {Object.entries(
                    STATUS,
                  ).map(
                    (
                      [
                        key,
                        label,
                      ],
                    ) => (
                      <option
                        key={
                          key
                        }
                        value={
                          key
                        }
                      >
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>
            )}

            <label>
              <span
                className="sr-only"
              >
                Prioridad
              </span>

              <select
                value={
                  priority
                }
                onChange={
                  event => {
                    setPriority(
                      event.target
                        .value,
                    )

                    setPage(
                      1,
                    )
                  }
                }
              >
                <option value="">
                  Todas las prioridades
                </option>

                {Object.entries(
                  PRIORITY,
                ).map(
                  (
                    [
                      key,
                      label,
                    ],
                  ) => (
                    <option
                      key={
                        key
                      }
                      value={
                        key
                      }
                    >
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <button
              type="button"
              className={
                'helpdesk-ui-button ' +
                'helpdesk-ui-button--secondary'
              }
              onClick={
                apply
              }
            >
              Buscar
            </button>

            <button
              type="button"
              className="helpdesk-inbox__clear"
              onClick={
                () => {
                  setInput(
                    '',
                  )

                  setSearch(
                    '',
                  )

                  setStatus(
                    '',
                  )

                  setPriority(
                    '',
                  )

                  setPage(
                    1,
                  )
                }
              }
            >
              Limpiar
            </button>
          </div>

          {view ===
            'kanban' ? (
            <>
              {loading ? (
                <div
                  className="helpdesk-inbox__empty"
                >
                  Cargando tablero…
                </div>
              ) : (
                <div
                  className="helpdesk-kanban"
                >
                  {kanban.map(
                    column => (
                      <section
                        key={
                          column.key
                        }
                        className={
                          `helpdesk-kanban__column ` +
                          `helpdesk-kanban__column--${column.key}`
                        }
                      >
                        <header>
                          <strong>
                            {
                              column.label
                            }
                          </strong>

                          <span>
                            {
                              column
                                .tickets
                                .length
                            }
                          </span>
                        </header>

                        <div
                          className="helpdesk-kanban__cards"
                        >
                          {
                            column.tickets
                              .length ===
                              0 ? (
                              <p
                                className="helpdesk-kanban__empty"
                              >
                                Sin tickets.
                              </p>
                            ) : (
                              column.tickets.map(
                                item => (
                                  <button
                                    key={
                                      item.id
                                    }
                                    type="button"
                                    className="helpdesk-kanban__card"
                                    onClick={
                                      () =>
                                        openTicket(
                                          item.id,
                                        )
                                    }
                                  >
                                    <div
                                      className="helpdesk-kanban__card-top"
                                    >
                                      <span>
                                        {
                                          item.number
                                        }
                                      </span>

                                      <span
                                        className={
                                          `helpdesk-kanban__priority ` +
                                          `helpdesk-kanban__priority--${item.priority}`
                                        }
                                      >
                                        {
                                          PRIORITY[
                                            item.priority
                                          ]
                                          ??
                                          item.priority
                                        }
                                      </span>
                                    </div>

                                    <strong>
                                      {
                                        item.subject
                                      }
                                    </strong>

                                    <small>
                                      {
                                        item.category
                                      }
                                    </small>

                                    <div
                                      className="helpdesk-kanban__meta"
                                    >
                                      <span>
                                        {
                                          item.assigneeName
                                          ??
                                          'Sin asignar'
                                        }
                                      </span>

                                      <span>
                                        {
                                          formatDate(
                                            item.updatedAtUtc,
                                          )
                                        }
                                      </span>
                                    </div>

                                    {item.slaBreached && (
                                      <span
                                        className="helpdesk-kanban__sla"
                                      >
                                        SLA vencido
                                      </span>
                                    )}
                                  </button>
                                ),
                              )
                            )
                          }
                        </div>
                      </section>
                    ),
                  )}
                </div>
              )}

              <footer
                className="helpdesk-inbox__footer"
              >
                <span>
                  Página {page} de {pages}
                  {' · '}
                  {total} tickets activos
                </span>

                <button
                  type="button"
                  disabled={
                    loading
                    ||
                    page <=
                      1
                  }
                  onClick={
                    () =>
                      setPage(
                        value =>
                          value -
                          1,
                      )
                  }
                >
                  Anterior
                </button>

                <button
                  type="button"
                  disabled={
                    loading
                    ||
                    page >=
                      pages
                  }
                  onClick={
                    () =>
                      setPage(
                        value =>
                          value +
                          1,
                      )
                  }
                >
                  Siguiente
                </button>
              </footer>
            </>
          ) : (
            <>
              <div
                className="helpdesk-inbox__panel-heading"
              >
                <div>
                  <h2>
                    {
                      view ===
                        'mine'
                        ? 'Asignadas a mí'
                        : view ===
                            'unassigned'
                          ? 'Pendientes de asignación'
                          : 'Todas las solicitudes'
                    }
                  </h2>

                  <p>
                    Abre un caso para
                    atenderlo y consultar
                    su historial.
                  </p>
                </div>

                <span
                  className="helpdesk-inbox__total"
                >
                  {total} resultados
                </span>
              </div>

              <div
                className="helpdesk-inbox__table-wrap"
              >
                <table
                  className="helpdesk-inbox__table"
                >
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
                        <span
                          className="sr-only"
                        >
                          Abrir
                        </span>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="helpdesk-inbox__empty"
                        >
                          Cargando…
                        </td>
                      </tr>
                    ) : !tickets.length ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="helpdesk-inbox__empty"
                        >
                          <ClipboardList
                            size={27}
                          />

                          <strong>
                            Sin solicitudes
                            en esta vista
                          </strong>

                          <span>
                            Prueba otros
                            filtros.
                          </span>
                        </td>
                      </tr>
                    ) : (
                      tickets.map(
                        item => (
                          <tr
                            key={
                              item.id
                            }
                          >
                            <td>
                              <button
                                type="button"
                                className="helpdesk-inbox__ticket-link"
                                onClick={
                                  () =>
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
                                    SLA vencido
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
                                {
                                  STATUS[
                                    item.status
                                  ]
                                  ??
                                  item.status
                                }
                              </span>
                            </td>

                            <td>
                              {
                                PRIORITY[
                                  item.priority
                                ]
                                ??
                                item.priority
                              }
                            </td>

                            <td>
                              {
                                item.requesterName
                              }
                            </td>

                            <td>
                              {
                                item.assigneeName
                                ??
                                'Sin asignar'
                              }
                            </td>

                            <td>
                              {
                                formatDate(
                                  item.updatedAtUtc,
                                )
                              }
                            </td>

                            <td>
                              <button
                                type="button"
                                className="helpdesk-inbox__open"
                                aria-label={
                                  `Abrir ${item.number}`
                                }
                                onClick={
                                  () =>
                                    openTicket(
                                      item.id,
                                    )
                                }
                              >
                                <ArrowRight
                                  size={17}
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

              <footer
                className="helpdesk-inbox__footer"
              >
                <span>
                  Página {page} de {pages}
                </span>

                <button
                  type="button"
                  disabled={
                    loading
                    ||
                    page <=
                      1
                  }
                  onClick={
                    () =>
                      setPage(
                        value =>
                          value -
                          1,
                      )
                  }
                >
                  Anterior
                </button>

                <button
                  type="button"
                  disabled={
                    loading
                    ||
                    page >=
                      pages
                  }
                  onClick={
                    () =>
                      setPage(
                        value =>
                          value +
                          1,
                      )
                  }
                >
                  Siguiente
                </button>
              </footer>
            </>
          )}
        </section>

        {view !==
          'kanban' && (
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
                  Carga activa y
                  disponibilidad
                </p>
              </div>
            </div>

            {!workload ? (
              <p>
                {
                  workloadError
                    ? 'Carga no disponible.'
                    : 'Cargando equipo…'
                }
              </p>
            ) : !workload
                .agents
                .length ? (
              <p>
                Todavía no hay
                agentes configurados.
              </p>
            ) : (
              workload.agents.map(
                agent => (
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
                        {
                          agent.isAvailable
                            ? 'Disponible'
                            : 'No disponible'
                        }
                      </span>
                    </div>

                    <p>
                      {
                        agent.openTickets
                      }
                      {' '}
                      activos · capacidad
                      {' '}
                      {
                        agent.capacity
                      }
                    </p>
                  </article>
                ),
              )
            )}
          </aside>
        )}
      </div>

      {showCreate &&
        canCreate && (
        <HelpdeskCreateRequest
          console
          onCancel={
            () =>
              setShowCreate(
                false,
              )
          }
          onCreated={
            id => {
              setShowCreate(
                false,
              )

              openTicket(
                id,
              )
            }
          }
        />
      )}
    </main>
  )
}