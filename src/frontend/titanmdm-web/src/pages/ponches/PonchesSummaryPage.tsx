import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertCircle,
  BarChart3,
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

interface SeriesItem {
  label: string
  total: number
}

interface DashboardData {
  summary: {
    totalHoy: number
    empleadosHoy: number
    relojesHoy: number
    conEntrada: number
    conSalida: number
    sinSalida: number
  }
  byDay: SeriesItem[]
  byDepartment: SeriesItem[]
  recent: Punch[]
}

interface Collaborator {
  codigo: string
  nombre: string | null
  departamento: string | null
  registros: number
  ultima_fecha: string | null
}

interface Device {
  nombre: string
  registros: number
  colaboradores: number
  ultima_fecha: string | null
}

type View = 'dashboard' | 'records' | 'collaborators' | 'devices'

function display(value: string | null | undefined): string {
  return value?.trim() || '—'
}

function Bars({
  title,
  items,
}: {
  title: string
  items: SeriesItem[]
}) {
  const max = Math.max(1, ...items.map((item) => item.total))

  return (
    <section className="ponches-panel">
      <div className="ponches-panel__head">
        <h2>{title}</h2>
      </div>

      <div style={{ padding: '0 20px 22px' }}>
        {items.length === 0 && (
          <p className="ponches-empty">Sin datos para mostrar.</p>
        )}

        {items.map((item) => (
          <div key={item.label} style={{ marginBottom: 14 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 6,
              }}
            >
              <span>{item.label}</span>
              <strong>{item.total.toLocaleString('es-DO')}</strong>
            </div>

            <div
              style={{
                height: 10,
                borderRadius: 10,
                background: '#fee2e2',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(item.total / max) * 100}%`,
                  height: '100%',
                  borderRadius: 10,
                  background: '#dc2626',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Metric({
  title,
  count,
}: {
  title: string
  count: number
}) {
  return (
    <article className="ponches-metric">
      <Activity size={20} />
      <span>{title}</span>
      <strong>{count.toLocaleString('es-DO')}</strong>
    </article>
  )
}

export function PonchesSummaryPage() {
  const [view, setView] = useState<View>('dashboard')
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [records, setRecords] = useState<Punch[]>([])
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (next: View, term = '') => {
    setLoading(true)
    setError('')

    try {
      if (next === 'dashboard') {
        const response = await apiClient.get<DashboardData>(
          '/ponches/dashboard',
        )
        setDashboard(response.data)
      } else if (next === 'records') {
        const response = await apiClient.get<{ items: Punch[] }>(
          '/ponches/records',
          { params: { limit: 100, search: term.trim() } },
        )
        setRecords(response.data.items)
      } else if (next === 'collaborators') {
        const response = await apiClient.get<{ items: Collaborator[] }>(
          '/ponches/collaborators',
          { params: { limit: 100, search: term.trim() } },
        )
        setCollaborators(response.data.items)
      } else {
        const response = await apiClient.get<{ items: Device[] }>(
          '/ponches/devices',
        )
        setDevices(response.data.items)
      }
    } catch {
      setError(
        'No se pudo consultar Ponches. Comprueba .NET, Python y BioTimeDB.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load('dashboard')
    }, 0)

    return () => window.clearTimeout(timer)
  }, [load])

  function select(next: View) {
    setView(next)
    setSearch('')
    void load(next)
  }

  const summary = dashboard?.summary

  return (
    <div className="ponches-page">
      <header className="ponches-hero">
        <div>
          <span className="ponches-eyebrow">SISTEMA BIOMÉTRICO</span>
          <h1>Visualizador de ponches</h1>
          <p>Asistencia y actividad de BioTimeDB.</p>
        </div>

        <button
          type="button"
          className="ponches-refresh"
          disabled={loading}
          onClick={() => void load(view, search)}
        >
          <RefreshCw size={17} />
          Actualizar
        </button>
      </header>

      <nav className="ponches-tabs" aria-label="Secciones de Ponches">
        {([
          ['dashboard', 'Dashboard', BarChart3],
          ['records', 'Registros', Clock3],
          ['collaborators', 'Colaboradores', Users],
          ['devices', 'Relojes', RadioTower],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            className={
              view === id
                ? 'ponches-tab ponches-tab--active'
                : 'ponches-tab'
            }
            onClick={() => select(id)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>

      {error && (
        <div className="ponches-error" role="alert">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {view === 'dashboard' && (
        <>
          <section className="ponches-metrics">
            <Metric title="Ponches hoy" count={summary?.totalHoy ?? 0} />
            <Metric
              title="Colaboradores"
              count={summary?.empleadosHoy ?? 0}
            />
            <Metric
              title="Relojes con actividad"
              count={summary?.relojesHoy ?? 0}
            />
            <Metric title="Sin salida" count={summary?.sinSalida ?? 0} />
          </section>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 16,
            }}
          >
            <Bars
              title="Actividad de los últimos 14 días"
              items={dashboard?.byDay ?? []}
            />
            <Bars
              title="Ponches por departamento hoy"
              items={dashboard?.byDepartment ?? []}
            />
          </div>

          <section className="ponches-panel">
            <div className="ponches-panel__head">
              <h2>Actividad reciente</h2>
            </div>
            <PunchTable items={dashboard?.recent ?? []} />
          </section>
        </>
      )}

      {(view === 'records' || view === 'collaborators') && (
        <form
          className="ponches-search"
          onSubmit={(event) => {
            event.preventDefault()
            void load(view, search)
          }}
        >
          <Search size={17} />
          <input
            value={search}
            maxLength={80}
            placeholder="Buscar por código o nombre"
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="submit">Buscar</button>
        </form>
      )}

      {view === 'records' && (
        <section className="ponches-panel">
          <div className="ponches-panel__head">
            <h2>Registros</h2>
          </div>
          <PunchTable items={records} />
        </section>
      )}

      {view === 'collaborators' && (
        <section className="ponches-panel">
          <div className="ponches-panel__head">
            <h2>Colaboradores</h2>
          </div>
          <div className="ponches-table-wrap">
            <table className="ponches-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Departamento</th>
                  <th>Registros</th>
                  <th>Última fecha</th>
                </tr>
              </thead>
              <tbody>
                {collaborators.map((item) => (
                  <tr key={item.codigo}>
                    <td>{display(item.codigo)}</td>
                    <td>{display(item.nombre)}</td>
                    <td>{display(item.departamento)}</td>
                    <td>{item.registros}</td>
                    <td>{display(item.ultima_fecha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {collaborators.length === 0 && (
            <p className="ponches-empty">Sin colaboradores para mostrar.</p>
          )}
        </section>
      )}

      {view === 'devices' && (
        <section className="ponches-panel">
          <div className="ponches-panel__head">
            <h2>Actividad por reloj</h2>
            <p>Relojes observados en los registros de BioTimeDB.</p>
          </div>
          <div className="ponches-table-wrap">
            <table className="ponches-table">
              <thead>
                <tr>
                  <th>Reloj</th>
                  <th>Registros</th>
                  <th>Colaboradores</th>
                  <th>Última fecha</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((item) => (
                  <tr key={item.nombre}>
                    <td>{display(item.nombre)}</td>
                    <td>{item.registros}</td>
                    <td>{item.colaboradores}</td>
                    <td>{display(item.ultima_fecha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {devices.length === 0 && (
            <p className="ponches-empty">Sin relojes para mostrar.</p>
          )}
        </section>
      )}

      {loading && (
        <p className="ponches-loading" role="status">
          Consultando BioTimeDB…
        </p>
      )}
    </div>
  )
}

function PunchTable({ items }: { items: Punch[] }) {
  if (items.length === 0) {
    return <p className="ponches-empty">Sin registros para mostrar.</p>
  }

  return (
    <div className="ponches-table-wrap">
      <table className="ponches-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Colaborador</th>
            <th>Departamento</th>
            <th>Fecha</th>
            <th>Entrada</th>
            <th>Salida</th>
            <th>Reloj</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{display(item.codigo)}</td>
              <td>{display(item.nombre)}</td>
              <td>{display(item.departamento)}</td>
              <td>{display(item.fecha)}</td>
              <td>{display(item.entrada)}</td>
              <td>{display(item.salida)}</td>
              <td>{display(item.dispositivo_origen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}