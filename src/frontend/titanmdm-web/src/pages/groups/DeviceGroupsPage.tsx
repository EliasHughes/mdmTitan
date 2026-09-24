import {
  Activity,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Edit3,
  Laptop,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserPlus,
  UsersRound,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  deviceGroupsApi,
  type DeviceGroup,
  type DeviceGroupDetails,
} from '../../api/deviceGroupsApi'

import {
  devicesApi,
} from '../../api/devicesApi'

import type {
  DeviceListItem,
} from '../../types/device'

import './DeviceGroupsPage.css'

type GroupMode =
  | 'static'
  | 'dynamic'

type PlatformFilter =
  | 'All'
  | 'Windows'
  | 'Android'

type StatusFilter =
  | 'All'
  | 'Online'
  | 'Offline'
  | 'Quarantined'

const commandOptions = [
  {
    value: 'PING',
    label: 'Ping',
    windowsOnly: false,
  },
  {
    value: 'DEVICE_INFO',
    label: 'Actualizar información',
    windowsOnly: false,
  },
  {
    value: 'DEVICE_INVENTORY',
    label: 'Inventario completo',
    windowsOnly: true,
  },
  {
    value: 'APP_INVENTORY',
    label: 'Inventario de aplicaciones',
    windowsOnly: false,
  },
  {
    value: 'PROCESS_INVENTORY',
    label: 'Inventario de procesos',
    windowsOnly: true,
  },
  {
    value: 'SERVICE_INVENTORY',
    label: 'Inventario de servicios',
    windowsOnly: true,
  },
  {
    value: 'NETWORK_INFO',
    label: 'Información de red',
    windowsOnly: true,
  },
  {
    value: 'SECURITY_STATUS',
    label: 'Estado de seguridad',
    windowsOnly: false,
  },
  {
    value: 'COMPLIANCE_CHECK',
    label: 'Evaluar cumplimiento',
    windowsOnly: false,
  },
  {
    value: 'WINDOWS_UPDATE_STATUS',
    label: 'Estado de Windows Update',
    windowsOnly: true,
  },
  {
    value: 'WINDOWS_UPDATE_SCAN',
    label: 'Buscar actualizaciones',
    windowsOnly: true,
  },
]

export function DeviceGroupsPage() {
  const [
    groups,
    setGroups,
  ] = useState<DeviceGroup[]>([])

  const [
    devices,
    setDevices,
  ] = useState<DeviceListItem[]>([])

  const [
    selectedGroup,
    setSelectedGroup,
  ] =
    useState<DeviceGroupDetails | null>(
      null,
    )

  const [
    selectedDeviceIds,
    setSelectedDeviceIds,
  ] =
    useState<Set<string>>(
      new Set(),
    )

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    platformFilter,
    setPlatformFilter,
  ] =
    useState<PlatformFilter>(
      'All',
    )

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<StatusFilter>(
      'All',
    )

  const [
    name,
    setName,
  ] = useState('')

  const [
    description,
    setDescription,
  ] = useState('')

  const [
    mode,
    setMode,
  ] =
    useState<GroupMode>(
      'static',
    )

  const [
    dynamicPlatform,
    setDynamicPlatform,
  ] =
    useState('Windows')

  const [
    dynamicStatus,
    setDynamicStatus,
  ] =
    useState('Online')

  const [
    editName,
    setEditName,
  ] = useState('')

  const [
    editDescription,
    setEditDescription,
  ] = useState('')

  const [
    editingGroup,
    setEditingGroup,
  ] = useState(false)

  const [
    commandType,
    setCommandType,
  ] =
    useState('PING')

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    working,
    setWorking,
  ] = useState(false)

  const [
    message,
    setMessage,
  ] =
    useState<string | null>(
      null,
    )

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    )

  const loadBase =
    useCallback(
      async () => {
        try {
          setLoading(true)
          setError(null)

          const [
            groupData,
            deviceData,
          ] =
            await Promise.all([
              deviceGroupsApi
                .getAll(),

              devicesApi
                .getDevices({
                  page: 1,
                  pageSize: 100,
                }),
            ])

          setGroups(
            groupData,
          )

          setDevices(
            deviceData.items,
          )
        } catch {
          setError(
            'No fue posible cargar la administración de flota.',
          )
        } finally {
          setLoading(false)
        }
      },
      [],
    )

  useEffect(
    () => {
      void loadBase()
    },
    [
      loadBase,
    ],
  )

  useEffect(
    () => {
      document.title =
        'Grupos y Flota | TitanMDM'
    },
    [],
  )

  const filteredDevices =
    useMemo(
      () => {
        const value =
          search
            .trim()
            .toLowerCase()

        return devices.filter(
          device => {
            const matchesSearch =
              !value
              ||
              device.deviceName
                .toLowerCase()
                .includes(
                  value,
                )
              ||
              device.serialNumber
                .toLowerCase()
                .includes(
                  value,
                )
              ||
              (
                device.assignedUser ??
                ''
              )
                .toLowerCase()
                .includes(
                  value,
                )
              ||
              (
                device.department ??
                ''
              )
                .toLowerCase()
                .includes(
                  value,
                )

            const matchesPlatform =
              platformFilter ===
                'All'
              ||
              device.platform ===
                platformFilter

            const matchesStatus =
              statusFilter ===
                'All'
              ||
              device.status ===
                statusFilter

            return (
              matchesSearch
              &&
              matchesPlatform
              &&
              matchesStatus
            )
          },
        )
      },
      [
        devices,
        search,
        platformFilter,
        statusFilter,
      ],
    )

  const windowsDevices =
    useMemo(
      () =>
        devices.filter(
          device =>
            device.platform ===
            'Windows',
        ).length,
      [
        devices,
      ],
    )

  const androidDevices =
    useMemo(
      () =>
        devices.filter(
          device =>
            device.platform ===
            'Android',
        ).length,
      [
        devices,
      ],
    )

  const onlineDevices =
    useMemo(
      () =>
        devices.filter(
          device =>
            device.status ===
            'Online',
        ).length,
      [
        devices,
      ],
    )

  const compliantDevices =
    useMemo(
      () =>
        devices.filter(
          device =>
            device.complianceStatus ===
            'Compliant',
        ).length,
      [
        devices,
      ],
    )

  const totalMembers =
    useMemo(
      () =>
        groups.reduce(
          (
            total,
            group,
          ) =>
            total +
            group.deviceCount,
          0,
        ),
      [
        groups,
      ],
    )

  const selectedDevices =
    useMemo(
      () =>
        devices.filter(
          device =>
            selectedDeviceIds.has(
              device.id,
            ),
        ),
      [
        devices,
        selectedDeviceIds,
      ],
    )

  const selectedWindowsCount =
    useMemo(
      () =>
        selectedDevices.filter(
          device =>
            device.platform ===
            'Windows',
        ).length,
      [
        selectedDevices,
      ],
    )

  const currentCommand =
    useMemo(
      () =>
        commandOptions.find(
          command =>
            command.value ===
            commandType,
        ),
      [
        commandType,
      ],
    )

  function toggleDevice(
    deviceId: string,
  ) {
    setSelectedDeviceIds(
      current => {
        const next =
          new Set(
            current,
          )

        if (
          next.has(
            deviceId,
          )
        ) {
          next.delete(
            deviceId,
          )
        }
        else {
          next.add(
            deviceId,
          )
        }

        return next
      },
    )
  }

  function toggleAllVisible() {
    const visibleIds =
      filteredDevices.map(
        device =>
          device.id,
      )

    const allSelected =
      visibleIds.length >
        0
      &&
      visibleIds.every(
        id =>
          selectedDeviceIds.has(
            id,
          ),
      )

    setSelectedDeviceIds(
      current => {
        const next =
          new Set(
            current,
          )

        visibleIds.forEach(
          id => {
            if (
              allSelected
            ) {
              next.delete(
                id,
              )
            }
            else {
              next.add(
                id,
              )
            }
          },
        )

        return next
      },
    )
  }

  function selectWindows() {
    setSelectedDeviceIds(
      new Set(
        filteredDevices
          .filter(
            device =>
              device.platform ===
              'Windows',
          )
          .map(
            device =>
              device.id,
          ),
      ),
    )
  }

  function selectOnline() {
    setSelectedDeviceIds(
      new Set(
        filteredDevices
          .filter(
            device =>
              device.status ===
              'Online',
          )
          .map(
            device =>
              device.id,
          ),
      ),
    )
  }

  function clearSelection() {
    setSelectedDeviceIds(
      new Set(),
    )
  }

  async function openGroup(
    groupId: string,
  ) {
    try {
      setWorking(true)
      setError(null)

      const details =
        await deviceGroupsApi
          .getById(
            groupId,
          )

      setSelectedGroup(
        details,
      )

      setEditName(
        details.name,
      )

      setEditDescription(
        details.description ??
          '',
      )

      setEditingGroup(
        false,
      )

      setSelectedDeviceIds(
        new Set(
          details.members.map(
            member =>
              member.deviceId,
          ),
        ),
      )
    } catch {
      setError(
        'No fue posible abrir el grupo.',
      )
    } finally {
      setWorking(false)
    }
  }

  function closeGroup() {
    setSelectedGroup(
      null,
    )

    setEditingGroup(
      false,
    )

    setSelectedDeviceIds(
      new Set(),
    )
  }

  async function createGroup() {
    if (
      !name.trim()
    ) {
      setError(
        'El grupo necesita un nombre.',
      )

      return
    }

    try {
      setWorking(true)
      setError(null)
      setMessage(null)

      const ruleJson =
        mode ===
        'dynamic'
          ? JSON.stringify({
              operator:
                'AND',

              conditions:
                [
                  {
                    field:
                      'platform',
                    operator:
                      'equals',
                    value:
                      dynamicPlatform,
                  },
                  {
                    field:
                      'status',
                    operator:
                      'equals',
                    value:
                      dynamicStatus,
                  },
                ],
            })
          : null

      const created =
        await deviceGroupsApi
          .create({
            name:
              name.trim(),

            description:
              description
                .trim()
              ||
              null,

            isDynamic:
              mode ===
              'dynamic',

            ruleJson,

            deviceIds:
              mode ===
              'static'
                ? Array.from(
                    selectedDeviceIds,
                  )
                : [],
          })

      setMessage(
        `Grupo "${created.name}" creado correctamente.`,
      )

      setName('')
      setDescription('')

      setSelectedDeviceIds(
        new Set(),
      )

      await loadBase()

      await openGroup(
        created.id,
      )
    } catch {
      setError(
        'No fue posible crear el grupo.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function updateGroup() {
    if (
      !selectedGroup
    ) {
      return
    }

    if (
      !editName.trim()
    ) {
      setError(
        'El nombre del grupo no puede estar vacío.',
      )

      return
    }

    try {
      setWorking(true)
      setError(null)
      setMessage(null)

      const updated =
        await deviceGroupsApi
          .update(
            selectedGroup.id,
            {
              name:
                editName.trim(),

              description:
                editDescription
                  .trim()
                ||
                null,

              isDynamic:
                selectedGroup
                  .isDynamic,

              ruleJson:
                selectedGroup
                  .ruleJson,
            },
          )

      setSelectedGroup(
        updated,
      )

      setEditingGroup(
        false,
      )

      await loadBase()

      setMessage(
        'Grupo actualizado correctamente.',
      )
    } catch {
      setError(
        'No fue posible actualizar el grupo.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function synchronizeMembers() {
    if (
      !selectedGroup
    ) {
      return
    }

    if (
      selectedGroup.isDynamic
    ) {
      setError(
        'Los miembros de un grupo dinámico no se modifican manualmente.',
      )

      return
    }

    try {
      setWorking(true)
      setError(null)
      setMessage(null)

      const original =
        new Set(
          selectedGroup
            .members
            .map(
              member =>
                member.deviceId,
            ),
        )

      const additions =
        Array.from(
          selectedDeviceIds,
        )
          .filter(
            id =>
              !original.has(
                id,
              ),
          )

      const removals =
        Array.from(
          original,
        )
          .filter(
            id =>
              !selectedDeviceIds
                .has(
                  id,
                ),
          )

      if (
        additions.length >
        0
      ) {
        await deviceGroupsApi
          .addMembers(
            selectedGroup.id,
            additions,
          )
      }

      for (
        const deviceId
        of removals
      ) {
        await deviceGroupsApi
          .removeMember(
            selectedGroup.id,
            deviceId,
          )
      }

      await openGroup(
        selectedGroup.id,
      )

      await loadBase()

      setMessage(
        'Miembros del grupo actualizados.',
      )
    } catch {
      setError(
        'No fue posible actualizar los miembros.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function sendGroupCommand() {
    if (
      !selectedGroup
    ) {
      return
    }

    if (
      selectedGroup.members
        .length ===
      0
    ) {
      setError(
        'El grupo no contiene dispositivos.',
      )

      return
    }

    if (
      currentCommand
        ?.windowsOnly
    ) {
      const nonWindows =
        selectedGroup
          .members
          .filter(
            member =>
              member.platform !==
              'Windows',
          )

      if (
        nonWindows.length >
        0
      ) {
        setError(
          `El comando ${commandType} es exclusivo de Windows y el grupo contiene ${nonWindows.length} dispositivo(s) no Windows.`,
        )

        return
      }
    }

    const confirmed =
      window.confirm(
        `¿Ejecutar ${commandType} sobre ${selectedGroup.members.length} dispositivo(s) del grupo "${selectedGroup.name}"?`,
      )

    if (
      !confirmed
    ) {
      return
    }

    try {
      setWorking(true)
      setError(null)
      setMessage(null)

      const result =
        await deviceGroupsApi
          .executeCommand(
            selectedGroup.id,
            {
              commandType,

              payloadJson:
                '{}',

              expiresInMinutes:
                60,
            },
          )

      setMessage(
        `${commandType} fue encolado para ${result.queuedDevices} dispositivo(s).`,
      )
    } catch {
      setError(
        'No fue posible ejecutar la acción masiva.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function deleteGroup() {
    if (
      !selectedGroup
    ) {
      return
    }

    const confirmed =
      window.confirm(
        `¿Eliminar el grupo "${selectedGroup.name}"? Los dispositivos no serán eliminados.`,
      )

    if (
      !confirmed
    ) {
      return
    }

    try {
      setWorking(true)
      setError(null)

      await deviceGroupsApi
        .delete(
          selectedGroup.id,
        )

      closeGroup()

      await loadBase()

      setMessage(
        'Grupo eliminado correctamente.',
      )
    } catch {
      setError(
        'No fue posible eliminar el grupo.',
      )
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="fleet-page">
      <header className="fleet-header">
        <div>
          <span className="fleet-eyebrow">
            TITANMDM FLEET MANAGEMENT
          </span>

          <h1>
            Grupos y Flota
          </h1>

          <p>
            Organiza dispositivos,
            filtra la flota y ejecuta
            operaciones masivas.
          </p>
        </div>

        <button
          type="button"
          className="fleet-secondary"
          onClick={
            () =>
              void loadBase()
          }
          disabled={
            loading
          }
        >
          <RefreshCw
            size={16}
          />

          Actualizar
        </button>
      </header>

      {message && (
        <div className="fleet-message success">
          <CheckCircle2
            size={17}
          />

          {message}
        </div>
      )}

      {error && (
        <div className="fleet-message error">
          {error}
        </div>
      )}

      <section className="fleet-stats">
        <Stat
          icon={
            <UsersRound
              size={20}
            />
          }
          label="Grupos"
          value={
            groups.length
          }
        />

        <Stat
          icon={
            <Cpu
              size={20}
            />
          }
          label="Dispositivos"
          value={
            devices.length
          }
        />

        <Stat
          icon={
            <Laptop
              size={20}
            />
          }
          label="Windows"
          value={
            windowsDevices
          }
        />

        <Stat
          icon={
            <Smartphone
              size={20}
            />
          }
          label="Android"
          value={
            androidDevices
          }
        />

        <Stat
          icon={
            <Wifi
              size={20}
            />
          }
          label="En línea"
          value={
            onlineDevices
          }
        />

        <Stat
          icon={
            <ShieldCheck
              size={20}
            />
          }
          label="Conformes"
          value={
            compliantDevices
          }
        />

        <Stat
          icon={
            <Activity
              size={20}
            />
          }
          label="Membresías"
          value={
            totalMembers
          }
        />
      </section>

      <div className="fleet-layout">
        <aside className="fleet-groups">
          <div className="fleet-panel-title">
            <div>
              <UsersRound
                size={18}
              />

              <strong>
                Grupos
              </strong>
            </div>

            <span>
              {groups.length}
            </span>
          </div>

          {groups.length ===
          0 ? (
            <div className="fleet-empty">
              No existen grupos.
            </div>
          ) : (
            groups.map(
              group => (
                <button
                  type="button"
                  key={
                    group.id
                  }
                  className={
                    selectedGroup
                      ?.id ===
                    group.id
                      ? 'fleet-group selected'
                      : 'fleet-group'
                  }
                  onClick={
                    () =>
                      void openGroup(
                        group.id,
                      )
                  }
                >
                  <div>
                    <strong>
                      {group.name}
                    </strong>

                    <span>
                      {group.isDynamic
                        ? 'Dinámico'
                        : 'Estático'}

                      {' · '}

                      {
                        group.deviceCount
                      }{' '}
                      dispositivo(s)
                    </span>
                  </div>

                  <ChevronRight
                    size={16}
                  />
                </button>
              ),
            )
          )}
        </aside>

        <main className="fleet-main">
          <section className="fleet-builder">
            <div className="fleet-panel-title">
              <div>
                <Plus
                  size={18}
                />

                <strong>
                  Crear grupo
                </strong>
              </div>
            </div>

            <div className="fleet-form-grid">
              <label>
                Nombre

                <input
                  value={
                    name
                  }
                  onChange={
                    event =>
                      setName(
                        event
                          .target
                          .value,
                      )
                  }
                  placeholder="Windows - Operaciones"
                />
              </label>

              <label>
                Tipo

                <select
                  value={
                    mode
                  }
                  onChange={
                    event =>
                      setMode(
                        event
                          .target
                          .value
                          as GroupMode,
                      )
                  }
                >
                  <option value="static">
                    Estático
                  </option>

                  <option value="dynamic">
                    Dinámico
                  </option>
                </select>
              </label>
            </div>

            <label>
              Descripción

              <input
                value={
                  description
                }
                onChange={
                  event =>
                    setDescription(
                      event
                        .target
                        .value,
                    )
                }
                placeholder="Flota Windows administrada por TitanMDM"
              />
            </label>

            {mode ===
              'dynamic' && (
              <div className="fleet-dynamic-rule">
                <strong>
                  Regla dinámica
                </strong>

                <label>
                  Plataforma

                  <select
                    value={
                      dynamicPlatform
                    }
                    onChange={
                      event =>
                        setDynamicPlatform(
                          event
                            .target
                            .value,
                        )
                    }
                  >
                    <option value="Windows">
                      Windows
                    </option>

                    <option value="Android">
                      Android
                    </option>
                  </select>
                </label>

                <label>
                  Estado

                  <select
                    value={
                      dynamicStatus
                    }
                    onChange={
                      event =>
                        setDynamicStatus(
                          event
                            .target
                            .value,
                        )
                    }
                  >
                    <option value="Online">
                      Online
                    </option>

                    <option value="Offline">
                      Offline
                    </option>

                    <option value="Quarantined">
                      Quarantined
                    </option>
                  </select>
                </label>
              </div>
            )}

            <button
              type="button"
              className="fleet-primary"
              onClick={
                () =>
                  void createGroup()
              }
              disabled={
                working
              }
            >
              <Plus
                size={16}
              />

              Crear grupo
            </button>
          </section>

          {selectedGroup && (
            <section className="fleet-selected-group">
              {!editingGroup ? (
                <div>
                  <span>
                    GRUPO ACTIVO
                  </span>

                  <h2>
                    {
                      selectedGroup.name
                    }
                  </h2>

                  <p>
                    {
                      selectedGroup
                        .description
                      ??
                      'Sin descripción'
                    }
                  </p>

                  <small>
                    {
                      selectedGroup
                        .isDynamic
                        ? 'Grupo dinámico'
                        : 'Grupo estático'
                    }
                    {' · '}
                    {
                      selectedGroup
                        .members
                        .length
                    }{' '}
                    miembro(s)
                  </small>
                </div>
              ) : (
                <div className="fleet-form-grid">
                  <label>
                    Nombre

                    <input
                      value={
                        editName
                      }
                      onChange={
                        event =>
                          setEditName(
                            event
                              .target
                              .value,
                          )
                      }
                    />
                  </label>

                  <label>
                    Descripción

                    <input
                      value={
                        editDescription
                      }
                      onChange={
                        event =>
                          setEditDescription(
                            event
                              .target
                              .value,
                          )
                      }
                    />
                  </label>
                </div>
              )}

              <div>
                {!editingGroup ? (
                  <button
                    type="button"
                    className="fleet-secondary"
                    onClick={
                      () =>
                        setEditingGroup(
                          true,
                        )
                    }
                  >
                    <Edit3
                      size={16}
                    />

                    Editar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="fleet-primary"
                    disabled={
                      working
                    }
                    onClick={
                      () =>
                        void updateGroup()
                    }
                  >
                    <Save
                      size={16}
                    />

                    Guardar
                  </button>
                )}

                <button
                  type="button"
                  className="fleet-close"
                  onClick={
                    closeGroup
                  }
                >
                  <X
                    size={17}
                  />
                </button>
              </div>
            </section>
          )}

          <section className="fleet-devices">
            <div className="fleet-devices-header">
              <div>
                <strong>
                  Selección de dispositivos
                </strong>

                <span>
                  {
                    selectedDeviceIds
                      .size
                  }{' '}
                  seleccionado(s)
                  {' · '}
                  {
                    selectedWindowsCount
                  }{' '}
                  Windows
                </span>
              </div>

              <div className="fleet-search">
                <Search
                  size={16}
                />

                <input
                  value={
                    search
                  }
                  onChange={
                    event =>
                      setSearch(
                        event
                          .target
                          .value,
                      )
                  }
                  placeholder="Buscar dispositivo..."
                />
              </div>
            </div>

            <div className="fleet-form-grid">
              <label>
                Plataforma

                <select
                  value={
                    platformFilter
                  }
                  onChange={
                    event =>
                      setPlatformFilter(
                        event
                          .target
                          .value
                          as PlatformFilter,
                      )
                  }
                >
                  <option value="All">
                    Todas
                  </option>

                  <option value="Windows">
                    Windows
                  </option>

                  <option value="Android">
                    Android
                  </option>
                </select>
              </label>

              <label>
                Estado

                <select
                  value={
                    statusFilter
                  }
                  onChange={
                    event =>
                      setStatusFilter(
                        event
                          .target
                          .value
                          as StatusFilter,
                      )
                  }
                >
                  <option value="All">
                    Todos
                  </option>

                  <option value="Online">
                    Online
                  </option>

                  <option value="Offline">
                    Offline
                  </option>

                  <option value="Quarantined">
                    Quarantined
                  </option>
                </select>
              </label>
            </div>

            <div className="fleet-members-action">
              <button
                type="button"
                className="fleet-secondary"
                onClick={
                  selectWindows
                }
              >
                <Laptop
                  size={16}
                />

                Seleccionar Windows
              </button>

              <button
                type="button"
                className="fleet-secondary"
                onClick={
                  selectOnline
                }
              >
                <Wifi
                  size={16}
                />

                Seleccionar Online
              </button>

              <button
                type="button"
                className="fleet-secondary"
                onClick={
                  clearSelection
                }
              >
                <X
                  size={16}
                />

                Limpiar
              </button>
            </div>

            <div className="fleet-table-wrapper">
              <table className="fleet-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={
                          filteredDevices
                            .length >
                            0
                          &&
                          filteredDevices
                            .every(
                              device =>
                                selectedDeviceIds
                                  .has(
                                    device.id,
                                  ),
                            )
                        }
                        onChange={
                          toggleAllVisible
                        }
                      />
                    </th>

                    <th>
                      DISPOSITIVO
                    </th>

                    <th>
                      PLATAFORMA
                    </th>

                    <th>
                      ESTADO
                    </th>

                    <th>
                      CUMPLIMIENTO
                    </th>

                    <th>
                      USUARIO
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredDevices.map(
                    device => (
                      <tr
                        key={
                          device.id
                        }
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={
                              selectedDeviceIds
                                .has(
                                  device.id,
                                )
                            }
                            onChange={
                              () =>
                                toggleDevice(
                                  device.id,
                                )
                            }
                          />
                        </td>

                        <td>
                          <div className="fleet-device">
                            {device.platform ===
                            'Android' ? (
                              <Smartphone
                                size={17}
                              />
                            ) : (
                              <Laptop
                                size={17}
                              />
                            )}

                            <div>
                              <strong>
                                {
                                  device
                                    .deviceName
                                }
                              </strong>

                              <span>
                                SN:{' '}
                                {
                                  device
                                    .serialNumber
                                }
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          {
                            device.platform
                          }
                        </td>

                        <td>
                          <span className="fleet-status">
                            {device.status ===
                            'Online' ? (
                              <Wifi
                                size={13}
                              />
                            ) : (
                              <WifiOff
                                size={13}
                              />
                            )}

                            {
                              device.status
                            }
                          </span>
                        </td>

                        <td>
                          {
                            device
                              .complianceStatus
                          }
                        </td>

                        <td>
                          {
                            device
                              .assignedUser
                            ??
                            'Sin asignar'
                          }
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            {selectedGroup &&
              !selectedGroup.isDynamic && (
              <div className="fleet-members-action">
                <button
                  type="button"
                  className="fleet-secondary"
                  disabled={
                    working
                  }
                  onClick={
                    () =>
                      void synchronizeMembers()
                  }
                >
                  <UserPlus
                    size={16}
                  />

                  Guardar miembros
                </button>
              </div>
            )}
          </section>

          {selectedGroup && (
            <section className="fleet-command-center">
              <div>
                <span>
                  OPERACIONES MASIVAS
                </span>

                <strong>
                  Command Center
                </strong>
              </div>

              <select
                value={
                  commandType
                }
                onChange={
                  event =>
                    setCommandType(
                      event
                        .target
                        .value,
                    )
                }
              >
                {commandOptions.map(
                  command => (
                    <option
                      key={
                        command.value
                      }
                      value={
                        command.value
                      }
                    >
                      {
                        command.label
                      }
                      {command.windowsOnly
                        ? ' · Windows'
                        : ''}
                    </option>
                  ),
                )}
              </select>

              <button
                type="button"
                className="fleet-primary"
                disabled={
                  working
                }
                onClick={
                  () =>
                    void sendGroupCommand()
                }
              >
                <Send
                  size={16}
                />

                Ejecutar en grupo
              </button>

              <button
                type="button"
                className="fleet-danger"
                disabled={
                  working
                }
                onClick={
                  () =>
                    void deleteGroup()
                }
              >
                <Trash2
                  size={16}
                />

                Eliminar grupo
              </button>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: number
}) {
  return (
    <article className="fleet-stat">
      <div>
        {icon}
      </div>

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </article>
  )
}