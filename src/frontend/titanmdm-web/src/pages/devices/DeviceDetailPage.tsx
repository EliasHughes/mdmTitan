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
  Smartphone,
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

import {
  deviceCommandsApi,
  type DeviceCommand,
} from '../../api/deviceCommandsApi'

import {
  devicesApi,
} from '../../api/devicesApi'

import type {
  AndroidDeviceDetails,
  DeviceDetails,
} from '../../types/device'

import './DeviceDetailPage.css'

type TabName =
  | 'overview'
  | 'enterprise'
  | 'hardware'
  | 'system'
  | 'security'
  | 'policy'
  | 'sync'
  | 'network'
  | 'commands'

interface FieldProps {
  label: string
  value: string | number | null | undefined
}

function DetailField({
  label,
  value,
}: FieldProps) {
  const displayValue =
    value === null ||
    value === undefined ||
    value === ''
      ? 'N/D'
      : String(value)

  return (
    <div>
      <span>{label}</span>
      <strong>{displayValue}</strong>
    </div>
  )
}

function formatDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return 'N/D'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'N/D'
  }

  return date.toLocaleString()
}

function getCommandStatusClass(
  status: string,
): string {
  return status.toLowerCase()
}

function getBatteryText(
  batteryLevel: number | null,
): string {
  return batteryLevel === null
    ? 'N/D'
    : `${batteryLevel}%`
}

function getYesNo(value: boolean): string {
  return value ? 'Sí' : 'No'
}

export function DeviceDetailPage() {
  const { deviceId } = useParams<{
    deviceId: string
  }>()

  const navigate = useNavigate()

  const [device, setDevice] =
    useState<DeviceDetails | null>(null)

  const [androidDetails, setAndroidDetails] =
    useState<AndroidDeviceDetails | null>(null)

  const [commands, setCommands] =
    useState<DeviceCommand[]>([])

  const [activeTab, setActiveTab] =
    useState<TabName>('overview')

  const [loading, setLoading] =
    useState<boolean>(true)

  const [sendingCommand, setSendingCommand] =
    useState<string | null>(null)

  const [error, setError] =
    useState<string | null>(null)

  const [message, setMessage] =
    useState<string | null>(null)

  const isAndroid =
    device?.platform === 'Android'

  const loadDevice = useCallback(
    async (): Promise<void> => {
      if (!deviceId) {
        setLoading(false)

        setError(
          'No se recibió un identificador de dispositivo válido.',
        )

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

        if (
          deviceResponse.platform ===
          'Android'
        ) {
          const androidResponse =
            await devicesApi.getAndroidDeviceDetails(
              deviceId,
            )

          setAndroidDetails(androidResponse)
        } else {
          setAndroidDetails(null)
        }
      } catch (loadError) {
        console.error(
          'Error cargando dispositivo:',
          loadError,
        )

        setError(
          'No fue posible obtener la información del dispositivo.',
        )
      } finally {
        setLoading(false)
      }
    },
    [deviceId],
  )

  const refreshCommands = useCallback(
    async (): Promise<void> => {
      if (!deviceId) {
        return
      }

      try {
        const response =
          await deviceCommandsApi.getForDevice(
            deviceId,
          )

        setCommands(response.items)
      } catch (refreshError) {
        console.error(
          'Error actualizando comandos:',
          refreshError,
        )
      }
    },
    [deviceId],
  )

  const sendCommand = async (
    commandType: string,
  ): Promise<void> => {
    if (!deviceId) {
      setError(
        'No existe un identificador válido para enviar el comando.',
      )

      return
    }

    if (isAndroid) {
      setError(
        'Los comandos Android se habilitarán mediante Android Management API en la fase A7.',
      )

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

      setCommands((currentCommands) => [
        command,
        ...currentCommands.filter(
          (currentCommand) =>
            currentCommand.id !== command.id,
        ),
      ])

      setMessage(
        `Comando ${commandType} creado correctamente.`,
      )

      setActiveTab('commands')
    } catch (commandError) {
      console.error(
        `Error enviando ${commandType}:`,
        commandError,
      )

      setError(
        `No fue posible enviar el comando ${commandType}.`,
      )
    } finally {
      setSendingCommand(null)
    }
  }

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
      return undefined
    }

    const timerId = window.setInterval(
      () => {
        void refreshCommands()
      },
      5000,
    )

    return () => {
      window.clearInterval(timerId)
    }
  }, [deviceId, refreshCommands])

  if (loading && device === null) {
    return (
      <div className="device-detail-loading">
        <RefreshCw
          size={24}
          className="device-detail-spin"
        />

        <span>
          Cargando dispositivo...
        </span>
      </div>
    )
  }

  if (device === null) {
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
            {isAndroid ? (
              <Smartphone size={27} />
            ) : (
              <Laptop size={27} />
            )}
          </div>

          <div>
            <div className="device-detail-title-line">
              <h1>
                {device.deviceName}
              </h1>

              <span
                className={
                  `device-detail-status ` +
                  `device-detail-status--${device.status.toLowerCase()}`
                }
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
            disabled={loading}
            onClick={() => {
              void loadDevice()
            }}
          >
            <RefreshCw size={16} />
            Actualizar
          </button>

          {!isAndroid && (
            <>
              <button
                type="button"
                className="device-action-primary"
                disabled={
                  sendingCommand !== null
                }
                onClick={() => {
                  void sendCommand('PING')
                }}
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
                onClick={() => {
                  void sendCommand(
                    'DEVICE_INFO',
                  )
                }}
              >
                <Database size={16} />

                {sendingCommand ===
                'DEVICE_INFO'
                  ? 'Solicitando...'
                  : 'DEVICE INFO'}
              </button>
            </>
          )}
        </div>
      </header>

      {error !== null && (
        <div className="device-detail-notice device-detail-notice--error">
          <XCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {message !== null && (
        <div className="device-detail-notice device-detail-notice--success">
          <CheckCircle2 size={17} />
          <span>{message}</span>
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
              {getBatteryText(
                device.batteryLevel,
              )}
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

        {isAndroid && (
          <button
            type="button"
            className={
              activeTab === 'enterprise'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActiveTab('enterprise')
            }
          >
            <Smartphone size={16} />
            Android Enterprise
          </button>
        )}

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

        {isAndroid && (
          <>
            <button
              type="button"
              className={
                activeTab === 'system'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setActiveTab('system')
              }
            >
              <Database size={16} />
              Sistema
            </button>

            <button
              type="button"
              className={
                activeTab === 'security'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setActiveTab('security')
              }
            >
              <ShieldCheck size={16} />
              Seguridad
            </button>

            <button
              type="button"
              className={
                activeTab === 'policy'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setActiveTab('policy')
              }
            >
              <CheckCircle2 size={16} />
              Política
            </button>

            <button
              type="button"
              className={
                activeTab === 'sync'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setActiveTab('sync')
              }
            >
              <RefreshCw size={16} />
              Sincronización
            </button>
          </>
        )}

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
          <span>{commands.length}</span>
        </button>
      </nav>

      {activeTab === 'overview' && (
        <section className="device-detail-grid">
          <article className="device-detail-card">
            <header>
              <Info size={18} />
              <h2>
                Información general
              </h2>
            </header>

            <div className="device-detail-fields">
              <DetailField
                label="Nombre"
                value={device.deviceName}
              />

              <DetailField
                label="Plataforma"
                value={device.platform}
              />

              <DetailField
                label="Sistema operativo"
                value={
                  device.operatingSystem
                }
              />

              <DetailField
                label="Versión del SO"
                value={
                  device.operatingSystemVersion
                }
              />

              <DetailField
                label="Versión del agente"
                value={
                  device.agentVersion
                }
              />

              <DetailField
                label="Administrado"
                value={getYesNo(
                  device.isManaged,
                )}
              />
            </div>
          </article>

          <article className="device-detail-card">
            <header>
              <User size={18} />
              <h2>Asignación</h2>
            </header>

            <div className="device-detail-fields">
              <DetailField
                label="Usuario"
                value={
                  device.assignedUser ??
                  'Sin asignar'
                }
              />

              <DetailField
                label="Departamento"
                value={
                  device.department ??
                  'Sin departamento'
                }
              />

              <DetailField
                label="Inscrito"
                value={formatDate(
                  device.enrolledAtUtc,
                )}
              />

              <DetailField
                label="Actualizado"
                value={formatDate(
                  device.updatedAtUtc,
                )}
              />

              {isAndroid &&
                androidDetails && (
                  <>
                    <DetailField
                      label="Modo de administración"
                      value={
                        androidDetails.managementMode
                      }
                    />

                    <DetailField
                      label="Propiedad"
                      value={
                        androidDetails.ownership
                      }
                    />
                  </>
                )}
            </div>
          </article>
        </section>
      )}

      {activeTab === 'enterprise' &&
        isAndroid && (
          <section className="device-detail-grid">
            <article className="device-detail-card device-detail-card--wide">
              <header>
                <Smartphone size={18} />
                <h2>
                  Android Enterprise
                </h2>
              </header>

              {androidDetails ? (
                <div className="device-detail-fields">
                  <DetailField
                    label="Google Device ID"
                    value={
                      androidDetails.googleDeviceId
                    }
                  />

                  <DetailField
                    label="Recurso de Google"
                    value={
                      androidDetails.googleDeviceName
                    }
                  />

                  <DetailField
                    label="Modo de administración"
                    value={
                      androidDetails.managementMode
                    }
                  />

                  <DetailField
                    label="Propiedad"
                    value={
                      androidDetails.ownership
                    }
                  />

                  <DetailField
                    label="Estado AMAPI"
                    value={
                      androidDetails.state
                    }
                  />

                  <DetailField
                    label="Usuario"
                    value={
                      androidDetails.userName
                    }
                  />

                  <DetailField
                    label="Enrollment Token"
                    value={
                      androidDetails.enrollmentTokenName
                    }
                  />

                  <DetailField
                    label="Fecha de inscripción"
                    value={formatDate(
                      androidDetails.enrollmentTimeUtc,
                    )}
                  />
                </div>
              ) : (
                <p>
                  No existe información
                  Android Enterprise para
                  este dispositivo.
                </p>
              )}
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
              <DetailField
                label="Fabricante"
                value={
                  device.manufacturer
                }
              />

              <DetailField
                label="Modelo"
                value={device.model}
              />

              <DetailField
                label="Número de serie"
                value={
                  device.serialNumber
                }
              />

              <DetailField
                label="IMEI"
                value={device.imei}
              />

              <DetailField
                label="Batería"
                value={getBatteryText(
                  device.batteryLevel,
                )}
              />

              {isAndroid &&
                androidDetails && (
                  <>
                    <DetailField
                      label="Marca"
                      value={
                        androidDetails.brand
                      }
                    />

                    <DetailField
                      label="Hardware"
                      value={
                        androidDetails.hardware
                      }
                    />

                    <DetailField
                      label="Baseband"
                      value={
                        androidDetails.deviceBasebandVersion
                      }
                    />

                    <DetailField
                      label="Bootloader"
                      value={
                        androidDetails.bootloaderVersion
                      }
                    />
                  </>
                )}
            </div>
          </article>
        </section>
      )}

      {activeTab === 'system' &&
        isAndroid && (
          <section className="device-detail-grid">
            <article className="device-detail-card device-detail-card--wide">
              <header>
                <Database size={18} />
                <h2>
                  Sistema Android
                </h2>
              </header>

              {androidDetails ? (
                <div className="device-detail-fields">
                  <DetailField
                    label="Versión Android"
                    value={
                      device.operatingSystemVersion
                    }
                  />

                  <DetailField
                    label="API Level"
                    value={
                      androidDetails.apiLevel
                    }
                  />

                  <DetailField
                    label="Build"
                    value={
                      androidDetails.buildNumber
                    }
                  />

                  <DetailField
                    label="Kernel"
                    value={
                      androidDetails.kernelVersion
                    }
                  />

                  <DetailField
                    label="Security Patch"
                    value={
                      androidDetails.securityPatchLevel
                    }
                  />

                  <DetailField
                    label="Android Device Policy"
                    value={
                      androidDetails.androidDevicePolicyVersion
                    }
                  />

                  <DetailField
                    label="ADP Version Code"
                    value={
                      androidDetails.androidDevicePolicyVersionCode
                    }
                  />
                </div>
              ) : (
                <p>
                  Información del sistema
                  Android no disponible.
                </p>
              )}
            </article>
          </section>
        )}

      {activeTab === 'security' &&
        isAndroid && (
          <section className="device-detail-grid">
            <article className="device-detail-card device-detail-card--wide">
              <header>
                <ShieldCheck size={18} />
                <h2>
                  Seguridad Android
                </h2>
              </header>

              {androidDetails ? (
                <div className="device-detail-fields">
                  <DetailField
                    label="Security Posture"
                    value={
                      androidDetails.securityPosture
                    }
                  />

                  <DetailField
                    label="Cifrado"
                    value={
                      androidDetails.encryptionStatus
                    }
                  />

                  <DetailField
                    label="Cumplimiento"
                    value={
                      device.complianceStatus
                    }
                  />

                  <DetailField
                    label="Administrado"
                    value={getYesNo(
                      device.isManaged,
                    )}
                  />

                  <DetailField
                    label="Security Patch"
                    value={
                      androidDetails.securityPatchLevel
                    }
                  />

                  <DetailField
                    label="Estado AMAPI"
                    value={
                      androidDetails.state
                    }
                  />
                </div>
              ) : (
                <p>
                  Información de seguridad
                  Android no disponible.
                </p>
              )}
            </article>
          </section>
        )}

      {activeTab === 'policy' &&
        isAndroid && (
          <section className="device-detail-grid">
            <article className="device-detail-card device-detail-card--wide">
              <header>
                <CheckCircle2 size={18} />
                <h2>
                  Política Android
                </h2>
              </header>

              {androidDetails ? (
                <div className="device-detail-fields">
                  <DetailField
                    label="Política aplicada"
                    value={
                      androidDetails.appliedPolicyName
                    }
                  />

                  <DetailField
                    label="Versión"
                    value={
                      androidDetails.appliedPolicyVersion
                    }
                  />

                  <DetailField
                    label="Estado de aplicación"
                    value={
                      androidDetails.appliedPolicyState
                    }
                  />

                  <DetailField
                    label="Última sincronización de política"
                    value={formatDate(
                      androidDetails.lastPolicySyncTimeUtc,
                    )}
                  />
                </div>
              ) : (
                <p>
                  No existe información de
                  política Android disponible.
                </p>
              )}
            </article>
          </section>
        )}

      {activeTab === 'sync' &&
        isAndroid && (
          <section className="device-detail-grid">
            <article className="device-detail-card device-detail-card--wide">
              <header>
                <RefreshCw size={18} />
                <h2>
                  Sincronización
                </h2>
              </header>

              {androidDetails ? (
                <div className="device-detail-fields">
                  <DetailField
                    label="Último reporte de estado"
                    value={formatDate(
                      androidDetails.lastStatusReportTimeUtc,
                    )}
                  />

                  <DetailField
                    label="Última sincronización TitanMDM"
                    value={formatDate(
                      androidDetails.lastSynchronizedAtUtc,
                    )}
                  />

                  <DetailField
                    label="Última sincronización de política"
                    value={formatDate(
                      androidDetails.lastPolicySyncTimeUtc,
                    )}
                  />

                  <DetailField
                    label="Eliminado en Google"
                    value={getYesNo(
                      androidDetails.isDeletedInGoogle,
                    )}
                  />

                  <DetailField
                    label="Fecha eliminación Google"
                    value={formatDate(
                      androidDetails.deletedInGoogleAtUtc,
                    )}
                  />
                </div>
              ) : (
                <p>
                  Información de sincronización
                  Android no disponible.
                </p>
              )}
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
              <DetailField
                label="Dirección IP"
                value={device.ipAddress}
              />

              <DetailField
                label="Dirección MAC"
                value={device.macAddress}
              />
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
              onClick={() => {
                void refreshCommands()
              }}
            >
              <RotateCw size={15} />
              Actualizar
            </button>
          </header>

          {isAndroid && (
            <div className="device-detail-notice">
              <Info size={17} />

              <span>
                El historial está preparado
                para Android. Los comandos
                remotos mediante Android
                Management API se habilitarán
                en A7.
              </span>
            </div>
          )}

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
                            className={
                              `command-status ` +
                              `command-status--${getCommandStatusClass(
                                command.status,
                              )}`
                            }
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