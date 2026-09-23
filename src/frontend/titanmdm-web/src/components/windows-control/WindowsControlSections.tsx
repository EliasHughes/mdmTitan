import {
  Boxes,
  CheckCircle2,
  Clock3,
  Cpu,
  HardDrive,
  KeyRound,
  Laptop,
  Lock,
  Network,
  Package,
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
  XCircle,
} from 'lucide-react'

import type {
  Dispatch,
  ReactNode,
  SetStateAction,
} from 'react'

import type {
  DeviceCommand,
} from '../../api/deviceCommandsApi'

import type {
  DeviceDetails,
} from '../../types/device'

import type {
  CommandDefinition,
  SecurityView,
  SendWindowsCommand,
  UninstallTarget,
  UpdateView,
  WindowsApplicationItem,
  WindowsProcessItem,
  WindowsServiceItem,
} from './windowsControl.types'

import {
  extractUninstallTarget,
  formatBytes,
  formatDate,
  latestByType,
  prettyResult,
} from './windowsControl.utils'

interface OverviewProps {
  device:
    DeviceDetails

  definitions:
    CommandDefinition[]

  sendingCommand:
    string | null

  sendCommand:
    SendWindowsCommand
}

export function WindowsOverviewSection({
  device,
  definitions,
  sendingCommand,
  sendCommand,
}: OverviewProps) {
  return (
    <section className="windows-control-grid">
      <article className="windows-control-card">
        <header>
          <Laptop
            size={18}
          />

          <h2>
            Endpoint
          </h2>
        </header>

        <div className="windows-control-fields">
          <div>
            <span>
              Equipo
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
                'N/D'}
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
              Agent
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
          <Network
            size={18}
          />

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
          <ScanLine
            size={18}
          />

          <h2>
            Recolección inmediata
          </h2>
        </header>

        <div className="windows-control-command-grid">
          {definitions.map(
            definition => (
              <button
                key={
                  definition.type
                }
                type="button"
                disabled={
                  sendingCommand !==
                  null
                }
                onClick={() =>
                  void sendCommand(
                    definition.type,
                  )
                }
              >
                {definition.icon}

                <div>
                  <strong>
                    {definition.label}
                  </strong>

                  <span>
                    {definition.description}
                  </span>
                </div>
              </button>
            ),
          )}
        </div>
      </article>
    </section>
  )
}

interface InventoryProps {
  commands:
    DeviceCommand[]

  sendCommand:
    SendWindowsCommand
}

export function WindowsInventorySection({
  commands,
  sendCommand,
}: InventoryProps) {
  return (
    <section className="windows-control-single">
      <article className="windows-control-card windows-control-card--wide">
        <header>
          <Boxes
            size={18}
          />

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
            Actualizar
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
  )
}

interface TelemetryCardProps {
  title:
    string

  value:
    string

  detail:
    string

  icon:
    ReactNode

  tone:
    'success'
    | 'warning'
    | 'danger'
    | 'unknown'
}

function TelemetryCard({
  title,
  value,
  detail,
  icon,
  tone,
}: TelemetryCardProps) {
  return (
    <article
      className={
        `windows-telemetry-card windows-telemetry-card--${tone}`
      }
    >
      <div className="windows-telemetry-card__header">
        {icon}

        <span>
          {title}
        </span>

        <i
          className={
            `windows-telemetry-state windows-telemetry-state--${tone}`
          }
        />
      </div>

      <strong>
        {value}
      </strong>

      <small>
        {detail}
      </small>
    </article>
  )
}

interface SecurityProps {
  security:
    SecurityView

  sendCommand:
    SendWindowsCommand
}

export function WindowsSecuritySection({
  security,
  sendCommand,
}: SecurityProps) {
  return (
    <section className="windows-control-single">
      <article className="windows-control-card windows-control-card--wide">
        <header>
          <ShieldCheck
            size={18}
          />

          <h2>
            Windows Security Posture
          </h2>

          <button
            type="button"
            onClick={() =>
              void sendCommand(
                'SECURITY_STATUS',
              )
            }
          >
            Consultar ahora
          </button>
        </header>

        {!security.available ? (
          <div className="windows-telemetry-empty">
            Ejecuta SECURITY_STATUS para obtener la postura de seguridad.
          </div>
        ) : (
          <div className="windows-telemetry-grid">
            <TelemetryCard
              title="Microsoft Defender"
              value={
                security.defenderRealTime ===
                true
                  ? 'Protegido'
                  : security.defenderAvailable
                    ? 'Revisar'
                    : 'No disponible'
              }
              detail={
                security.defenderVersion
                  ? `Firmas ${security.defenderVersion}`
                  : 'Protección en tiempo real'
              }
              icon={
                <ShieldCheck
                  size={18}
                />
              }
              tone={
                security.defenderRealTime ===
                true
                  ? 'success'
                  : 'warning'
              }
            />

            <TelemetryCard
              title="Firewall"
              value={
                security.firewallEnabledProfiles !==
                null
                  ? `${security.firewallEnabledProfiles} perfiles`
                  : 'N/D'
              }
              detail="Perfiles de Windows Firewall"
              icon={
                <Shield
                  size={18}
                />
              }
              tone={
                (
                  security.firewallEnabledProfiles
                  ??
                  0
                ) >
                0
                  ? 'success'
                  : 'warning'
              }
            />

            <TelemetryCard
              title="BitLocker"
              value={
                security.bitLockerProtected ===
                true
                  ? 'Protegido'
                  : security.bitLockerAvailable
                    ? 'Revisar'
                    : 'N/D'
              }
              detail="Protección de volúmenes"
              icon={
                <HardDrive
                  size={18}
                />
              }
              tone={
                security.bitLockerProtected ===
                true
                  ? 'success'
                  : 'warning'
              }
            />

            <TelemetryCard
              title="TPM"
              value={
                security.tpmPresent ===
                true
                  ? security.tpmReady ===
                    true
                    ? 'Listo'
                    : 'Presente'
                  : 'No disponible'
              }
              detail="Trusted Platform Module"
              icon={
                <KeyRound
                  size={18}
                />
              }
              tone={
                security.tpmReady ===
                true
                  ? 'success'
                  : 'warning'
              }
            />

            <TelemetryCard
              title="Secure Boot"
              value={
                security.secureBoot ===
                true
                  ? 'Activo'
                  : security.secureBoot ===
                      false
                    ? 'Inactivo'
                    : 'N/D'
              }
              detail="Arranque seguro UEFI"
              icon={
                <ShieldCheck
                  size={18}
                />
              }
              tone={
                security.secureBoot ===
                true
                  ? 'success'
                  : 'warning'
              }
            />

            <TelemetryCard
              title="UAC"
              value={
                security.uacEnabled ===
                true
                  ? 'Activo'
                  : 'Inactivo'
              }
              detail="User Account Control"
              icon={
                <Shield
                  size={18}
                />
              }
              tone={
                security.uacEnabled ===
                true
                  ? 'success'
                  : 'warning'
              }
            />

            <TelemetryCard
              title="Reinicio pendiente"
              value={
                security.pendingReboot ===
                true
                  ? 'Sí'
                  : 'No'
              }
              detail="Windows requiere reinicio"
              icon={
                <RefreshCw
                  size={18}
                />
              }
              tone={
                security.pendingReboot ===
                true
                  ? 'warning'
                  : 'success'
              }
            />

            <TelemetryCard
              title="Remote Desktop"
              value={
                security.remoteDesktopEnabled ===
                true
                  ? 'Habilitado'
                  : 'Deshabilitado'
              }
              detail="Configuración RDP"
              icon={
                <RadioTower
                  size={18}
                />
              }
              tone={
                security.remoteDesktopEnabled ===
                true
                  ? 'warning'
                  : 'success'
              }
            />
          </div>
        )}
      </article>
    </section>
  )
}

interface UpdateProps {
  update:
    UpdateView

  sendCommand:
    SendWindowsCommand
}

export function WindowsUpdateSection({
  update,
  sendCommand,
}: UpdateProps) {
  return (
    <section className="windows-control-single">
      <article className="windows-control-card windows-control-card--wide">
        <header>
          <RefreshCw
            size={18}
          />

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

        {!update.available ? (
          <div className="windows-telemetry-empty">
            Ejecuta WINDOWS_UPDATE_STATUS para obtener el estado.
          </div>
        ) : (
          <>
            <div className="windows-telemetry-grid">
              <TelemetryCard
                title="Servicio"
                value={
                  update.serviceStatus
                }
                detail="Windows Update Service"
                icon={
                  <RefreshCw
                    size={18}
                  />
                }
                tone={
                  update.serviceStatus
                    .toLowerCase() ===
                  'running'
                    ? 'success'
                    : 'warning'
                }
              />

              <TelemetryCard
                title="Consulta"
                value={
                  update.serviceQuerySucceeded
                    ? 'Correcta'
                    : 'Error'
                }
                detail="Consulta al servicio wuauserv"
                icon={
                  <CheckCircle2
                    size={18}
                  />
                }
                tone={
                  update.serviceQuerySucceeded
                    ? 'success'
                    : 'danger'
                }
              />

              <TelemetryCard
                title="Reinicio"
                value={
                  update.pendingReboot ===
                  true
                    ? 'Pendiente'
                    : 'No requerido'
                }
                detail="Estado de reboot"
                icon={
                  <RotateCw
                    size={18}
                  />
                }
                tone={
                  update.pendingReboot ===
                  true
                    ? 'warning'
                    : 'success'
                }
              />

              <TelemetryCard
                title="Historial"
                value={
                  `${update.history.length} eventos`
                }
                detail="Historial disponible"
                icon={
                  <Clock3
                    size={18}
                  />
                }
                tone={
                  update.historyAvailable
                    ? 'success'
                    : 'warning'
                }
              />
            </div>

            <h3 className="windows-telemetry-section-title">
              Historial reciente
            </h3>

            <div className="windows-update-history">
              <table>
                <thead>
                  <tr>
                    <th>
                      Actualización
                    </th>

                    <th>
                      Fecha
                    </th>

                    <th>
                      Resultado
                    </th>

                    <th>
                      HRESULT
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {update.history.map(
                    (
                      item,
                      index,
                    ) => (
                      <tr
                        key={
                          `${item.title}-${index}`
                        }
                      >
                        <td>
                          {item.title}
                        </td>

                        <td>
                          {formatDate(
                            item.date,
                          )}
                        </td>

                        <td>
                          {item.resultCode ??
                            'N/D'}
                        </td>

                        <td>
                          {item.hResult ??
                            'N/D'}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </article>
    </section>
  )
}

interface ProcessesProps {
  processes:
    WindowsProcessItem[]

  filter:
    string

  setFilter:
    Dispatch<
      SetStateAction<string>
    >

  sendCommand:
    SendWindowsCommand
}

export function WindowsProcessesSection({
  processes,
  filter,
  setFilter,
  sendCommand,
}: ProcessesProps) {
  return (
    <section className="windows-control-single">
      <article className="windows-control-card windows-control-card--wide">
        <header>
          <Cpu
            size={18}
          />

          <h2>
            Procesos activos
          </h2>

          <div className="windows-control-inline-actions">
            <input
              className="windows-control-filter"
              type="search"
              placeholder="Buscar proceso..."
              value={
                filter
              }
              onChange={
                event =>
                  setFilter(
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
                  RAM
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
              {processes.length ===
              0 ? (
                <tr>
                  <td colSpan={5}>
                    No existen resultados.
                  </td>
                </tr>
              ) : (
                processes.map(
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
  )
}

interface ServicesProps {
  services:
    WindowsServiceItem[]

  filter:
    string

  setFilter:
    Dispatch<
      SetStateAction<string>
    >

  sendCommand:
    SendWindowsCommand
}

export function WindowsServicesSection({
  services,
  filter,
  setFilter,
  sendCommand,
}: ServicesProps) {
  return (
    <section className="windows-control-single">
      <article className="windows-control-card windows-control-card--wide">
        <header>
          <ServerCog
            size={18}
          />

          <h2>
            Servicios Windows
          </h2>

          <div className="windows-control-inline-actions">
            <input
              className="windows-control-filter"
              type="search"
              placeholder="Buscar servicio..."
              value={
                filter
              }
              onChange={
                event =>
                  setFilter(
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
              {services.map(
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
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  )
}

interface SoftwareProps {
  applications:
    WindowsApplicationItem[]

  filter:
    string

  setFilter:
    Dispatch<
      SetStateAction<string>
    >

  packagePath:
    string

  setPackagePath:
    Dispatch<
      SetStateAction<string>
    >

  packageSha256:
    string

  setPackageSha256:
    Dispatch<
      SetStateAction<string>
    >

  packageArguments:
    string

  setPackageArguments:
    Dispatch<
      SetStateAction<string>
    >

  uninstallTarget:
    UninstallTarget

  setUninstallTarget:
    Dispatch<
      SetStateAction<
        UninstallTarget
      >
    >

  sendCommand:
    SendWindowsCommand
}

export function WindowsSoftwareSection({
  applications,
  filter,
  setFilter,
  packagePath,
  setPackagePath,
  packageSha256,
  setPackageSha256,
  packageArguments,
  setPackageArguments,
  uninstallTarget,
  setUninstallTarget,
  sendCommand,
}: SoftwareProps) {
  return (
    <section className="windows-control-single">
      <article className="windows-control-card windows-control-card--wide">
        <header>
          <Package
            size={18}
          />

          <h2>
            Software instalado
          </h2>

          <div className="windows-control-inline-actions">
            <input
              className="windows-control-filter"
              type="search"
              placeholder="Buscar software..."
              value={
                filter
              }
              onChange={
                event =>
                  setFilter(
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
              {applications.map(
                (
                  application,
                  index,
                ) => (
                  <tr
                    key={
                      `${application.name}-${index}`
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
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="windows-control-card windows-control-card--wide">
        <header>
          <Package
            size={18}
          />

          <h2>
            Instalar paquete
          </h2>
        </header>

        <div className="windows-control-form-stack">
          <input
            value={
              packagePath
            }
            onChange={
              event =>
                setPackagePath(
                  event.target.value,
                )
            }
            placeholder="Ruta local del paquete"
          />

          <input
            value={
              packageSha256
            }
            onChange={
              event =>
                setPackageSha256(
                  event.target.value,
                )
            }
            placeholder="SHA-256 esperado"
          />

          <input
            value={
              packageArguments
            }
            onChange={
              event =>
                setPackageArguments(
                  event.target.value,
                )
            }
            placeholder="Argumentos opcionales"
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
          <XCircle
            size={18}
          />

          <h2>
            Desinstalar software
          </h2>
        </header>

        <div className="windows-control-form-stack">
          <input
            value={
              uninstallTarget.name
            }
            readOnly
            placeholder="Aplicación seleccionada"
          />

          <input
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
            placeholder="MSI ProductCode"
          />

          <input
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
            placeholder="Uninstall executable"
          />

          <input
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
            placeholder="Argumentos"
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
                    uninstallTarget.productCode.trim()
                    ||
                    null,

                  uninstallExecutable:
                    uninstallTarget.executable.trim()
                    ||
                    null,

                  arguments:
                    uninstallTarget.arguments.trim()
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
  )
}

interface ActionsProps {
  scriptPath:
    string

  setScriptPath:
    Dispatch<
      SetStateAction<string>
    >

  scriptSha256:
    string

  setScriptSha256:
    Dispatch<
      SetStateAction<string>
    >

  scriptTimeout:
    string

  setScriptTimeout:
    Dispatch<
      SetStateAction<string>
    >

  sendCommand:
    SendWindowsCommand
}

export function WindowsActionsSection({
  scriptPath,
  setScriptPath,
  scriptSha256,
  setScriptSha256,
  scriptTimeout,
  setScriptTimeout,
  sendCommand,
}: ActionsProps) {
  return (
    <section className="windows-control-grid">
      <article className="windows-control-card">
        <header>
          <Power
            size={18}
          />

          <h2>
            Acciones del endpoint
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
            <Lock
              size={17}
            />

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
            <RotateCw
              size={17}
            />

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
            <Power
              size={17}
            />

            Apagar
          </button>
        </div>
      </article>

      <article className="windows-control-card">
        <header>
          <Terminal
            size={18}
          />

          <h2>
            Script firmado
          </h2>
        </header>

        <div className="windows-control-form-stack">
          <input
            value={
              scriptPath
            }
            onChange={
              event =>
                setScriptPath(
                  event.target.value,
                )
            }
            placeholder="Ruta del script"
          />

          <input
            value={
              scriptSha256
            }
            onChange={
              event =>
                setScriptSha256(
                  event.target.value,
                )
            }
            placeholder="SHA-256"
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
  )
}

interface HistoryProps {
  commands:
    DeviceCommand[]
}

export function WindowsCommandHistorySection({
  commands,
}: HistoryProps) {
  return (
    <section className="windows-control-single">
      <article className="windows-control-card windows-control-card--wide">
        <header>
          <SquareTerminal
            size={18}
          />

          <h2>
            Historial de comandos
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
  )
}