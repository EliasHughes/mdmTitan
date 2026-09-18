import {
  Activity,
  ArrowLeft,
  Battery,
  CheckCircle2,
  Clock3,
  Cpu,
  Database,
  HardDrive,
  Info,
  Laptop,
  Network,
  Play,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  Terminal,
  User,
  Wifi,
  XCircle,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  useNavigate,
  useParams,
} from 'react-router-dom'

import { devicesApi } from '../../api/devicesApi'

import {
  deviceCommandsApi,
  type DeviceCommand,
} from '../../api/deviceCommandsApi'

import type {
  DeviceDetails,
} from '../../types/device'

import './DeviceDetailPage.css'

type TabName =
  | 'overview'
  | 'hardware'
  | 'network'
  | 'commands'

function formatDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return 'N/D'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? 'N/D'
    : date.toLocaleString()
}

function commandStatusClass(
  status: string,
): string {
  return status.toLowerCase()
}

export function DeviceDetailPage() {
  const { deviceId } = useParams()

  const navigate = useNavigate()

  const [device, setDevice] =
    useState<DeviceDetails | null>(null)

  const [commands, setCommands] =
    useState<DeviceCommand[]>([])

  const [activeTab, setActiveTab] =
    useState<TabName>('overview')

  const [loading, setLoading] =
    useState(true)

  const [sendingCommand, setSendingCommand] =
    useState<string | null>(null)

  const [error, setError] =
    useState<string | null>(null)

  const [message, setMessage] =
    useState<string | null>(null)

  const loadDevice = useCallback(async () => {
    if (!deviceId) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      const [
        deviceResponse,
        commandResponse,
      ] = await Promise.all([
        devicesApi.getDeviceById(deviceId),
        deviceCommandsApi.getForDevice(
          deviceId,
        ),
      ])

      setDevice(deviceResponse)
      setCommands(commandResponse.items)
    } catch (loadError) {
      console.error(loadError)

      setError(
        'No fue posible obtener la información del dispositivo.',
      )
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  useEffect(() => {
    void loadDevice()
  }, [loadDevice])

  useEffect(() => {
    document.title = device
      ? `${device.deviceName} | TitanMDM`
      : 'Dispositivo | TitanMDM'
  }, [device])

  useEffect(() => {
    if (!deviceId) {
      return
    }

    const timer = window.setInterval(
      async () => {
        try {
          const result =
            await deviceCommandsApi.getForDevice(
              deviceId,
            )

          setCommands(result.items)
        } catch {
          // La actualización manual seguirá disponible.
        }
      },
      5000,
    )

    return () => {
      window.clearInterval(timer)
    }
  }, [deviceId])

  const sendCommand = async (
    commandType: string,
  ) => {
    if (!deviceId) {
      return
    }

    try {
      setSendingCommand(commandType)
      setError(null)
      setMessage(null)

      const command =
        await deviceCommandsApi.create({
          deviceId,
          commandType,
          payloadJson: '{}',
          expirationMinutes: 30,
        })

      setCommands((current) => [
        command,
        ...current.filter(
          (item) => item.id !== command.id,
        ),
      ])

      setMessage(
        `Comando ${commandType} enviado correctamente.`,
      )

      setActiveTab('commands')
    } catch (commandError) {
      console.error(commandError)

      setError(
        `No fue posible enviar el comando ${commandType}.`,
      )
    } finally {
      setSendingCommand(null)
    }
  }

  if (loading && !device) {
    return (
      <div className="device-detail-loading">
        <RefreshCw
          size={24}
          className="device-detail-spin"
        />

        Cargando dispositivo...
      </div>
    )
  }

  if (!device) {
    return (
      <div className="device-detail-error">
        <XCircle size={28} />

        <h2>
          Dispositivo no disponible
        </h2>

        <p>
          {error ??
            'No fue posible localizar el dispositivo.'}
        </p>

        <button
          type="button"
          onClick={() =>
            navigate('/devices')
          }
        >
          Volver a dispositivos
        </button>
      </div>
    )
  }

  return (
    <div className="device-detail-page">
      <button
        type="button"
        className="device-detail-back"
        onClick={() =>
          navigate('/devices')
        }
      >
        <ArrowLeft size={16} />
        Dispositivos
      </button>

      <header className="device-detail-header">
        <div className="device-detail-identity">
          <div className="device-detail-device-icon">
            <Laptop size={27} />
          </div>

          <div>
            <div className="device-detail-title-line">
              <h1>
                {device.deviceName}
              </h1>

              <span
                className={`device-detail-status device-detail-status--${device.status.toLowerCase()}`}
              >
                <Wifi size={13} />
                {device.status}
              </span>
            </div>

            <p>
              {device.platform}
              {' · '}
              {device.manufacturer ??
                'Fabricante desconocido'}
              {' · '}
              {device.model ??
                'Modelo desconocido'}
            </p>

            <small>
              ID: {device.id}
            </small>
          </div>
        </div>

        <div className="device-detail-actions">
          <button
            type="button"
            className="device-action-secondary"
            onClick={() =>
              void loadDevice()
            }
          >
            <RefreshCw size={16} />
            Actualizar
          </button>

          <button
            type="button"
            className="device-action-primary"
            disabled={
              sendingCommand !== null
            }
            onClick={() =>
              void sendCommand('PING')
            }
          >
            <Play size={16} />

            {sendingCommand === 'PING'
              ? 'Enviando...'
              : 'PING'}
          </button>

          <button
            type="button"
            className="device-action-primary"
            disabled={
              sendingCommand !== null
            }
            onClick={() =>
              void sendCommand(
                'DEVICE_INFO',
              )
            }
          >
            <Database size={16} />

            {sendingCommand ===
            'DEVICE_INFO'
              ? 'Solicitando...'
              : 'DEVICE INFO'}
          </button>
        </div>
      </header>

      {error && (
        <div className="device-detail-notice device-detail-notice--error">
          <XCircle size={17} />
          {error}
        </div>
      )}

      {message && (
        <div className="device-detail-notice device-detail-notice--success">
          <CheckCircle2 size={17} />
          {message}
        </div>
      )}

      <section className="device-detail-kpis">
        <article>
          <Activity size={19} />

          <div>
            <span>Estado</span>
            <strong>
              {device.status}
            </strong>
          </div>
        </article>

        <article>
          <ShieldCheck size={19} />

          <div>
            <span>Cumplimiento</span>
            <strong>
              {device.complianceStatus}
            </strong>
          </div>
        </article>

        <article>
          <Battery size={19} />

          <div>
            <span>Batería</span>
            <strong>
              {device.batteryLevel !== null
                ? `${device.batteryLevel}%`
                : 'N/D'}
            </strong>
          </div>
        </article>

        <article>
          <Clock3 size={19} />

          <div>
            <span>
              Última comunicación
            </span>

            <strong>
              {formatDate(
                device.lastSeenAtUtc,
              )}
            </strong>
          </div>
        </article>
      </section>

      <nav className="device-detail-tabs">
        <button
          type="button"
          className={
            activeTab === 'overview'
              ? 'active'
              : ''
          }
          onClick={() =>
            setActiveTab('overview')
          }
        >
          <Info size={16} />
          Resumen
        </button>

        <button
          type="button"
          className={
            activeTab === 'hardware'
              ? 'active'
              : ''
          }
          onClick={() =>
            setActiveTab('hardware')
          }
        >
          <Cpu size={16} />
          Hardware
        </button>

        <button
          type="button"
          className={
            activeTab === 'network'
              ? 'active'
              : ''
          }
          onClick={() =>
            setActiveTab('network')
          }
        >
          <Network size={16} />
          Red
        </button>

        <button
          type="button"
          className={
            activeTab === 'commands'
              ? 'active'
              : ''
          }
          onClick={() =>
            setActiveTab('commands')
          }
        >
          <Terminal size={16} />
          Comandos

          <span>
            {commands.length}
          </span>
        </button>
      </nav>

      {activeTab === 'overview' && (
        <section className="device-detail-grid">
          <article className="device-detail-card">
            <header>
              <h2>
                Información general
              </h2>
            </header>

            <div className="device-detail-fields">
              <div>
                <span>Nombre</span>
                <strong>
                  {device.deviceName}
                </strong>
              </div>

              <div>
                <span>Plataforma</span>
                <strong>
                  {device.platform}
                </strong>
              </div>

              <div>
                <span>
                  Sistema operativo
                </span>
                <strong>
                  {device.operatingSystem ??
                    'N/D'}
                </strong>
              </div>

              <div>
                <span>Versión</span>
                <strong>
                  {device.operatingSystemVersion ??
                    'N/D'}
                </strong>
              </div>

              <div>
                <span>Agent</span>
                <strong>
                  {device.agentVersion ??
                    'N/D'}
                </strong>
              </div>

              <div>
                <span>Administrado</span>
                <strong>
                  {device.isManaged
                    ? 'Sí'
                    : 'No'}
                </strong>
              </div>
            </div>
          </article>

          <article className="device-detail-card">
            <header>
              <h2>
                Asignación
              </h2>
            </header>

            <div className="device-detail-fields">
              <div>
                <span>Usuario</span>
                <strong>
                  {device.assignedUser ??
                    'Sin asignar'}
                </strong>
              </div>

              <div>
                <span>Departamento</span>
                <strong>
                  {device.department ??
                    'Sin departamento'}
                </strong>
              </div>

              <div>
                <span>Inscrito</span>
                <strong>
                  {formatDate(
                    device.enrolledAtUtc,
                  )}
                </strong>
              </div>

              <div>
                <span>Actualizado</span>
                <strong>
                  {formatDate(
                    device.updatedAtUtc,
                  )}
                </strong>
              </div>
            </div>
          </article>
        </section>
      )}

      {activeTab === 'hardware' && (
        <section className="device-detail-grid">
          <article className="device-detail-card device-detail-card--wide">
            <header>
              <HardDrive size={18} />
              <h2>
                Identidad del hardware
              </h2>
            </header>

            <div className="device-detail-fields">
              <div>
                <span>Fabricante</span>
                <strong>
                  {device.manufacturer ??
                    'N/D'}
                </strong>
              </div>

              <div>
                <span>Modelo</span>
                <strong>
                  {device.model ?? 'N/D'}
                </strong>
              </div>

              <div>
                <span>
                  Número de serie
                </span>
                <strong>
                  {device.serialNumber}
                </strong>
              </div>

              <div>
                <span>IMEI</span>
                <strong>
                  {device.imei ?? 'N/D'}
                </strong>
              </div>

              <div>
                <span>Batería</span>
                <strong>
                  {device.batteryLevel !== null
                    ? `${device.batteryLevel}%`
                    : 'N/D'}
                </strong>
              </div>
            </div>
          </article>
        </section>
      )}

      {activeTab === 'network' && (
        <section className="device-detail-grid">
          <article className="device-detail-card device-detail-card--wide">
            <header>
              <Network size={18} />
              <h2>
                Información de red
              </h2>
            </header>

            <div className="device-detail-fields">
              <div>
                <span>Dirección IP</span>
                <strong>
                  {device.ipAddress ??
                    'N/D'}
                </strong>
              </div>

              <div>
                <span>Dirección MAC</span>
                <strong>
                  {device.macAddress ??
                    'N/D'}
                </strong>
              </div>
            </div>
          </article>
        </section>
      )}

      {activeTab === 'commands' && (
        <section className="device-detail-card device-detail-card--wide">
          <header className="device-command-header">
            <div>
              <h2>
                Historial de comandos
              </h2>

              <p>
                Seguimiento de acciones
                enviadas al dispositivo.
              </p>
            </div>

            <button
              type="button"
              className="device-action-secondary"
              onClick={() =>
                void loadDevice()
              }
            >
              <RotateCw size={15} />
              Actualizar
            </button>
          </header>

          <div className="device-command-table-wrapper">
            <table className="device-command-table">
              <thead>
                <tr>
                  <th>Comando</th>
                  <th>Estado</th>
                  <th>Creado</th>
                  <th>Finalizado</th>
                  <th>Intentos</th>
                  <th>Resultado</th>
                </tr>
              </thead>

              <tbody>
                {commands.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="device-command-empty"
                    >
                      No se han enviado
                      comandos a este
                      dispositivo.
                    </td>
                  </tr>
                ) : (
                  commands.map(
                    (command) => (
                      <tr key={command.id}>
                        <td>
                          <strong>
                            {
                              command.commandType
                            }
                          </strong>
                        </td>

                        <td>
                          <span
                            className={`command-status command-status--${commandStatusClass(
                              command.status,
                            )}`}
                          >
                            {command.status}
                          </span>
                        </td>

                        <td>
                          {formatDate(
                            command.createdAtUtc,
                          )}
                        </td>

                        <td>
                          {formatDate(
                            command.completedAtUtc,
                          )}
                        </td>

                        <td>
                          {
                            command.deliveryAttempts
                          }
                        </td>

                        <td className="command-result">
                          {command.errorMessage ??
                            command.resultJson ??
                            '—'}
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}