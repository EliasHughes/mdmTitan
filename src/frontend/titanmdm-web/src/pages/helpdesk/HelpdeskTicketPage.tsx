import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react'

import {
  useNavigate,
  useParams,
} from 'react-router-dom'

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Headphones,
  LockKeyhole,
  MessageSquare,
  Monitor,
  PauseCircle,
  RefreshCw,
  RotateCcw,
  Send,
  UserRound,
  X,
} from 'lucide-react'

import axios from 'axios'

import {
  helpdeskApi,
  type HelpdeskTicketDetails,
} from '../../api/helpdeskApi'

import {
  useAuth,
} from '../../auth/AuthContext'

import {
  helpdeskPermissions,
} from '../../auth/helpdeskAccess'

import './HelpdeskPages.css'
import './HelpdeskWorkflowActions.css'

const statusLabels:
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

const priorityLabels:
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

const dateFormatter =
  new Intl.DateTimeFormat(
    'es-DO',
    {
      dateStyle:
        'medium',

      timeStyle:
        'short',
    },
  )

function formatDate(
  value?: string | null,
) {
  if (!value) {
    return 'Sin fecha'
  }

  const date =
    new Date(
      value,
    )

  return Number.isNaN(
    date.getTime(),
  )
    ? 'Sin fecha'
    : dateFormatter.format(
        date,
      )
}

function getErrorMessage(
  error: unknown,
  fallback: string,
) {
  if (
    axios.isAxiosError(
      error,
    )
    &&
    typeof error
      .response
      ?.data
      ?.message ===
      'string'
  ) {
    return error
      .response
      .data
      .message
  }

  return fallback
}

export function HelpdeskTicketPage() {
  const {
    ticketId,
  } =
    useParams()

  const navigate =
    useNavigate()

  const {
    user,
    hasPermission,
  } =
    useAuth()

  const [
    ticket,
    setTicket,
  ] =
    useState<
      HelpdeskTicketDetails |
      null
    >(
      null,
    )

  const [
    comment,
    setComment,
  ] =
    useState(
      '',
    )

  const [
    internal,
    setInternal,
  ] =
    useState(
      false,
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    )

  const [
    saving,
    setSaving,
  ] =
    useState(
      false,
    )

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null,
    )

  const [
    showReopen,
    setShowReopen,
  ] =
    useState(
      false,
    )

  const [
    reopenReason,
    setReopenReason,
  ] =
    useState(
      '',
    )

  const canComment =
    hasPermission(
      'tickets.comment',
    )
    ||
    hasPermission(
      helpdeskPermissions
        .ticketComment,
    )
    ||
    hasPermission(
      helpdeskPermissions
        .adminAccess,
    )

  const canAssign =
    hasPermission(
      'tickets.assign',
    )
    ||
    hasPermission(
      helpdeskPermissions
        .ticketAssign,
    )
    ||
    hasPermission(
      helpdeskPermissions
        .ticketTake,
    )
    ||
    hasPermission(
      helpdeskPermissions
        .adminAccess,
    )

  /*
   * Actualmente el backend usa tickets.comment
   * para las transiciones operativas.
   *
   * También aceptamos los permisos modernos
   * para mantener la UI preparada para RBAC
   * granular.
   */
  const canOperationalTransition =
    canComment
    ||
    hasPermission(
      helpdeskPermissions
        .ticketTransition,
    )

  const canResolve =
    hasPermission(
      'tickets.close',
    )
    ||
    hasPermission(
      helpdeskPermissions
        .ticketResolve,
    )
    ||
    hasPermission(
      helpdeskPermissions
        .adminAccess,
    )

  const canClose =
    hasPermission(
      'tickets.close',
    )
    ||
    hasPermission(
      helpdeskPermissions
        .ticketClose,
    )
    ||
    hasPermission(
      helpdeskPermissions
        .adminAccess,
    )

  const canReopenPermission =
    hasPermission(
      'tickets.close',
    )
    ||
    hasPermission(
      helpdeskPermissions
        .ticketReopen,
    )
    ||
    hasPermission(
      helpdeskPermissions
        .adminAccess,
    )

  const load =
    useCallback(
      async () => {
        if (
          !ticketId
        ) {
          setError(
            'No se indicó un ticket válido.',
          )

          setLoading(
            false,
          )

          return
        }

        setLoading(
          true,
        )

        setError(
          null,
        )

        try {
          const result =
            await helpdeskApi
              .getTicket(
                ticketId,
              )

          setTicket(
            result,
          )
        }
        catch (
          exception
        ) {
          setError(
            getErrorMessage(
              exception,
              'No se pudo cargar el ticket. Comprueba la conexión e inténtalo de nuevo.',
            ),
          )
        }
        finally {
          setLoading(
            false,
          )
        }
      },
      [
        ticketId,
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

  async function sendComment(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      !ticketId
      ||
      !comment.trim()
      ||
      !canComment
      ||
      saving
    ) {
      return
    }

    setSaving(
      true,
    )

    setError(
      null,
    )

    try {
      const updated =
        await helpdeskApi
          .addComment(
            ticketId,
            comment.trim(),
            internal,
          )

      setTicket(
        updated,
      )

      setComment(
        '',
      )

      setInternal(
        false,
      )
    }
    catch (
      exception
    ) {
      setError(
        getErrorMessage(
          exception,
          'No se pudo publicar el comentario.',
        ),
      )
    }
    finally {
      setSaving(
        false,
      )
    }
  }

  async function changeStatus(
    status: string,
  ) {
    if (
      !ticketId
      ||
      saving
    ) {
      return
    }

    setSaving(
      true,
    )

    setError(
      null,
    )

    try {
      const updated =
        await helpdeskApi
          .transition(
            ticketId,
            status,
          )

      setTicket(
        updated,
      )
    }
    catch (
      exception
    ) {
      setError(
        getErrorMessage(
          exception,
          'No se pudo actualizar el estado del ticket.',
        ),
      )
    }
    finally {
      setSaving(
        false,
      )
    }
  }

  async function reopenTicket(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      !ticketId
      ||
      !reopenReason.trim()
      ||
      saving
    ) {
      return
    }

    setSaving(
      true,
    )

    setError(
      null,
    )

    try {
      const updated =
        await helpdeskApi
          .reopen(
            ticketId,
            reopenReason.trim(),
          )

      setTicket(
        updated,
      )

      setReopenReason(
        '',
      )

      setShowReopen(
        false,
      )
    }
    catch (
      exception
    ) {
      setError(
        getErrorMessage(
          exception,
          'No se pudo reabrir el ticket.',
        ),
      )
    }
    finally {
      setSaving(
        false,
      )
    }
  }

  async function takeTicket() {
    if (
      !ticketId
      ||
      !user?.id
      ||
      !canAssign
      ||
      saving
    ) {
      return
    }

    setSaving(
      true,
    )

    setError(
      null,
    )

    try {
      const updated =
        await helpdeskApi
          .assign(
            ticketId,
            user.id,
          )

      setTicket(
        updated,
      )
    }
    catch (
      exception
    ) {
      setError(
        getErrorMessage(
          exception,
          'No se pudo asignar el ticket a tu usuario.',
        ),
      )
    }
    finally {
      setSaving(
        false,
      )
    }
  }

  if (
    loading
    &&
    !ticket
  ) {
    return (
      <main
        className={
          'titan-page ' +
          'helpdesk-page ' +
          'helpdesk-detail'
        }
      >
        <div
          className="helpdesk-detail__loading"
        >
          Cargando ticket…
        </div>
      </main>
    )
  }

  if (
    !ticket
  ) {
    return (
      <main
        className={
          'titan-page ' +
          'helpdesk-page ' +
          'helpdesk-detail'
        }
      >
        <div
          className="helpdesk-detail__loading"
        >
          <p>
            {
              error
              ??
              'No se encontró el ticket.'
            }
          </p>

          <button
            type="button"
            className={
              'helpdesk-ui-button ' +
              'helpdesk-ui-button--secondary'
            }
            onClick={
              () =>
                navigate(
                  '/helpdesk?workspace=helpdesk',
                )
            }
          >
            <ArrowLeft
              size={16}
            />

            Volver a la bandeja
          </button>
        </div>
      </main>
    )
  }

  const normalizedStatus =
    ticket.status
      .trim()
      .toLowerCase()

  const terminal =
    normalizedStatus ===
      'resolved'
    ||
    normalizedStatus ===
      'closed'

  const canTake =
    canAssign
    &&
    !terminal
    &&
    ticket.assigneeUserId !==
      user?.id

  const showInProgress =
    canOperationalTransition
    &&
    !terminal
    &&
    normalizedStatus !==
      'inprogress'

  const showPendingUser =
    canOperationalTransition
    &&
    !terminal
    &&
    normalizedStatus !==
      'pendinguser'

  const showResolve =
    canResolve
    &&
    !terminal

  /*
   * Según la máquina de estados:
   * resolved -> closed.
   *
   * No ofrecemos "Cerrar" desde open,
   * new, inprogress o pendinguser.
   */
  const showClose =
    canClose
    &&
    normalizedStatus ===
      'resolved'

  const showReopenAction =
    canReopenPermission
    &&
    terminal

  const slaPaused =
    normalizedStatus ===
      'pendinguser'

  return (
    <main
      className={
        'titan-page ' +
        'helpdesk-page ' +
        'helpdesk-detail'
      }
    >
      <div
        className="helpdesk-detail__back"
      >
        <button
          type="button"
          onClick={
            () =>
              navigate(
                '/helpdesk?workspace=helpdesk',
              )
          }
        >
          <ArrowLeft
            size={16}
          />

          Volver a tickets
        </button>
      </div>

      <header
        className="helpdesk-detail__header"
      >
        <div>
          <span
            className="helpdesk-inbox__eyebrow"
          >
            <Headphones
              size={15}
            />

            Ticket {
              ticket.number
            }
          </span>

          <h1>
            {ticket.subject}
          </h1>

          <div
            className="helpdesk-detail__header-meta"
          >
            <span
              className={
                `helpdesk-inbox__badge ` +
                `helpdesk-inbox__badge--${normalizedStatus}`
              }
            >
              {
                statusLabels[
                  normalizedStatus
                ]
                ??
                ticket.status
              }
            </span>

            <span>
              Prioridad{' '}
              {
                priorityLabels[
                  ticket.priority
                ]
                ??
                ticket.priority
              }
            </span>

            <span>
              Creado{' '}
              {formatDate(
                ticket.createdAtUtc,
              )}
            </span>

            {slaPaused && (
              <span
                className="helpdesk-workflow__sla-paused"
              >
                <PauseCircle
                  size={14}
                />

                SLA pausado
              </span>
            )}

            {ticket.slaBreached && (
              <span
                className="helpdesk-detail__breached"
              >
                <AlertTriangle
                  size={14}
                />

                SLA vencido
              </span>
            )}
          </div>
        </div>

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
            () =>
              void load()
          }
        >
          <RefreshCw
            size={16}
          />

          Actualizar
        </button>
      </header>

      {error && (
        <div
          className="helpdesk-inbox__error"
          role="alert"
        >
          <AlertTriangle
            size={17}
          />

          {error}
        </div>
      )}

      <div
        className="helpdesk-detail__layout"
      >
        <div
          className="helpdesk-detail__main"
        >
          <section
            className="helpdesk-detail__card"
          >
            <div
              className="helpdesk-detail__section-title"
            >
              <div>
                <h2>
                  Descripción del caso
                </h2>

                <p>
                  Información registrada
                  al crear el ticket
                </p>
              </div>
            </div>

            <p
              className="helpdesk-detail__description"
            >
              {
                ticket.description
                ||
                'No se agregó una descripción.'
              }
            </p>

            <div
              className="helpdesk-detail__attributes"
            >
              <span>
                Tipo:{' '}
                <strong>
                  {ticket.type}
                </strong>
              </span>

              <span>
                Categoría:{' '}
                <strong>
                  {ticket.category}
                </strong>
              </span>

              <span>
                Origen:{' '}
                <strong>
                  {ticket.source}
                </strong>
              </span>
            </div>
          </section>

          <section
            className="helpdesk-detail__card"
          >
            <div
              className="helpdesk-detail__section-title"
            >
              <div>
                <h2>
                  Conversación
                </h2>

                <p>
                  Respuestas y notas
                  registradas en el ticket
                </p>
              </div>

              <span
                className="helpdesk-detail__count"
              >
                {
                  ticket.comments.length
                }
              </span>
            </div>

            <div
              className="helpdesk-detail__conversation"
            >
              {
                ticket.comments.length ===
                  0
                  ? (
                    <div
                      className="helpdesk-detail__empty"
                    >
                      <MessageSquare
                        size={25}
                      />

                      <strong>
                        Aún no hay respuestas
                      </strong>

                      <span>
                        La conversación
                        aparecerá aquí.
                      </span>
                    </div>
                  )
                  : ticket.comments.map(
                      item => (
                        <article
                          key={
                            item.id
                          }
                          className={
                            `helpdesk-detail__message` +
                            (
                              item.isInternal
                                ? ' helpdesk-detail__message--internal'
                                : ''
                            )
                          }
                        >
                          <div
                            className="helpdesk-detail__message-top"
                          >
                            <span
                              className="helpdesk-detail__avatar"
                            >
                              {
                                item.authorName
                                  .charAt(
                                    0,
                                  )
                                  .toUpperCase()
                              }
                            </span>

                            <div>
                              <strong>
                                {
                                  item.authorName
                                }
                              </strong>

                              <span>
                                {formatDate(
                                  item.createdAtUtc,
                                )}
                              </span>
                            </div>

                            {item.isInternal && (
                              <small>
                                <LockKeyhole
                                  size={13}
                                />

                                Nota interna
                              </small>
                            )}
                          </div>

                          <p>
                            {item.body}
                          </p>
                        </article>
                      ),
                    )
              }
            </div>

            {canComment && !terminal && (
              <form
                className="helpdesk-detail__composer"
                onSubmit={
                  event =>
                    void sendComment(
                      event,
                    )
                }
              >
                <label
                  htmlFor="helpdesk-reply"
                >
                  {
                    internal
                      ? 'Nota interna'
                      : 'Respuesta al solicitante'
                  }
                </label>

                <textarea
                  id="helpdesk-reply"
                  required
                  maxLength={
                    4000
                  }
                  rows={
                    4
                  }
                  value={
                    comment
                  }
                  onChange={
                    event =>
                      setComment(
                        event
                          .target
                          .value,
                      )
                  }
                  placeholder={
                    internal
                      ? 'Escribe una nota visible solo para el personal autorizado…'
                      : 'Escribe tu respuesta…'
                  }
                />

                <div
                  className="helpdesk-detail__composer-footer"
                >
                  <label
                    className="helpdesk-detail__internal"
                  >
                    <input
                      type="checkbox"
                      checked={
                        internal
                      }
                      onChange={
                        event =>
                          setInternal(
                            event
                              .target
                              .checked,
                          )
                      }
                    />

                    <LockKeyhole
                      size={15}
                    />

                    Nota interna
                  </label>

                  <button
                    type="submit"
                    className={
                      'helpdesk-ui-button ' +
                      'helpdesk-ui-button--primary'
                    }
                    disabled={
                      saving
                      ||
                      !comment.trim()
                    }
                  >
                    <Send
                      size={15}
                    />

                    {
                      saving
                        ? 'Publicando…'
                        : 'Publicar'
                    }
                  </button>
                </div>
              </form>
            )}
          </section>

          <section
            className="helpdesk-detail__card"
          >
            <div
              className="helpdesk-detail__section-title"
            >
              <div>
                <h2>
                  Actividad
                </h2>

                <p>
                  Historial de acciones
                  del ticket
                </p>
              </div>

              <Clock3
                size={18}
              />
            </div>

            {
              ticket.timeline.length ===
                0
                ? (
                  <p
                    className="helpdesk-detail__muted"
                  >
                    Todavía no hay eventos.
                  </p>
                )
                : (
                  <ol
                    className="helpdesk-detail__timeline"
                  >
                    {
                      ticket.timeline.map(
                        item => (
                          <li
                            key={
                              item.id
                            }
                          >
                            <span
                              className="helpdesk-detail__timeline-dot"
                            />

                            <div>
                              <strong>
                                {
                                  item.summary
                                }
                              </strong>

                              <time>
                                {formatDate(
                                  item.createdAtUtc,
                                )}
                              </time>
                            </div>
                          </li>
                        ),
                      )
                    }
                  </ol>
                )
            }
          </section>
        </div>

        <aside
          className="helpdesk-detail__sidebar"
        >
          <section
            className="helpdesk-detail__card"
          >
            <h2>
              Responsables
            </h2>

            <div
              className="helpdesk-detail__info-row"
            >
              <UserRound
                size={17}
              />

              <div>
                <span>
                  Solicitante
                </span>

                <strong>
                  {
                    ticket.requesterName
                  }
                </strong>

                {
                  ticket.entraUserPrincipalName &&
                  (
                    <small>
                      {
                        ticket.entraUserPrincipalName
                      }
                    </small>
                  )
                }
              </div>
            </div>

            <div
              className="helpdesk-detail__info-row"
            >
              <Headphones
                size={17}
              />

              <div>
                <span>
                  Técnico asignado
                </span>

                <strong>
                  {
                    ticket.assigneeName
                    ??
                    'Sin asignar'
                  }
                </strong>
              </div>
            </div>

            {canTake && (
              <button
                type="button"
                className={
                  'helpdesk-ui-button ' +
                  'helpdesk-ui-button--secondary ' +
                  'helpdesk-detail__full'
                }
                disabled={
                  saving
                }
                onClick={
                  () =>
                    void takeTicket()
                }
              >
                Tomar ticket
              </button>
            )}
          </section>

          <section
            className="helpdesk-detail__card"
          >
            <h2>
              Dispositivo
            </h2>

            <div
              className="helpdesk-detail__info-row"
            >
              <Monitor
                size={18}
              />

              <div>
                <span>
                  Equipo relacionado
                </span>

                <strong>
                  {
                    ticket.deviceName
                    ??
                    'Sin dispositivo vinculado'
                  }
                </strong>

                {
                  ticket.devicePlatform &&
                  (
                    <small>
                      {
                        ticket.devicePlatform
                      }
                    </small>
                  )
                }
              </div>
            </div>

            {ticket.deviceId && (
              <button
                type="button"
                className={
                  'helpdesk-ui-button ' +
                  'helpdesk-ui-button--secondary ' +
                  'helpdesk-detail__full'
                }
                onClick={
                  () =>
                    navigate(
                      `/devices/${ticket.deviceId}`,
                    )
                }
              >
                Ver dispositivo
              </button>
            )}

            {ticket.remoteSessionId && (
              <p
                className="helpdesk-detail__muted"
              >
                Sesión remota vinculada:{' '}
                {
                  ticket.remoteSessionId
                }
              </p>
            )}
          </section>

          <section
            className="helpdesk-detail__card"
          >
            <h2>
              Acuerdos de servicio
            </h2>

            {slaPaused && (
              <div
                className="helpdesk-workflow__notice"
              >
                <PauseCircle
                  size={17}
                />

                <div>
                  <strong>
                    SLA pausado
                  </strong>

                  <span>
                    Esperando una respuesta
                    del solicitante.
                  </span>
                </div>
              </div>
            )}

            <div
              className="helpdesk-detail__sla-row"
            >
              <span>
                Primera respuesta
              </span>

              <strong>
                {formatDate(
                  ticket.firstResponseDueAtUtc,
                )}
              </strong>
            </div>

            <div
              className="helpdesk-detail__sla-row"
            >
              <span>
                Resolución
              </span>

              <strong>
                {formatDate(
                  ticket.resolveDueAtUtc,
                )}
              </strong>
            </div>

            <p
              className="helpdesk-detail__muted"
            >
              {
                slaPaused
                  ? 'Los vencimientos se reanudarán cuando el solicitante responda.'
                  : ticket.slaBreached
                    ? 'Hay un plazo vencido.'
                    : 'Sin vencimientos detectados.'
              }
            </p>
          </section>

          {
            (
              canOperationalTransition
              ||
              canResolve
              ||
              canClose
              ||
              canReopenPermission
            )
            &&
            (
              <section
                className="helpdesk-detail__card"
              >
                <h2>
                  Acciones
                </h2>

                <div
                  className="helpdesk-detail__actions"
                >
                  {showInProgress && (
                    <button
                      type="button"
                      className={
                        'helpdesk-ui-button ' +
                        'helpdesk-ui-button--secondary'
                      }
                      disabled={
                        saving
                      }
                      onClick={
                        () =>
                          void changeStatus(
                            'inprogress',
                          )
                      }
                    >
                      En proceso
                    </button>
                  )}

                  {showPendingUser && (
                    <button
                      type="button"
                      className={
                        'helpdesk-ui-button ' +
                        'helpdesk-ui-button--secondary'
                      }
                      disabled={
                        saving
                      }
                      onClick={
                        () =>
                          void changeStatus(
                            'pendinguser',
                          )
                      }
                    >
                      <PauseCircle
                        size={16}
                      />

                      Esperando usuario
                    </button>
                  )}

                  {showResolve && (
                    <button
                      type="button"
                      className={
                        'helpdesk-ui-button ' +
                        'helpdesk-ui-button--secondary'
                      }
                      disabled={
                        saving
                      }
                      onClick={
                        () =>
                          void changeStatus(
                            'resolved',
                          )
                      }
                    >
                      <CheckCircle2
                        size={16}
                      />

                      Resolver
                    </button>
                  )}

                  {showClose && (
                    <button
                      type="button"
                      className={
                        'helpdesk-ui-button ' +
                        'helpdesk-ui-button--secondary'
                      }
                      disabled={
                        saving
                      }
                      onClick={
                        () =>
                          void changeStatus(
                            'closed',
                          )
                      }
                    >
                      Cerrar ticket
                    </button>
                  )}

                  {showReopenAction && (
                    <button
                      type="button"
                      className={
                        'helpdesk-ui-button ' +
                        'helpdesk-workflow__reopen-button'
                      }
                      disabled={
                        saving
                      }
                      onClick={
                        () => {
                          setReopenReason(
                            '',
                          )

                          setShowReopen(
                            true,
                          )
                        }
                      }
                    >
                      <RotateCcw
                        size={16}
                      />

                      Reabrir ticket
                    </button>
                  )}
                </div>
              </section>
            )
          }
        </aside>
      </div>

      {showReopen && (
        <div
          className="helpdesk-workflow-modal"
          role="presentation"
          onMouseDown={
            event => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setShowReopen(
                  false,
                )
              }
            }
          }
        >
          <form
            className="helpdesk-workflow-modal__dialog"
            onSubmit={
              event =>
                void reopenTicket(
                  event,
                )
            }
          >
            <header
              className="helpdesk-workflow-modal__header"
            >
              <div
                className="helpdesk-workflow-modal__icon"
              >
                <RotateCcw
                  size={21}
                />
              </div>

              <div>
                <h2>
                  Reabrir ticket
                </h2>

                <p>
                  Esta acción devolverá
                  el caso a estado abierto.
                </p>
              </div>

              <button
                type="button"
                className="helpdesk-workflow-modal__close"
                aria-label="Cerrar"
                onClick={
                  () =>
                    setShowReopen(
                      false,
                    )
                }
              >
                <X
                  size={19}
                />
              </button>
            </header>

            <div
              className="helpdesk-workflow-modal__body"
            >
              <label
                htmlFor="helpdesk-reopen-reason"
              >
                Motivo de reapertura
              </label>

              <textarea
                id="helpdesk-reopen-reason"
                autoFocus
                rows={5}
                minLength={5}
                maxLength={1000}
                required
                value={
                  reopenReason
                }
                onChange={
                  event =>
                    setReopenReason(
                      event
                        .target
                        .value,
                    )
                }
                placeholder={
                  'Describe por qué es necesario continuar trabajando este caso…'
                }
              />

              <small>
                El motivo quedará registrado
                en el historial de auditoría.
              </small>
            </div>

            <footer
              className="helpdesk-workflow-modal__footer"
            >
              <button
                type="button"
                className={
                  'helpdesk-ui-button ' +
                  'helpdesk-ui-button--secondary'
                }
                disabled={
                  saving
                }
                onClick={
                  () =>
                    setShowReopen(
                      false,
                    )
                }
              >
                Cancelar
              </button>

              <button
                type="submit"
                className={
                  'helpdesk-ui-button ' +
                  'helpdesk-ui-button--primary'
                }
                disabled={
                  saving
                  ||
                  reopenReason
                    .trim()
                    .length < 5
                }
              >
                <RotateCcw
                  size={16}
                />

                {
                  saving
                    ? 'Reabriendo…'
                    : 'Confirmar reapertura'
                }
              </button>
            </footer>
          </form>
        </div>
      )}
    </main>
  )
}