import {
  Activity,
  AppWindow,
  Boxes,
  CheckCircle2,
  Cpu,
  HardDrive,
  Layers3,
  LockKeyhole,
  Network,
  Power,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UsersRound,
  Wifi,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  deviceCommandsApi,
  type DeviceCommand,
} from '../../../api/deviceCommandsApi'

import {
  devicesApi,
} from '../../../api/devicesApi'

import type {
  DeviceOperationalSnapshot,
} from '../../../types/device'

import './DeviceOperationalPanel.css'

interface Props {
  deviceId: string
}

const INVENTORY_COMMANDS = [
  'DEVICE_INVENTORY',
  'APP_INVENTORY',
  'NETWORK_INFO',
  'SECURITY_STATUS',
  'COMPLIANCE_CHECK',
  'WINDOWS_UPDATE_STATUS',
] as const

const LABELS: Record<string, string> = {
  DEVICE_INFO:
    'Información del dispositivo',

  DEVICE_INVENTORY:
    'Hardware e inventario',

  APP_INVENTORY:
    'Aplicaciones instaladas',

  PROCESS_INVENTORY:
    'Procesos',

  SERVICE_INVENTORY:
    'Servicios',

  NETWORK_INFO:
    'Red',

  SECURITY_STATUS:
    'Seguridad',

  COMPLIANCE_CHECK:
    'Cumplimiento',

  WINDOWS_UPDATE_STATUS:
    'Windows Update',
}

function parseJson(
  value: string | null,
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

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return 'N/D'
  }

  return new Date(
    value,
  ).toLocaleString()
}

function isTerminal(
  status: string,
): boolean {
  return [
    'Success',
    'Failed',
    'Timeout',
    'Cancelled',
  ].includes(status)
}

async function waitForCommand(
  command: DeviceCommand,
): Promise<DeviceCommand> {
  let current =
    command

  for (
    let attempt = 0;
    attempt < 30;
    attempt++
  ) {
    if (
      isTerminal(
        current.status,
      )
    ) {
      return current
    }

    await new Promise(
      resolve =>
        window.setTimeout(
          resolve,
          2000,
        ),
    )

    current =
      await deviceCommandsApi
        .getById(
          current.id,
        )
  }

  return current
}

function calculateHealth(
  snapshot:
    DeviceOperationalSnapshot,
) {
  let score = 0

  const checks: {
    label: string
    ok: boolean
    value: string
  }[] = []

  /*
   * Administración
   * 25 puntos
   */
  const managed =
    snapshot.device
      .isManaged

  score +=
    managed
      ? 25
      : 0

  checks.push({
    label:
      'Administración',

    ok:
      managed,

    value:
      managed
        ? 'Administrado'
        : 'No administrado',
  })

  /*
   * Cumplimiento
   * 25 puntos
   */
  const compliance =
    snapshot.device
      .complianceStatus

  const compliant =
    compliance ===
    'Compliant'

  const unknownCompliance =
    compliance ===
    'Unknown'

  score +=
    compliant
      ? 25
      : unknownCompliance
        ? 10
        : 0

  checks.push({
    label:
      'Cumplimiento',

    ok:
      compliant,

    value:
      compliance,
  })

  /*
   * Agente
   * 20 puntos
   */
  const agent =
    Boolean(
      snapshot.device
        .agentVersion,
    )
    ||
    Boolean(
      snapshot.security
        ?.agentInstalled,
    )

  score +=
    agent
      ? 20
      : 0

  checks.push({
    label:
      'Agente',

    ok:
      agent,

    value:
      snapshot.device
        .agentVersion
      ??
      snapshot.security
        ?.agentVersionName
      ??
      'No detectado',
  })

  /*
   * Telemetría
   * 15 puntos
   */
  const lastSeen =
    snapshot.device
      .lastSeenAtUtc
      ? new Date(
          snapshot.device
            .lastSeenAtUtc,
        )
      : null

  const recent =
    lastSeen !== null
    &&
    Date.now() -
      lastSeen.getTime()
      <
      24 *
        60 *
        60 *
        1000

  score +=
    recent
      ? 15
      : 0

  checks.push({
    label:
      'Telemetría',

    ok:
      recent,

    value:
      formatDate(
        snapshot.device
          .lastSeenAtUtc,
      ),
  })

  /*
   * Seguridad
   * 15 puntos
   */
  const securityScore =
    snapshot.security
      ?.complianceScore

  if (
    securityScore !==
    undefined
  ) {
    const normalizedSecurity =
      Math.max(
        0,
        Math.min(
          100,
          securityScore,
        ),
      )

    score +=
      Math.round(
        normalizedSecurity *
        0.15,
      )
  } else {
    /*
     * No castigamos excesivamente
     * un equipo que todavía no ha
     * sido evaluado.
     */
    score += 7
  }

  checks.push({
    label:
      'Seguridad',

    ok:
      securityScore !==
        undefined
        ? securityScore >=
          70
        : true,

    value:
      securityScore !==
        undefined
        ? `${securityScore}/100`
        : 'Sin evaluación',
  })

  /*
   * La conectividad se muestra como
   * indicador operacional, pero no
   * modifica el Health Score.
   *
   * Un equipo apagado no equivale
   * necesariamente a un equipo enfermo.
   */
  const online =
    snapshot.device
      .status ===
      'Online'

  checks.push({
    label:
      'Conectividad',

    ok:
      online,

    value:
      snapshot.device
        .status,
  })

  return {
    score:
      Math.max(
        0,
        Math.min(
          100,
          score,
        ),
      ),

    checks,
  }
}

function JsonPreview({
  value,
}: {
  value: unknown
}) {
  if (
    value === null
    ||
    value === undefined
  ) {
    return (
      <div className="device-op-empty">
        Sin datos.
      </div>
    )
  }

  if (
    typeof value ===
    'string'
  ) {
    return (
      <pre className="device-op-json">
        {value}
      </pre>
    )
  }

  return (
    <pre className="device-op-json">
      {JSON.stringify(
        value,
        null,
        2,
      )}
    </pre>
  )
}

export function DeviceOperationalPanel({
  deviceId,
}: Props) {
  const [
    snapshot,
    setSnapshot,
  ] =
    useState<
      DeviceOperationalSnapshot | null
    >(null)

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    working,
    setWorking,
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
    error,
    setError,
  ] =
    useState<
      string | null
    >(null)

  const load =
    useCallback(
      async () => {
        try {
          setLoading(true)

          const data =
            await devicesApi
              .getOperationalSnapshot(
                deviceId,
              )

          setSnapshot(
            data,
          )

          setError(
            null,
          )
        } catch {
          setError(
            'No fue posible cargar el snapshot operacional.',
          )
        } finally {
          setLoading(
            false,
          )
        }
      },
      [
        deviceId,
      ],
    )

  useEffect(
    () => {
      void load()
    },
    [
      load,
    ],
  )

  const health =
    useMemo(
      () =>
        snapshot
          ? calculateHealth(
              snapshot,
            )
          : null,
      [
        snapshot,
      ],
    )

  async function execute(
    commandType: string,
  ) {
    if (working) {
      return
    }

    try {
      setWorking(
        commandType,
      )

      setError(
        null,
      )

      setMessage(
        null,
      )

      const command =
        await deviceCommandsApi
          .create({
            deviceId,
            commandType,
            payloadJson:
              '{}',
            expirationMinutes:
              30,
          })

      const result =
        await waitForCommand(
          command,
        )

      if (
        result.status ===
        'Success'
      ) {
        setMessage(
          `${commandType} completado correctamente.`,
        )
      } else {
        setError(
          result.errorMessage
          ??
          `${commandType} terminó con estado ${result.status}.`,
        )
      }

      await load()
    } catch {
      setError(
        `No fue posible ejecutar ${commandType}.`,
      )
    } finally {
      setWorking(
        null,
      )
    }
  }

  async function fullRefresh() {
    if (
      working
      ||
      !snapshot
    ) {
      return
    }

    if (
      snapshot.device
        .platform !==
      'Windows'
    ) {
      await execute(
        'DEVICE_INFO',
      )

      return
    }

    try {
      setWorking(
        'FULL_REFRESH',
      )

      setError(
        null,
      )

      setMessage(
        'Solicitando inventario completo...',
      )

      const commands =
        await Promise.all(
          INVENTORY_COMMANDS.map(
            commandType =>
              deviceCommandsApi
                .create({
                  deviceId,
                  commandType,
                  payloadJson:
                    '{}',
                  expirationMinutes:
                    30,
                }),
          ),
        )

      await Promise.all(
        commands.map(
          command =>
            waitForCommand(
              command,
            ),
        ),
      )

      await load()

      setMessage(
        'Inventario actualizado.',
      )
    } catch {
      setError(
        'No fue posible completar el refresh integral.',
      )
    } finally {
      setWorking(
        null,
      )
    }
  }

  async function destructiveAction(
    commandType: string,
    label: string,
  ) {
    const confirmed =
      window.confirm(
        `${label}\n\n¿Deseas continuar?`,
      )

    if (!confirmed) {
      return
    }

    await execute(
      commandType,
    )
  }

  if (
    loading
    &&
    !snapshot
  ) {
    return (
      <section className="device-op-loading">
        <RefreshCw
          size={20}
          className="device-detail-spin"
        />

        Cargando información operacional...
      </section>
    )
  }

  if (!snapshot) {
    return (
      <section className="device-op-error">
        {error ??
          'Snapshot no disponible.'}
      </section>
    )
  }

  const windows =
    snapshot.device
      .platform ===
    'Windows'

  return (
    <section className="device-op">
      <div className="device-op-toolbar">
        <div>
          <span>
            DEVICE OPERATIONS
          </span>

          <strong>
            Inventario y salud
          </strong>

          <small>
            Último inventario:{' '}
            {formatDate(
              snapshot
                .lastInventoryAtUtc,
            )}
          </small>
        </div>

        <div className="device-op-actions">
          <button
            type="button"
            className="device-op-primary"
            disabled={
              Boolean(
                working,
              )
            }
            onClick={() =>
              void fullRefresh()
            }
          >
            <RefreshCw
              size={15}
              className={
                working ===
                'FULL_REFRESH'
                  ? 'device-detail-spin'
                  : ''
              }
            />

            {working ===
            'FULL_REFRESH'
              ? 'Actualizando...'
              : 'Actualizar inventario'}
          </button>

          {windows && (
            <>
              <button
                type="button"
                disabled={
                  Boolean(
                    working,
                  )
                }
                onClick={() =>
                  void destructiveAction(
                    'LOCK_DEVICE',
                    'Bloquear dispositivo',
                  )
                }
              >
                <LockKeyhole
                  size={15}
                />

                Bloquear
              </button>

              <button
                type="button"
                disabled={
                  Boolean(
                    working,
                  )
                }
                onClick={() =>
                  void destructiveAction(
                    'RESTART_DEVICE',
                    'Reiniciar dispositivo',
                  )
                }
              >
                <RotateCcw
                  size={15}
                />

                Reiniciar
              </button>

              <button
                type="button"
                className="device-op-danger"
                disabled={
                  Boolean(
                    working,
                  )
                }
                onClick={() =>
                  void destructiveAction(
                    'SHUTDOWN_DEVICE',
                    'Apagar dispositivo',
                  )
                }
              >
                <Power
                  size={15}
                />

                Apagar
              </button>
            </>
          )}
        </div>
      </div>

      {message && (
        <div className="device-op-notice success">
          <CheckCircle2
            size={16}
          />

          {message}
        </div>
      )}

      {error && (
        <div className="device-op-notice error">
          {error}
        </div>
      )}

      <div className="device-op-health-layout">
        <article className="device-op-health">
          <div className="device-op-health-score">
            <strong>
              {health?.score ??
                0}
            </strong>

            <span>
              /100
            </span>
          </div>

          <div>
            <span>
              DEVICE HEALTH
            </span>

            <h3>
              Salud del endpoint
            </h3>

            <p>
              Score calculado con administración,
              conectividad, cumplimiento,
              agente, telemetría y seguridad.
            </p>
          </div>
        </article>

        <div className="device-op-health-checks">
          {health?.checks.map(
            check => (
              <div
                key={
                  check.label
                }
                className={
                  check.ok
                    ? 'good'
                    : 'warning'
                }
              >
                <span>
                  {check.label}
                </span>

                <strong>
                  {check.value}
                </strong>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="device-op-summary">
        <article>
          <Activity
            size={18}
          />

          <span>
            Estado
          </span>

          <strong>
            {snapshot.device.status}
          </strong>
        </article>

        <article>
          <ShieldCheck
            size={18}
          />

          <span>
            Cumplimiento
          </span>

          <strong>
            {snapshot.device
              .complianceStatus}
          </strong>
        </article>

        <article>
          <UsersRound
            size={18}
          />

          <span>
            Grupos
          </span>

          <strong>
            {snapshot.groups.length}
          </strong>
        </article>

        <article>
          <Wifi
            size={18}
          />

          <span>
            IP
          </span>

          <strong>
            {snapshot.device
              .ipAddress
            ??
            'N/D'}
          </strong>
        </article>
      </div>

      <article className="device-op-card">
        <header>
          <Layers3
            size={17}
          />

          <div>
            <strong>
              Grupos
            </strong>

            <span>
              Membresía del dispositivo
            </span>
          </div>
        </header>

        <div className="device-op-groups">
          {snapshot.groups.length ===
          0 ? (
            <span>
              No pertenece a ningún grupo.
            </span>
          ) : (
            snapshot.groups.map(
              group => (
                <div
                  key={group.id}
                >
                  <strong>
                    {group.name}
                  </strong>

                  <span>
                    {group.isDynamic
                      ? 'Dinámico'
                      : 'Estático'}
                    {' · '}
                    {group.source}
                  </span>
                </div>
              ),
            )
          )}
        </div>
      </article>

      {windows && (
        <div className="device-op-inventory-grid">
          {[
            [
              'DEVICE_INVENTORY',
              Cpu,
            ],
            [
              'APP_INVENTORY',
              AppWindow,
            ],
            [
              'NETWORK_INFO',
              Network,
            ],
            [
              'SECURITY_STATUS',
              ShieldCheck,
            ],
            [
              'COMPLIANCE_CHECK',
              CheckCircle2,
            ],
            [
              'WINDOWS_UPDATE_STATUS',
              HardDrive,
            ],
          ].map(
            ([
              commandType,
              Icon,
            ]) => {
              const result =
                snapshot
                  .latestResults[
                  commandType as string
                ]

              return (
                <article
                  className="device-op-card"
                  key={
                    commandType as string
                  }
                >
                  <header>
                    <Icon
                      size={17}
                    />

                    <div>
                      <strong>
                        {LABELS[
                          commandType as string
                        ]}
                      </strong>

                      <span>
                        {result
                          ? formatDate(
                              result.completedAtUtc
                              ??
                              result.createdAtUtc,
                            )
                          : 'Sin snapshot'}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={
                        Boolean(
                          working,
                        )
                      }
                      onClick={() =>
                        void execute(
                          commandType as string,
                        )
                      }
                    >
                      <RefreshCw
                        size={14}
                      />
                    </button>
                  </header>

                  <JsonPreview
                    value={
                      parseJson(
                        result
                          ?.resultJson
                        ??
                        null,
                      )
                    }
                  />
                </article>
              )
            },
          )}
        </div>
      )}

      {!windows && (
        <article className="device-op-card">
          <header>
            <Boxes
              size={17}
            />

            <div>
              <strong>
                Android Enterprise
              </strong>

              <span>
                El detalle AMAPI permanece disponible
                en las pestañas Android del dispositivo.
              </span>
            </div>
          </header>
        </article>
      )}
    </section>
  )
}