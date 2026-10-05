import {
  authFetch,
  titanFetch,
} from './api'

export type PunchRow = {
  id?: number | string
  codigo?: string
  nombre?: string | null
  departamento?: string | null
  entrada?: string | null
  salida?: string | null
  dispositivo_origen?: string | null
}

export type DeviceHealthItem = {
  name: string
  online: boolean
  latencyMs: number | null
  punchesToday: number
}

export type DashboardSnapshot = {
  generatedAt: string

  serviceOnline: boolean
  databaseOnline: boolean

  punchesToday: number
  punchesYesterday: number

  employeesToday: number
  employeesYesterday: number

  entriesToday: number
  exitsToday: number

  openShifts: number

  devicesTotal: number
  devicesOnline: number
  devicesOffline: number

  byDevice: Array<{
    name: string
    total: number
  }>

  byDepartment: Array<{
    name: string
    total: number
  }>

  byHour: Array<{
    hour: number
    total: number
  }>

  byDay: Array<{
    day: string
    total: number
  }>

  recentPunches: PunchRow[]

  activity: Array<{
    timestamp: string
    actor: string
    action: string
    target: string
  }>

  healthItems: DeviceHealthItem[]

  warnings: string[]
}

type UnknownRecord =
  Record<string, unknown>

function object(
  value: unknown,
): UnknownRecord {
  return (
    value &&
    typeof value ===
      'object' &&
    !Array.isArray(value)
  )
    ? value as UnknownRecord
    : {}
}

function array(
  value: unknown,
): unknown[] {
  return Array.isArray(
    value,
  )
    ? value
    : []
}

function numberValue(
  value: unknown,
  fallback = 0,
): number {
  if (
    typeof value ===
      'number' &&
    Number.isFinite(value)
  ) {
    return value
  }

  const parsed =
    Number(value)

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : fallback
}

function stringValue(
  value: unknown,
  fallback = '',
): string {
  return typeof value ===
    'string'
    ? value
    : fallback
}

function booleanValue(
  value: unknown,
  fallback = false,
): boolean {
  if (
    typeof value ===
    'boolean'
  ) {
    return value
  }

  if (
    typeof value ===
    'string'
  ) {
    const normalized =
      value
        .trim()
        .toLowerCase()

    if (
      [
        'true',
        'online',
        'healthy',
        'ok',
        'available',
      ].includes(
        normalized,
      )
    ) {
      return true
    }

    if (
      [
        'false',
        'offline',
        'down',
        'error',
        'unavailable',
      ].includes(
        normalized,
      )
    ) {
      return false
    }
  }

  return fallback
}

async function safeJson(
  response: Response,
): Promise<unknown> {
  const text =
    await response.text()

  if (
    !text.trim()
  ) {
    return {}
  }

  try {
    return JSON.parse(
      text,
    )
  } catch {
    return {}
  }
}

function normalizeHealth(
  raw: unknown,
): {
  total: number
  online: number
  offline: number
  items: DeviceHealthItem[]
} {
  const root =
    object(raw)

  const rawItems =
    array(
      root.items ??
      root.devices ??
      root.relojes,
    )

  const items =
    rawItems.map(
      item => {
        const row =
          object(item)

        return {
          name:
            stringValue(
              row.name ??
              row.nombre ??
              row.device_name ??
              row.alias,
              'Reloj',
            ),

          online:
            booleanValue(
              row.online ??
              row.is_online ??
              row.connected ??
              row.status,
            ),

          latencyMs:
            row.latency_ms == null &&
            row.latencyMs == null
              ? null
              : numberValue(
                  row.latency_ms ??
                  row.latencyMs,
                ),

          punchesToday:
            numberValue(
              row.punches_today ??
              row.punchesToday ??
              row.ponches_hoy,
            ),
        }
      },
    )

  const total =
    numberValue(
      root.total,
      items.length,
    )

  const online =
    numberValue(
      root.online,
      items.filter(
        item =>
          item.online,
      ).length,
    )

  return {
    total,
    online,

    offline:
      numberValue(
        root.offline,
        Math.max(
          0,
          total - online,
        ),
      ),

    items,
  }
}

function normalizeDashboard(
  raw: unknown,
  healthRaw: unknown,
  serviceOnline: boolean,
): DashboardSnapshot {
  const root =
    object(raw)

  const summary =
    object(
      root.summary,
    )

  const overview =
    object(
      root.overview,
    )

  const today =
    object(
      overview.today ??
      root.today,
    )

  const yesterday =
    object(
      overview.yesterday ??
      root.yesterday,
    )

  const stats =
    object(
      root.stats,
    )

  const database =
    object(
      summary.database ??
      root.database,
    )

  const health =
    normalizeHealth(
      healthRaw,
    )

  const byDevice =
    array(
      stats.by_device ??
      root.by_device,
    ).map(
      item => {
        const row =
          object(item)

        return {
          name:
            stringValue(
              row.name ??
              row.device ??
              row.dispositivo,
              'Sin identificar',
            ),

          total:
            numberValue(
              row.total ??
              row.count,
            ),
        }
      },
    )

  const byDepartment =
    array(
      overview.by_dept ??
      root.by_department ??
      root.by_dept,
    ).map(
      item => {
        const row =
          object(item)

        return {
          name:
            stringValue(
              row.depto ??
              row.department ??
              row.name,
              'Sin departamento',
            ),

          total:
            numberValue(
              row.total ??
              row.count,
            ),
        }
      },
    )

  const byHour =
    array(
      stats.by_hour ??
      root.by_hour,
    ).map(
      item => {
        const row =
          object(item)

        return {
          hour:
            numberValue(
              row.hora ??
              row.hour,
            ),

          total:
            numberValue(
              row.total ??
              row.count,
            ),
        }
      },
    )

  const byDay =
    array(
      stats.by_day ??
      root.by_day,
    ).map(
      item => {
        const row =
          object(item)

        return {
          day:
            stringValue(
              row.dia ??
              row.day,
              '—',
            ),

          total:
            numberValue(
              row.total ??
              row.count,
            ),
        }
      },
    )

  const recentPunches =
    array(
      root.recent ??
      root.recent_punches,
    ).map(
      item => {
        const row =
          object(item)

        return {
          id:
            (
              row.id as
                string |
                number |
                undefined
            ),

          codigo:
            stringValue(
              row.codigo ??
              row.code,
            ),

          nombre:
            stringValue(
              row.nombre ??
              row.name,
            ) || null,

          departamento:
            stringValue(
              row.departamento ??
              row.department,
            ) || null,

          entrada:
            stringValue(
              row.entrada ??
              row.entry,
            ) || null,

          salida:
            stringValue(
              row.salida ??
              row.exit,
            ) || null,

          dispositivo_origen:
            stringValue(
              row.dispositivo_origen ??
              row.device,
            ) || null,
        }
      },
    )

  const activity =
    array(
      stats.activity ??
      root.activity,
    ).map(
      item => {
        const row =
          object(item)

        return {
          timestamp:
            stringValue(
              row.timestamp,
            ),

          actor:
            stringValue(
              row.actor,
              'Sistema',
            ),

          action:
            stringValue(
              row.action,
            ),

          target:
            stringValue(
              row.target,
            ),
        }
      },
    )

  const databaseOnline =
    booleanValue(
      overview.sql_online ??
      root.sql_online ??
      database.status,
      serviceOnline,
    )

  const warnings: string[] =
    []

  if (
    !serviceOnline
  ) {
    warnings.push(
      'El servicio interno de Ponches no respondió correctamente.',
    )
  }

  if (
    !databaseOnline
  ) {
    warnings.push(
      'La conexión con BioTime/SQL requiere revisión.',
    )
  }

  if (
    health.offline > 0
  ) {
    warnings.push(
      `${health.offline} reloj(es) biométrico(s) aparecen fuera de línea.`,
    )
  }

  const openShifts =
    numberValue(
      today.sin_salida ??
      root.open_shifts ??
      array(
        overview.open_shifts,
      ).length,
    )

  if (
    openShifts > 0
  ) {
    warnings.push(
      `${openShifts} colaborador(es) tienen un turno abierto o sin salida registrada.`,
    )
  }

  return {
    generatedAt:
      stringValue(
        root.timestamp ??
        root.generated_at,
        new Date()
          .toISOString(),
      ),

    serviceOnline,
    databaseOnline,

    punchesToday:
      numberValue(
        today.total ??
        summary.total_hoy ??
        root.punches_today,
      ),

    punchesYesterday:
      numberValue(
        yesterday.total ??
        root.punches_yesterday,
      ),

    employeesToday:
      numberValue(
        today.empleados ??
        summary.empleados_hoy ??
        root.employees_today,
      ),

    employeesYesterday:
      numberValue(
        yesterday.empleados ??
        root.employees_yesterday,
      ),

    entriesToday:
      numberValue(
        summary.con_entrada ??
        root.entries_today,
      ),

    exitsToday:
      numberValue(
        summary.con_salida ??
        root.exits_today,
      ),

    openShifts,

    devicesTotal:
      health.total,

    devicesOnline:
      health.online,

    devicesOffline:
      health.offline,

    byDevice,
    byDepartment,
    byHour,
    byDay,
    recentPunches,
    activity,

    healthItems:
      health.items,

    warnings,
  }
}

async function loadLegacyDashboard():
  Promise<unknown> {
  const combined =
    await authFetch(
      '/api/records/dashboard-combined',
    )

  if (
    combined.ok
  ) {
    return safeJson(
      combined,
    )
  }

  const [
    summary,
    stats,
    overview,
    recent,
  ] =
    await Promise.all([
      authFetch(
        '/api/records/summary',
      ),

      authFetch(
        '/api/records/stats',
      ),

      authFetch(
        '/api/records/ops-overview',
      ),

      authFetch(
        '/api/records/recent?limit=10',
      ),
    ])

  const recentData =
    recent.ok
      ? object(
          await safeJson(
            recent,
          ),
        )
      : {}

  return {
    summary:
      summary.ok
        ? await safeJson(
            summary,
          )
        : {},

    stats:
      stats.ok
        ? await safeJson(
            stats,
          )
        : {},

    overview:
      overview.ok
        ? await safeJson(
            overview,
          )
        : {},

    recent:
      recentData.items ??
      [],
  }
}

export async function loadDashboardSnapshot(
  signal?: AbortSignal,
): Promise<DashboardSnapshot> {
  let serviceOnline =
    false

  let dashboardRaw:
    unknown = {}

  let healthRaw:
    unknown = {}

  /*
   * Primero usamos únicamente
   * contratos TitanMDM estables.
   */
  try {
    const [
      health,
      dashboard,
      deviceHealth,
    ] =
      await Promise.all([
        titanFetch(
          '/api/ponches/health',
          {
            signal,
          },
        ),

        titanFetch(
          '/api/ponches/dashboard',
          {
            signal,
          },
        ),

        titanFetch(
          '/api/ponches/device-health',
          {
            signal,
          },
        ),
      ])

    serviceOnline =
      health.ok

    if (
      dashboard.ok
    ) {
      dashboardRaw =
        await safeJson(
          dashboard,
        )
    }

    if (
      deviceHealth.ok
    ) {
      healthRaw =
        await safeJson(
          deviceHealth,
        )
    }

    if (
      dashboard.ok
    ) {
      return normalizeDashboard(
        dashboardRaw,
        healthRaw,
        serviceOnline,
      )
    }
  } catch {
    /*
     * Entramos al fallback temporal.
     */
  }

  /*
   * Compatibilidad F1/F1.5.
   *
   * Se eliminará cuando F3-F9
   * dejen completamente el API legacy.
   */
  dashboardRaw =
    await loadLegacyDashboard()

  try {
    const health =
      await authFetch(
        '/api/records/device-health',
        {
          signal,
        },
      )

    if (
      health.ok
    ) {
      healthRaw =
        await safeJson(
          health,
        )
    }
  } catch {
    healthRaw =
      {}
  }

  return normalizeDashboard(
    dashboardRaw,
    healthRaw,
    true,
  )
}