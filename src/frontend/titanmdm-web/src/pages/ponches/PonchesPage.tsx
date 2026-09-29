import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import {
  Activity,
  AlertCircle,
  Clock3,
  RadioTower,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react'
import apiClient from '../../api/apiClient'
import './PonchesPage.css'

interface Punch {
  id: number
  codigo: string
  nombre: string | null
  departamento: string | null
  fecha: string | null
  entrada: string | null
  salida: string | null
  dispositivo_origen: string | null
}

interface DashboardData {
  generatedAtUtc: string
  summary: {
    totalHoy: number
    empleadosHoy: number
    relojesHoy: number
    conEntrada: number
    conSalida: number
    sinSalida: number
  }
  recent: Punch[]
}

interface RecordsData {
  items: Punch[]
  count: number
}

type View = 'dashboard' | 'records'

function value(text: string | null | undefined) {
  return text?.trim() || '—'
}

function Metric({
  title,
  count,
  icon: Icon,
}: {
  title: string
  count: number
  icon: typeof Clock3
}) {
  return (
    <article className="ponches-metric">
      <Icon size={21} />
      <span>{title}</span>
      <strong>
        {count.toLocaleString('es-DO')}
      </strong>
    </article>
  )
}

function PunchTable({
  items,
}: {
  items: Punch[]
}) {
  if (items.length === 0) {
    return (
      <p className="ponches-empty">
        No hay registros para mostrar.
      </p>
    )
  }

  return (
    <div className="ponches-table-wrap">
      <table className="ponches-table">
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col">Colaborador</th>
            <th scope="col">Departamento</th>
            <th scope="col">Fecha</th>
            <th scope="col">Entrada</th>
            <th scope="col">Salida</th>
            <th scope="col">Reloj</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{value(item.codigo)}</td>
              <td>{value(item.nombre)}</td>
              <td>
                {value(item.departamento)}
              </td>
              <td>{value(item.fecha)}</td>
              <td>{value(item.entrada)}</td>
              <td>{value(item.salida)}</td>
              <td>
                {value(
                  item.dispositivo_origen,
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PonchesPage() {
  const [view, setView] =
    useState<View>('dashboard')
  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null)
  const [records, setRecords] =
    useState<Punch[]>([])
  const [search, setSearch] =
    useState('')
  const [loading, setLoading] =
    useState(false)
  const [error, setError] =
    useState('')

  const loadDashboard =
    useCallback(async () => {
      setLoading(true)
      setError('')

      try {
        const response =
          await apiClient.get<DashboardData>(
            '/ponches/dashboard',
          )

        setDashboard(response.data)
      } catch {
        setError(
          'No se pudo consultar BioTime. Revisa el servicio Python y SQL Server.',
        )
      } finally {
        setLoading(false)
      }
    }, [])

  const loadRecords =
    useCallback(async (
      term: string,
    ) => {
      setLoading(true)
      setError('')

      try {
        const response =
          await apiClient.get<RecordsData>(
            '/ponches/records',
            {
              params: {
                limit: 100,
                search: term.trim(),
              },
            },
          )

        setRecords(
          response.data.items,
        )
      } catch {
        setError(
          'No se pudieron cargar los registros de ponches.',
        )
      } finally {
        setLoading(false)
      }
    }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  function changeView(next: View) {
    setView(next)
    setError('')

    if (next === 'records') {
      void loadRecords(search)
    }
  }

  const summary = dashboard?.summary

  return (
    <main className="ponches-page">
      <header className="ponches-hero">
        <div>
          <span className="ponches-eyebrow">
            SISTEMA BIOMÉTRICO
          </span>
          <h1>
            Visualizador de ponches
          </h1>
          <p>
            Asistencia, actividad y registros
            consultados desde BioTime.
          </p>
        </div>

        <button
          type="button"
          className="ponches-refresh"
          disabled={loading}
          onClick={() =>
            view === 'dashboard'
              ? void loadDashboard()
              : void loadRecords(search)
          }
        >
          <RefreshCw size={17} />
          Actualizar
        </button>
      </header>

      <nav
        className="ponches-tabs"
        aria-label="Secciones disponibles de Ponches"
      >
        <button
          type="button"
          className={
            view === 'dashboard'
              ? 'ponches-tab ponches-tab--active'
              : 'ponches-tab'
          }
          onClick={() =>
            changeView('dashboard')
          }
        >
          <Activity size={17} />
          Resumen
        </button>

        <button
          type="button"
          className={
            view === 'records'
              ? 'ponches-tab ponches-tab--active'
              : 'ponches-tab'
          }
          onClick={() =>
            changeView('records')
          }
        >
          <Clock3 size={17} />
          Registros
        </button>
      </nav>

      {error && (
        <div
          className="ponches-error"
          role="alert"
        >
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {view === 'dashboard' ? (
        <>
          <section
            className="ponches-metrics"
            aria-label="Indicadores de hoy"
          >
            <Metric
              title="Ponches hoy"
              count={
                summary?.totalHoy ?? 0
              }
              icon={Clock3}
            />
            <Metric
              title="Colaboradores"
              count={
                summary?.empleadosHoy ?? 0
              }
              icon={Users}
            />
            <Metric
              title="Relojes con actividad"
              count={
                summary?.relojesHoy ?? 0
              }
              icon={RadioTower}
            />
            <Metric
              title="Sin salida"
              count={
                summary?.sinSalida ?? 0
              }
              icon={AlertCircle}
            />
          </section>

          <section className="ponches-panel">
            <div className="ponches-panel__head">
              <h2>Actividad reciente</h2>
              <p>
                Últimos 30 registros.
              </p>
            </div>
            <PunchTable
              items={
                dashboard?.recent ?? []
              }
            />
          </section>
        </>
      ) : (
        <section className="ponches-panel">
          <div className="ponches-panel__head">
            <h2>
              Consultar registros
            </h2>
            <p>
              Busca por código, nombre
              o departamento.
            </p>
          </div>

          <form
            className="ponches-search"
            onSubmit={(event) => {
              event.preventDefault()
              void loadRecords(search)
            }}
          >
            <Search size={17} />

            <input
              value={search}
              maxLength={80}
              placeholder="Buscar colaborador..."
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />

            <button type="submit">
              Buscar
            </button>
          </form>

          <PunchTable items={records} />
        </section>
      )}

      {loading && (
        <p
          className="ponches-loading"
          role="status"
        >
          Consultando BioTime…
        </p>
      )}
    </main>
  )
}