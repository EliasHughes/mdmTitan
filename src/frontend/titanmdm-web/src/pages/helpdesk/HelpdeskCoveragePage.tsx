import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  RefreshCw,
  Users,
} from 'lucide-react'
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

type CoverageFilter = 'pending' | 'all' | 'ready'

const specialtiesUrl =
  '/helpdesk/especialidades?workspace=helpdesk'

function describePending(row: CoverageRow): string {
  if (row.reason) return row.reason

  return row.usersInZone === 0
    ? 'Todavía no hay usuarios vinculados a esta zona.'
    : 'Revisa el grupo, sus agentes y su capacidad.'
}

function csvCell(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`
}

function exportPendingRows(rows: CoverageRow[]): void {
  const pending = rows.filter((row) => !row.ready)

  if (pending.length === 0) return

  const header = [
    'Zona',
    'Tipo de zona',
    'Categoría',
    'Usuarios en zona',
    'Agentes disponibles',
    'Motivo',
  ]

  const lines = [
    header.map(csvCell).join(','),
    ...pending.map((row) =>
      [
        row.zoneName,
        row.zoneType,
        row.category,
        row.usersInZone,
        row.availableAgents,
        describePending(row),
      ]
        .map(csvCell)
        .join(','),
    ),
  ]

  const blob = new Blob(
    ['\uFEFF', lines.join('\r\n')],
    { type: 'text/csv;charset=utf-8' },
  )

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = 'helpdesk-cobertura-pendiente.csv'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function HelpdeskCoveragePage() {
  const [data, setData] = useState<Readiness | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] =
    useState<CoverageFilter>('pending')
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
      setError(
        'No se pudo consultar la cobertura de la mesa de ayuda.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const rows = data?.rows ?? []

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()

    return rows.filter((row) => {
      if (filter === 'pending' && row.ready) return false
      if (filter === 'ready' && !row.ready) return false

      if (!term) return true

      return [
        row.zoneName,
        row.zoneType,
        row.category,
        row.selectedTeam ?? '',
        row.coveredByZone ?? '',
        row.reason,
      ].some((value) =>
        value.toLocaleLowerCase().includes(term),
      )
    })
  }, [rows, filter, search])

  const hasConfiguration =
    (data?.totalZones ?? 0) > 0 &&
    (data?.totalCategories ?? 0) > 0

  const coverageComplete =
    hasConfiguration &&
    (data?.readyCount ?? 0) > 0 &&
    data?.uncoveredCount === 0

  const zonesWithoutUsers = useMemo(
    () =>
      new Set(
        rows
          .filter((row) => row.usersInZone === 0)
          .map((row) => row.zoneId),
      ).size,
    [rows],
  )

  return (
    <main className="titan-page helpdesk-page">
      <header className="helpdesk-detail__header">
        <div>
          <span className="helpdesk-inbox__eyebrow">
            Configuración · Mesa de ayuda
          </span>

          <h1>Cobertura de asignación</h1>

          <p>
            Comprueba qué zonas y categorías pueden recibir
            una asignación automática antes de habilitar los
            tickets por correo.
          </p>
        </div>

        <button
          type="button"
          className="helpdesk-ui-button helpdesk-ui-button--secondary"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </header>

      <div className="helpdesk-detail__attributes">
        <span>
          Zonas: <strong>{data?.totalZones ?? 0}</strong>
        </span>
        <span>
          Categorías: <strong>{data?.totalCategories ?? 0}</strong>
        </span>
        <span>
          Combinaciones listas:{' '}
          <strong>{data?.readyCount ?? 0}</strong>
        </span>
        <span>
          Pendientes:{' '}
          <strong>{data?.uncoveredCount ?? 0}</strong>
        </span>
        <span>
          Zonas sin usuarios:{' '}
          <strong>{zonesWithoutUsers}</strong>
        </span>
      </div>

      {error && (
        <div className="helpdesk-inbox__error" role="alert">
          <AlertCircle size={17} />
          {error}
        </div>
      )}

      {!loading && !error && (
        <section
          className="helpdesk-detail__card"
          aria-label="Preparación de asignaciones"
        >
          <div className="helpdesk-detail__section-title">
            <div>
              <h2>
                {coverageComplete
                  ? 'Cobertura configurada'
                  : 'Configuración pendiente'}
              </h2>

              <p>
                {coverageComplete
                  ? 'Todas las combinaciones evaluadas tienen al menos un agente elegible en este momento.'
                  : 'Completa las zonas, categorías y agentes pendientes antes de recibir tickets por correo.'}
              </p>
            </div>

            {coverageComplete ? (
              <CheckCircle2
                size={24}
                aria-label="Cobertura completa"
              />
            ) : (
              <AlertCircle
                size={24}
                aria-label="Cobertura pendiente"
              />
            )}
          </div>

          <p className="helpdesk-detail__muted">
            Esta revisión muestra la capacidad actual. Al crear
            cada ticket, el servidor vuelve a comprobar permisos,
            disponibilidad y carga del agente. La recepción por
            correo se habilitará en su fase final.
          </p>

          <Link
            to={specialtiesUrl}
            className="helpdesk-ui-button helpdesk-ui-button--primary"
          >
            Configurar zonas, grupos y agentes
          </Link>
        </section>
      )}

      <section className="helpdesk-detail__card">
        <div className="helpdesk-detail__section-title">
          <div>
            <h2>Estado por zona y categoría</h2>
            <p>
              Revisa cada pendiente y corrígelo desde{' '}
              <Link to={specialtiesUrl}>
                Especialidades
              </Link>.
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <input
            aria-label="Buscar en cobertura"
            placeholder="Buscar zona, categoría o grupo"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          <select
            aria-label="Filtrar cobertura"
            value={filter}
            onChange={(event) =>
              setFilter(
                event.target.value as CoverageFilter,
              )
            }
          >
            <option value="pending">
              Solo pendientes
            </option>
            <option value="all">
              Todas
            </option>
            <option value="ready">
              Solo listas
            </option>
          </select>

          <button
            type="button"
            className="helpdesk-ui-button helpdesk-ui-button--secondary"
            onClick={() => exportPendingRows(rows)}
            disabled={
              loading ||
              !data ||
              data.uncoveredCount === 0
            }
          >
            <Download size={16} />
            Exportar pendientes
          </button>
        </div>

        {loading ? (
          <p role="status">
            Cargando cobertura…
          </p>
        ) : rows.length === 0 ? (
          <p>
            Aún no hay zonas y categorías para evaluar.
            Crea la estructura en{' '}
            <Link to={specialtiesUrl}>
              Especialidades
            </Link>.
          </p>
        ) : visible.length === 0 ? (
          <p>
            No hay resultados para los filtros actuales.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr>
                  <th scope="col">Zona</th>
                  <th scope="col">Categoría</th>
                  <th scope="col">Usuarios</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Grupo / motivo</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>

              <tbody>
                {visible.map((row) => (
                  <tr
                    key={`${row.zoneId}:${row.category}`}
                  >
                    <td>
                      <strong>{row.zoneName}</strong>
                      <br />
                      <small>{row.zoneType}</small>
                    </td>

                    <td>{row.category}</td>

                    <td>
                      <Users
                        size={15}
                        aria-hidden="true"
                      />{' '}
                      {row.usersInZone}
                    </td>

                    <td>
                      {row.ready ? (
                        <span>
                          <CheckCircle2
                            size={16}
                            aria-hidden="true"
                          />{' '}
                          {row.availableAgents}{' '}
                          agente(s) disponible(s)
                        </span>
                      ) : (
                        <span>
                          <AlertCircle
                            size={16}
                            aria-hidden="true"
                          />{' '}
                          Pendiente
                        </span>
                      )}
                    </td>

                    <td>
                      {row.ready ? (
                        <>
                          {row.selectedTeam ??
                            'Grupo disponible'}
                          {' · '}
                          {row.coveredByZone ??
                            row.zoneName}
                        </>
                      ) : (
                        describePending(row)
                      )}
                    </td>

                    <td>
                      <Link to={specialtiesUrl}>
                        Configurar
                      </Link>
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