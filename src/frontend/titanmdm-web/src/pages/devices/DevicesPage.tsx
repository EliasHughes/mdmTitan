import {
  Activity,
  Battery,
  CheckCircle2,
  Clock3,
  CloudCog,
  Laptop,
  MonitorSmartphone,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  TriangleAlert,
  Wifi,
  WifiOff,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'

import { androidEnterpriseApi } from '../../api/androidEnterpriseApi'
import { devicesApi } from '../../api/devicesApi'

import type {
  AndroidDeviceInventorySummary,
  AndroidDeviceSyncResult,
} from '../../types/androidEnterprise'

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

function formatDateTime(
  value: string | null,
  emptyText = 'Nunca',
): string {
  if (!value) {
    return emptyText
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Sin información'
  }

  return date.toLocaleString()
}

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const response = (
      error as {
        response?: {
          data?: {
            message?: string
          }
        }
      }
    ).response

    if (
      response?.data?.message &&
      typeof response.data.message === 'string'
    ) {
      return response.data.message
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

export function DevicesPage() {
  const navigate = useNavigate()

  const [devices, setDevices] = useState<
    DeviceListItem[]
  >([])

  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState('')
  const [platform, setPlatform] = useState('')
  const [status, setStatus] = useState('')

  const [isLoading, setIsLoading] =
    useState(true)

  const [isSyncingAndroid, setIsSyncingAndroid] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [androidError, setAndroidError] =
    useState<string | null>(null)

  const [androidSummary, setAndroidSummary] =
    useState<AndroidDeviceInventorySummary | null>(
      null,
    )

  const [lastSyncResult, setLastSyncResult] =
    useState<AndroidDeviceSyncResult | null>(
      null,
    )

  const loadDevices = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response =
        await devicesApi.getDevices({
          search,
          platform,
          status,
        })

      setDevices(response.items)
      setTotal(response.totalCount)
    } catch (loadError) {
      setError(
        getErrorMessage(
          loadError,
          'No fue posible obtener el inventario de dispositivos.',
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }, [search, platform, status])

  const loadAndroidSummary =
    useCallback(async () => {
      try {
        const summary =
          await androidEnterpriseApi.getDeviceSummary()

        setAndroidSummary(summary)
        setAndroidError(null)
      } catch (summaryError) {
        setAndroidError(
          getErrorMessage(
            summaryError,
            'No fue posible consultar el resumen de Android Enterprise.',
          ),
        )
      }
    }, [])

  const synchronizeAndroid =
    useCallback(async () => {
      if (isSyncingAndroid) {
        return
      }

      try {
        setIsSyncingAndroid(true)
        setAndroidError(null)
        setLastSyncResult(null)

        const result =
          await androidEnterpriseApi.synchronizeDevices()

        setLastSyncResult(result)

        await Promise.all([
          loadAndroidSummary(),
          loadDevices(),
        ])
      } catch (syncError) {
        setAndroidError(
          getErrorMessage(
            syncError,
            'No fue posible sincronizar Android Enterprise.',
          ),
        )
      } finally {
        setIsSyncingAndroid(false)
      }
    }, [
      isSyncingAndroid,
      loadAndroidSummary,
      loadDevices,
    ])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadDevices()
    }, 250)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [loadDevices])

  useEffect(() => {
    void loadAndroidSummary()
  }, [loadAndroidSummary])

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

        <div className="devices-heading__actions">
          <button
            type="button"
            className="devices-refresh-button"
            onClick={() => {
              void Promise.all([
                loadDevices(),
                loadAndroidSummary(),
              ])
            }}
            disabled={
              isLoading || isSyncingAndroid
            }
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

          <button
            type="button"
            className="devices-android-sync-button"
            onClick={() =>
              void synchronizeAndroid()
            }
            disabled={isSyncingAndroid}
          >
            <CloudCog
              size={17}
              className={
                isSyncingAndroid
                  ? 'devices-icon-spinning'
                  : ''
              }
            />

            {isSyncingAndroid
              ? 'Sincronizando...'
              : 'Sincronizar Android'}
          </button>
        </div>
      </div>

      <section className="devices-summary">
        <article className="devices-summary-card">
          <div className="devices-summary-card__icon">
            <MonitorSmartphone size={20} />
          </div>

          <div>
            <span>Total</span>
            <strong>{total}</strong>
            <small>
              Dispositivos administrados
            </small>
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

      <section className="android-inventory-panel">
        <div className="android-inventory-panel__header">
          <div className="android-inventory-panel__identity">
            <div className="android-inventory-panel__logo">
              <Smartphone size={22} />
            </div>

            <div>
              <span>
                ANDROID ENTERPRISE
              </span>

              <h2>
                Flota administrada
              </h2>

              <p>
                Inventario sincronizado directamente
                con Android Management API.
              </p>
            </div>
          </div>

          <div className="android-last-sync">
            <Clock3 size={15} />

            <div>
              <span>
                Última sincronización
              </span>

              <strong>
                {formatDateTime(
                  androidSummary
                    ?.lastSynchronizationUtc ??
                    null,
                )}
              </strong>
            </div>
          </div>
        </div>

        <div className="android-inventory-metrics">
          <div>
            <span>Inventario Android</span>
            <strong>
              {androidSummary?.total ?? 0}
            </strong>
          </div>

          <div>
            <span>Administrados</span>
            <strong>
              {androidSummary?.managed ?? 0}
            </strong>
          </div>

          <div>
            <span>Totalmente administrados</span>
            <strong>
              {androidSummary?.fullyManaged ?? 0}
            </strong>
          </div>

          <div>
            <span>Kiosk / dedicados</span>
            <strong>
              {androidSummary?.dedicated ?? 0}
            </strong>
          </div>

          <div>
            <span>Perfil de trabajo</span>
            <strong>
              {androidSummary?.workProfile ?? 0}
            </strong>
          </div>

          <div>
            <span>Ausentes en Google</span>
            <strong>
              {androidSummary?.missingInGoogle ?? 0}
            </strong>
          </div>
        </div>

        {lastSyncResult && (
          <div
            className={
              lastSyncResult.failed > 0
                ? 'android-sync-result android-sync-result--warning'
                : 'android-sync-result android-sync-result--success'
            }
          >
            {lastSyncResult.failed > 0 ? (
              <TriangleAlert size={19} />
            ) : (
              <CheckCircle2 size={19} />
            )}

            <div>
              <strong>
                Sincronización finalizada
              </strong>

              <span>
                Google reportó{' '}
                {lastSyncResult.receivedFromGoogle}{' '}
                dispositivo
                {lastSyncResult.receivedFromGoogle ===
                1
                  ? ''
                  : 's'}
                . Nuevos: {lastSyncResult.created}.
                Actualizados:{' '}
                {lastSyncResult.updated}. Ausentes:{' '}
                {lastSyncResult.markedMissing}.
                Errores: {lastSyncResult.failed}.
              </span>

              {lastSyncResult.errors.length >
                0 && (
                <ul>
                  {lastSyncResult.errors.map(
                    (message, index) => (
                      <li
                        key={`${index}-${message}`}
                      >
                        {message}
                      </li>
                    ),
                  )}
                </ul>
              )}
            </div>
          </div>
        )}

        {androidError && (
          <div className="android-sync-result android-sync-result--error">
            <ShieldAlert size={19} />

            <div>
              <strong>
                Android Enterprise
              </strong>

              <span>{androidError}</span>
            </div>
          </div>
        )}
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
              {isLoading &&
              devices.length === 0 ? (
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
                      Los dispositivos Android
                      Enterprise y Windows aparecerán
                      aquí.
                    </span>
                  </td>
                </tr>
              ) : (
                devices.map((device) => (
                  <tr
                    key={device.id}
                    className="device-row-clickable"
                    onClick={() =>
                      navigate(
                        `/devices/${device.id}`,
                      )
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
                            SN:{' '}
                            {device.serialNumber}
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
                          {device.batteryLevel !==
                          null
                            ? `${device.batteryLevel}%`
                            : 'N/D'}
                        </span>
                      </div>
                    </td>

                    <td>
                      {formatDateTime(
                        device.lastSeenAtUtc,
                        'Sin comunicación',
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