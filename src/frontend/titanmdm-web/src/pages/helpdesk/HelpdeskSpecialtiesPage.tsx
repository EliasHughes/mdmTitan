import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Save } from 'lucide-react'
import apiClient from '../../api/apiClient'
import './HelpdeskPages.css'

interface Team {
  id: string
  name: string
  isActive: boolean
  categories: string[]
}

export function HelpdeskSpecialtiesPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const response = await apiClient.get<Team[]>(
        '/helpdesk/specialties',
      )

      setTeams(response.data)
      setDrafts(
        Object.fromEntries(
          response.data.map((team) => [
            team.id,
            team.categories.join(', '),
          ]),
        ),
      )
    } catch {
      setError('No se pudieron cargar los grupos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save(teamId: string) {
    const categories = (drafts[teamId] ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)

    try {
      setSavingId(teamId)
      setError('')
      setMessage('')

      await apiClient.put(
        `/helpdesk/specialties/teams/${teamId}`,
        { categories },
      )

      setMessage('Especialidades guardadas.')
      await load()
    } catch {
      setError(
        'No se pudieron guardar las especialidades. ' +
        'Revisa los nombres y vuelve a intentarlo.',
      )
    } finally {
      setSavingId(null)
    }
  }

  return (
    <main className="titan-page helpdesk-page helpdesk-operations">
      <header className="helpdesk-inbox__header">
        <div>
          <span className="helpdesk-inbox__eyebrow">
            Mesa de Ayuda · Administración
          </span>
          <h1>Especialidades de los grupos</h1>
          <p>
            Indica qué casos atiende cada grupo TIC.
            Una lista vacía significa que el grupo es general.
          </p>
        </div>

        <Link to="/helpdesk/operations?workspace=helpdesk">
          Volver a Operación de la mesa
        </Link>
      </header>

      <section className="titan-section-card">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Actualizar grupos
        </button>

        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}

        {loading && teams.length === 0 && (
          <p>Cargando grupos...</p>
        )}

        {!loading && teams.length === 0 && (
          <p>
            Crea primero un grupo en Operación de la mesa.
          </p>
        )}

        {teams.map((team) => (
          <article
            key={team.id}
            className="titan-section-card"
            style={{ marginTop: 16 }}
          >
            <h2>{team.name}</h2>

            <p>
              {team.isActive ? 'Grupo activo' : 'Grupo inactivo'}
            </p>

            <label htmlFor={`categories-${team.id}`}>
              Categorías separadas por comas
            </label>

            <input
              id={`categories-${team.id}`}
              type="text"
              value={drafts[team.id] ?? ''}
              placeholder="redes, equipos, software"
              onChange={(event) =>
                setDrafts((previous) => ({
                  ...previous,
                  [team.id]: event.target.value,
                }))
              }
              disabled={savingId === team.id}
            />

            <p>
              Usa exactamente los nombres de las categorías
              que aparecen al crear tickets.
            </p>

            <button
              type="button"
              onClick={() => void save(team.id)}
              disabled={savingId !== null}
            >
              <Save size={16} />
              {savingId === team.id
                ? 'Guardando...'
                : 'Guardar especialidades'}
            </button>
          </article>
        ))}
      </section>
    </main>
  )
}