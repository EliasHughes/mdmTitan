import {
  Activity,
  Battery,
  CheckCircle2,
  Laptop,
  MonitorSmartphone,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  Wifi,
  WifiOff,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { devicesApi  } from '../../api/devicesApi'
import { useNavigate } from 'react-router-dom'

import type {
  DeviceListItem,
  DeviceStatus,
} from '../../types/device'

import './DevicesPage.css'

function getPlatformIcon(platform: string) {
  switch (platform) {
    case 'Android':
      return <Smartphone size={18} />

    case 'Windows':
      return <Laptop size={18} />

    default:
      return <MonitorSmartphone size={18} />
  }
}

function getStatusIcon(status: DeviceStatus) {
  switch (status) {
    case 'Online':
      return <Wifi size={14} />

    case 'Offline':
      return <WifiOff size={14} />

    case 'Quarantined':
      return <ShieldAlert size={14} />

    default:
      return <Activity size={14} />
  }
}

function formatLastSeen(
  value: string | null,
): string {
  if (!value) {
    return 'Sin comunicación'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Sin información'
  }

  return date.toLocaleString()
}

export function DevicesPage() {
  const [devices, setDevices] = useState<
    DeviceListItem[]
  >([])
  
  const navigate = useNavigate()

  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState('')

  const [platform, setPlatform] =
    useState('')

  const [status, setStatus] =
    useState('')

  const [isLoading, setIsLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  const loadDevices = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await devicesApi.getDevices({
  search,
  platform,
  status,
    })

setDevices(response.items)
setTotal(response.totalCount)
    } catch {
      setError(
        'No fue posible obtener el inventario de dispositivos.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [search, platform, status])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadDevices()
    }, 250)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [loadDevices])

  useEffect(() => {
    document.title = 'Dispositivos | TitanMDM'
  }, [])

  const onlineDevices = useMemo(
    () =>
      devices.filter(
        (device) => device.status === 'Online',
      ).length,
    [devices],
  )

  const offlineDevices = useMemo(
    () =>
      devices.filter(
        (device) => device.status === 'Offline',
      ).length,
    [devices],
  )

  const compliantDevices = useMemo(
    () =>
      devices.filter(
        (device) =>
          device.complianceStatus === 'Compliant',
      ).length,
    [devices],
  )

  return (
    <div className="devices-page">
      <div className="devices-heading">
        <div>
          <span className="devices-heading__eyebrow">
            TITANMDM ENTERPRISE
          </span>

          <h1>Dispositivos</h1>

          <p>
            Inventario centralizado de endpoints
            administrados por TitanMDM.
          </p>
        </div>

        <button
          type="button"
          className="devices-refresh-button"
          onClick={() => void loadDevices()}
          disabled={isLoading}
        >
          <RefreshCw
            size={17}
            className={
              isLoading
                ? 'devices-icon-spinning'
                : ''
            }
          />

          Actualizar
        </button>
      </div>

      <section className="devices-summary">
        <article className="devices-summary-card">
          <div className="devices-summary-card__icon">
            <MonitorSmartphone size={20} />
          </div>

          <div>
            <span>Total</span>
            <strong>{total}</strong>
            <small>Dispositivos administrados</small>
          </div>
        </article>

        <article className="devices-summary-card">
          <div className="devices-summary-card__icon devices-summary-card__icon--online">
            <Wifi size={20} />
          </div>

          <div>
            <span>En línea</span>
            <strong>{onlineDevices}</strong>
            <small>Comunicación activa</small>
          </div>
        </article>

        <article className="devices-summary-card">
          <div className="devices-summary-card__icon devices-summary-card__icon--offline">
            <WifiOff size={20} />
          </div>

          <div>
            <span>Fuera de línea</span>
            <strong>{offlineDevices}</strong>
            <small>Sin comunicación</small>
          </div>
        </article>

        <article className="devices-summary-card">
          <div className="devices-summary-card__icon devices-summary-card__icon--compliant">
            <CheckCircle2 size={20} />
          </div>

          <div>
            <span>Conformes</span>
            <strong>{compliantDevices}</strong>
            <small>Cumplimiento correcto</small>
          </div>
        </article>
      </section>

      <section className="devices-panel">
        <div className="devices-toolbar">
          <div className="devices-search">
            <Search size={17} />

            <input
              type="search"
              placeholder="Buscar por nombre, serial o usuario..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <select
            value={platform}
            onChange={(event) =>
              setPlatform(event.target.value)
            }
          >
            <option value="">
              Todas las plataformas
            </option>

            <option value="Android">
              Android
            </option>

            <option value="Windows">
              Windows
            </option>
          </select>

          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
          >
            <option value="">
              Todos los estados
            </option>

            <option value="Online">
              En línea
            </option>

            <option value="Offline">
              Fuera de línea
            </option>

            <option value="Pending">
              Pendiente
            </option>

            <option value="Enrolling">
              Inscribiendo
            </option>

            <option value="Locked">
              Bloqueado
            </option>

            <option value="Quarantined">
              Cuarentena
            </option>

            <option value="Retired">
              Retirado
            </option>
          </select>
        </div>

        {error && (
          <div className="devices-error">
            <ShieldAlert size={19} />

            <div>
              <strong>
                Error al cargar dispositivos
              </strong>

              <span>{error}</span>
            </div>
          </div>
        )}

        <div className="devices-table-wrapper">
          <table className="devices-table">
            <thead>
              <tr>
                <th>Dispositivo</th>
                <th>Plataforma</th>
                <th>Estado</th>
                <th>Usuario</th>
                <th>Cumplimiento</th>
                <th>Batería</th>
                <th>Última comunicación</th>
              </tr>
            </thead>

            <tbody>
              {isLoading && devices.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="devices-empty"
                  >
                    <RefreshCw
                      size={22}
                      className="devices-icon-spinning"
                    />

                    Cargando inventario...
                  </td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="devices-empty"
                  >
                    <MonitorSmartphone size={28} />

                    <strong>
                      No hay dispositivos
                    </strong>

                    <span>
                      Cuando inscribamos el primer
                      dispositivo aparecerá aquí.
                    </span>
                  </td>
                </tr>
              ) : (
                devices.map((device) => (
                  <tr
                      key={device.id}
                      className="device-row-clickable"
                      onClick={() =>
                        navigate(`/devices/${device.id}`)
                      }
                      >
                       <td>
                      <div className="device-identity">
                        <div className="device-platform-icon">
                          {getPlatformIcon(
                            device.platform,
                          )}
                        </div>

                        <div>
                          <strong>
                            {device.deviceName}
                          </strong>

                          <span>
                            {device.manufacturer ??
                              'Fabricante desconocido'}

                            {' · '}

                            {device.model ??
                              'Modelo desconocido'}
                          </span>

                          <small>
                            SN: {device.serialNumber}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="device-platform">
                        {getPlatformIcon(
                          device.platform,
                        )}

                        <span>
                          {device.platform}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`device-status device-status--${device.status.toLowerCase()}`}
                      >
                        {getStatusIcon(
                          device.status,
                        )}

                        {device.status}
                      </span>
                    </td>

                    <td>
                      <div className="device-user">
                        <strong>
                          {device.assignedUser ??
                            'Sin asignar'}
                        </strong>

                        <span>
                          {device.department ??
                            'Sin departamento'}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`device-compliance device-compliance--${device.complianceStatus.toLowerCase()}`}
                      >
                        {
                          device.complianceStatus
                        }
                      </span>
                    </td>

                    <td>
                      <div className="device-battery">
                        <Battery size={16} />

                        <span>
                          {device.batteryLevel !== null
                            ? `${device.batteryLevel}%`
                            : 'N/D'}
                        </span>
                      </div>
                    </td>

                    <td>
                      {formatLastSeen(
                        device.lastSeenAtUtc,
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="devices-panel-footer">
          <span>
            {total} dispositivo
            {total === 1 ? '' : 's'}
          </span>
        </footer>
      </section>
    </div>
  )
}