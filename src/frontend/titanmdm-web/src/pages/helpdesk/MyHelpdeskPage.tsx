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
  Headphones,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
} from 'lucide-react'
import apiClient from '../../api/apiClient'
import {
  HelpdeskCategorySelect,
} from './HelpdeskCategorySelect'
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

interface MyComment {
  id: string
  body: string
  authorUserId: string
  authorName: string
  createdAtUtc: string
}

interface MyTicketDetails
  extends MyTicket {
  comments: MyComment[]
  activity: {
    id: string
    eventType: string
    summary: string
    createdAtUtc: string
  }[]
}

interface AssistantSuggestion {
  suggestedSubject: string
  suggestedCategory: string
  recommendations: string[]
}

const statusNames:
  Record<string, string> = {
    new: 'Recibido',
    open: 'En atención',
    inprogress: 'En proceso',
    pendinguser:
      'Esperando tu respuesta',
    resolved: 'Resuelto',
    closed: 'Cerrado',
  }

function formatDate(value: string) {
  const date = new Date(value)

  return Number.isNaN(
    date.getTime(),
  )
    ? '—'
    : new Intl.DateTimeFormat(
        'es-DO',
        {
          dateStyle: 'medium',
          timeStyle: 'short',
        },
      ).format(date)
}

export function MyHelpdeskPage() {
  const { ticketId } = useParams()
  const navigate = useNavigate()

  const [tickets, setTickets] =
    useState<MyTicket[]>([])
  const [ticket, setTicket] =
    useState<
      MyTicketDetails | null
    >(null)
  const [loading, setLoading] =
    useState(true)
  const [saving, setSaving] =
    useState(false)
  const [error, setError] =
    useState('')
  const [
    showCreate,
    setShowCreate,
  ] = useState(false)
  const [subject, setSubject] =
    useState('')
  const [
    description,
    setDescription,
  ] = useState('')
  const [
    category,
    setCategory,
  ] = useState('general')
  const [reply, setReply] =
    useState('')

  const [
    assistantEnabled,
    setAssistantEnabled,
  ] = useState(false)
  const [
    suggesting,
    setSuggesting,
  ] = useState(false)
  const [
    suggestion,
    setSuggestion,
  ] =
    useState<
      AssistantSuggestion | null
    >(null)
  const [
    suggestionError,
    setSuggestionError,
  ] = useState('')

  const load = useCallback(
    async () => {
      setLoading(true)
      setError('')

      try {
        if (ticketId) {
          const result =
            await apiClient.get<
              MyTicketDetails
            >(
              `/my/helpdesk/tickets/${ticketId}`,
            )
          setTicket(result.data)
        } else {
          const result =
            await apiClient.get<
              MyTicket[]
            >(
              '/my/helpdesk/tickets',
            )
          setTickets(
            result.data,
          )
          setTicket(null)
        }
      } catch {
        setError(
          'No pudimos cargar tus solicitudes.',
        )
      } finally {
        setLoading(false)
      }
    },
    [ticketId],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (ticketId) return

    let active = true

    async function loadAssistant() {
      try {
        const response =
          await apiClient.get<{
            enabled: boolean
          }>(
            '/helpdesk/operations/assistant/me',
          )

        if (active) {
          setAssistantEnabled(
            response.data
              .enabled === true,
          )
        }
      } catch {
        if (active) {
          setAssistantEnabled(
            false,
          )
        }
      }
    }

    void loadAssistant()

    return () => {
      active = false
    }
  }, [ticketId])

  async function requestSuggestion() {
    if (
      !assistantEnabled ||
      suggesting ||
      description
        .trim()
        .length < 15
    ) {
      return
    }

    setSuggesting(true)
    setSuggestion(null)
    setSuggestionError('')

    try {
      const response =
        await apiClient.post<
          AssistantSuggestion
        >(
          '/my/helpdesk/assistant/suggest',
          {
            subject:
              subject.trim(),
            description:
              description.trim(),
          },
        )

      setSuggestion(
        response.data,
      )
    } catch {
      setSuggestionError(
        'El asistente no está disponible ahora. Puedes enviar tu solicitud sin sugerencias.',
      )
    } finally {
      setSuggesting(false)
    }
  }

  async function createTicket(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      !subject.trim() ||
      !description.trim() ||
      saving
    ) {
      return
    }

    setSaving(true)
    setError('')

    try {
      const response =
        await apiClient.post<{
          id: string
        }>(
          '/my/helpdesk/tickets',
          {
            subject:
              subject.trim(),
            description:
              description.trim(),
            type:
              'incident',
            priority:
              'medium',
            category,
          },
        )

      setShowCreate(false)
      navigate(
        `/my-support/${response.data.id}?workspace=helpdesk`,
      )
    } catch {
      setError(
        'No pudimos crear tu solicitud.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function sendReply(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      !ticketId ||
      !reply.trim() ||
      saving
    ) {
      return
    }

    setSaving(true)
    setError('')

    try {
      const result =
        await apiClient.post<
          MyTicketDetails
        >(
          `/my/helpdesk/tickets/${ticketId}/reply`,
          {
            body:
              reply.trim(),
          },
        )

      setTicket(
        result.data,
      )
      setReply('')
    } catch {
      setError(
        'No pudimos publicar tu respuesta.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (ticketId) {
    return (
      <main className="titan-page helpdesk-page my-helpdesk">
        <button
          type="button"
          className="my-helpdesk__back"
          onClick={() =>
            navigate(
              '/my-support?workspace=helpdesk',
            )
          }
        >
          <ArrowLeft size={16} />
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
          <section className="my-helpdesk__card">
            Cargando solicitud…
          </section>
        )}

        {!loading &&
          ticket && (
            <>
              <header className="my-helpdesk__hero">
                <span className="helpdesk-inbox__eyebrow">
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

                <div className="my-helpdesk__meta">
                  <span
                    className={
                      `helpdesk-inbox__badge ` +
                      `helpdesk-inbox__badge--${ticket.status}`
                    }
                  >
                    {statusNames[
                      ticket.status
                    ] ??
                      ticket.status}
                  </span>

                  <span>
                    Creada{' '}
                    {formatDate(
                      ticket.createdAtUtc,
                    )}
                  </span>
                </div>
              </header>

              <section className="my-helpdesk__card">
                <h2>
                  Tu solicitud
                </h2>

                <p className="my-helpdesk__body">
                  {
                    ticket.description
                  }
                </p>
              </section>

              <section className="my-helpdesk__card">
                <h2>
                  Conversación
                </h2>

                {ticket
                  .comments
                  .length === 0 ? (
                  <p className="my-helpdesk__muted">
                    Aún no hay
                    respuestas.
                  </p>
                ) : (
                  <div className="my-helpdesk__messages">
                    {ticket.comments.map(
                      (item) => (
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

                          <p className="my-helpdesk__body">
                            {
                              item.body
                            }
                          </p>
                        </article>
                      ),
                    )}
                  </div>
                )}

                {![
                  'resolved',
                  'closed',
                ].includes(
                  ticket.status,
                ) && (
                  <form
                    className="my-helpdesk__form"
                    onSubmit={(
                      event,
                    ) =>
                      void sendReply(
                        event,
                      )
                    }
                  >
                    <label htmlFor="my-helpdesk-reply">
                      Responder
                      al equipo TIC
                    </label>

                    <textarea
                      id="my-helpdesk-reply"
                      required
                      maxLength={4000}
                      rows={4}
                      value={reply}
                      onChange={(
                        event,
                      ) =>
                        setReply(
                          event.target.value,
                        )
                      }
                      placeholder="Escribe información adicional…"
                    />

                    <button
                      type="submit"
                      className="helpdesk-ui-button helpdesk-ui-button--primary"
                      disabled={
                        saving ||
                        !reply.trim()
                      }
                    >
                      <Send
                        size={
                          16
                        }
                      />
                      {saving
                        ? 'Enviando…'
                        : 'Enviar respuesta'}
                    </button>
                  </form>
                )}
              </section>
            </>
          )}
      </main>
    )
  }

  return (
    <main className="titan-page helpdesk-page my-helpdesk">
      <header className="my-helpdesk__hero">
        <span className="helpdesk-inbox__eyebrow">
          <Headphones size={15} />
          Mi centro de ayuda
        </span>

        <div className="my-helpdesk__heading">
          <div>
            <h1>
              Mis solicitudes
            </h1>

            <p>
              Consulta el progreso
              y comunícate con TIC.
            </p>
          </div>

          <button
            type="button"
            className="helpdesk-ui-button helpdesk-ui-button--primary"
            onClick={() => {
              setSuggestion(
                null,
              )
              setSuggestionError(
                '',
              )
              setShowCreate(
                true,
              )
            }}
          >
            <Plus size={16} />
            Nueva solicitud
          </button>
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

      <section className="my-helpdesk__card">
        <h2>Historial</h2>

        {loading ? (
          <p className="my-helpdesk__muted">
            Cargando solicitudes…
          </p>
        ) : tickets.length ===
          0 ? (
          <div className="my-helpdesk__empty">
            <MessageSquare
              size={26}
            />

            <strong>
              Aún no tienes
              solicitudes
            </strong>

            <span>
              Crea aquí tu primer
              caso cuando necesites
              ayuda.
            </span>
          </div>
        ) : (
          <div className="my-helpdesk__list">
            {tickets.map(
              (item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() =>
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
                      {formatDate(
                        item.createdAtUtc,
                      )}
                    </small>
                  </span>

                  <span
                    className={
                      `helpdesk-inbox__badge ` +
                      `helpdesk-inbox__badge--${item.status}`
                    }
                  >
                    {statusNames[
                      item.status
                    ] ??
                      item.status}
                  </span>
                </button>
              ),
            )}
          </div>
        )}
      </section>

      {showCreate && (
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
            aria-labelledby="my-ticket-title"
            onMouseDown={(
              event,
            ) =>
              event.stopPropagation()
            }
          >
            <header>
              <div>
                <span className="helpdesk-inbox__eyebrow">
                  Centro de ayuda
                </span>

                <h2 id="my-ticket-title">
                  Nueva solicitud
                </h2>

                <p>
                  Cuéntanos qué ocurre
                  para dirigir el caso
                  al equipo adecuado.
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
                ×
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
                  autoFocus
                  required
                  maxLength={250}
                  value={subject}
                  onChange={(
                    event,
                  ) => {
                    setSubject(
                      event.target.value,
                    )
                    setSuggestion(
                      null,
                    )
                  }}
                  placeholder="¿Qué necesitas resolver?"
                />
              </label>

              <label>
                Describe el problema
                <textarea
                  required
                  maxLength={4000}
                  rows={6}
                  value={
                    description
                  }
                  onChange={(
                    event,
                  ) => {
                    setDescription(
                      event.target.value,
                    )
                    setSuggestion(
                      null,
                    )
                  }}
                  placeholder="Indica qué ocurre y cómo afecta tu trabajo"
                />
              </label>

              <HelpdeskCategorySelect
                id="my-helpdesk-category"
                value={category}
                onChange={
                  setCategory
                }
                disabled={
                  saving
                }
              />

              {assistantEnabled && (
                <div className="my-helpdesk__assistant">
                  <button
                    type="button"
                    className="helpdesk-ui-button helpdesk-ui-button--secondary"
                    disabled={
                      suggesting ||
                      description
                        .trim()
                        .length < 15
                    }
                    onClick={() =>
                      void requestSuggestion()
                    }
                  >
                    <Sparkles
                      size={16}
                    />
                    {suggesting
                      ? 'Preparando sugerencia…'
                      : 'Pedir sugerencia al asistente'}
                  </button>

                  {suggestionError && (
                    <p role="alert">
                      {
                        suggestionError
                      }
                    </p>
                  )}

                  {suggestion && (
                    <div aria-live="polite">
                      <p>
                        <strong>
                          Asunto sugerido:
                        </strong>{' '}
                        {suggestion
                          .suggestedSubject ||
                          'Sin cambio'}
                      </p>

                      <p>
                        <strong>
                          Categoría sugerida:
                        </strong>{' '}
                        {
                          suggestion
                            .suggestedCategory
                        }
                      </p>

                      {suggestion
                        .recommendations
                        .length >
                        0 && (
                        <ul>
                          {suggestion.recommendations.map(
                            (
                              item,
                              index,
                            ) => (
                              <li
                                key={
                                  index
                                }
                              >
                                {
                                  item
                                }
                              </li>
                            ),
                          )}
                        </ul>
                      )}

                      <button
                        type="button"
                        className="helpdesk-ui-button helpdesk-ui-button--secondary"
                        onClick={() => {
                          if (
                            suggestion.suggestedSubject
                          ) {
                            setSubject(
                              suggestion.suggestedSubject,
                            )
                          }

                          setCategory(
                            suggestion.suggestedCategory ||
                              'general',
                          )
                          setSuggestion(
                            null,
                          )
                        }}
                      >
                        Aplicar sugerencia
                      </button>

                      <p>
                        Revisa los datos
                        antes de enviar.
                        El asistente
                        no crea el ticket
                        automáticamente.
                      </p>
                    </div>
                  )}
                </div>
              )}

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
                    saving
                  }
                >
                  <Plus size={16} />
                  {saving
                    ? 'Creando…'
                    : 'Enviar solicitud'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}