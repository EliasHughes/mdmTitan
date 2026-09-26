
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MonitorSmartphone } from 'lucide-react'
import { TitanPageHeader } from '../../components/ui/TitanPageHeader'
import {
  helpdeskApi,
  type HelpdeskTicketDetails,
} from '../../api/helpdeskApi'
import { useAuth } from '../../auth/AuthContext'
import './HelpdeskPages.css'

export function HelpdeskTicketPage() {
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [ticket, setTicket] = useState<HelpdeskTicketDetails | null>(null)
  const [comment, setComment] = useState('')
  const [internal, setInternal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!ticketId) return
    try {
      setTicket(await helpdeskApi.getTicket(ticketId))
    } catch {
      setError('No se pudo abrir el ticket.')
    }
  }

  useEffect(() => {
    void load()
  }, [ticketId])

  async function sendComment() {
    if (!ticketId || !comment.trim()) return
    setTicket(await helpdeskApi.addComment(ticketId, comment, internal))
    setComment('')
  }

  async function changeStatus(status: string) {
    if (!ticketId) return
    setTicket(await helpdeskApi.transition(ticketId, status))
  }

  async function takeTicket() {
    if (!ticketId || !user?.id) return
    setTicket(await helpdeskApi.assign(ticketId, user.id))
  }

  if (!ticket) {
    return <div className="titan-page">{error ?? 'Cargando ticket…'}</div>
  }

  return (
    <div className="titan-page helpdesk-page">
      <TitanPageHeader
        eyebrow={ticket.number}
        title={ticket.subject}
        description="Contexto MDM, conversación y línea de tiempo en la misma UI Titan."
        actions={
          <button className="titan-button titan-button--ghost" onClick={() => navigate('/helpdesk?workspace=helpdesk')}>
            <ArrowLeft size={16} />
            Inbox
          </button>
        }
      />

      <div className="helpdesk-ticket-grid">
        <section className="titan-section-card">
          <p className="helpdesk-description">{ticket.description}</p>
          <div className="helpdesk-comments">
            {ticket.comments.map((item) => (
              <article key={item.id} className={item.isInternal ? 'is-internal' : ''}>
                <strong>{item.authorName}</strong>
                <span>{new Date(item.createdAtUtc).toLocaleString()}</span>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
          <textarea
            rows={4}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Respuesta al solicitante o nota interna"
          />
          <label className="helpdesk-check">
            <input
              type="checkbox"
              checked={internal}
              onChange={(event) => setInternal(event.target.checked)}
            />
            Nota interna
          </label>
          <button className="titan-button" onClick={() => void sendComment()}>
            Publicar
          </button>
        </section>

        <aside className="titan-section-card helpdesk-side">
          <h2>Contexto</h2>
          <p><strong>Estado:</strong> {ticket.status}</p>
          <p><strong>Prioridad:</strong> {ticket.priority}</p>
          <p><strong>Solicitante:</strong> {ticket.requesterName}</p>
          <p><strong>Entra UPN:</strong> {ticket.entraUserPrincipalName ?? '—'}</p>
          <p><strong>Asignado:</strong> {ticket.assigneeName ?? 'Sin asignar'}</p>
          <p>
            <MonitorSmartphone size={14} />
            {ticket.deviceName ?? 'Sin dispositivo'} {ticket.devicePlatform ?? ''}
          </p>
          {ticket.deviceId && (
            <button
              className="titan-button titan-button--ghost"
              onClick={() => navigate(`/devices/${ticket.deviceId}`)}
            >
              Abrir dispositivo
            </button>
          )}
          <div className="helpdesk-side__actions">
            <button className="titan-button" onClick={() => void takeTicket()}>
              Tomar ticket
            </button>
            <button className="titan-button titan-button--ghost" onClick={() => void changeStatus('resolved')}>
              Resolver
            </button>
            <button className="titan-button titan-button--ghost" onClick={() => void changeStatus('closed')}>
              Cerrar
            </button>
          </div>
          <h3>Línea de tiempo</h3>
          <ul>
            {ticket.timeline.map((event) => (
              <li key={event.id}>
                <strong>{event.eventType}</strong>
                <span>{event.summary}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
