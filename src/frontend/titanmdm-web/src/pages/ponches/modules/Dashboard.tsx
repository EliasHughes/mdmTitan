import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  LogIn,
  LogOut,
  MonitorSmartphone,
  Pause,
  Radio,
  RefreshCw,
  Search,
  Server,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react'

import {
  useSearchParams,
} from 'react-router-dom'

import {
  loadDashboardSnapshot,
  type DashboardSnapshot,
} from '../lib/dashboardApi'

import {
  Btn,
  PageHeader,
} from '../ui/kit'

type CardProps = {
  label: string
  value: string | number
  subtitle: string
  icon: React.ReactNode
  tone?:
    | 'default'
    | 'green'
    | 'amber'
    | 'red'
    | 'blue'
}

function MetricCard({
  label,
  value,
  subtitle,
  icon,
  tone = 'default',
}: CardProps) {
  const tones = {
    default:
      'bg-white border-zinc-200',

    green:
      'bg-emerald-50/50 border-emerald-100',

    amber:
      'bg-amber-50/60 border-amber-100',

    red:
      'bg-rose-50/60 border-rose-100',

    blue:
      'bg-sky-50/60 border-sky-100',
  }

  return (
    <article
      className={
        `rounded-2xl border p-4 shadow-sm ${tones[tone]}`
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
            {label}
          </p>

          <p className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
            {value}
          </p>

          <p className="mt-1 text-xs text-zinc-500">
            {subtitle}
          </p>
        </div>

        <div className="rounded-xl bg-white p-2.5 text-[#c8102e] shadow-sm ring-1 ring-black/5">
          {icon}
        </div>
      </div>
    </article>
  )
}

function percentChange(
  current: number,
  previous: number,
) {
  if (
    previous <= 0
  ) {
    return null
  }

  return Math.round(
    (
      (current - previous) /
      previous
    ) * 100,
  )
}

function formatTime(
  value?: string | null,
) {
  if (
    !value
  ) {
    return '—'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value
  }

  return date
    .toLocaleString()
}

export default function Dashboard() {
  const [
    ,
    setSearchParams,
  ] =
    useSearchParams()

  const [
    snapshot,
    setSnapshot,
  ] =
    useState<DashboardSnapshot | null>(
      null,
    )

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false)

  const [
    autoRefresh,
    setAutoRefresh,
  ] =
    useState(true)

  const [
    error,
    setError,
  ] =
    useState('')

  const [
    search,
    setSearch,
  ] =
    useState('')

  const open =
    useCallback(
      (
        section: string,
      ) => {
        setSearchParams({
          section,
        })
      },
      [
        setSearchParams,
      ],
    )

  const load =
    useCallback(
      async (
        initial = false,
      ) => {
        if (
          initial
        ) {
          setLoading(
            true,
          )
        } else {
          setRefreshing(
            true,
          )
        }

        setError('')

        try {
          const result =
            await loadDashboardSnapshot()

          setSnapshot(
            result,
          )
        } catch (
          exception
        ) {
          console.error(
            exception,
          )

          setError(
            'No fue posible actualizar el Centro Operativo de Ponches.',
          )
        } finally {
          setLoading(
            false,
          )

          setRefreshing(
            false,
          )
        }
      },
      [],
    )

  useEffect(
    () => {
      void load(true)
    },
    [
      load,
    ],
  )

  useEffect(
    () => {
      if (
        !autoRefresh
      ) {
        return
      }

      const interval =
        window.setInterval(
          () => {
            void load()
          },
          30_000,
        )

      return () =>
        window.clearInterval(
          interval,
        )
    },
    [
      autoRefresh,
      load,
    ],
  )

  const onlinePercent =
    snapshot &&
    snapshot.devicesTotal >
      0
      ? Math.round(
          (
            snapshot.devicesOnline /
            snapshot.devicesTotal
          ) *
            100,
        )
      : 0

  const attendanceDelta =
    snapshot
      ? percentChange(
          snapshot.punchesToday,
          snapshot.punchesYesterday,
        )
      : null

  const employeeDelta =
    snapshot
      ? percentChange(
          snapshot.employeesToday,
          snapshot.employeesYesterday,
        )
      : null

  const peakHour =
    useMemo(
      () => {
        const rows =
          snapshot?.byHour ??
          []

        if (
          rows.length === 0
        ) {
          return null
        }

        return [
          ...rows,
        ].sort(
          (
            a,
            b,
          ) =>
            b.total -
            a.total,
        )[0]
      },
      [
        snapshot,
      ],
    )

  const maxHour =
    Math.max(
      1,
      ...(
        snapshot?.byHour ??
        []
      ).map(
        item =>
          item.total,
      ),
    )

  const maxDepartment =
    Math.max(
      1,
      ...(
        snapshot?.byDepartment ??
        []
      ).map(
        item =>
          item.total,
      ),
    )

  const filteredPunches =
    useMemo(
      () => {
        const term =
          search
            .trim()
            .toLowerCase()

        if (
          !term
        ) {
          return (
            snapshot?.recentPunches ??
            []
          )
        }

        return (
          snapshot?.recentPunches ??
          []
        ).filter(
          item =>
            [
              item.codigo,
              item.nombre,
              item.departamento,
              item.dispositivo_origen,
            ]
              .filter(
                Boolean,
              )
              .some(
                value =>
                  String(
                    value,
                  )
                    .toLowerCase()
                    .includes(
                      term,
                    ),
              ),
        )
      },
      [
        snapshot,
        search,
      ],
    )

  if (
    loading
  ) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <RefreshCw
          size={34}
          className="animate-spin text-[#c8102e]"
        />

        <div className="text-center">
          <p className="font-semibold text-zinc-800">
            Preparando Centro Operativo
          </p>

          <p className="mt-1 text-sm text-zinc-500">
            Consultando BioTime, relojes y actividad reciente.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        kicker="Ponches · Centro Operativo"
        title="Resumen General"
        subtitle={
          snapshot
            ? `Última actualización: ${formatTime(
                snapshot.generatedAt,
              )}`
            : 'Información operacional del módulo biométrico.'
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Btn
              tone="ghost"
              onClick={() =>
                setAutoRefresh(
                  value =>
                    !value,
                )
              }
            >
              {autoRefresh
                ? (
                  <Radio
                    size={16}
                  />
                )
                : (
                  <Pause
                    size={16}
                  />
                )}

              {autoRefresh
                ? 'En vivo'
                : 'Pausado'}
            </Btn>

            <Btn
              tone="primary"
              disabled={
                refreshing
              }
              onClick={() =>
                void load()
              }
            >
              <RefreshCw
                size={16}
                className={
                  refreshing
                    ? 'animate-spin'
                    : ''
                }
              />

              Actualizar
            </Btn>
          </div>
        }
      />

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle
            size={18}
          />

          {error}
        </div>
      )}

      {snapshot &&
        snapshot.warnings.length >
          0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold text-amber-900">
              <AlertTriangle
                size={18}
              />

              Atención operativa
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              {snapshot.warnings.map(
                warning => (
                  <div
                    key={
                      warning
                    }
                    className="rounded-xl bg-white px-3 py-2 text-sm text-zinc-700 ring-1 ring-amber-100"
                  >
                    {warning}
                  </div>
                ),
              )}
            </div>
          </section>
        )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Ponches hoy"
          value={
            snapshot?.punchesToday ??
            0
          }
          subtitle={
            attendanceDelta == null
              ? 'Sin referencia anterior'
              : `${attendanceDelta >= 0 ? '+' : ''}${attendanceDelta}% vs ayer`
          }
          icon={
            attendanceDelta != null &&
            attendanceDelta <
              0
              ? (
                <ArrowDownRight
                  size={20}
                />
              )
              : (
                <ArrowUpRight
                  size={20}
                />
              )
          }
          tone="blue"
        />

        <MetricCard
          label="Colaboradores"
          value={
            snapshot?.employeesToday ??
            0
          }
          subtitle={
            employeeDelta == null
              ? 'Personas registradas hoy'
              : `${employeeDelta >= 0 ? '+' : ''}${employeeDelta}% vs ayer`
          }
          icon={
            <Users
              size={20}
            />
          }
        />

        <MetricCard
          label="Entradas"
          value={
            snapshot?.entriesToday ??
            0
          }
          subtitle="Entradas registradas"
          icon={
            <LogIn
              size={20}
            />
          }
          tone="green"
        />

        <MetricCard
          label="Salidas"
          value={
            snapshot?.exitsToday ??
            0
          }
          subtitle="Salidas registradas"
          icon={
            <LogOut
              size={20}
            />
          }
        />

        <MetricCard
          label="Turnos abiertos"
          value={
            snapshot?.openShifts ??
            0
          }
          subtitle="Sin salida o pendientes"
          icon={
            <Clock3
              size={20}
            />
          }
          tone={
            (
              snapshot?.openShifts ??
              0
            ) >
            0
              ? 'amber'
              : 'green'
          }
        />

        <MetricCard
          label="Relojes online"
          value={
            snapshot?.devicesOnline ??
            0
          }
          subtitle={`${onlinePercent}% disponible`}
          icon={
            <Wifi
              size={20}
            />
          }
          tone="green"
        />

        <MetricCard
          label="Relojes offline"
          value={
            snapshot?.devicesOffline ??
            0
          }
          subtitle={`de ${snapshot?.devicesTotal ?? 0} configurados`}
          icon={
            <WifiOff
              size={20}
            />
          }
          tone={
            (
              snapshot?.devicesOffline ??
              0
            ) >
            0
              ? 'red'
              : 'default'
          }
        />

        <MetricCard
          label="Hora pico"
          value={
            peakHour
              ? `${String(
                  peakHour.hour,
                ).padStart(
                  2,
                  '0',
                )}:00`
              : '—'
          }
          subtitle={
            peakHour
              ? `${peakHour.total} registros`
              : 'Sin datos suficientes'
          }
          icon={
            <Gauge
              size={20}
            />
          }
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_.8fr]">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-zinc-900">
                Actividad por hora
              </h2>

              <p className="text-sm text-zinc-500">
                Distribución de ponches durante el día.
              </p>
            </div>

            <Activity className="text-[#c8102e]" />
          </div>

          <div className="flex h-52 items-end gap-2">
            {(
              snapshot?.byHour ??
              []
            ).length ===
            0 ? (
              <div className="flex h-full w-full items-center justify-center text-sm text-zinc-400">
                Todavía no hay actividad suficiente.
              </div>
            ) : (
              snapshot?.byHour.map(
                item => (
                  <div
                    key={
                      item.hour
                    }
                    className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
                  >
                    <span className="text-[10px] font-semibold text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100">
                      {item.total}
                    </span>

                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-[#991b2f] to-[#e11d48] transition-all hover:brightness-110"
                      style={{
                        height:
                          `${Math.max(
                            5,
                            (
                              item.total /
                              maxHour
                            ) *
                              145,
                          )}px`,
                      }}
                    />

                    <span className="text-[10px] text-zinc-500">
                      {String(
                        item.hour,
                      ).padStart(
                        2,
                        '0',
                      )}
                    </span>
                  </div>
                ),
              )
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <Server className="text-[#c8102e]" />

            <div>
              <h2 className="font-semibold">
                Salud del servicio
              </h2>

              <p className="text-sm text-zinc-500">
                TitanMDM ↔ Python ↔ BioTime
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <StatusRow
              label="Gateway Python"
              online={
                snapshot?.serviceOnline ??
                false
              }
              icon={
                <Server
                  size={17}
                />
              }
            />

            <StatusRow
              label="Base de datos BioTime"
              online={
                snapshot?.databaseOnline ??
                false
              }
              icon={
                <Database
                  size={17}
                />
              }
            />

            <StatusRow
              label="Red biométrica"
              online={
                (
                  snapshot?.devicesOffline ??
                  0
                ) ===
                0
              }
              icon={
                <MonitorSmartphone
                  size={17}
                />
              }
            />
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">
                Ponches por departamento
              </h2>

              <p className="text-sm text-zinc-500">
                Distribución de actividad registrada.
              </p>
            </div>

            <Building2 className="text-[#c8102e]" />
          </div>

          <div className="space-y-4">
            {(
              snapshot?.byDepartment ??
              []
            ).slice(
              0,
              8,
            ).map(
              item => (
                <div
                  key={
                    item.name
                  }
                >
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="truncate font-medium">
                      {item.name}
                    </span>

                    <span className="text-zinc-500">
                      {item.total}
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-[#c8102e]"
                      style={{
                        width:
                          `${Math.max(
                            3,
                            (
                              item.total /
                              maxDepartment
                            ) *
                              100,
                          )}%`,
                      }}
                    />
                  </div>
                </div>
              ),
            )}

            {(
              snapshot?.byDepartment ??
              []
            ).length ===
              0 && (
              <p className="py-10 text-center text-sm text-zinc-400">
                No existen datos departamentales para mostrar.
              </p>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">
                Estado de relojes
              </h2>

              <p className="text-sm text-zinc-500">
                Disponibilidad y latencia de los dispositivos.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                open(
                  'devices',
                )
              }
              className="flex items-center gap-1 text-sm font-semibold text-[#c8102e]"
            >
              Ver todos
              <ArrowRight
                size={15}
              />
            </button>
          </div>

          <div className="divide-y divide-zinc-100">
            {(
              snapshot?.healthItems ??
              []
            ).slice(
              0,
              8,
            ).map(
              item => (
                <div
                  key={
                    item.name
                  }
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={
                        `rounded-xl p-2 ${
                          item.online
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-rose-50 text-rose-600'
                        }`
                      }
                    >
                      {item.online
                        ? (
                          <Wifi
                            size={17}
                          />
                        )
                        : (
                          <WifiOff
                            size={17}
                          />
                        )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {item.name}
                      </p>

                      <p className="text-xs text-zinc-500">
                        {item.punchesToday} ponches hoy
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p
                      className={
                        `text-xs font-semibold ${
                          item.online
                            ? 'text-emerald-600'
                            : 'text-rose-600'
                        }`
                      }
                    >
                      {item.online
                        ? 'Online'
                        : 'Offline'}
                    </p>

                    <p className="text-xs text-zinc-400">
                      {item.latencyMs == null
                        ? '—'
                        : `${item.latencyMs} ms`}
                    </p>
                  </div>
                </div>
              ),
            )}

            {(
              snapshot?.healthItems ??
              []
            ).length ===
              0 && (
              <p className="py-10 text-center text-sm text-zinc-400">
                No existen relojes reportados.
              </p>
            )}
          </div>
        </article>
      </section>

      <article className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-zinc-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold">
              Ponches recientes
            </h2>

            <p className="text-sm text-zinc-500">
              Últimos registros recibidos desde BioTime.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />

              <input
                value={
                  search
                }
                onChange={
                  event =>
                    setSearch(
                      event.target.value,
                    )
                }
                placeholder="Buscar empleado..."
                className="w-64 rounded-xl border border-zinc-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#c8102e]"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                open(
                  'records',
                )
              }
              className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              Ver historial
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-3">
                  Código
                </th>

                <th className="px-5 py-3">
                  Colaborador
                </th>

                <th className="px-5 py-3">
                  Departamento
                </th>

                <th className="px-5 py-3">
                  Entrada
                </th>

                <th className="px-5 py-3">
                  Salida
                </th>

                <th className="px-5 py-3">
                  Dispositivo
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-100">
              {filteredPunches.map(
                (
                  punch,
                  index,
                ) => (
                  <tr
                    key={
                      punch.id ??
                      `${punch.codigo}-${index}`
                    }
                    className="hover:bg-zinc-50/70"
                  >
                    <td className="px-5 py-3 font-mono text-xs">
                      {punch.codigo ||
                        '—'}
                    </td>

                    <td className="px-5 py-3 font-semibold">
                      {punch.nombre ||
                        'Sin identificar'}
                    </td>

                    <td className="px-5 py-3 text-zinc-600">
                      {punch.departamento ||
                        'Sin departamento'}
                    </td>

                    <td className="px-5 py-3">
                      {formatTime(
                        punch.entrada,
                      )}
                    </td>

                    <td className="px-5 py-3">
                      {formatTime(
                        punch.salida,
                      )}
                    </td>

                    <td className="px-5 py-3 text-zinc-500">
                      {punch.dispositivo_origen ||
                        '—'}
                    </td>
                  </tr>
                ),
              )}

              {filteredPunches.length ===
                0 && (
                <tr>
                  <td
                    colSpan={
                      6
                    }
                    className="px-5 py-12 text-center text-zinc-400"
                  >
                    No hay registros recientes para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <QuickAction
          title="Ver ponches"
          description="Historial y búsqueda"
          onClick={() =>
            open(
              'records',
            )
          }
        />

        <QuickAction
          title="Relojes"
          description="Estado de dispositivos"
          onClick={() =>
            open(
              'devices',
            )
          }
        />

        <QuickAction
          title="Colaboradores"
          description="Personal biométrico"
          onClick={() =>
            open(
              'collaborators',
            )
          }
        />

        <QuickAction
          title="Modo espejo"
          description="Sincronización de relojes"
          onClick={() =>
            open(
              'mirror',
            )
          }
        />

        <QuickAction
          title="Reportes"
          description="Horas y resultados"
          onClick={() =>
            open(
              'reports',
            )
          }
        />
      </section>
    </div>
  )
}

function StatusRow({
  label,
  online,
  icon,
}: {
  label: string
  online: boolean
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/70 px-3 py-3">
      <div className="flex items-center gap-3">
        <span className="text-zinc-500">
          {icon}
        </span>

        <span className="text-sm font-medium">
          {label}
        </span>
      </div>

      <span
        className={
          `flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            online
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-rose-100 text-rose-700'
          }`
        }
      >
        {online
          ? (
            <CheckCircle2
              size={13}
            />
          )
          : (
            <AlertTriangle
              size={13}
            />
          )}

        {online
          ? 'Operativo'
          : 'Revisar'}
      </span>
    </div>
  )
}

function QuickAction({
  title,
  description,
  onClick,
}: {
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className="group rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <Activity
          size={18}
          className="text-[#c8102e]"
        />

        <ArrowUpRight
          size={16}
          className="text-zinc-300 transition group-hover:text-[#c8102e]"
        />
      </div>

      <p className="mt-4 text-sm font-semibold text-zinc-900">
        {title}
      </p>

      <p className="mt-1 text-xs text-zinc-500">
        {description}
      </p>
    </button>
  )
}