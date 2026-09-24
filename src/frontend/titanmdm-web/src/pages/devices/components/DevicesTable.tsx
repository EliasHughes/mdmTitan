import {
  Activity,
  Battery,
  Laptop,
  MonitorSmartphone,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  Wifi,
  WifiOff,
} from 'lucide-react'

import type {
  DeviceListItem,
  DeviceStatus,
} from '../../../types/device'

import {
  formatDeviceDateTime,
} from '../utils/devicesPage.utils'

interface Props {
  devices:
    DeviceListItem[]

  isLoading:
    boolean

  isWindowsWorkspace:
    boolean

  isAndroidWorkspace:
    boolean

  onOpenDevice:
    (
      device:
        DeviceListItem,
    ) => void
}

function getPlatformIcon(
  platform: string,
) {
  if (
    platform ===
    'Android'
  ) {
    return (
      <Smartphone
        size={18}
      />
    )
  }

  if (
    platform ===
    'Windows'
  ) {
    return (
      <Laptop
        size={18}
      />
    )
  }

  return (
    <MonitorSmartphone
      size={18}
    />
  )
}

function getStatusIcon(
  status:
    DeviceStatus,
) {
  switch (
    status
  ) {
    case 'Online':
      return (
        <Wifi
          size={14}
        />
      )

    case 'Offline':
      return (
        <WifiOff
          size={14}
        />
      )

    case 'Quarantined':
      return (
        <ShieldAlert
          size={14}
        />
      )

    default:
      return (
        <Activity
          size={14}
        />
      )
  }
}

export function DevicesTable({
  devices,

  isLoading,

  isWindowsWorkspace,
  isAndroidWorkspace,

  onOpenDevice,
}: Props) {
  return (
    <div className="devices-table-wrapper">
      <table className="devices-table">
        <thead>
          <tr>
            <th>
              Dispositivo
            </th>

            <th>
              Plataforma
            </th>

            <th>
              Estado
            </th>

            <th>
              Usuario
            </th>

            <th>
              Cumplimiento
            </th>

            <th>
              Batería
            </th>

            <th>
              Última comunicación
            </th>
          </tr>
        </thead>

        <tbody>
          {isLoading &&
          devices.length ===
            0 ? (
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
          ) : devices.length ===
            0 ? (
            <tr>
              <td
                colSpan={7}
                className="devices-empty"
              >
                <MonitorSmartphone
                  size={28}
                />

                <strong>
                  No hay dispositivos
                </strong>

                <span>
                  {isWindowsWorkspace
                    ? 'No existen equipos Windows para este filtro.'
                    : isAndroidWorkspace
                      ? 'No existen dispositivos Android para este filtro.'
                      : 'No existen dispositivos para este filtro.'}
                </span>
              </td>
            </tr>
          ) : (
            devices.map(
              device => (
                <tr
                  key={
                    device.id
                  }
                  className="device-row-clickable"
                  onClick={() =>
                    onOpenDevice(
                      device,
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
                          {
                            device
                              .deviceName
                          }
                        </strong>

                        <span>
                          {device.manufacturer
                          ??
                          'Fabricante desconocido'}

                          {' · '}

                          {device.model
                          ??
                          'Modelo desconocido'}
                        </span>

                        <small>
                          SN:{' '}
                          {
                            device
                              .serialNumber
                          }
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
                        {
                          device
                            .platform
                        }
                      </span>
                    </div>
                  </td>

                  <td>
                    <span
                      className={
                        `device-status device-status--${device.status.toLowerCase()}`
                      }
                    >
                      {getStatusIcon(
                        device.status,
                      )}

                      {
                        device
                          .status
                      }
                    </span>
                  </td>

                  <td>
                    <div className="device-user">
                      <strong>
                        {device.assignedUser
                        ??
                        'Sin asignar'}
                      </strong>

                      <span>
                        {device.department
                        ??
                        'Sin departamento'}
                      </span>
                    </div>
                  </td>

                  <td>
                    <span
                      className={
                        `device-compliance device-compliance--${device.complianceStatus.toLowerCase()}`
                      }
                    >
                      {
                        device
                          .complianceStatus
                      }
                    </span>
                  </td>

                  <td>
                    <div className="device-battery">
                      <Battery
                        size={16}
                      />

                      <span>
                        {device.batteryLevel !==
                        null
                          ? `${device.batteryLevel}%`
                          : 'N/D'}
                      </span>
                    </div>
                  </td>

                  <td>
                    {formatDeviceDateTime(
                      device.lastSeenAtUtc,
                      'Sin comunicación',
                    )}
                  </td>
                </tr>
              ),
            )
          )}
        </tbody>
      </table>
    </div>
  )
}