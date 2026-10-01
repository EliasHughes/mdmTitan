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
} from 'lucide-react'
import axios from 'axios'
import apiClient from '../../api/apiClient'
import { HelpdeskCreateRequest } from './HelpdeskCreateRequest'
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
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : value + 'Z',
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
  const [ticket, setTicket] = useState<MyTicketDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [reply, setReply] = useState('')

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError('')
    setTicket(null)

    try {
      if (ticketId) {
        const result = await apiClient.get<MyTicketDetails>(
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
  }, [ticketId])

  useEffect(() => {
    const controller = new AbortController()
    setReply('')
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!ticketId || !reply.trim() || saving) return

    setSaving(true)
    setError('')

    try {
      const result = await apiClient.post<MyTicketDetails>(
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
      className={
        `helpdesk-inbox__badge helpdesk-inbox__badge--${value}`
      }
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
          onClick={() => navigate('/my-support?workspace=helpdesk')}
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

              {!['resolved', 'closed'].includes(ticket.status) && (
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
                    onChange={event => setReply(event.target.value)}
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
            onClick={() => setShowCreate(true)}
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
        <HelpdeskCreateRequest
          onCancel={() => setShowCreate(false)}
          onCreated={id => {
            setShowCreate(false)
            navigate(`/my-support/${id}?workspace=helpdesk`)
          }}
        />
      )}
    </main>
  )
}