import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Headphones,
  LockKeyhole,
  MessageSquare,
  Monitor,
  RefreshCw,
  Send,
  UserRound,
} from 'lucide-react'
import { helpdeskApi, type HelpdeskTicketDetails } from '../../api/helpdeskApi'
import { useAuth } from '../../auth/AuthContext'
import './HelpdeskPages.css'

const statusLabels: Record<string, string> = {
  new: 'Nuevo',
  open: 'Abierto',
  pendinguser: 'Pendiente del usuario',
  resolved: 'Resuelto',
  closed: 'Cerrado',
}

const priorityLabels: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
}

const dateFormatter = new Intl.DateTimeFormat('es-DO', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : dateFormatter.format(date)
}

export function HelpdeskTicketPage() {
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [ticket, setTicket] = useState<HelpdeskTicketDetails | null>(null)
  const [comment, setComment] = useState('')
  const [internal, setInternal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const permissions = user?.permissions ?? []
  const canComment = permissions.includes('tickets.comment')
  const canAssign = permissions.includes('tickets.assign')
  const canClose = permissions.includes('tickets.close')

  const load = useCallback(async () => {
    if (!ticketId) {
      setError('No se indicó un ticket válido.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      setTicket(await helpdeskApi.getTicket(ticketId))
    } catch {
      setError('No se pudo cargar el ticket. Comprueba la conexión e inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    void load()
  }, [load])

  async function sendComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ticketId || !comment.trim() || !canComment || saving) return

    setSaving(true)
    setError(null)

    try {
      const updated = await helpdeskApi.addComment(ticketId, comment.trim(), internal)
      setTicket(updated)
      setComment('')
      setInternal(false)
    } catch {
      setError('No se pudo publicar el comentario.')
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(status: string) {
    if (!ticketId || !canClose || saving) return

    setSaving(true)
    setError(null)

    try {
      setTicket(await helpdeskApi.transition(ticketId, status))
    } catch {
      setError('No se pudo actualizar el estado del ticket.')
    } finally {
      setSaving(false)
    }
  }

  async function takeTicket() {
    if (!ticketId || !user?.id || !canAssign || saving) return

    setSaving(true)
    setError(null)

    try {
      setTicket(await helpdeskApi.assign(ticketId, user.id))
    } catch {
      setError('No se pudo asignar el ticket a tu usuario.')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !ticket) {
    return (
      <main className="titan-page helpdesk-page helpdesk-detail">
        <div className="helpdesk-detail__loading">Cargando ticket…</div>
      </main>
    )
  }

  if (!ticket) {
    return (
      <main className="titan-page helpdesk-page helpdesk-detail">
        <div className="helpdesk-detail__loading">
          <p>{error ?? 'No se encontró el ticket.'}</p>
          <button
            className="helpdesk-ui-button helpdesk-ui-button--secondary"
            onClick={() => navigate('/helpdesk?workspace=helpdesk')}
          >
            <ArrowLeft size={16} /> Volver a la bandeja
          </button>
        </div>
      </main>
    )
  }

  const canTake = canAssign && ticket.assigneeUserId !== user?.id
  const canResolve = canClose && !['resolved', 'closed'].includes(ticket.status)
  const canReopen = canClose && ['resolved', 'closed'].includes(ticket.status)

  return (
    <main className="titan-page helpdesk-page helpdesk-detail">
      <div className="helpdesk-detail__back">
        <button type="button" onClick={() => navigate('/helpdesk?workspace=helpdesk')}>
          <ArrowLeft size={16} /> Volver a tickets
        </button>
      </div>

      <header className="helpdesk-detail__header">
        <div>
          <span className="helpdesk-inbox__eyebrow">
            <Headphones size={15} /> Ticket {ticket.number}
          </span>
          <h1>{ticket.subject}</h1>
          <div className="helpdesk-detail__header-meta">
            <span className={`helpdesk-inbox__badge helpdesk-inbox__badge--${ticket.status}`}>
              {statusLabels[ticket.status] ?? ticket.status}
            </span>
            <span>Prioridad {priorityLabels[ticket.priority] ?? ticket.priority}</span>
            <span>Creado {formatDate(ticket.createdAtUtc)}</span>
            {ticket.slaBreached && (
              <span className="helpdesk-detail__breached">
                <AlertTriangle size={14} /> SLA vencido
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          className="helpdesk-ui-button helpdesk-ui-button--secondary"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw size={16} /> Actualizar
        </button>
      </header>

      {error && (
        <div className="helpdesk-inbox__error" role="alert">
          <AlertTriangle size={17} />
          {error}
        </div>
      )}

      <div className="helpdesk-detail__layout">
        <div className="helpdesk-detail__main">
          <section className="helpdesk-detail__card">
            <div className="helpdesk-detail__section-title">
              <div>
                <h2>Descripción del caso</h2>
                <p>Información registrada al crear el ticket</p>
              </div>
            </div>
            <p className="helpdesk-detail__description">
              {ticket.description || 'No se agregó una descripción.'}
            </p>
            <div className="helpdesk-detail__attributes">
              <span>Tipo: <strong>{ticket.type}</strong></span>
              <span>Categoría: <strong>{ticket.category}</strong></span>
              <span>Origen: <strong>{ticket.source}</strong></span>
            </div>
          </section>

          <section className="helpdesk-detail__card">
            <div className="helpdesk-detail__section-title">
              <div>
                <h2>Conversación</h2>
                <p>Respuestas y notas registradas en el ticket</p>
              </div>
              <span className="helpdesk-detail__count">{ticket.comments.length}</span>
            </div>

            <div className="helpdesk-detail__conversation">
              {ticket.comments.length === 0 ? (
                <div className="helpdesk-detail__empty">
                  <MessageSquare size={25} />
                  <strong>Aún no hay respuestas</strong>
                  <span>La conversación aparecerá aquí.</span>
                </div>
              ) : ticket.comments.map((item) => (
                <article
                  key={item.id}
                  className={`helpdesk-detail__message${item.isInternal ? ' helpdesk-detail__message--internal' : ''}`}
                >
                  <div className="helpdesk-detail__message-top">
                    <span className="helpdesk-detail__avatar">
                      {item.authorName.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <strong>{item.authorName}</strong>
                      <span>{formatDate(item.createdAtUtc)}</span>
                    </div>
                    {item.isInternal && (
                      <small><LockKeyhole size={13} /> Nota interna</small>
                    )}
                  </div>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>

            {canComment && (
              <form className="helpdesk-detail__composer" onSubmit={(event) => void sendComment(event)}>
                <label htmlFor="helpdesk-reply">
                  {internal ? 'Nota interna' : 'Respuesta al solicitante'}
                </label>
                <textarea
                  id="helpdesk-reply"
                  required
                  maxLength={4000}
                  rows={4}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder={internal
                    ? 'Escribe una nota visible solo para el personal autorizado…'
                    : 'Escribe tu respuesta…'}
                />
                <div className="helpdesk-detail__composer-footer">
                  <label className="helpdesk-detail__internal">
                    <input
                      type="checkbox"
                      checked={internal}
                      onChange={(event) => setInternal(event.target.checked)}
                    />
                    <LockKeyhole size={15} />
                    Nota interna
                  </label>
                  <button
                    type="submit"
                    className="helpdesk-ui-button helpdesk-ui-button--primary"
                    disabled={saving || !comment.trim()}
                  >
                    <Send size={15} />
                    {saving ? 'Publicando…' : 'Publicar'}
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="helpdesk-detail__card">
            <div className="helpdesk-detail__section-title">
              <div>
                <h2>Actividad</h2>
                <p>Historial de acciones del ticket</p>
              </div>
              <Clock3 size={18} />
            </div>
            {ticket.timeline.length === 0 ? (
              <p className="helpdesk-detail__muted">Todavía no hay eventos.</p>
            ) : (
              <ol className="helpdesk-detail__timeline">
                {ticket.timeline.map((item) => (
                  <li key={item.id}>
                    <span className="helpdesk-detail__timeline-dot" />
                    <div>
                      <strong>{item.summary}</strong>
                      <time>{formatDate(item.createdAtUtc)}</time>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="helpdesk-detail__sidebar">
          <section className="helpdesk-detail__card">
            <h2>Responsables</h2>
            <div className="helpdesk-detail__info-row">
              <UserRound size={17} />
              <div>
                <span>Solicitante</span>
                <strong>{ticket.requesterName}</strong>
                {ticket.entraUserPrincipalName && <small>{ticket.entraUserPrincipalName}</small>}
              </div>
            </div>
            <div className="helpdesk-detail__info-row">
              <Headphones size={17} />
              <div>
                <span>Técnico asignado</span>
                <strong>{ticket.assigneeName ?? 'Sin asignar'}</strong>
              </div>
            </div>
            {canTake && (
              <button
                type="button"
                className="helpdesk-ui-button helpdesk-ui-button--secondary helpdesk-detail__full"
                disabled={saving}
                onClick={() => void takeTicket()}
              >
                Tomar ticket
              </button>
            )}
          </section>

          <section className="helpdesk-detail__card">
            <h2>Dispositivo</h2>
            <div className="helpdesk-detail__info-row">
              <Monitor size={18} />
              <div>
                <span>Equipo relacionado</span>
                <strong>{ticket.deviceName ?? 'Sin dispositivo vinculado'}</strong>
                {ticket.devicePlatform && <small>{ticket.devicePlatform}</small>}
              </div>
            </div>
            {ticket.deviceId && (
              <button
                type="button"
                className="helpdesk-ui-button helpdesk-ui-button--secondary helpdesk-detail__full"
                onClick={() => navigate(`/devices/${ticket.deviceId}`)}
              >
                Ver dispositivo
              </button>
            )}
            {ticket.remoteSessionId && (
              <p className="helpdesk-detail__muted">
                Sesión remota vinculada: {ticket.remoteSessionId}
              </p>
            )}
          </section>

          <section className="helpdesk-detail__card">
            <h2>Acuerdos de servicio</h2>
            <div className="helpdesk-detail__sla-row">
              <span>Primera respuesta</span>
              <strong>{formatDate(ticket.firstResponseDueAtUtc)}</strong>
            </div>
            <div className="helpdesk-detail__sla-row">
              <span>Resolución</span>
              <strong>{formatDate(ticket.resolveDueAtUtc)}</strong>
            </div>
            <p className="helpdesk-detail__muted">
              {ticket.slaBreached ? 'Hay un plazo vencido.' : 'Sin vencimientos detectados.'}
            </p>
          </section>

          {canClose && (
            <section className="helpdesk-detail__card">
              <h2>Acciones</h2>
              <div className="helpdesk-detail__actions">
                {canResolve && (
                  <>
                    <button
                      type="button"
                      className="helpdesk-ui-button helpdesk-ui-button--secondary"
                      disabled={saving}
                      onClick={() => void changeStatus('resolved')}
                    >
                      <CheckCircle2 size={16} /> Resolver
                    </button>
                    <button
                      type="button"
                      className="helpdesk-ui-button helpdesk-ui-button--secondary"
                      disabled={saving}
                      onClick={() => void changeStatus('closed')}
                    >
                      Cerrar ticket
                    </button>
                  </>
                )}
                {canReopen && (
                  <button
                    type="button"
                    className="helpdesk-ui-button helpdesk-ui-button--secondary"
                    disabled={saving}
                    onClick={() => void changeStatus('open')}
                  >
                    Reabrir ticket
                  </button>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
    </main>
  )
}