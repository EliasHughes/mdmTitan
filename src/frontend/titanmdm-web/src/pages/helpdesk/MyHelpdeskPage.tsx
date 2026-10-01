import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Headphones,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
} from 'lucide-react'
import axios from 'axios'
import apiClient from '../../api/apiClient'
import { HelpdeskCategorySelect } from './HelpdeskCategorySelect'
import { HelpdeskRequestTemplates } from './HelpdeskRequestTemplates'
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

interface MyTicketDetails extends MyTicket {
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

interface AssistantSuggestion {
  suggestedSubject: string
  suggestedCategory: string
  recommendations: string[]
}

const statusNames: Record<string, string> = {
  new: 'Recibido',
  open: 'En atención',
  inprogress: 'En proceso',
  pendinguser: 'Esperando tu respuesta',
  resolved: 'Resuelto',
  closed: 'Cerrado',
}

function formatDate(value: string) {
  const date = new Date(
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
      ? value
      : value + 'Z',
  )
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('es-DO', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}

function errorMessage(error: unknown, fallback: string) {
  return axios.isAxiosError(error) &&
    typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : fallback
}

export function MyHelpdeskPage() {
  const { ticketId } = useParams()
  const navigate = useNavigate()

  const [tickets, setTickets] = useState<MyTicket[]>([])
  const [ticket, setTicket] =
    useState<MyTicketDetails | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('general')
  const [ticketType, setTicketType] =
    useState<'incident' | 'request'>('incident')
  const [reply, setReply] = useState('')
  const [assistantEnabled, setAssistantEnabled] =
    useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestion, setSuggestion] =
    useState<AssistantSuggestion | null>(null)
  const [suggestionError, setSuggestionError] = useState('')

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true)
      setError('')
      setTicket(null)
      try {
        if (ticketId) {
          const result =
            await apiClient.get<MyTicketDetails>(
              `/my/helpdesk/tickets/${ticketId}`,
              { signal },
            )
          if (!signal.aborted) setTicket(result.data)
        } else {
          const result = await apiClient.get<MyTicket[]>(
            '/my/helpdesk/tickets',
            { signal },
          )
          if (!signal.aborted) setTickets(result.data)
        }
      } catch (ex) {
        if (!signal.aborted) {
          setError(
            errorMessage(ex, 'No pudimos cargar tus solicitudes.'),
          )
        }
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    },
    [ticketId],
  )

  useEffect(() => {
    const controller = new AbortController()
    setReply('')
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  useEffect(() => {
    if (ticketId) return
    const controller = new AbortController()
    setAssistantEnabled(false)

    void apiClient
      .get<{ enabled: boolean }>(
        '/helpdesk/operations/assistant/me',
        { signal: controller.signal },
      )
      .then(result => {
        if (!controller.signal.aborted) {
          setAssistantEnabled(result.data.enabled === true)
        }
      })
      .catch(() => {})

    return () => controller.abort()
  }, [ticketId])

  async function requestSuggestion() {
    if (
      !assistantEnabled ||
      suggesting ||
      description.trim().length < 15
    ) return

    setSuggesting(true)
    setSuggestion(null)
    setSuggestionError('')

    try {
      const result =
        await apiClient.post<AssistantSuggestion>(
          '/my/helpdesk/assistant/suggest',
          {
            subject: subject.trim(),
            description: description.trim(),
          },
        )
      setSuggestion(result.data)
    } catch {
      setSuggestionError(
        'El asistente no está disponible ahora. ' +
          'Puedes enviar tu solicitud sin sugerencias.',
      )
    } finally {
      setSuggesting(false)
    }
  }

  async function createTicket(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    if (!subject.trim() || !description.trim() || saving) return

    setSaving(true)
    setError('')

    try {
      const result = await apiClient.post<{ id: string }>(
        '/my/helpdesk/tickets',
        {
          subject: subject.trim(),
          description: description.trim(),
          type: ticketType,
          priority: 'medium',
          category,
        },
      )
      setShowCreate(false)
      navigate(
        `/my-support/${result.data.id}?workspace=helpdesk`,
      )
    } catch (ex) {
      setError(
        errorMessage(ex, 'No pudimos crear tu solicitud.'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function sendReply(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    if (!ticketId || !reply.trim() || saving) return

    setSaving(true)
    setError('')

    try {
      const result =
        await apiClient.post<MyTicketDetails>(
          `/my/helpdesk/tickets/${ticketId}/reply`,
          { body: reply.trim() },
        )
      setTicket(result.data)
      setReply('')
    } catch (ex) {
      setError(
        errorMessage(ex, 'No pudimos publicar tu respuesta.'),
      )
    } finally {
      setSaving(false)
    }
  }

  const badge = (value: string) => (
    <span
      className={`helpdesk-inbox__badge helpdesk-inbox__badge--${value}`}
    >
      {statusNames[value] ?? value}
    </span>
  )

  if (ticketId) {
    return (
      <main className="titan-page helpdesk-page my-helpdesk">
        <button
          type="button"
          className="my-helpdesk__back"
          onClick={() =>
            navigate('/my-support?workspace=helpdesk')
          }
        >
          <ArrowLeft size={16} /> Mis solicitudes
        </button>

        {error && (
          <div className="helpdesk-inbox__error" role="alert">
            {error}
          </div>
        )}

        {loading && (
          <section className="my-helpdesk__card">
            Cargando solicitud…
          </section>
        )}

        {!loading && ticket && (
          <>
            <header className="my-helpdesk__hero">
              <span className="helpdesk-inbox__eyebrow">
                <Headphones size={15} />
                Solicitud {ticket.number}
              </span>
              <h1>{ticket.subject}</h1>
              <div className="my-helpdesk__meta">
                {badge(ticket.status)}
                <span>
                  Creada {formatDate(ticket.createdAtUtc)}
                </span>
              </div>
            </header>

            <section className="my-helpdesk__card">
              <h2>Tu solicitud</h2>
              <p className="my-helpdesk__body">
                {ticket.description}
              </p>
            </section>

            <section className="my-helpdesk__card">
              <h2>Conversación</h2>
              {!ticket.comments.length ? (
                <p className="my-helpdesk__muted">
                  Aún no hay respuestas.
                </p>
              ) : (
                <div className="my-helpdesk__messages">
                  {ticket.comments.map(item => (
                    <article key={item.id}>
                      <div>
                        <strong>{item.authorName}</strong>
                        <time>
                          {formatDate(item.createdAtUtc)}
                        </time>
                      </div>
                      <p className="my-helpdesk__body">
                        {item.body}
                      </p>
                    </article>
                  ))}
                </div>
              )}

              {!['resolved', 'closed'].includes(
                ticket.status,
              ) && (
                <form
                  className="my-helpdesk__form"
                  onSubmit={event => void sendReply(event)}
                >
                  <label htmlFor="my-helpdesk-reply">
                    Responder al equipo TIC
                  </label>
                  <textarea
                    id="my-helpdesk-reply"
                    required
                    maxLength={4000}
                    rows={4}
                    value={reply}
                    disabled={saving}
                    onChange={event =>
                      setReply(event.target.value)
                    }
                    placeholder="Escribe información adicional…"
                  />
                  <button
                    className="helpdesk-ui-button helpdesk-ui-button--primary"
                    disabled={saving || !reply.trim()}
                  >
                    <Send size={16} />
                    {saving ? 'Enviando…' : 'Enviar respuesta'}
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
          <Headphones size={15} /> Mi centro de ayuda
        </span>
        <div className="my-helpdesk__heading">
          <div>
            <h1>Mis solicitudes</h1>
            <p>Consulta el progreso y comunícate con TIC.</p>
          </div>
          <button
            type="button"
            className="helpdesk-ui-button helpdesk-ui-button--primary"
            onClick={() => {
              setSuggestion(null)
              setSuggestionError('')
              setShowCreate(true)
            }}
          >
            <Plus size={16} /> Nueva solicitud
          </button>
        </div>
      </header>

      {error && (
        <div className="helpdesk-inbox__error" role="alert">
          {error}
        </div>
      )}

      <section className="my-helpdesk__card">
        <h2>Historial</h2>
        {loading ? (
          <p>Cargando solicitudes…</p>
        ) : !tickets.length ? (
          <div className="my-helpdesk__empty">
            <MessageSquare size={26} />
            <strong>Aún no tienes solicitudes</strong>
            <span>
              Crea aquí tu primer caso cuando necesites ayuda.
            </span>
          </div>
        ) : (
          <div className="my-helpdesk__list">
            {tickets.map(item => (
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
                  <small>{item.number}</small>
                  <strong>{item.subject}</strong>
                  <small>{formatDate(item.createdAtUtc)}</small>
                </span>
                {badge(item.status)}
              </button>
            ))}
          </div>
        )}
      </section>

      {showCreate && (
        <div
          className="helpdesk-inbox__overlay"
          onMouseDown={() => {
            if (!saving && !suggesting) setShowCreate(false)
          }}
        >
          <section
            className="helpdesk-inbox__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="my-ticket-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="helpdesk-inbox__eyebrow">
                  Centro de ayuda
                </span>
                <h2 id="my-ticket-title">Nueva solicitud</h2>
                <p>
                  Cuéntanos qué ocurre para dirigir el caso
                  al equipo adecuado.
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                disabled={saving || suggesting}
                onClick={() => setShowCreate(false)}
              >
                ×
              </button>
            </header>

            <form
              onSubmit={event => void createTicket(event)}
            >
              <HelpdeskRequestTemplates
                disabled={saving || suggesting}
                onApply={draft => {
                  setSubject(draft.subject)
                  setDescription(draft.description)
                  setCategory(draft.category)
                  setTicketType(draft.ticketType)
                  setSuggestion(null)
                  setSuggestionError('')
                }}
              />

              <label>
                Asunto
                <input
                  required
                  maxLength={250}
                  value={subject}
                  disabled={saving || suggesting}
                  onChange={event => {
                    setSubject(event.target.value)
                    setSuggestion(null)
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
                  value={description}
                  disabled={saving || suggesting}
                  onChange={event => {
                    setDescription(event.target.value)
                    setSuggestion(null)
                  }}
                  placeholder="Indica qué ocurre y cómo afecta tu trabajo"
                />
              </label>

              <label>
                Tipo de solicitud
                <select
                  value={ticketType}
                  disabled={saving || suggesting}
                  onChange={event =>
                    setTicketType(
                      event.target.value === 'request'
                        ? 'request'
                        : 'incident',
                    )
                  }
                >
                  <option value="incident">Incidente</option>
                  <option value="request">
                    Solicitud de servicio
                  </option>
                </select>
              </label>

              <HelpdeskCategorySelect
                id="my-helpdesk-category"
                value={category}
                onChange={setCategory}
                disabled={saving || suggesting}
              />

              <p>
                Si no conoces la categoría, utiliza General.
                La plantilla no asigna técnicos; la distribución
                depende de la categoría y de tu ubicación
                configurada.
              </p>

              {assistantEnabled && (
                <div className="my-helpdesk__assistant">
                  <button
                    type="button"
                    className="helpdesk-ui-button helpdesk-ui-button--secondary"
                    disabled={
                      saving ||
                      suggesting ||
                      description.trim().length < 15
                    }
                    onClick={() => void requestSuggestion()}
                  >
                    <Sparkles size={16} />
                    {suggesting
                      ? 'Preparando sugerencia…'
                      : 'Pedir sugerencia al asistente'}
                  </button>

                  {suggestionError && (
                    <p role="alert">{suggestionError}</p>
                  )}

                  {suggestion && (
                    <div aria-live="polite">
                      <p>
                        <strong>Asunto sugerido:</strong>{' '}
                        {suggestion.suggestedSubject || 'Sin cambio'}
                      </p>
                      <p>
                        <strong>Categoría sugerida:</strong>{' '}
                        {suggestion.suggestedCategory}.
                        Selecciónala en el catálogo si corresponde.
                      </p>
                      <ul>
                        {suggestion.recommendations?.map(
                          (text, index) => (
                            <li key={index}>{text}</li>
                          ),
                        )}
                      </ul>
                      <button
                        type="button"
                        className="helpdesk-ui-button helpdesk-ui-button--secondary"
                        disabled={saving}
                        onClick={() => {
                          setSubject(
                            (
                              suggestion.suggestedSubject ||
                              subject
                            ).slice(0, 250),
                          )
                          setSuggestion(null)
                        }}
                      >
                        Aplicar asunto sugerido
                      </button>
                      <p>
                        Revisa los datos antes de enviar.
                        El asistente no crea el ticket
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
                  disabled={saving || suggesting}
                  onClick={() => setShowCreate(false)}
                >
                  Cancelar
                </button>
                <button
                  className="helpdesk-ui-button helpdesk-ui-button--primary"
                  disabled={
                    saving ||
                    suggesting ||
                    !subject.trim() ||
                    !description.trim()
                  }
                >
                  <Plus size={16} />
                  {saving ? 'Creando…' : 'Enviar solicitud'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}