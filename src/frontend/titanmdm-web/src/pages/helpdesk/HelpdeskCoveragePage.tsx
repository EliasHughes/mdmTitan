import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react'
import apiClient from '../../api/apiClient'
import './HelpdeskPages.css'

interface CoverageRow {
  zoneId: string
  zoneName: string
  zoneType: string
  category: string
  usersInZone: number
  ready: boolean
  availableAgents: number
  selectedTeam: string | null
  coveredByZone: string | null
  reason: string
}

interface Readiness {
  generatedAtUtc: string
  totalZones: number
  totalCategories: number
  readyCount: number
  uncoveredCount: number
  rows: CoverageRow[]
}

export function HelpdeskCoveragePage() {
  const [data, setData] = useState<Readiness | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'missing'>('missing')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await apiClient.get<Readiness>(
        '/helpdesk/coverage/readiness',
      )
      setData(response.data)
    } catch {
      setError('No se pudo consultar la cobertura de Helpdesk.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()

    return (data?.rows ?? []).filter((row) => {
      if (filter === 'missing' && row.ready) return false
      if (!term) return true

      return [
        row.zoneName,
        row.category,
        row.selectedTeam ?? '',
      ].some((value) => value.toLocaleLowerCase().includes(term))
    })
  }, [data, filter, search])

  return (
    <main className="titan-page helpdesk-page">
      <header className="helpdesk-detail__header">
        <div>
          <span className="helpdesk-inbox__eyebrow">
            Configuración · Mesa de ayuda
          </span>
          <h1>Cobertura de asignación</h1>
          <p>
            Revisa las zonas y categorías antes de habilitar la
            creación de tickets por correo.
          </p>
        </div>

        <button
          type="button"
          className="helpdesk-ui-button helpdesk-ui-button--secondary"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </header>

      <div className="helpdesk-detail__attributes">
        <span>Zonas: <strong>{data?.totalZones ?? 0}</strong></span>
        <span>Categorías: <strong>{data?.totalCategories ?? 0}</strong></span>
        <span>Listas: <strong>{data?.readyCount ?? 0}</strong></span>
        <span>Sin capacidad: <strong>{data?.uncoveredCount ?? 0}</strong></span>
      </div>

      <p className="helpdesk-detail__muted">
        La capacidad refleja el momento de la consulta. Al crear cada
        ticket, la asignación vuelve a comprobar la carga del agente.
      </p>

      {error && (
        <div className="helpdesk-inbox__error" role="alert">
          <AlertCircle size={17} />
          {error}
        </div>
      )}

      <section className="helpdesk-detail__card">
        <div className="helpdesk-detail__section-title">
          <div>
            <h2>Estado por ubicación y categoría</h2>
            <p>
              Configura zonas, grupos, categorías y miembros desde{' '}
              <Link to="/helpdesk/especialidades?workspace=helpdesk">
                Especialidades
              </Link>.
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <input
            aria-label="Buscar zona o categoría"
            placeholder="Buscar zona o categoría"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            aria-label="Filtrar cobertura"
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as 'all' | 'missing')
            }
          >
            <option value="missing">Solo pendientes</option>
            <option value="all">Mostrar todas</option>
          </select>
        </div>

        {loading ? (
          <p>Cargando cobertura…</p>
        ) : visible.length === 0 ? (
          <p>
            {filter === 'missing' && data?.rows.length
              ? 'No hay combinaciones pendientes con este filtro.'
              : 'No hay zonas o categorías configuradas.'}
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th scope="col">Zona</th>
                  <th scope="col">Categoría</th>
                  <th scope="col">Usuarios en zona</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Grupo / cobertura</th>
                </tr>
              </thead>

              <tbody>
                {visible.map((row) => (
                  <tr key={`${row.zoneId}:${row.category}`}>
                    <td>{row.zoneName}</td>
                    <td>{row.category}</td>
                    <td>{row.usersInZone}</td>
                    <td>
                      {row.ready ? (
                        <>
                          <CheckCircle2 size={16} />{' '}
                          {row.availableAgents} disponible(s)
                        </>
                      ) : (
                        <>
                          <AlertCircle size={16} /> Pendiente
                        </>
                      )}
                    </td>
                    <td>
                      {row.ready
                        ? `${row.selectedTeam} · ${row.coveredByZone}`
                        : row.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}