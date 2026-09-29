import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
  Headphones,
  MapPin,
  RefreshCw,
  Save,
  ShieldCheck,
  Users,
} from 'lucide-react'
import apiClient from '../../api/apiClient'
import './HelpdeskPages.css'
import './HelpdeskSpecialtiesPage.css'

interface SpecialtyTeam {
  id: string
  name: string
  isActive: boolean
  categories: string[]
}

interface Zone {
  id: string
  name: string
  type: string
  parentZoneId: string | null
  isActive: boolean
}

interface Coverage {
  teamId: string
  zoneId: string
}

interface Member {
  teamId: string
  userId: string
  isAvailable: boolean
  acceptsAutomaticAssignments: boolean
  maxOpenTickets: number
}

interface Catalog {
  zones: Zone[]
  teams: {
    id: string
    name: string
    isActive: boolean
  }[]
  coverage: Coverage[]
  members: Member[]
}

interface StaffUser {
  id: string
  name: string
  email: string
  canWorkTickets: boolean
}

function parseCategories(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  ]
}

export function HelpdeskSpecialtiesPage() {
  const [teams, setTeams] = useState<SpecialtyTeam[]>([])
  const [catalog, setCatalog] = useState<Catalog>({
    zones: [],
    teams: [],
    coverage: [],
    members: [],
  })
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [specialties, operations, users] =
        await Promise.all([
          apiClient.get<SpecialtyTeam[]>(
            '/helpdesk/specialties',
          ),
          apiClient.get<Catalog>(
            '/helpdesk/operations/catalog',
          ),
          apiClient.get<StaffUser[]>(
            '/helpdesk/staff/users',
          ),
        ])

      setTeams(specialties.data)
      setCatalog(operations.data)
      setStaff(users.data)

      setDrafts(
        Object.fromEntries(
          specialties.data.map((team) => [
            team.id,
            team.categories.join(', '),
          ]),
        ),
      )
    } catch {
      setError(
        'No se pudo cargar la configuración. Comprueba los permisos de administración de Helpdesk.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const activeTeams = useMemo(
    () => teams.filter((team) => team.isActive),
    [teams],
  )

  const configuredCategories = useMemo(
    () => [
      ...new Set(
        activeTeams.flatMap((team) =>
          team.categories.map((category) =>
            category.trim().toLowerCase(),
          ),
        ),
      ),
    ].sort((a, b) => a.localeCompare(b)),
    [activeTeams],
  )

  const activeZoneIds = useMemo(
    () =>
      new Set(
        catalog.zones
          .filter((zone) => zone.isActive)
          .map((zone) => zone.id),
      ),
    [catalog.zones],
  )

  const staffById = useMemo(
    () =>
      new Map(
        staff.map((user) => [
          user.id,
          user,
        ]),
      ),
    [staff],
  )

  const readiness = useMemo(() => {
    const coveredTeams = new Set(
      catalog.coverage
        .filter((item) =>
          activeZoneIds.has(item.zoneId),
        )
        .map((item) => item.teamId),
    )

    const eligibleMembers = catalog.members.filter(
      (member) =>
        member.isAvailable &&
        member.acceptsAutomaticAssignments &&
        member.maxOpenTickets > 0 &&
        staffById.get(member.userId)
          ?.canWorkTickets,
    )

    return [
      {
        label: 'Zonas activas',
        ready: activeZoneIds.size > 0,
        detail: `${activeZoneIds.size} configuradas`,
      },
      {
        label: 'Grupos TIC activos',
        ready: activeTeams.length > 0,
        detail: `${activeTeams.length} configurados`,
      },
      {
        label: 'Cobertura de zonas',
        ready: activeTeams.some((team) =>
          coveredTeams.has(team.id),
        ),
        detail: `${
          catalog.coverage.filter((item) =>
            activeZoneIds.has(item.zoneId),
          ).length
        } relaciones`,
      },
      {
        label: 'Agentes disponibles',
        ready: eligibleMembers.length > 0,
        detail: `${
          new Set(
            eligibleMembers.map(
              (member) => member.userId,
            ),
          ).size
        } agentes`,
      },
      {
        label: 'Especialidades definidas',
        ready: configuredCategories.length > 0,
        detail: `${configuredCategories.length} categorías`,
      },
    ]
  }, [
    activeTeams,
    activeZoneIds,
    catalog.coverage,
    catalog.members,
    configuredCategories,
    staffById,
  ])

  async function save(teamId: string) {
    if (savingId) return

    const categories = parseCategories(
      drafts[teamId] ?? '',
    )

    if (
      categories.some(
        (category) => category.length > 80,
      )
    ) {
      setError(
        'Cada categoría debe tener como máximo 80 caracteres.',
      )
      return
    }

    setSavingId(teamId)
    setMessage('')
    setError('')

    try {
      await apiClient.put(
        `/helpdesk/specialties/teams/${teamId}`,
        { categories },
      )

      await load()
      setMessage(
        categories.length > 0
          ? 'Especialidades guardadas. Comprueba su cobertura y agentes.'
          : 'El grupo quedó configurado como respaldo general.',
      )
    } catch {
      setError(
        'No se pudieron guardar las categorías. Revisa el nombre del grupo y los permisos.',
      )
    } finally {
      setSavingId(null)
    }
  }

  return (
    <main className="titan-page helpdesk-page helpdesk-specialties">
      <header className="helpdesk-inbox__header">
        <div>
          <span className="helpdesk-inbox__eyebrow">
            <Headphones size={15} />
            Mesa de ayuda · Administración
          </span>

          <h1>Especialidades y cobertura</h1>
          <p>
            Define qué atiende cada grupo y comprueba
            si la asignación automática tiene cobertura.
          </p>
        </div>

        <div className="helpdesk-specialties__header-actions">
          <button
            type="button"
            className="helpdesk-ui-button helpdesk-ui-button--secondary"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw size={16} />
            Actualizar
          </button>

          <Link
            className="helpdesk-ui-button helpdesk-ui-button--secondary"
            to="/helpdesk/operations?workspace=helpdesk"
          >
            Zonas y agentes
          </Link>
        </div>
      </header>

      {error && (
        <div className="helpdesk-inbox__error" role="alert">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {message && (
        <div
          className="helpdesk-specialties__success"
          role="status"
        >
          <CheckCircle2 size={18} />
          {message}
        </div>
      )}

      <section className="helpdesk-specialties__overview">
        <article>
          <Users size={20} />
          <span>Grupos activos</span>
          <strong>{activeTeams.length}</strong>
        </article>

        <article>
          <MapPin size={20} />
          <span>Zonas activas</span>
          <strong>{activeZoneIds.size}</strong>
        </article>

        <article>
          <ShieldCheck size={20} />
          <span>Categorías configuradas</span>
          <strong>
            {configuredCategories.length}
          </strong>
        </article>
      </section>

      <section className="helpdesk-specialties__readiness">
        <div>
          <h2>Preparación para recibir tickets</h2>
          <p>
            Esta vista informa sobre la configuración.
            No activa el buzón ni garantiza una asignación
            para cada ubicación: eso se comprobará con
            los datos reales de la empresa.
          </p>
        </div>

        <div className="helpdesk-specialties__checks">
          {readiness.map((item) => (
            <div key={item.label}>
              {item.ready ? (
                <CheckCircle2
                  size={18}
                  className="helpdesk-specialties__ready"
                />
              ) : (
                <AlertCircle
                  size={18}
                  className="helpdesk-specialties__missing"
                />
              )}

              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="helpdesk-specialties__directory">
        <div className="helpdesk-specialties__section-title">
          <h2>Catálogo de categorías</h2>
          <p>
            Utiliza estos mismos nombres al clasificar
            los tickets.
          </p>
        </div>

        <div className="helpdesk-specialties__tags">
          {configuredCategories.length ? (
            configuredCategories.map(
              (category) => (
                <span key={category}>
                  {category}
                </span>
              ),
            )
          ) : (
            <p>
              Todavía no se han definido categorías
              especializadas.
            </p>
          )}
        </div>
      </section>

      <section className="helpdesk-specialties__teams">
        <div className="helpdesk-specialties__section-title">
          <h2>Grupos de trabajo</h2>
          <p>
            Las categorías de un grupo especialista
            tienen prioridad sobre un grupo general.
            Dejar la lista vacía configura el grupo
            como respaldo general.
          </p>
        </div>

        {loading && teams.length === 0 && (
          <p>Cargando grupos…</p>
        )}

        {!loading && teams.length === 0 && (
          <p>
            Todavía no hay grupos. Créalos en
            «Zonas y agentes».
          </p>
        )}

        <div className="helpdesk-specialties__team-grid">
          {teams.map((team) => {
            const teamCoverage =
              catalog.coverage.filter(
                (item) =>
                  item.teamId === team.id &&
                  activeZoneIds.has(item.zoneId),
              )

            const teamMembers =
              catalog.members.filter(
                (member) =>
                  member.teamId === team.id,
              )

            const availableMembers =
              teamMembers.filter(
                (member) =>
                  member.isAvailable &&
                  member.acceptsAutomaticAssignments &&
                  member.maxOpenTickets > 0 &&
                  staffById.get(member.userId)
                    ?.canWorkTickets,
              )

            const dirty =
              parseCategories(
                drafts[team.id] ?? '',
              ).join('|') !==
              [...team.categories]
                .map((item) =>
                  item.trim().toLowerCase(),
                )
                .sort()
                .join('|')

            return (
              <article
                key={team.id}
                className="helpdesk-specialties__team"
              >
                <div className="helpdesk-specialties__team-top">
                  <div>
                    <h3>{team.name}</h3>
                    <span>
                      {team.isActive
                        ? 'Grupo activo'
                        : 'Grupo inactivo'}
                    </span>
                  </div>

                  <span
                    className={
                      team.categories.length
                        ? 'helpdesk-specialties__kind'
                        : 'helpdesk-specialties__kind helpdesk-specialties__kind--general'
                    }
                  >
                    {team.categories.length
                      ? 'Especialista'
                      : 'Respaldo general'}
                  </span>
                </div>

                <div className="helpdesk-specialties__team-stats">
                  <span>
                    <MapPin size={15} />
                    {teamCoverage.length} zonas
                  </span>

                  <span>
                    <Users size={15} />
                    {availableMembers.length}
                    /{teamMembers.length} disponibles
                  </span>
                </div>

                <label
                  htmlFor={`categories-${team.id}`}
                >
                  Categorías que atiende
                </label>

                <textarea
                  id={`categories-${team.id}`}
                  value={drafts[team.id] ?? ''}
                  disabled={
                    !team.isActive ||
                    savingId !== null
                  }
                  rows={3}
                  placeholder="redes, software, equipos"
                  onChange={(event) =>
                    setDrafts((previous) => ({
                      ...previous,
                      [team.id]:
                        event.target.value,
                    }))
                  }
                />

                <small>
                  Separa las categorías con comas.
                  Los nombres se normalizan a
                  minúsculas.
                </small>

                <button
                  type="button"
                  className="helpdesk-ui-button helpdesk-ui-button--primary"
                  disabled={
                    !team.isActive ||
                    !dirty ||
                    savingId !== null
                  }
                  onClick={() =>
                    void save(team.id)
                  }
                >
                  <Save size={16} />
                  {savingId === team.id
                    ? 'Guardando…'
                    : 'Guardar grupo'}
                </button>
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}