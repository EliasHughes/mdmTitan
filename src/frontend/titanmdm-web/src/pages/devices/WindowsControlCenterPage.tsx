import {
  Activity,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Clock3,
  Cpu,
  Laptop,
  Lock,
  Network,
  Package,
  Play,
  Power,
  RadioTower,
  RefreshCw,
  RotateCw,
  ScanLine,
  ServerCog,
  Shield,
  ShieldCheck,
  SquareTerminal,
  Terminal,
  Wifi,
  XCircle,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
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
  DeviceDetails,
} from '../../types/device'

import './WindowsControlCenterPage.css'

type ControlTab =
  | 'overview'
  | 'inventory'
  | 'security'
  | 'updates'
  | 'processes'
  | 'services'
  | 'software'
  | 'actions'
  | 'commands'

interface CommandDefinition {
  type: string
  label: string
  description: string
  icon: ReactNode
}

interface WindowsProcessItem {
  processId: number
  name: string
  workingSetBytes: number
  startTimeUtc: string | null
}

interface WindowsServiceItem {
  name: string
  displayName: string | null
  imagePath: string | null
  startType: string | null
  serviceType: string | null
}

interface WindowsApplicationItem {
  name: string
  version: string | null
  publisher: string | null
  installLocation: string | null
  uninstallString: string | null
}

interface UninstallTarget {
  name: string
  productCode: string
  executable: string
  arguments: string
}

const commandDefinitions:
  CommandDefinition[] = [
    {
      type: 'DEVICE_INFO',
      label: 'Información del equipo',
      description:
        'Obtiene información básica del sistema Windows.',
      icon: <Laptop size={18} />,
    },
    {
      type: 'DEVICE_INVENTORY',
      label: 'Inventario completo',
      description:
        'Hardware, red, software, procesos y servicios.',
      icon: <Boxes size={18} />,
    },
    {
      type: 'NETWORK_INFO',
      label: 'Estado de red',
      description:
        'Adaptadores, IP, gateway y DNS.',
      icon: <Network size={18} />,
    },
    {
      type: 'SECURITY_STATUS',
      label: 'Seguridad',
      description:
        'Defender, Firewall, BitLocker, TPM y Secure Boot.',
      icon: <ShieldCheck size={18} />,
    },
    {
      type: 'COMPLIANCE_CHECK',
      label: 'Compliance',
      description:
        'Ejecuta una evaluación de cumplimiento.',
      icon: <Shield size={18} />,
    },
    {
      type: 'WINDOWS_UPDATE_STATUS',
      label: 'Windows Update',
      description:
        'Consulta servicio, historial y reinicio pendiente.',
      icon: <RefreshCw size={18} />,
    },
    {
      type: 'PROCESS_INVENTORY',
      label: 'Procesos',
      description:
        'Obtiene los procesos activos.',
      icon: <Cpu size={18} />,
    },
    {
      type: 'SERVICE_INVENTORY',
      label: 'Servicios',
      description:
        'Obtiene los servicios registrados.',
      icon: <ServerCog size={18} />,
    },
    {
      type: 'APP_INVENTORY',
      label: 'Software',
      description:
        'Obtiene aplicaciones instaladas.',
      icon: <Package size={18} />,
    },
  ]

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

function formatBytes(
  value: number,
): string {
  if (!Number.isFinite(value)) {
    return 'N/D'
  }

  const units = [
    'B',
    'KB',
    'MB',
    'GB',
    'TB',
  ]

  let size = value
  let unit = 0

  while (
    size >= 1024
    &&
    unit < units.length - 1
  ) {
    size /= 1024
    unit++
  }

  return `${size.toFixed(
    unit === 0 ? 0 : 1,
  )} ${units[unit]}`
}

function safeParseJson(
  value: string | null | undefined,
): unknown {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function latestByType(
  commands: DeviceCommand[],
  commandType: string,
): DeviceCommand | null {
  return (
    [...commands]
      .filter(
        command =>
          command.commandType ===
          commandType,
      )
      .sort(
        (left, right) =>
          new Date(
            right.createdAtUtc,
          ).getTime()
          -
          new Date(
            left.createdAtUtc,
          ).getTime(),
      )[0]
    ??
    null
  )
}

function parseArrayResult<T>(
  command: DeviceCommand | null,
): T[] {
  if (
    !command
    ||
    command.status !== 'Success'
    ||
    !command.resultJson
  ) {
    return []
  }

  const parsed =
    safeParseJson(
      command.resultJson,
    )

  return Array.isArray(parsed)
    ? parsed as T[]
    : []
}

function prettyResult(
  command: DeviceCommand | null,
): string {
  if (!command) {
    return 'Todavía no existe información para esta consulta.'
  }

  if (
    command.status === 'Failed'
    ||
    command.status === 'Timeout'
  ) {
    return (
      command.errorMessage
      ??
      command.errorCode
      ??
      'El comando terminó con error.'
    )
  }

  const parsed =
    safeParseJson(
      command.resultJson,
    )

  if (parsed === null) {
    return (
      `Estado: ${command.status}\n`
      +
      'Esperando resultado del agente...'
    )
  }

  if (typeof parsed === 'string') {
    return parsed
  }

  return JSON.stringify(
    parsed,
    null,
    2,
  )
}

function extractUninstallTarget(
  application: WindowsApplicationItem,
): UninstallTarget {
  const uninstall =
    application.uninstallString
      ?.trim()
    ??
    ''

  const guid =
    uninstall.match(
      /\{[0-9a-fA-F-]{36}\}/,
    )?.[0]
    ??
    ''

  if (
    guid
    &&
    uninstall.toLowerCase()
      .includes('msiexec')
  ) {
    return {
      name: application.name,
      productCode: guid,
      executable: '',
      arguments: '',
    }
  }

  if (!uninstall) {
    return {
      name: application.name,
      productCode: '',
      executable: '',
      arguments: '',
    }
  }

  if (uninstall.startsWith('"')) {
    const closing =
      uninstall.indexOf(
        '"',
        1,
      )

    if (closing > 1) {
      return {
        name: application.name,
        productCode: '',
        executable:
          uninstall.slice(
            1,
            closing,
          ),
        arguments:
          uninstall
            .slice(
              closing + 1,
            )
            .trim(),
      }
    }
  }

  const exeIndex =
    uninstall
      .toLowerCase()
      .indexOf('.exe')

  if (exeIndex >= 0) {
    const executable =
      uninstall.slice(
        0,
        exeIndex + 4,
      )

    return {
      name: application.name,
      productCode: '',
      executable,
      arguments:
        uninstall
          .slice(
            exeIndex + 4,
          )
          .trim(),
    }
  }

  return {
    name: application.name,
    productCode: '',
    executable: '',
    arguments: '',
  }
}

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (
    typeof error === 'object'
    &&
    error !== null
    &&
    'response' in error
  ) {
    const response =
      (
        error as {
          response?: {
            data?: {
              message?: string
            }
          }
        }
      ).response

    if (
      response
        ?.data
        ?.message
    ) {
      return response
        .data
        .message
    }
  }

  if (
    error instanceof Error
    &&
    error.message
  ) {
    return error.message
  }

  return fallback
}

export function WindowsControlCenterPage() {
  const {
    deviceId,
  } =
    useParams<{
      deviceId: string
    }>()

  const navigate =
    useNavigate()

  const [
    device,
    setDevice,
  ] =
    useState<
      DeviceDetails | null
    >(null)

  const [
    commands,
    setCommands,
  ] =
    useState<
      DeviceCommand[]
    >([])

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<ControlTab>(
      'overview',
    )

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    sendingCommand,
    setSendingCommand,
  ] =
    useState<
      string | null
    >(null)

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null)

  const [
    message,
    setMessage,
  ] =
    useState<
      string | null
    >(null)

  const [
    scriptPath,
    setScriptPath,
  ] =
    useState('')

  const [
    scriptSha256,
    setScriptSha256,
  ] =
    useState('')

  const [
    scriptTimeout,
    setScriptTimeout,
  ] =
    useState('300')

  const [
    packagePath,
    setPackagePath,
  ] =
    useState('')

  const [
    packageSha256,
    setPackageSha256,
  ] =
    useState('')

  const [
    packageArguments,
    setPackageArguments,
  ] =
    useState('')

  const [
    uninstallTarget,
    setUninstallTarget,
  ] =
    useState<
      UninstallTarget
    >({
      name: '',
      productCode: '',
      executable: '',
      arguments: '',
    })

  const [
    processFilter,
    setProcessFilter,
  ] =
    useState('')

  const [
    serviceFilter,
    setServiceFilter,
  ] =
    useState('')

  const [
    softwareFilter,
    setSoftwareFilter,
  ] =
    useState('')

  /*
   * ==============================================================
   * LOAD
   * ==============================================================
   */

  const loadData =
    useCallback(
      async () => {
        if (!deviceId) {
          setError(
            'No se recibió un DeviceId válido.',
          )

          setLoading(false)

          return
        }

        try {
          setError(null)

          const [
            deviceResponse,
            commandResponse,
          ] =
            await Promise.all([
              devicesApi
                .getDeviceById(
                  deviceId,
                ),

              deviceCommandsApi
                .getForDevice(
                  deviceId,
                ),
            ])

          if (
            deviceResponse.platform !==
            'Windows'
          ) {
            setDevice(null)

            setError(
              'El Control Center Windows solo admite endpoints Windows.',
            )

            return
          }

          setDevice(
            deviceResponse,
          )

          setCommands(
            commandResponse.items,
          )
        } catch (
          loadError
        ) {
          console.error(
            loadError,
          )

          setError(
            getErrorMessage(
              loadError,
              'No fue posible cargar el endpoint.',
            ),
          )
        } finally {
          setLoading(false)
        }
      },
      [
        deviceId,
      ],
    )

  const refreshCommands =
    useCallback(
      async () => {
        if (!deviceId) {
          return
        }

        try {
          const response =
            await deviceCommandsApi
              .getForDevice(
                deviceId,
              )

          setCommands(
            response.items,
          )
        } catch {
          // Polling silencioso.
        }
      },
      [
        deviceId,
      ],
    )

  useEffect(
    () => {
      void loadData()
    },
    [
      loadData,
    ],
  )

  useEffect(
    () => {
      if (!deviceId) {
        return undefined
      }

      const timer =
        window.setInterval(
          () => {
            void refreshCommands()
          },
          5000,
        )

      return () =>
        window.clearInterval(
          timer,
        )
    },
    [
      deviceId,
      refreshCommands,
    ],
  )

  useEffect(
    () => {
      document.title =
        device
          ? `${device.deviceName} · Control Center | TitanMDM`
          : 'Windows Control Center | TitanMDM'
    },
    [
      device,
    ],
  )

  /*
   * ==============================================================
   * COMMAND
   * ==============================================================
   */

  const sendCommand =
    useCallback(
      async (
        commandType: string,
        payload:
          Record<
            string,
            unknown
          > = {},
      ) => {
        if (
          !deviceId
          ||
          sendingCommand !==
            null
        ) {
          return
        }

        try {
          setSendingCommand(
            commandType,
          )

          setError(null)
          setMessage(null)

          const command =
            await deviceCommandsApi
              .create({
                deviceId,
                commandType,
                payloadJson:
                  JSON.stringify(
                    payload,
                  ),
                expirationMinutes:
                  30,
              })

          setCommands(
            current => [
              command,

              ...current.filter(
                item =>
                  item.id !==
                  command.id,
              ),
            ],
          )

          setMessage(
            `${commandType} enviado correctamente.`,
          )
        } catch (
          commandError
        ) {
          setError(
            getErrorMessage(
              commandError,
              `No fue posible ejecutar ${commandType}.`,
            ),
          )
        } finally {
          setSendingCommand(
            null,
          )
        }
      },
      [
        deviceId,
        sendingCommand,
      ],
    )

  /*
   * ==============================================================
   * COMMAND RESULTS
   * ==============================================================
   */

  const processCommand =
    useMemo(
      () =>
        latestByType(
          commands,
          'PROCESS_INVENTORY',
        ),
      [
        commands,
      ],
    )

  const serviceCommand =
    useMemo(
      () =>
        latestByType(
          commands,
          'SERVICE_INVENTORY',
        ),
      [
        commands,
      ],
    )

  const softwareCommand =
    useMemo(
      () =>
        latestByType(
          commands,
          'APP_INVENTORY',
        ),
      [
        commands,
      ],
    )

  const processes =
    useMemo(
      () =>
        parseArrayResult<
          WindowsProcessItem
        >(
          processCommand,
        ),
      [
        processCommand,
      ],
    )

  const services =
    useMemo(
      () =>
        parseArrayResult<
          WindowsServiceItem
        >(
          serviceCommand,
        ),
      [
        serviceCommand,
      ],
    )

  const applications =
    useMemo(
      () =>
        parseArrayResult<
          WindowsApplicationItem
        >(
          softwareCommand,
        ),
      [
        softwareCommand,
      ],
    )

  const visibleProcesses =
    useMemo(
      () => {
        const filter =
          processFilter
            .trim()
            .toLowerCase()

        if (!filter) {
          return processes
        }

        return processes.filter(
          process =>
            process.name
              .toLowerCase()
              .includes(
                filter,
              )
            ||
            String(
              process.processId,
            ).includes(
              filter,
            ),
        )
      },
      [
        processes,
        processFilter,
      ],
    )

  const visibleServices =
    useMemo(
      () => {
        const filter =
          serviceFilter
            .trim()
            .toLowerCase()

        if (!filter) {
          return services
        }

        return services.filter(
          service =>
            service.name
              .toLowerCase()
              .includes(
                filter,
              )
            ||
            (
              service.displayName
              ??
              ''
            )
              .toLowerCase()
              .includes(
                filter,
              ),
        )
      },
      [
        services,
        serviceFilter,
      ],
    )

  const visibleApplications =
    useMemo(
      () => {
        const filter =
          softwareFilter
            .trim()
            .toLowerCase()

        if (!filter) {
          return applications
        }

        return applications.filter(
          application =>
            application.name
              .toLowerCase()
              .includes(
                filter,
              )
            ||
            (
              application.publisher
              ??
              ''
            )
              .toLowerCase()
              .includes(
                filter,
              ),
        )
      },
      [
        applications,
        softwareFilter,
      ],
    )

  const successfulCommands =
    commands.filter(
      command =>
        command.status ===
        'Success',
    ).length

  const failedCommands =
    commands.filter(
      command =>
        command.status ===
          'Failed'
        ||
        command.status ===
          'Timeout',
    ).length

  const activeCommands =
    commands.filter(
      command =>
        [
          'Pending',
          'Queued',
          'Dispatching',
          'Sent',
          'Delivered',
          'Executing',
        ].includes(
          command.status,
        ),
    ).length

  /*
   * ==============================================================
   * LOADING
   * ==============================================================
   */

  if (
    loading
    &&
    device === null
  ) {
    return (
      <div className="windows-control-loading">
        <RefreshCw
          size={26}
          className="windows-control-spin"
        />

        <span>
          Cargando Windows Control Center...
        </span>
      </div>
    )
  }

  if (
    device === null
  ) {
    return (
      <div className="windows-control-error-page">
        <XCircle
          size={34}
        />

        <h2>
          Control Center no disponible
        </h2>

        <p>
          {error ??
            'No fue posible cargar este endpoint.'}
        </p>

        <button
          type="button"
          onClick={() =>
            navigate(
              '/devices?platform=Windows&workspace=windows',
            )
          }
        >
          Volver
        </button>
      </div>
    )
  }

  /*
   * ==============================================================
   * RENDER
   * ==============================================================
   */

  return (
    <div className="windows-control-page">
      <button
        type="button"
        className="windows-control-back"
        onClick={() =>
          navigate(
            '/devices?platform=Windows&workspace=windows',
          )
        }
      >
        <ArrowLeft size={16} />

        Dispositivos Windows
      </button>

      <header className="windows-control-hero">
        <div className="windows-control-device">
          <div className="windows-control-device__icon">
            <Laptop size={28} />
          </div>

          <div>
            <span className="windows-control-eyebrow">
              WINDOWS ENDPOINT
            </span>

            <div className="windows-control-title">
              <h1>
                {device.deviceName}
              </h1>

              <span
                className={
                  `windows-control-status windows-control-status--${device.status.toLowerCase()}`
                }
              >
                {device.status ===
                'Online'
                  ? <Wifi size={13} />
                  : <Activity size={13} />}

                {device.status}
              </span>
            </div>

            <p>
              {device.operatingSystem ??
                'Windows'}

              {' · '}

              {device.manufacturer ??
                'Fabricante desconocido'}

              {' · '}

              {device.model ??
                'Modelo desconocido'}
            </p>
          </div>
        </div>

        <div className="windows-control-hero__actions">
          <button
            type="button"
            className="windows-control-secondary"
            onClick={() =>
              void loadData()
            }
          >
            <RefreshCw size={16} />

            Actualizar
          </button>

          <button
            type="button"
            className="windows-control-secondary"
            onClick={() =>
              navigate(
                '/remote?workspace=windows',
              )
            }
          >
            <RadioTower size={16} />

            Soporte remoto
          </button>

          <button
            type="button"
            className="windows-control-primary"
            disabled={
              sendingCommand !==
              null
            }
            onClick={() =>
              void sendCommand(
                'PING',
              )
            }
          >
            <Play size={16} />

            PING
          </button>
        </div>
      </header>

      {error && (
        <div className="windows-control-notice windows-control-notice--error">
          <XCircle size={17} />

          {error}
        </div>
      )}

      {message && (
        <div className="windows-control-notice windows-control-notice--success">
          <CheckCircle2 size={17} />

          {message}
        </div>
      )}

      <section className="windows-control-kpis">
        <article>
          <Activity size={19} />

          <div>
            <span>
              Estado
            </span>

            <strong>
              {device.status}
            </strong>
          </div>
        </article>

        <article>
          <ShieldCheck size={19} />

          <div>
            <span>
              Compliance
            </span>

            <strong>
              {device.complianceStatus}
            </strong>
          </div>
        </article>

        <article>
          <SquareTerminal size={19} />

          <div>
            <span>
              Comandos activos
            </span>

            <strong>
              {activeCommands}
            </strong>
          </div>
        </article>

        <article>
          <CheckCircle2 size={19} />

          <div>
            <span>
              Correctos
            </span>

            <strong>
              {successfulCommands}
            </strong>
          </div>
        </article>

        <article>
          <XCircle size={19} />

          <div>
            <span>
              Fallidos
            </span>

            <strong>
              {failedCommands}
            </strong>
          </div>
        </article>
      </section>

      <nav className="windows-control-tabs">
        {[
          ['overview', 'Resumen'],
          ['inventory', 'Inventario'],
          ['security', 'Seguridad'],
          ['updates', 'Windows Update'],
          ['processes', 'Procesos'],
          ['services', 'Servicios'],
          ['software', 'Software'],
          ['actions', 'Acciones'],
          ['commands', 'Historial'],
        ].map(
          item => (
            <button
              key={item[0]}
              type="button"
              className={
                activeTab ===
                item[0]
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setActiveTab(
                  item[0] as
                    ControlTab,
                )
              }
            >
              {item[1]}
            </button>
          ),
        )}
      </nav>

      {activeTab ===
        'overview' && (
        <section className="windows-control-grid">
          <article className="windows-control-card">
            <header>
              <Laptop size={18} />

              <h2>
                Endpoint
              </h2>
            </header>

            <div className="windows-control-fields">
              <div>
                <span>
                  Nombre
                </span>

                <strong>
                  {device.deviceName}
                </strong>
              </div>

              <div>
                <span>
                  Sistema
                </span>

                <strong>
                  {device.operatingSystem ??
                    'Windows'}
                </strong>
              </div>

              <div>
                <span>
                  Versión
                </span>

                <strong>
                  {device.operatingSystemVersion ??
                    'N/D'}
                </strong>
              </div>

              <div>
                <span>
                  Agente
                </span>

                <strong>
                  {device.agentVersion ??
                    'N/D'}
                </strong>
              </div>

              <div>
                <span>
                  IP
                </span>

                <strong>
                  {device.ipAddress ??
                    'N/D'}
                </strong>
              </div>

              <div>
                <span>
                  Último heartbeat
                </span>

                <strong>
                  {formatDate(
                    device.lastSeenAtUtc,
                  )}
                </strong>
              </div>
            </div>
          </article>

          <article className="windows-control-card">
            <header>
              <Network size={18} />

              <h2>
                Identidad
              </h2>
            </header>

            <div className="windows-control-fields">
              <div>
                <span>
                  Serial
                </span>

                <strong>
                  {device.serialNumber}
                </strong>
              </div>

              <div>
                <span>
                  MAC
                </span>

                <strong>
                  {device.macAddress ??
                    'N/D'}
                </strong>
              </div>

              <div>
                <span>
                  Usuario
                </span>

                <strong>
                  {device.assignedUser ??
                    'Sin asignar'}
                </strong>
              </div>

              <div>
                <span>
                  Departamento
                </span>

                <strong>
                  {device.department ??
                    'Sin departamento'}
                </strong>
              </div>
            </div>
          </article>

          <article className="windows-control-card windows-control-card--wide">
            <header>
              <ScanLine size={18} />

              <h2>
                Recolección inmediata
              </h2>
            </header>

            <div className="windows-control-command-grid">
              {commandDefinitions.map(
                command => (
                  <button
                    key={command.type}
                    type="button"
                    disabled={
                      sendingCommand !==
                      null
                    }
                    onClick={() =>
                      void sendCommand(
                        command.type,
                      )
                    }
                  >
                    {command.icon}

                    <div>
                      <strong>
                        {command.label}
                      </strong>

                      <span>
                        {command.description}
                      </span>
                    </div>
                  </button>
                ),
              )}
            </div>
          </article>
        </section>
      )}

      {activeTab ===
        'inventory' && (
        <section className="windows-control-single">
          <article className="windows-control-card windows-control-card--wide">
            <header>
              <Boxes size={18} />

              <h2>
                Inventario completo
              </h2>

              <button
                type="button"
                onClick={() =>
                  void sendCommand(
                    'DEVICE_INVENTORY',
                  )
                }
              >
                Actualizar inventario
              </button>
            </header>

            <pre className="windows-control-json">
              {prettyResult(
                latestByType(
                  commands,
                  'DEVICE_INVENTORY',
                ),
              )}
            </pre>
          </article>
        </section>
      )}

      {activeTab ===
        'security' && (
        <section className="windows-control-single">
          <article className="windows-control-card windows-control-card--wide">
            <header>
              <ShieldCheck size={18} />

              <h2>
                Security Posture
              </h2>

              <button
                type="button"
                onClick={() =>
                  void sendCommand(
                    'SECURITY_STATUS',
                  )
                }
              >
                Consultar seguridad
              </button>
            </header>

            <pre className="windows-control-json">
              {prettyResult(
                latestByType(
                  commands,
                  'SECURITY_STATUS',
                ),
              )}
            </pre>
          </article>
        </section>
      )}

      {activeTab ===
        'updates' && (
        <section className="windows-control-single">
          <article className="windows-control-card windows-control-card--wide">
            <header>
              <RefreshCw size={18} />

              <h2>
                Windows Update
              </h2>

              <div className="windows-control-inline-actions">
                <button
                  type="button"
                  onClick={() =>
                    void sendCommand(
                      'WINDOWS_UPDATE_STATUS',
                    )
                  }
                >
                  Consultar
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void sendCommand(
                      'WINDOWS_UPDATE_SCAN',
                    )
                  }
                >
                  Buscar actualizaciones
                </button>
              </div>
            </header>

            <pre className="windows-control-json">
              {prettyResult(
                latestByType(
                  commands,
                  'WINDOWS_UPDATE_STATUS',
                ),
              )}
            </pre>
          </article>
        </section>
      )}

      {activeTab ===
        'processes' && (
        <section className="windows-control-single">
          <article className="windows-control-card windows-control-card--wide">
            <header>
              <Cpu size={18} />

              <h2>
                Procesos activos
              </h2>

              <div className="windows-control-inline-actions">
                <input
                  className="windows-control-filter"
                  type="search"
                  placeholder="Buscar proceso..."
                  value={
                    processFilter
                  }
                  onChange={
                    event =>
                      setProcessFilter(
                        event.target.value,
                      )
                  }
                />

                <button
                  type="button"
                  onClick={() =>
                    void sendCommand(
                      'PROCESS_INVENTORY',
                    )
                  }
                >
                  Actualizar
                </button>
              </div>
            </header>

            <div className="windows-control-table-wrapper">
              <table className="windows-control-table">
                <thead>
                  <tr>
                    <th>
                      Proceso
                    </th>

                    <th>
                      PID
                    </th>

                    <th>
                      Memoria
                    </th>

                    <th>
                      Inicio
                    </th>

                    <th>
                      Acción
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visibleProcesses.length ===
                  0 ? (
                    <tr>
                      <td colSpan={5}>
                        No hay información. Ejecuta PROCESS_INVENTORY.
                      </td>
                    </tr>
                  ) : (
                    visibleProcesses.map(
                      process => (
                        <tr
                          key={
                            process.processId
                          }
                        >
                          <td>
                            <strong>
                              {process.name}
                            </strong>
                          </td>

                          <td>
                            {process.processId}
                          </td>

                          <td>
                            {formatBytes(
                              process.workingSetBytes,
                            )}
                          </td>

                          <td>
                            {formatDate(
                              process.startTimeUtc,
                            )}
                          </td>

                          <td>
                            <button
                              type="button"
                              className="windows-row-danger"
                              disabled={
                                process.processId <=
                                4
                              }
                              onClick={() =>
                                void sendCommand(
                                  'PROCESS_TERMINATE',
                                  {
                                    processId:
                                      process.processId,
                                  },
                                )
                              }
                            >
                              Terminar
                            </button>
                          </td>
                        </tr>
                      ),
                    )
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      )}

      {activeTab ===
        'services' && (
        <section className="windows-control-single">
          <article className="windows-control-card windows-control-card--wide">
            <header>
              <ServerCog size={18} />

              <h2>
                Servicios Windows
              </h2>

              <div className="windows-control-inline-actions">
                <input
                  className="windows-control-filter"
                  type="search"
                  placeholder="Buscar servicio..."
                  value={
                    serviceFilter
                  }
                  onChange={
                    event =>
                      setServiceFilter(
                        event.target.value,
                      )
                  }
                />

                <button
                  type="button"
                  onClick={() =>
                    void sendCommand(
                      'SERVICE_INVENTORY',
                    )
                  }
                >
                  Actualizar
                </button>
              </div>
            </header>

            <div className="windows-control-table-wrapper">
              <table className="windows-control-table">
                <thead>
                  <tr>
                    <th>
                      Servicio
                    </th>

                    <th>
                      Display Name
                    </th>

                    <th>
                      Inicio
                    </th>

                    <th>
                      Tipo
                    </th>

                    <th>
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visibleServices.length ===
                  0 ? (
                    <tr>
                      <td colSpan={5}>
                        No hay información. Ejecuta SERVICE_INVENTORY.
                      </td>
                    </tr>
                  ) : (
                    visibleServices.map(
                      service => (
                        <tr
                          key={
                            service.name
                          }
                        >
                          <td>
                            <strong>
                              {service.name}
                            </strong>
                          </td>

                          <td>
                            {service.displayName ??
                              'N/D'}
                          </td>

                          <td>
                            {service.startType ??
                              'N/D'}
                          </td>

                          <td>
                            {service.serviceType ??
                              'N/D'}
                          </td>

                          <td>
                            <div className="windows-row-actions">
                              <button
                                type="button"
                                onClick={() =>
                                  void sendCommand(
                                    'SERVICE_START',
                                    {
                                      serviceName:
                                        service.name,
                                    },
                                  )
                                }
                              >
                                Iniciar
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void sendCommand(
                                    'SERVICE_STOP',
                                    {
                                      serviceName:
                                        service.name,
                                    },
                                  )
                                }
                              >
                                Detener
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void sendCommand(
                                    'SERVICE_RESTART',
                                    {
                                      serviceName:
                                        service.name,
                                    },
                                  )
                                }
                              >
                                Reiniciar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ),
                    )
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      )}

      {activeTab ===
        'software' && (
        <section className="windows-control-single">
          <article className="windows-control-card windows-control-card--wide">
            <header>
              <Package size={18} />

              <h2>
                Software instalado
              </h2>

              <div className="windows-control-inline-actions">
                <input
                  className="windows-control-filter"
                  type="search"
                  placeholder="Buscar software..."
                  value={
                    softwareFilter
                  }
                  onChange={
                    event =>
                      setSoftwareFilter(
                        event.target.value,
                      )
                  }
                />

                <button
                  type="button"
                  onClick={() =>
                    void sendCommand(
                      'APP_INVENTORY',
                    )
                  }
                >
                  Actualizar
                </button>
              </div>
            </header>

            <div className="windows-control-table-wrapper">
              <table className="windows-control-table">
                <thead>
                  <tr>
                    <th>
                      Aplicación
                    </th>

                    <th>
                      Versión
                    </th>

                    <th>
                      Publisher
                    </th>

                    <th>
                      Ubicación
                    </th>

                    <th>
                      Acción
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visibleApplications.length ===
                  0 ? (
                    <tr>
                      <td colSpan={5}>
                        No hay inventario. Ejecuta APP_INVENTORY.
                      </td>
                    </tr>
                  ) : (
                    visibleApplications.map(
                      (
                        application,
                        index,
                      ) => (
                        <tr
                          key={
                            `${application.name}-${application.version}-${index}`
                          }
                        >
                          <td>
                            <strong>
                              {application.name}
                            </strong>
                          </td>

                          <td>
                            {application.version ??
                              'N/D'}
                          </td>

                          <td>
                            {application.publisher ??
                              'N/D'}
                          </td>

                          <td>
                            {application.installLocation ??
                              'N/D'}
                          </td>

                          <td>
                            <button
                              type="button"
                              className="windows-row-danger"
                              disabled={
                                !application.uninstallString
                              }
                              onClick={() =>
                                setUninstallTarget(
                                  extractUninstallTarget(
                                    application,
                                  ),
                                )
                              }
                            >
                              Desinstalar
                            </button>
                          </td>
                        </tr>
                      ),
                    )
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="windows-control-card windows-control-card--wide">
            <header>
              <Package size={18} />

              <h2>
                Instalar paquete
              </h2>
            </header>

            <div className="windows-control-form-stack">
              <input
                type="text"
                placeholder="Ruta del paquete"
                value={
                  packagePath
                }
                onChange={
                  event =>
                    setPackagePath(
                      event.target.value,
                    )
                }
              />

              <input
                type="text"
                placeholder="SHA-256 esperado"
                value={
                  packageSha256
                }
                onChange={
                  event =>
                    setPackageSha256(
                      event.target.value,
                    )
                }
              />

              <input
                type="text"
                placeholder="Argumentos opcionales"
                value={
                  packageArguments
                }
                onChange={
                  event =>
                    setPackageArguments(
                      event.target.value,
                    )
                }
              />

              <button
                type="button"
                disabled={
                  !packagePath.trim()
                  ||
                  !packageSha256.trim()
                }
                onClick={() =>
                  void sendCommand(
                    'SOFTWARE_INSTALL',
                    {
                      packagePath:
                        packagePath.trim(),

                      expectedSha256:
                        packageSha256.trim(),

                      arguments:
                        packageArguments.trim()
                        ||
                        null,

                      timeoutSeconds:
                        1800,
                    },
                  )
                }
              >
                Instalar software
              </button>
            </div>
          </article>

          <article className="windows-control-card windows-control-card--wide">
            <header>
              <XCircle size={18} />

              <h2>
                Desinstalar software
              </h2>
            </header>

            <div className="windows-control-form-stack">
              <input
                type="text"
                placeholder="Aplicación seleccionada"
                value={
                  uninstallTarget.name
                }
                readOnly
              />

              <input
                type="text"
                placeholder="MSI ProductCode"
                value={
                  uninstallTarget.productCode
                }
                onChange={
                  event =>
                    setUninstallTarget(
                      current => ({
                        ...current,
                        productCode:
                          event.target.value,
                      }),
                    )
                }
              />

              <input
                type="text"
                placeholder="Uninstall executable"
                value={
                  uninstallTarget.executable
                }
                onChange={
                  event =>
                    setUninstallTarget(
                      current => ({
                        ...current,
                        executable:
                          event.target.value,
                      }),
                    )
                }
              />

              <input
                type="text"
                placeholder="Argumentos"
                value={
                  uninstallTarget.arguments
                }
                onChange={
                  event =>
                    setUninstallTarget(
                      current => ({
                        ...current,
                        arguments:
                          event.target.value,
                      }),
                    )
                }
              />

              <button
                type="button"
                className="windows-row-danger"
                disabled={
                  !uninstallTarget.productCode.trim()
                  &&
                  !uninstallTarget.executable.trim()
                }
                onClick={() =>
                  void sendCommand(
                    'SOFTWARE_UNINSTALL',
                    {
                      productCode:
                        uninstallTarget
                          .productCode
                          .trim()
                        ||
                        null,

                      uninstallExecutable:
                        uninstallTarget
                          .executable
                          .trim()
                        ||
                        null,

                      arguments:
                        uninstallTarget
                          .arguments
                          .trim()
                        ||
                        null,

                      timeoutSeconds:
                        1800,
                    },
                  )
                }
              >
                Confirmar desinstalación
              </button>
            </div>
          </article>
        </section>
      )}

      {activeTab ===
        'actions' && (
        <section className="windows-control-grid">
          <article className="windows-control-card">
            <header>
              <Power size={18} />

              <h2>
                Energía
              </h2>
            </header>

            <div className="windows-control-danger-actions">
              <button
                type="button"
                onClick={() =>
                  void sendCommand(
                    'LOCK_DEVICE',
                  )
                }
              >
                <Lock size={17} />

                Bloquear
              </button>

              <button
                type="button"
                onClick={() =>
                  void sendCommand(
                    'RESTART_DEVICE',
                  )
                }
              >
                <RotateCw size={17} />

                Reiniciar
              </button>

              <button
                type="button"
                className="danger"
                onClick={() =>
                  void sendCommand(
                    'SHUTDOWN_DEVICE',
                  )
                }
              >
                <Power size={17} />

                Apagar
              </button>
            </div>
          </article>

          <article className="windows-control-card">
            <header>
              <Terminal size={18} />

              <h2>
                Script firmado
              </h2>
            </header>

            <div className="windows-control-form-stack">
              <input
                type="text"
                placeholder="Ruta del script"
                value={
                  scriptPath
                }
                onChange={
                  event =>
                    setScriptPath(
                      event.target.value,
                    )
                }
              />

              <input
                type="text"
                placeholder="SHA-256 esperado"
                value={
                  scriptSha256
                }
                onChange={
                  event =>
                    setScriptSha256(
                      event.target.value,
                    )
                }
              />

              <input
                type="number"
                min="30"
                max="3600"
                value={
                  scriptTimeout
                }
                onChange={
                  event =>
                    setScriptTimeout(
                      event.target.value,
                    )
                }
              />

              <button
                type="button"
                disabled={
                  !scriptPath.trim()
                  ||
                  !scriptSha256.trim()
                }
                onClick={() =>
                  void sendCommand(
                    'SCRIPT_EXECUTE',
                    {
                      scriptPath:
                        scriptPath.trim(),

                      expectedSha256:
                        scriptSha256.trim(),

                      timeoutSeconds:
                        Number(
                          scriptTimeout,
                        ),
                    },
                  )
                }
              >
                Ejecutar
              </button>
            </div>
          </article>
        </section>
      )}

      {activeTab ===
        'commands' && (
        <section className="windows-control-single">
          <article className="windows-control-card windows-control-card--wide">
            <header>
              <SquareTerminal size={18} />

              <h2>
                Historial
              </h2>

              <span>
                {commands.length} registros
              </span>
            </header>

            <div className="windows-command-list">
              {commands.map(
                command => (
                  <article
                    key={
                      command.id
                    }
                    className="windows-command-item"
                  >
                    <div className="windows-command-item__main">
                      <strong>
                        {command.commandType}
                      </strong>

                      <span
                        className={
                          `windows-command-status windows-command-status--${command.status.toLowerCase()}`
                        }
                      >
                        {command.status}
                      </span>
                    </div>

                    <div className="windows-command-item__meta">
                      <span>
                        {formatDate(
                          command.createdAtUtc,
                        )}
                      </span>

                      <span>
                        Intentos:{' '}
                        {command.deliveryAttempts}
                      </span>

                      {command.errorCode && (
                        <span>
                          {command.errorCode}
                        </span>
                      )}
                    </div>

                    {(command.resultJson
                      ||
                      command.errorMessage) && (
                      <pre>
                        {prettyResult(
                          command,
                        )}
                      </pre>
                    )}
                  </article>
                ),
              )}
            </div>
          </article>
        </section>
      )}

      <footer className="windows-control-footer">
        <Clock3 size={14} />

        Última comunicación:{' '}
        {formatDate(
          device.lastSeenAtUtc,
        )}

        <span>
          ·
        </span>

        Device ID:{' '}
        {device.id}
      </footer>
    </div>
  )
}