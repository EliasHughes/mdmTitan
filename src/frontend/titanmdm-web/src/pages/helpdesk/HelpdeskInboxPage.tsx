
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Headphones, Plus, RefreshCw, Search } from 'lucide-react'
import { TitanPageHeader } from '../../components/ui/TitanPageHeader'
import { helpdeskApi, type HelpdeskTicketListItem } from '../../api/helpdeskApi'
import { useAuth } from '../../auth/AuthContext'
import './HelpdeskPages.css'

export function HelpdeskInboxPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tickets, setTickets] = useState<HelpdeskTicketListItem[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')

  const canCreate = user?.permissions?.includes('tickets.create')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const result = await helpdeskApi.getTickets({
        search: search || undefined,
        status: status || undefined,
        page: 1,
        pageSize: 50,
      })
      setTickets(result.items)
    } catch {
      setError('No se pudieron cargar los tickets.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const breached = useMemo(
    () => tickets.filter((ticket) => ticket.slaBreached).length,
    [tickets],
  )

  async function createTicket() {
    if (!subject.trim()) return
    setCreating(true)
    try {
      const created = await helpdeskApi.createTicket({
        subject,
        description,
        priority,
        source: 'console',
      })
      setSubject('')
      setDescription('')
      navigate(`/helpdesk/tickets/${created.id}?workspace=helpdesk`)
    } catch {
      setError('No se pudo crear el ticket.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="titan-page helpdesk-page">
      <TitanPageHeader
        eyebrow="Mesa de Ayuda"
        title="Inbox de tickets"
        description="Solo los administradores actuales de TitanMDM pueden gestionar la mesa. Los usuarios de Entra ID se sincronizan como solicitantes, no como admins."
        icon={<Headphones size={16} />}
        actions={
          <button className="titan-button titan-button--ghost" onClick={() => void load()}>
            <RefreshCw size={16} />
            Actualizar
          </button>
        }
      />

      <div className="helpdesk-kpis">
        <article>
          <span>Abiertos</span>
          <strong>{tickets.length}</strong>
        </article>
        <article>
          <span>SLA en riesgo</span>
          <strong>{breached}</strong>
        </article>
      </div>

      <section className="titan-section-card helpdesk-toolbar">
        <label className="helpdesk-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void load()
            }}
            placeholder="Buscar por número, asunto o categoría"
          />
        </label>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Todos los estados</option>
          <option value="new">Nuevo</option>
          <option value="open">Abierto</option>
          <option value="pendinguser">Pendiente usuario</option>
          <option value="resolved">Resuelto</option>
          <option value="closed">Cerrado</option>
        </select>
        <button className="titan-button" onClick={() => void load()}>
          Filtrar
        </button>
      </section>

      {canCreate && (
        <section className="titan-section-card helpdesk-create">
          <h2>Nuevo ticket</h2>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Asunto"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Descripción del incidente o solicitud"
            rows={3}
          />
          <div className="helpdesk-create__row">
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
            <button className="titan-button" disabled={creating} onClick={() => void createTicket()}>
              <Plus size={16} />
              Crear ticket
            </button>
          </div>
        </section>
      )}

      {error && <div className="helpdesk-error">{error}</div>}

      <section className="titan-section-card">
        <table className="helpdesk-table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Asunto</th>
              <th>Estado</th>
              <th>Prioridad</th>
              <th>Solicitante</th>
              <th>Dispositivo</th>
              <th>SLA</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7}>Cargando tickets…</td>
              </tr>
            )}
            {!loading && tickets.length === 0 && (
              <tr>
                <td colSpan={7}>No hay tickets todavía.</td>
              </tr>
            )}
            {tickets.map((ticket) => (
              <tr
                key={ticket.id}
                onClick={() => navigate(`/helpdesk/tickets/${ticket.id}?workspace=helpdesk`)}
              >
                <td>{ticket.number}</td>
                <td>{ticket.subject}</td>
                <td>
                  <span className={`helpdesk-pill helpdesk-pill--${ticket.status}`}>
                    {ticket.status}
                  </span>
                </td>
                <td>{ticket.priority}</td>
                <td>{ticket.requesterName}</td>
                <td>{ticket.deviceName ?? '—'}</td>
                <td>{ticket.slaBreached ? 'Vencido' : 'En tiempo'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
