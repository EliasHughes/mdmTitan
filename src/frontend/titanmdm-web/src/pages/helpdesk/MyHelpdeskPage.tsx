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
  ArrowLeft,
  ArrowRight,
  Headphones,
  MessageSquare,
  Plus,
  Send,
  Ticket,
} from 'lucide-react'

import axios
  from 'axios'

import apiClient
  from '../../api/apiClient'

import {
  useAuth,
} from '../../auth/AuthContext'

import {
  helpdeskPermissions,
} from '../../auth/helpdeskAccess'

import './HelpdeskPages.css'

interface MyTicket {
  id: string
  number: string
  subject: string
  description: string
  status: string
  priority: string
  category: string
  createdAtUtc: string
  updatedAtUtc: string
}

interface MyTicketDetails
  extends MyTicket {
  comments: {
    id: string
    authorUserId: string
    authorName: string
    body: string
    createdAtUtc: string
  }[]

  activity: {
    id: string
    eventType: string
    summary: string
    createdAtUtc: string
  }[]
}

const statusNames:
  Record<string, string> = {
    new:
      'Recibido',

    open:
      'En atención',

    inprogress:
      'En proceso',

    pendinguser:
      'Esperando tu respuesta',

    resolved:
      'Resuelto',

    closed:
      'Cerrado',
  }

function formatDate(
  value: string,
) {
  const parsed =
    new Date(
      /(?:Z|[+-]\d{2}:?\d{2})$/i
        .test(value)
        ? value
        : value + 'Z',
    )

  return Number.isNaN(
    parsed.getTime(),
  )
    ? '—'
    : new Intl
        .DateTimeFormat(
          'es-DO',
          {
            dateStyle:
              'medium',

            timeStyle:
              'short',
          },
        )
        .format(
          parsed,
        )
}

function errorMessage(
  error: unknown,
  fallback: string,
) {
  return (
    axios.isAxiosError(
      error,
    )
    &&
    typeof error
      .response
      ?.data
      ?.message ===
      'string'
  )
    ? error
        .response
        ?.data
        ?.message
    : fallback
}

export function MyHelpdeskPage() {
  const {
    ticketId,
  } =
    useParams()

  const navigate =
    useNavigate()

  const {
    hasPermission,
  } =
    useAuth()

  const [
    tickets,
    setTickets,
  ] =
    useState<MyTicket[]>(
      [],
    )

  const [
    ticket,
    setTicket,
  ] =
    useState<MyTicketDetails | null>(
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
    useState(
      '',
    )

  const [
    reply,
    setReply,
  ] =
    useState(
      '',
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

  const canReply =
    hasPermission(
      helpdeskPermissions
        .requestOwnComment,
    )
    ||
    hasPermission(
      helpdeskPermissions
        .portalAccess,
    )

  const load =
    useCallback(
      async (
        signal:
          AbortSignal,
      ) => {
        setLoading(
          true,
        )

        setError(
          '',
        )

        setTicket(
          null,
        )

        try {
          if (
            ticketId
          ) {
            /*
             * IMPORTANTE:
             * usuario común usa SIEMPRE
             * /api/my/helpdesk.
             */
            const result =
              await apiClient
                .get<MyTicketDetails>(
                  `/my/helpdesk/tickets/${ticketId}`,
                  {
                    signal,
                  },
                )

            if (
              !signal.aborted
            ) {
              setTicket(
                result.data,
              )
            }
          }
          else {
            const result =
              await apiClient
                .get<MyTicket[]>(
                  '/my/helpdesk/tickets',
                  {
                    signal,
                  },
                )

            if (
              !signal.aborted
            ) {
              setTickets(
                result.data,
              )
            }
          }
        }
        catch (
          exception
        ) {
          if (
            !signal.aborted
          ) {
            setError(
              errorMessage(
                exception,
                ticketId
                  ? 'No pudimos cargar esta solicitud.'
                  : 'No pudimos cargar tus solicitudes.',
              ),
            )
          }
        }
        finally {
          if (
            !signal.aborted
          ) {
            setLoading(
              false,
            )
          }
        }
      },
      [
        ticketId,
      ],
    )

  useEffect(
    () => {
      const controller =
        new AbortController()

      setReply(
        '',
      )

      void load(
        controller.signal,
      )

      return () =>
        controller.abort()
    },
    [
      load,
    ],
  )

  async function sendReply(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      !ticketId
      ||
      !reply.trim()
      ||
      saving
    ) {
      return
    }

    setSaving(
      true,
    )

    setError(
      '',
    )

    try {
      const result =
        await apiClient
          .post<MyTicketDetails>(
            `/my/helpdesk/tickets/${ticketId}/reply`,
            {
              body:
                reply.trim(),
            },
          )

      setTicket(
        result.data,
      )

      setReply(
        '',
      )
    }
    catch (
      exception
    ) {
      setError(
        errorMessage(
          exception,
          'No pudimos publicar tu respuesta.',
        ),
      )
    }
    finally {
      setSaving(
        false,
      )
    }
  }

  const badge =
    (
      value: string,
    ) => (
      <span
        className={
          `helpdesk-inbox__badge ` +
          `helpdesk-inbox__badge--${value}`
        }
      >
        {
          statusNames[
            value
          ]
          ??
          value
        }
      </span>
    )

  /*
   * ============================================================
   * DETAIL
   * ============================================================
   */

  if (
    ticketId
  ) {
    return (
      <main
        className={
          'titan-page ' +
          'helpdesk-page ' +
          'my-helpdesk'
        }
      >
        <button
          type="button"
          className="my-helpdesk__back"
          onClick={
            () =>
              navigate(
                '/my-support?workspace=helpdesk',
              )
          }
        >
          <ArrowLeft
            size={16}
          />

          Mis solicitudes
        </button>

        {error && (
          <div
            className="helpdesk-inbox__error"
            role="alert"
          >
            {error}
          </div>
        )}

        {loading && (
          <section
            className="my-helpdesk__card"
          >
            Cargando solicitud…
          </section>
        )}

        {!loading &&
          !ticket &&
          !error && (
          <section
            className="my-helpdesk__card"
          >
            La solicitud no
            está disponible.
          </section>
        )}

        {!loading &&
          ticket && (
          <>
            <header
              className="my-helpdesk__hero"
            >
              <span
                className="helpdesk-inbox__eyebrow"
              >
                <Headphones
                  size={15}
                />

                Solicitud{' '}
                {
                  ticket.number
                }
              </span>

              <h1>
                {
                  ticket.subject
                }
              </h1>

              <div
                className="my-helpdesk__meta"
              >
                {badge(
                  ticket.status,
                )}

                <span>
                  Creada{' '}
                  {formatDate(
                    ticket.createdAtUtc,
                  )}
                </span>
              </div>
            </header>

            <section
              className="my-helpdesk__card"
            >
              <h2>
                Tu solicitud
              </h2>

              <p
                className="my-helpdesk__body"
              >
                {
                  ticket.description
                }
              </p>
            </section>

            <section
              className="my-helpdesk__card"
            >
              <h2>
                Conversación
              </h2>

              {!ticket
                .comments
                .length ? (
                <div
                  className="my-helpdesk__empty"
                >
                  <MessageSquare
                    size={26}
                  />

                  <strong>
                    Aún no hay respuestas
                  </strong>

                  <span>
                    El equipo TIC
                    responderá aquí.
                  </span>
                </div>
              ) : (
                <div
                  className="my-helpdesk__messages"
                >
                  {ticket.comments.map(
                    item => (
                      <article
                        key={
                          item.id
                        }
                      >
                        <div>
                          <strong>
                            {
                              item.authorName
                            }
                          </strong>

                          <time>
                            {formatDate(
                              item.createdAtUtc,
                            )}
                          </time>
                        </div>

                        <p
                          className="my-helpdesk__body"
                        >
                          {
                            item.body
                          }
                        </p>
                      </article>
                    ),
                  )}
                </div>
              )}

              {canReply &&
                ![
                  'resolved',
                  'closed',
                ].includes(
                  ticket.status,
                ) && (
                <form
                  className="my-helpdesk__form"
                  onSubmit={
                    event =>
                      void sendReply(
                        event,
                      )
                  }
                >
                  <label
                    htmlFor="helpdesk-reply"
                  >
                    Responder al
                    equipo TIC
                  </label>

                  <textarea
                    id="helpdesk-reply"
                    value={
                      reply
                    }
                    onChange={
                      event =>
                        setReply(
                          event
                            .target
                            .value,
                        )
                    }
                    placeholder={
                      'Escribe información adicional…'
                    }
                  />

                  <button
                    type="submit"
                    className={
                      'helpdesk-ui-button ' +
                      'helpdesk-ui-button--primary'
                    }
                    disabled={
                      saving ||
                      !reply.trim()
                    }
                  >
                    <Send
                      size={16}
                    />

                    {
                      saving
                        ? 'Enviando…'
                        : 'Enviar respuesta'
                    }
                  </button>
                </form>
              )}
            </section>
          </>
        )}
      </main>
    )
  }

  /*
   * ============================================================
   * REQUESTER HOME
   * ============================================================
   */

  return (
    <main
      className={
        'titan-page ' +
        'helpdesk-page ' +
        'my-helpdesk'
      }
    >
      <header
        className="my-helpdesk__hero"
      >
        <div
          className="my-helpdesk__heading"
        >
          <div>
            <span
              className="helpdesk-inbox__eyebrow"
            >
              <Headphones
                size={15}
              />

              PORTAL DE SOPORTE
            </span>

            <h1>
              Mesa de Ayuda
            </h1>

            <p>
              Crea solicitudes,
              consulta su estado y
              conversa con el equipo TIC.
            </p>
          </div>

          {canCreate && (
            <button
              type="button"
              className={
                'helpdesk-ui-button ' +
                'helpdesk-ui-button--primary'
              }
              onClick={
                () =>
                  navigate(
                    '/my-support/new?workspace=helpdesk',
                  )
              }
            >
              <Plus
                size={16}
              />

              Crear solicitud
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
        </div>
      )}

      <section
        className="my-helpdesk__card"
      >
        <div
          className="my-helpdesk__heading"
        >
          <div>
            <h2>
              Mis solicitudes
            </h2>

            <p>
              Solo puedes ver
              tus propios tickets.
            </p>
          </div>

          <span
            className="helpdesk-inbox__total"
          >
            {
              tickets.length
            } solicitudes
          </span>
        </div>

        {loading ? (
          <div
            className="my-helpdesk__empty"
          >
            Cargando…
          </div>
        ) : !tickets.length ? (
          <div
            className="my-helpdesk__empty"
          >
            <Ticket
              size={28}
            />

            <strong>
              No tienes solicitudes
            </strong>

            <span>
              Cuando necesites
              soporte podrás crear
              una solicitud aquí.
            </span>
          </div>
        ) : (
          <div
            className="my-helpdesk__list"
          >
            {tickets.map(
              item => (
                <button
                  type="button"
                  key={
                    item.id
                  }
                  onClick={
                    () =>
                      navigate(
                        `/my-support/${item.id}?workspace=helpdesk`,
                      )
                  }
                >
                  <span>
                    <small>
                      {
                        item.number
                      }
                    </small>

                    <strong>
                      {
                        item.subject
                      }
                    </strong>

                    <small>
                      Actualizado{' '}
                      {formatDate(
                        item.updatedAtUtc,
                      )}
                    </small>
                  </span>

                  <span
                    className="my-helpdesk__meta"
                  >
                    {badge(
                      item.status,
                    )}

                    <ArrowRight
                      size={17}
                    />
                  </span>
                </button>
              ),
            )}
          </div>
        )}
      </section>
    </main>
  )
}