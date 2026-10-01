import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import {
  Headphones,
  RefreshCw,
  Trash2,
  Pencil,
  MapPin,
  Users,
  UserRound,
  Building2,
  Sparkles,
} from 'lucide-react'
import apiClient from '../../api/apiClient'
import './HelpdeskPages.css'
import './HelpdeskOperationsPage.css'

type Zone = {
  id: string
  name: string
  type: string
  parentZoneId: string | null
  isActive: boolean
}

type Team = {
  id: string
  name: string
  description: string | null
  isActive: boolean
}

type Coverage = { teamId: string; zoneId: string }

type Member = {
  teamId: string
  userId: string
  isAvailable: boolean
  acceptsAutomaticAssignments: boolean
  maxOpenTickets: number
}

type UserZone = { userId: string; zoneId: string }

type Staff = {
  id: string
  name: string
  email: string
  canWorkTickets: boolean
  assistantEnabled: boolean
}

type Catalog = {
  zones: Zone[]
  teams: Team[]
  coverage: Coverage[]
  members: Member[]
  userZones: UserZone[]
  eligibleUserIds: string[]
}

const empty: Catalog = {
  zones: [],
  teams: [],
  coverage: [],
  members: [],
  userZones: [],
  eligibleUserIds: [],
}

const zoneTypes: Record<string, string> = {
  locality: 'Localidad',
  plant: 'Planta',
  building: 'Nave o edificio',
  area: 'Área',
}

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as {
      message?: string
      title?: string
    } | undefined

    return data?.message ||
      data?.title ||
      `No se pudo completar la operación (${error.response?.status || 'sin conexión'}).`
  }

  return error instanceof Error
    ? error.message
    : 'No se pudo completar la operación.'
}

export function HelpdeskOperationsPage() {
  const [catalog, setCatalog] = useState<Catalog>(empty)
  const [users, setUsers] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState('zones')

  const [zoneName, setZoneName] = useState('')
  const [zoneType, setZoneType] = useState('locality')
  const [parentZoneId, setParentZoneId] = useState('')

  const [teamName, setTeamName] = useState('')
  const [description, setDescription] = useState('')

  const [coverageTeam, setCoverageTeam] = useState('')
  const [coverageZone, setCoverageZone] = useState('')

  const [memberTeam, setMemberTeam] = useState('')
  const [memberUser, setMemberUser] = useState('')
  const [available, setAvailable] = useState(true)
  const [automatic, setAutomatic] = useState(true)
  const [capacity, setCapacity] = useState(20)

  const [locationUser, setLocationUser] = useState('')
  const [locationZone, setLocationZone] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [assistantUser, setAssistantUser] = useState('')

  const disabled = loading || saving

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const [a, b] = await Promise.all([
        apiClient.get<Catalog>('/helpdesk/operations/catalog'),
        apiClient.get<Staff[]>('/helpdesk/staff/users'),
      ])

      if (
        !Array.isArray(a.data.userZones) ||
        !Array.isArray(a.data.eligibleUserIds)
      ) {
        throw new Error(
          'El backend sigue usando el catálogo anterior. ' +
          'Reinicia el backend después de reemplazar el controlador.',
        )
      }

      setCatalog(a.data)
      setUsers(b.data)
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    setError('')
    try {
      await load()
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [load])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function save(
    action: () => Promise<unknown>,
    success: string,
    reset?: () => void,
  ) {
    if (disabled) return

    setSaving(true)
    setError('')
    setMessage('')

    try {
      await action()
      setMessage(success)
      reset?.()

      try {
        await load()
      } catch (e) {
        setError(
          'El cambio se guardó, pero no se pudo actualizar la pantalla: ' +
          errorMessage(e),
        )
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  function remove(
    action: () => Promise<unknown>,
    question: string,
    success: string,
  ) {
    if (window.confirm(question)) {
      void save(action, success)
    }
  }

  function selectMember(teamId: string, userId: string) {
    setMemberTeam(teamId)
    setMemberUser(userId)

    const member = catalog.members.find(
      (m) => m.teamId === teamId && m.userId === userId,
    )

    setAvailable(member?.isAvailable ?? true)
    setAutomatic(member?.acceptsAutomaticAssignments ?? true)
    setCapacity(member?.maxOpenTickets ?? 20)
  }

  function selectLocation(userId: string) {
    setLocationUser(userId)
    setLocationZone(
      catalog.userZones.find((z) => z.userId === userId)?.zoneId ?? '',
    )
  }

  const userById = new Map(users.map((u) => [u.id, u]))
  const eligible = new Set(catalog.eligibleUserIds)

  const zoneLabel = (id: string) =>
    catalog.zones.find((z) => z.id === id)?.name ??
    'Zona no disponible'

  const teamLabel = (id: string) =>
    catalog.teams.find((t) => t.id === id)?.name ??
    'Grupo no disponible'

  const userLabel = (id: string) =>
    userById.get(id)?.name ||
    userById.get(id)?.email ||
    'Usuario no disponible'

  const activeZones = catalog.zones.filter((z) => z.isActive)
  const activeTeams = catalog.teams.filter((t) => t.isActive)

  const filteredUsers = users.filter((u) =>
    `${u.name} ${u.email}`
      .toLowerCase()
      .includes(userSearch.trim().toLowerCase()),
  )

  const assistant = userById.get(assistantUser)

  const submit = (event: FormEvent, action: () => void) => {
    event.preventDefault()
    action()
  }

  const tabs = [
    ['zones', 'Zonas', MapPin],
    ['teams', 'Grupos', Users],
    ['coverage', 'Cobertura', Building2],
    ['agents', 'Técnicos', UserRound],
    ['locations', 'Ubicación de usuarios', MapPin],
    ['assistant', 'Asistente', Sparkles],
  ] as const

  const button = 'helpdesk-ui-button helpdesk-ui-button--primary'
  const secondary = 'helpdesk-ui-button helpdesk-ui-button--secondary'

  return (
    <main className="titan-page helpdesk-page hd-operation">
      <header className="helpdesk-inbox__header">
        <div>
          <span className="helpdesk-inbox__eyebrow">
            <Headphones size={15} />
            Administración de soporte
          </span>
          <h1>Configuración de asignaciones</h1>
          <p>
            Define quién atiende cada ubicación y controla
            su disponibilidad y capacidad.
          </p>
        </div>

        <button
          type="button"
          className={secondary}
          disabled={disabled}
          onClick={() => void refresh()}
        >
          <RefreshCw size={16} /> Actualizar
        </button>
      </header>

      {error && (
        <div role="alert" className="helpdesk-inbox__error">
          {error}
        </div>
      )}

      {message && (
        <div role="status" className="hd-operation__success">
          {message}
        </div>
      )}

      <div className="hd-operation__metrics">
        {[
          ['Zonas activas', activeZones.length],
          ['Grupos activos', activeTeams.length],
          [
            'Técnicos habilitados',
            new Set(
              catalog.members
                .filter((m) =>
                  m.isAvailable &&
                  m.acceptsAutomaticAssignments &&
                  eligible.has(m.userId) &&
                  activeTeams.some((t) => t.id === m.teamId),
                )
                .map((m) => m.userId),
            ).size,
          ],
          [
            'Usuarios con ubicación',
            new Set(catalog.userZones.map((z) => z.userId)).size,
          ],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="hd-operation__actions">
        <Link
          className={secondary}
          to="/helpdesk/especialidades"
        >
          Categorías y especialidades
        </Link>
        <Link
          className={secondary}
          to="/helpdesk/cobertura"
        >
          Verificar cobertura y capacidad
        </Link>
      </div>

      <nav
        className="hd-operation__tabs"
        aria-label="Configuración de mesa de ayuda"
      >
        {tabs.map(([key, title, Icon]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            <Icon size={16} />
            {title}
          </button>
        ))}
      </nav>

      {loading && <p role="status">Cargando configuración…</p>}

      <p className="hd-operation__hint">
        Habilitado indica disponibilidad, permiso y aceptación automática.
        La capacidad restante se verifica en Cobertura antes de cada asignación.
      </p>

      <fieldset
        disabled={disabled}
        className="hd-operation__fieldset"
      >
        {tab === 'zones' && (
          <section className="hd-operation__card">
            <h2>Zonas y jerarquía</h2>
            <p>
              Organiza localidades, plantas, naves y áreas.
              La cobertura puede heredarse de una zona superior.
            </p>

            <form
              onSubmit={(e) => submit(e, () => void save(
                () => apiClient.post('/helpdesk/operations/zones', {
                  name: zoneName.trim(),
                  type: zoneType,
                  parentZoneId: parentZoneId || null,
                }),
                'Zona creada.',
                () => setZoneName(''),
              ))}
            >
              <label>
                Nombre
                <input
                  required
                  maxLength={120}
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                />
              </label>

              <label>
                Tipo
                <select
                  value={zoneType}
                  onChange={(e) => setZoneType(e.target.value)}
                >
                  {Object.entries(zoneTypes).map(([key, value]) => (
                    <option key={key} value={key}>{value}</option>
                  ))}
                </select>
              </label>

              <label>
                Zona superior
                <select
                  value={parentZoneId}
                  onChange={(e) => setParentZoneId(e.target.value)}
                >
                  <option value="">Sin zona superior</option>
                  {activeZones.map((z) => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              </label>

              <button className={button}>Crear zona</button>
            </form>

            <div className="hd-operation__table">
              <table>
                <thead>
                  <tr>
                    <th>Zona</th><th>Tipo</th>
                    <th>Zona superior</th><th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.zones.map((z) => (
                    <tr key={z.id}>
                      <td>{z.name}</td>
                      <td>{zoneTypes[z.type] || z.type}</td>
                      <td>
                        {z.parentZoneId
                          ? zoneLabel(z.parentZoneId)
                          : 'Principal'}
                      </td>
                      <td>{z.isActive ? 'Activa' : 'Inactiva'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'teams' && (
          <section className="hd-operation__card">
            <h2>Grupos de trabajo</h2>
            <p>
              Las categorías de cada grupo se administran
              en la pantalla de especialidades.
            </p>

            <form
              onSubmit={(e) => submit(e, () => void save(
                () => apiClient.post('/helpdesk/operations/teams', {
                  name: teamName.trim(),
                  description: description.trim() || null,
                }),
                'Grupo creado.',
                () => {
                  setTeamName('')
                  setDescription('')
                },
              ))}
            >
              <label>
                Nombre
                <input
                  required
                  maxLength={120}
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </label>
              <label>
                Descripción
                <input
                  maxLength={500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <button className={button}>Crear grupo</button>
            </form>

            <div className="hd-operation__table">
              <table>
                <thead>
                  <tr><th>Grupo</th><th>Descripción</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {catalog.teams.map((t) => (
                    <tr key={t.id}>
                      <td>{t.name}</td>
                      <td>{t.description || 'Sin descripción'}</td>
                      <td>{t.isActive ? 'Activo' : 'Inactivo'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'coverage' && (
          <section className="hd-operation__card">
            <h2>Cobertura geográfica</h2>
            <p>
              Relaciona cada grupo con las zonas que atiende.
              Retirar cobertura afecta futuras asignaciones;
              no mueve tickets existentes.
            </p>

            <form
              onSubmit={(e) => submit(e, () => void save(
                () => apiClient.post(
                  `/helpdesk/operations/teams/${coverageTeam}/zones/${coverageZone}`,
                ),
                'Cobertura guardada.',
              ))}
            >
              <label>
                Grupo
                <select
                  required
                  value={coverageTeam}
                  onChange={(e) => setCoverageTeam(e.target.value)}
                >
                  <option value="">Selecciona grupo</option>
                  {activeTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Zona
                <select
                  required
                  value={coverageZone}
                  onChange={(e) => setCoverageZone(e.target.value)}
                >
                  <option value="">Selecciona zona</option>
                  {activeZones.map((z) => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              </label>
              <button className={button}>Agregar cobertura</button>
            </form>

            <div className="hd-operation__table">
              <table>
                <thead>
                  <tr><th>Grupo</th><th>Zona</th><th>Acción</th></tr>
                </thead>
                <tbody>
                  {catalog.coverage.map((c) => (
                    <tr key={`${c.teamId}-${c.zoneId}`}>
                      <td>{teamLabel(c.teamId)}</td>
                      <td>{zoneLabel(c.zoneId)}</td>
                      <td>
                        <button
                          type="button"
                          className={secondary}
                          onClick={() => remove(
                            () => apiClient.delete(
                              `/helpdesk/operations/teams/${c.teamId}/zones/${c.zoneId}`,
                            ),
                            '¿Retirar esta cobertura para futuras asignaciones?',
                            'Cobertura retirada.',
                          )}
                        >
                          <Trash2 size={15} /> Retirar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'agents' && (
          <section className="hd-operation__card">
            <h2>Técnicos, disponibilidad y capacidad</h2>
            <p>
              La capacidad se aplica a tickets activos del técnico.
              Desactivar disponibilidad no retira sus tickets actuales.
            </p>

            <form
              onSubmit={(e) => submit(e, () => void save(
                () => apiClient.put(
                  `/helpdesk/operations/teams/${memberTeam}/members/${memberUser}`,
                  {
                    acceptsAutomaticAssignments: automatic,
                    isAvailable: available,
                    maxOpenTickets: capacity,
                  },
                ),
                'Configuración del técnico guardada.',
              ))}
            >
              <label>
                Grupo
                <select
                  required
                  value={memberTeam}
                  onChange={(e) =>
                    selectMember(e.target.value, memberUser)}
                >
                  <option value="">Selecciona grupo</option>
                  {activeTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>

              <label>
                Técnico
                <select
                  required
                  value={memberUser}
                  onChange={(e) =>
                    selectMember(memberTeam, e.target.value)}
                >
                  <option value="">Selecciona técnico</option>
                  {users
                    .filter((u) =>
                      eligible.has(u.id) ||
                      catalog.members.some((m) => m.userId === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} · {u.email}
                        {eligible.has(u.id)
                          ? ''
                          : ' · sin permiso de atención'}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                Máximo de tickets activos
                <input
                  type="number"
                  required
                  min={1}
                  max={500}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                />
              </label>

              <label className="hd-operation__check">
                <input
                  type="checkbox"
                  checked={available}
                  onChange={(e) => setAvailable(e.target.checked)}
                />
                Disponible
              </label>

              <label className="hd-operation__check">
                <input
                  type="checkbox"
                  checked={automatic}
                  onChange={(e) => setAutomatic(e.target.checked)}
                />
                Recibe asignaciones automáticas
              </label>

              <button className={button}>Guardar técnico</button>
            </form>

            <div className="hd-operation__table">
              <table>
                <thead>
                  <tr>
                    <th>Técnico</th><th>Grupo</th>
                    <th>Disponible</th><th>Automático</th>
                    <th>Capacidad</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.members.map((m) => (
                    <tr key={`${m.teamId}-${m.userId}`}>
                      <td>
                        {userLabel(m.userId)}
                        {!eligible.has(m.userId) && (
                          <small>Sin permiso de atención</small>
                        )}
                      </td>
                      <td>{teamLabel(m.teamId)}</td>
                      <td>{m.isAvailable ? 'Sí' : 'No'}</td>
                      <td>
                        {m.acceptsAutomaticAssignments ? 'Sí' : 'No'}
                      </td>
                      <td>{m.maxOpenTickets}</td>
                      <td>
                        <div className="hd-operation__actions">
                          <button
                            type="button"
                            className={secondary}
                            onClick={() =>
                              selectMember(m.teamId, m.userId)}
                          >
                            <Pencil size={15} /> Editar
                          </button>
                          <button
                            type="button"
                            className={secondary}
                            onClick={() => remove(
                              () => apiClient.delete(
                                `/helpdesk/operations/teams/${m.teamId}/members/${m.userId}`,
                              ),
                              '¿Retirar al técnico de este grupo? Sus tickets actuales conservarán su asignación.',
                              'Técnico retirado del grupo.',
                            )}
                          >
                            <Trash2 size={15} /> Retirar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'locations' && (
          <section className="hd-operation__card">
            <h2>Ubicación principal de los usuarios</h2>
            <p>
              Esta ubicación determina qué cobertura se utiliza
              al crear su ticket.
            </p>

            <label>
              Buscar usuario
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Nombre o correo"
              />
            </label>

            <form
              onSubmit={(e) => submit(e, () => void save(
                () => apiClient.put(
                  `/helpdesk/operations/users/${locationUser}/zone`,
                  { zoneId: locationZone },
                ),
                'Ubicación principal guardada.',
              ))}
            >
              <label>
                Usuario
                <select
                  required
                  value={locationUser}
                  onChange={(e) => selectLocation(e.target.value)}
                >
                  <option value="">Selecciona usuario</option>
                  {users
                    .filter((u) =>
                      filteredUsers.some((f) => f.id === u.id) ||
                      u.id === locationUser)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} · {u.email}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                Zona
                <select
                  required
                  value={locationZone}
                  onChange={(e) => setLocationZone(e.target.value)}
                >
                  <option value="">Selecciona zona</option>
                  {activeZones.map((z) => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              </label>

              <button className={button}>Guardar ubicación</button>
            </form>

            <div className="hd-operation__table">
              <table>
                <thead>
                  <tr>
                    <th>Usuario</th><th>Zona principal</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.userZones
                    .filter((z) =>
                      filteredUsers.some((u) => u.id === z.userId))
                    .slice(0, 100)
                    .map((z) => (
                      <tr key={`${z.userId}-${z.zoneId}`}>
                        <td>{userLabel(z.userId)}</td>
                        <td>{zoneLabel(z.zoneId)}</td>
                        <td>
                          <div className="hd-operation__actions">
                            <button
                              type="button"
                              className={secondary}
                              onClick={() => selectLocation(z.userId)}
                            >
                              <Pencil size={15} /> Editar
                            </button>
                            <button
                              type="button"
                              className={secondary}
                              onClick={() => remove(
                                () => apiClient.delete(
                                  `/helpdesk/operations/users/${z.userId}/zone`,
                                ),
                                '¿Retirar la ubicación? Los nuevos tickets pueden quedar pendientes de asignación.',
                                'Ubicación retirada.',
                              )}
                            >
                              <Trash2 size={15} /> Retirar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <p>
              Se muestran hasta 100 ubicaciones coincidentes.
              Usa la búsqueda para localizar un usuario.
            </p>
          </section>
        )}

        {tab === 'assistant' && (
          <section className="hd-operation__card">
            <h2>Acceso individual al asistente</h2>
            <p>
              Autoriza su uso. Esto no concede permisos adicionales
              ni activa la integración con Ollama.
            </p>

            <label>
              Usuario
              <select
                value={assistantUser}
                onChange={(e) => setAssistantUser(e.target.value)}
              >
                <option value="">Selecciona usuario</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.email}
                  </option>
                ))}
              </select>
            </label>

            {assistant && (
              <p>
                Acceso:{' '}
                <strong>
                  {assistant.assistantEnabled
                    ? 'Autorizado'
                    : 'Sin autorización'}
                </strong>
              </p>
            )}

            <div className="hd-operation__actions">
              <button
                type="button"
                className={button}
                disabled={!assistantUser}
                onClick={() => void save(
                  () => apiClient.put(
                    `/helpdesk/operations/assistant/users/${assistantUser}`,
                    { enabled: true },
                  ),
                  'Acceso autorizado.',
                )}
              >
                Autorizar
              </button>
              <button
                type="button"
                className={secondary}
                disabled={!assistantUser}
                onClick={() => void save(
                  () => apiClient.put(
                    `/helpdesk/operations/assistant/users/${assistantUser}`,
                    { enabled: false },
                  ),
                  'Acceso retirado.',
                )}
              >
                Retirar acceso
              </button>
            </div>
          </section>
        )}
      </fieldset>
    </main>
  )
}