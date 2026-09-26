import { useCallback, useEffect, useState } from 'react'
import {
  Building2,
  Headphones,
  MapPin,
  RefreshCw,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react'
import apiClient from '../../api/apiClient'
import './HelpdeskPages.css'

interface Zone {
  id: string
  name: string
  type: string
  parentZoneId: string | null
  isActive: boolean
}

interface Team {
  id: string
  name: string
  description: string | null
  isActive: boolean
}

interface Coverage {
  teamId: string
  zoneId: string
}

interface TeamMember {
  teamId: string
  userId: string
  isAvailable: boolean
  acceptsAutomaticAssignments: boolean
  maxOpenTickets: number
}

interface Catalog {
  zones: Zone[]
  teams: Team[]
  coverage: Coverage[]
  members: TeamMember[]
}

interface StaffUser {
  id: string
  name: string
  email: string
  canWorkTickets: boolean
  assistantEnabled: boolean
}

const zoneTypes: Record<string, string> = {
  locality: 'Localidad',
  plant: 'Planta',
  building: 'Nave o edificio',
  area: 'Área',
}

export function HelpdeskOperationsPage() {
  const [catalog, setCatalog] = useState<Catalog>({
    zones: [],
    teams: [],
    coverage: [],
    members: [],
  })
  const [users, setUsers] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [zoneName, setZoneName] = useState('')
  const [zoneType, setZoneType] = useState('locality')
  const [parentZoneId, setParentZoneId] = useState('')
  const [teamName, setTeamName] = useState('')
  const [teamDescription, setTeamDescription] = useState('')
  const [coverageTeamId, setCoverageTeamId] = useState('')
  const [coverageZoneId, setCoverageZoneId] = useState('')
  const [memberTeamId, setMemberTeamId] = useState('')
  const [memberUserId, setMemberUserId] = useState('')
  const [maxOpenTickets, setMaxOpenTickets] = useState(20)
  const [userZoneUserId, setUserZoneUserId] = useState('')
  const [userZoneId, setUserZoneId] = useState('')
  const [assistantUserId, setAssistantUserId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [catalogResponse, usersResponse] = await Promise.all([
        apiClient.get<Catalog>('/helpdesk/operations/catalog'),
        apiClient.get<StaffUser[]>('/helpdesk/staff/users'),
      ])
      setCatalog(catalogResponse.data)
      setUsers(usersResponse.data)
    } catch {
      setError('No fue posible cargar la configuración de la mesa.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save(
    action: () => Promise<unknown>,
    successMessage: string,
  ) {
    if (saving) return

    setSaving(true)
    setError('')
    setMessage('')

    try {
      await action()
      setMessage(successMessage)
      await load()
    } catch {
      setError('No se pudo guardar. Verifica que los datos pertenezcan a esta organización.')
    } finally {
      setSaving(false)
    }
  }

  const selectedAssistant = users.find((item) => item.id === assistantUserId)

  return (
    <main className="titan-page helpdesk-page helpdesk-operations">
      <header className="helpdesk-inbox__header">
        <div>
          <span className="helpdesk-inbox__eyebrow">
            <Headphones size={15} />
            Administración de soporte
          </span>
          <h1>Operación de la mesa</h1>
          <p>Configura cobertura, grupos, técnicos y acceso al asistente.</p>
        </div>
        <button
          className="helpdesk-ui-button helpdesk-ui-button--secondary"
          type="button"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={16} /> Actualizar
        </button>
      </header>

      {error && <div className="helpdesk-inbox__error" role="alert">{error}</div>}
      {message && <div className="helpdesk-operations__success" role="status">{message}</div>}

      <div className="helpdesk-operations__grid">
        <section className="helpdesk-operations__card">
          <div className="helpdesk-operations__title">
            <MapPin size={19} />
            <div>
              <h2>Zonas</h2>
              <p>Localidad, planta, nave y área del solicitante.</p>
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!zoneName.trim()) return
              void save(
                () => apiClient.post('/helpdesk/operations/zones', {
                  name: zoneName.trim(),
                  type: zoneType,
                  parentZoneId: parentZoneId || null,
                }),
                'Zona creada.',
              ).then(() => setZoneName(''))
            }}
          >
            <label>
              Nombre
              <input
                required
                maxLength={120}
                value={zoneName}
                onChange={(event) => setZoneName(event.target.value)}
                placeholder="Ej.: Nave B"
              />
            </label>
            <label>
              Tipo
              <select value={zoneType} onChange={(event) => setZoneType(event.target.value)}>
                {Object.entries(zoneTypes).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              Zona superior
              <select
                value={parentZoneId}
                onChange={(event) => setParentZoneId(event.target.value)}
              >
                <option value="">Sin zona superior</option>
                {catalog.zones.filter((item) => item.isActive).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {zoneTypes[item.type] ?? item.type}
                  </option>
                ))}
              </select>
            </label>
            <button className="helpdesk-ui-button helpdesk-ui-button--primary" disabled={saving}>
              Crear zona
            </button>
          </form>

          <div className="helpdesk-operations__list">
            {catalog.zones.map((item) => (
              <span key={item.id}>
                {item.name}
                <small>{zoneTypes[item.type] ?? item.type}</small>
              </span>
            ))}
          </div>
        </section>

        <section className="helpdesk-operations__card">
          <div className="helpdesk-operations__title">
            <Users size={19} />
            <div>
              <h2>Grupos TIC</h2>
              <p>Equipos responsables de atender zonas.</p>
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!teamName.trim()) return
              void save(
                () => apiClient.post('/helpdesk/operations/teams', {
                  name: teamName.trim(),
                  description: teamDescription.trim() || null,
                }),
                'Grupo creado.',
              ).then(() => {
                setTeamName('')
                setTeamDescription('')
              })
            }}
          >
            <label>
              Nombre del grupo
              <input
                required
                maxLength={120}
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                placeholder="Ej.: Soporte Zona Norte"
              />
            </label>
            <label>
              Descripción
              <input
                maxLength={500}
                value={teamDescription}
                onChange={(event) => setTeamDescription(event.target.value)}
                placeholder="Responsabilidad del grupo"
              />
            </label>
            <button className="helpdesk-ui-button helpdesk-ui-button--primary" disabled={saving}>
              Crear grupo
            </button>
          </form>

          <div className="helpdesk-operations__list">
            {catalog.teams.map((item) => (
              <span key={item.id}>
                {item.name}
                <small>{item.description || 'Sin descripción'}</small>
              </span>
            ))}
          </div>
        </section>

        <section className="helpdesk-operations__card">
          <div className="helpdesk-operations__title">
            <Building2 size={19} />
            <div>
              <h2>Cobertura</h2>
              <p>Qué grupo atiende cada zona.</p>
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!coverageTeamId || !coverageZoneId) return
              void save(
                () => apiClient.post(
                  `/helpdesk/operations/teams/${coverageTeamId}/zones/${coverageZoneId}`,
                ),
                'Cobertura agregada.',
              )
            }}
          >
            <label>
              Grupo
              <select
                required
                value={coverageTeamId}
                onChange={(event) => setCoverageTeamId(event.target.value)}
              >
                <option value="">Selecciona grupo</option>
                {catalog.teams.filter((item) => item.isActive).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label>
              Zona
              <select
                required
                value={coverageZoneId}
                onChange={(event) => setCoverageZoneId(event.target.value)}
              >
                <option value="">Selecciona zona</option>
                {catalog.zones.filter((item) => item.isActive).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <button className="helpdesk-ui-button helpdesk-ui-button--primary" disabled={saving}>
              Agregar cobertura
            </button>
          </form>

          <div className="helpdesk-operations__list">
            {catalog.coverage.map((item) => (
              <span key={`${item.teamId}-${item.zoneId}`}>
                {catalog.teams.find((team) => team.id === item.teamId)?.name ?? 'Grupo'}
                <small>
                  {catalog.zones.find((zone) => zone.id === item.zoneId)?.name ?? 'Zona'}
                </small>
              </span>
            ))}
          </div>
        </section>

        <section className="helpdesk-operations__card">
          <div className="helpdesk-operations__title">
            <UserRound size={19} />
            <div>
              <h2>Técnicos</h2>
              <p>Disponibilidad y capacidad de asignación automática.</p>
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!memberTeamId || !memberUserId) return
              void save(
                () => apiClient.put(
                  `/helpdesk/operations/teams/${memberTeamId}/members/${memberUserId}`,
                  {
                    acceptsAutomaticAssignments: true,
                    isAvailable: true,
                    maxOpenTickets,
                  },
                ),
                'Técnico asignado al grupo.',
              )
            }}
          >
            <label>
              Grupo
              <select
                required
                value={memberTeamId}
                onChange={(event) => setMemberTeamId(event.target.value)}
              >
                <option value="">Selecciona grupo</option>
                {catalog.teams.filter((item) => item.isActive).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label>
              Técnico
              <select
                required
                value={memberUserId}
                onChange={(event) => setMemberUserId(event.target.value)}
              >
                <option value="">Selecciona técnico</option>
                {users.filter((item) => item.canWorkTickets).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.email}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Máximo de tickets abiertos
              <input
                type="number"
                min={1}
                max={500}
                value={maxOpenTickets}
                onChange={(event) => setMaxOpenTickets(Number(event.target.value))}
              />
            </label>
            <button className="helpdesk-ui-button helpdesk-ui-button--primary" disabled={saving}>
              Guardar técnico
            </button>
          </form>

          <div className="helpdesk-operations__list">
            {catalog.members.map((item) => (
              <span key={`${item.teamId}-${item.userId}`}>
                {users.find((user) => user.id === item.userId)?.name ?? 'Técnico'}
                <small>
                  {catalog.teams.find((team) => team.id === item.teamId)?.name ?? 'Grupo'}
                  {' · '}Máximo {item.maxOpenTickets}
                </small>
              </span>
            ))}
          </div>
        </section>

        <section className="helpdesk-operations__card">
          <div className="helpdesk-operations__title">
            <MapPin size={19} />
            <div>
              <h2>Ubicación del solicitante</h2>
              <p>Zona principal usada al crear su ticket.</p>
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!userZoneUserId || !userZoneId) return
              void save(
                () => apiClient.put(
                  `/helpdesk/operations/users/${userZoneUserId}/zone`,
                  { zoneId: userZoneId },
                ),
                'Ubicación del usuario guardada.',
              )
            }}
          >
            <label>
              Usuario
              <select
                required
                value={userZoneUserId}
                onChange={(event) => setUserZoneUserId(event.target.value)}
              >
                <option value="">Selecciona usuario</option>
                {users.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.email}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Zona principal
              <select
                required
                value={userZoneId}
                onChange={(event) => setUserZoneId(event.target.value)}
              >
                <option value="">Selecciona zona</option>
                {catalog.zones.filter((item) => item.isActive).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <button className="helpdesk-ui-button helpdesk-ui-button--primary" disabled={saving}>
              Guardar ubicación
            </button>
          </form>
        </section>

        <section className="helpdesk-operations__card">
          <div className="helpdesk-operations__title">
            <Sparkles size={19} />
            <div>
              <h2>Asistente virtual</h2>
              <p>Autoriza individualmente quién podrá usarlo cuando Ollama esté integrado.</p>
            </div>
          </div>

          <div className="helpdesk-operations__form">
            <label>
              Usuario
              <select
                value={assistantUserId}
                onChange={(event) => setAssistantUserId(event.target.value)}
              >
                <option value="">Selecciona usuario</option>
                {users.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.email}
                  </option>
                ))}
              </select>
            </label>

            {selectedAssistant && (
              <p className="helpdesk-operations__access">
                Acceso: {selectedAssistant.assistantEnabled ? 'autorizado' : 'sin autorización'}
              </p>
            )}

            <div className="helpdesk-operations__actions">
              <button
                type="button"
                className="helpdesk-ui-button helpdesk-ui-button--primary"
                disabled={!assistantUserId || saving}
                onClick={() => void save(
                  () => apiClient.put(
                    `/helpdesk/operations/assistant/users/${assistantUserId}`,
                    { enabled: true },
                  ),
                  'Acceso al asistente autorizado.',
                )}
              >
                Autorizar
              </button>
              <button
                type="button"
                className="helpdesk-ui-button helpdesk-ui-button--secondary"
                disabled={!assistantUserId || saving}
                onClick={() => void save(
                  () => apiClient.put(
                    `/helpdesk/operations/assistant/users/${assistantUserId}`,
                    { enabled: false },
                  ),
                  'Acceso al asistente retirado.',
                )}
              >
                Retirar acceso
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}