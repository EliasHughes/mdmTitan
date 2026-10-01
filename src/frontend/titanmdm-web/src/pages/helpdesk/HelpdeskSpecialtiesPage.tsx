import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import apiClient from '../../api/apiClient'
import './HelpdeskSpecialtiesPage.css'

type Slot = {
  day: number
  start: string
  end: string
}

type Technician = {
  userId: string
  isAvailable: boolean
  acceptsAutomaticAssignments: boolean
  maxOpenTickets: number
  priority: number
  timeZoneId: string
  slots: Slot[]
  onDuty?: boolean
}

type Group = {
  id: string
  name: string
  description: string | null
  isActive: boolean
  tasks: string[]
  zoneIds: string[]
  technicians: Technician[]
}

type Zone = {
  id: string
  name: string
  type: string
}

type Staff = {
  id: string
  name: string
  email: string
  eligible: boolean
  zoneIds: string[]
}

type Catalog = {
  groups: Group[]
  zones: Zone[]
  users: Staff[]
}

const days = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]

const defaultSlots = (): Slot[] =>
  [1, 2, 3, 4, 5].map(day => ({
    day,
    start: '08:00',
    end: '17:00',
  }))

const clone = (group: Group): Group => ({
  ...group,
  tasks: [...group.tasks],
  zoneIds: [...group.zoneIds],
  technicians: group.technicians.map(technician => ({
    ...technician,
    slots: technician.slots.map(slot => ({ ...slot })),
  })),
})

function errorMessage(error: unknown) {
  if (
    axios.isAxiosError<{
      message?: string
      detail?: string
    }>(error)
  ) {
    return (
      error.response?.data?.message ??
      error.response?.data?.detail ??
      'No se pudo completar la operación. Revisa el backend y la migración.'
    )
  }

  return error instanceof Error
    ? error.message
    : 'No se pudo completar la operación.'
}

export function HelpdeskSpecialtiesPage() {
  const [catalog, setCatalog] = useState<Catalog>({
    groups: [],
    zones: [],
    users: [],
  })

  const [selected, setSelected] = useState<Group | null>(null)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [task, setTask] = useState('')
  const [staffId, setStaffId] = useState('')
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [description, setDescription] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async (preferredId?: string) => {
    setLoading(true)

    try {
      const { data } = await apiClient.get<Catalog>(
        '/helpdesk/group-planning',
      )

      setCatalog(data)

      const group =
        data.groups.find(item => item.id === preferredId) ??
        data.groups[0]

      setSelected(group ? clone(group) : null)
      setDirty(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load().catch(error => setError(errorMessage(error)))
  }, [load])

  const update = (patch: Partial<Group>) => {
    setSelected(group => (group ? { ...group, ...patch } : null))
    setDirty(true)
    setMessage('')
    setError('')
  }

  const updateTech = (
    userId: string,
    patch: Partial<Technician>,
  ) => {
    if (!selected) return

    update({
      technicians: selected.technicians.map(technician =>
        technician.userId === userId
          ? { ...technician, ...patch }
          : technician,
      ),
    })
  }

  const choose = (group: Group) => {
    if (
      dirty &&
      !window.confirm('¿Descartar los cambios sin guardar?')
    ) {
      return
    }

    setSelected(clone(group))
    setDirty(false)
    setError('')
    setMessage('')
    setTask('')
    setStaffId('')
  }

  const addTask = () => {
    if (!selected) return

    const tasks = [
      ...new Set([
        ...selected.tasks,
        ...task
          .split(/[,;\n]/)
          .map(value => value.trim().toLowerCase())
          .filter(Boolean),
      ]),
    ]

    if (
      tasks.length > 15 ||
      tasks.some(value => value.length > 50 || value.includes('|'))
    ) {
      setError(
        'Admite hasta 15 tareas por grupo, de hasta 50 caracteres.',
      )
      return
    }

    update({ tasks })
    setTask('')
  }

  const addTech = () => {
    if (!selected || !staffId) return

    update({
      technicians: [
        ...selected.technicians,
        {
          userId: staffId,
          isAvailable: true,
          acceptsAutomaticAssignments: true,
          maxOpenTickets: 20,
          priority: Math.min(
            100,
            Math.max(
              0,
              ...selected.technicians.map(item => item.priority),
            ) + 1,
          ),
          timeZoneId: 'America/Santo_Domingo',
          slots: defaultSlots(),
        },
      ],
    })

    setStaffId('')
  }

  const save = async () => {
    if (!selected) return

    if (!selected.tasks.length || !selected.zoneIds.length) {
      setError('Agrega al menos una tarea y una zona de cobertura.')
      return
    }

    if (
      selected.technicians.some(
        technician =>
          technician.acceptsAutomaticAssignments &&
          !technician.slots.length,
      )
    ) {
      setError('Cada técnico automático necesita un horario.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    try {
      await apiClient.put(
        `/helpdesk/group-planning/groups/${selected.id}`,
        {
          tasks: selected.tasks,
          zoneIds: selected.zoneIds,
          technicians: selected.technicians,
        },
      )

      setDirty(false)
      setMessage(
        'Grupo, tareas, cobertura, técnicos y horarios guardados.',
      )

      try {
        await load(selected.id)
      } catch (error) {
        setError(
          'Se guardó, pero no se pudo actualizar la pantalla. ' +
            errorMessage(error),
        )
      }
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const create = async () => {
    if (!newName.trim()) {
      setError('Escribe el nombre del grupo.')
      return
    }

    if (
      dirty &&
      !window.confirm(
        '¿Descartar los cambios pendientes y crear otro grupo?',
      )
    ) {
      return
    }

    setSaving(true)
    setError('')

    try {
      const { data } = await apiClient.post<{ id: string }>(
        '/helpdesk/group-planning/groups',
        {
          name: newName.trim(),
          description: description.trim() || null,
        },
      )

      setShowCreate(false)
      setNewName('')
      setDescription('')

      try {
        await load(data.id)
        setMessage('Grupo creado. Configura sus tareas, zonas y técnicos.')
      } catch (error) {
        setError(
          'El grupo se creó, pero no se pudo actualizar. ' +
            errorMessage(error),
        )
      }
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const refresh = async () => {
    if (
      dirty &&
      !window.confirm(
        '¿Descartar los cambios sin guardar y actualizar?',
      )
    ) {
      return
    }

    setError('')

    try {
      await load(selected?.id)
    } catch (error) {
      setError(errorMessage(error))
    }
  }

  const busy = loading || saving

  return (
    <main className="hdgp">
      <header className="hdgp-header">
        <div>
          <span className="hdgp-eyebrow">
            MESA DE AYUDA · ADMINISTRACIÓN
          </span>
          <h1>Grupos, tareas y turnos</h1>
          <p>
            Define qué atiende cada grupo, dónde trabaja y quién recibe
            el ticket en cada horario.
          </p>
        </div>

        <div className="hdgp-actions">
          <Link to="/helpdesk/operations">
            Ubicaciones y usuarios
          </Link>
          <button disabled={busy} onClick={() => void refresh()}>
            Actualizar
          </button>
          <button
            className="hdgp-primary"
            disabled={busy}
            onClick={() => setShowCreate(!showCreate)}
          >
            Crear grupo
          </button>
        </div>
      </header>

      {error && (
        <div className="hdgp-alert hdgp-error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="hdgp-alert hdgp-success" role="status">
          {message}
        </div>
      )}

      {showCreate && (
        <section className="hdgp-panel">
          <h2>Nuevo grupo</h2>
          <fieldset disabled={busy} className="hdgp-create">
            <label>
              Nombre
              <input
                maxLength={120}
                placeholder="Grupo CEDI"
                value={newName}
                onChange={event => setNewName(event.target.value)}
              />
            </label>
            <label>
              Descripción
              <input
                maxLength={500}
                value={description}
                onChange={event => setDescription(event.target.value)}
              />
            </label>
            <button
              className="hdgp-primary"
              onClick={() => void create()}
            >
              Crear
            </button>
          </fieldset>
        </section>
      )}

      <div className="hdgp-layout">
        <aside className="hdgp-panel hdgp-sidebar">
          <h2>Grupos de trabajo</h2>
          <input
            aria-label="Buscar grupo"
            placeholder="Buscar grupo…"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />

          {catalog.groups
            .filter(group =>
              group.name.toLowerCase().includes(search.toLowerCase()),
            )
            .map(group => (
              <button
                key={group.id}
                disabled={busy}
                className={`hdgp-group ${
                  selected?.id === group.id ? 'selected' : ''
                }`}
                onClick={() => choose(group)}
              >
                <strong>{group.name}</strong>
                <span>
                  {group.tasks.length} tareas ·{' '}
                  {group.technicians.length} técnicos
                </span>
                {!group.isActive && <small>Inactivo</small>}
              </button>
            ))}

          {!loading && !catalog.groups.length && (
            <p>Crea el primer grupo.</p>
          )}
        </aside>

        <section className="hdgp-editor">
          {loading && (
            <div className="hdgp-panel">Cargando configuración…</div>
          )}

          {!loading && !selected && (
            <div className="hdgp-panel">
              Crea un grupo para comenzar.
            </div>
          )}

          {selected && (
            <fieldset disabled={busy}>
              <section className="hdgp-panel">
                <div className="hdgp-title">
                  <div>
                    <h2>{selected.name}</h2>
                    <p>
                      {selected.description ||
                        'Grupo de atención de tickets.'}
                    </p>
                  </div>
                  <span className="hdgp-tag">
                    {selected.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <details open>
                  <summary>1. Tareas y equipos que atiende</summary>
                  <p>
                    Agrega las tareas individualmente o separadas por
                    comas.
                  </p>

                  <div className="hdgp-inline">
                    <input
                      value={task}
                      placeholder="Telefonía, cableado, RP4, mouse, monitor…"
                      onChange={event => setTask(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          addTask()
                        }
                      }}
                    />
                    <button onClick={addTask}>Agregar tareas</button>
                  </div>

                  <div className="hdgp-chips">
                    {selected.tasks.map(value => (
                      <span key={value}>
                        {value}
                        <button
                          aria-label={`Quitar ${value}`}
                          onClick={() =>
                            update({
                              tasks: selected.tasks.filter(
                                item => item !== value,
                              ),
                            })
                          }
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </details>
              </section>

              <section className="hdgp-panel">
                <details open>
                  <summary>2. Zonas de cobertura</summary>
                  <p>
                    El grupo puede cubrir varias zonas. La ubicación del
                    técnico se configura en Ubicaciones y usuarios.
                  </p>

                  <div className="hdgp-zones">
                    {catalog.zones.map(zone => (
                      <label key={zone.id}>
                        <input
                          type="checkbox"
                          checked={selected.zoneIds.includes(zone.id)}
                          onChange={event =>
                            update({
                              zoneIds: event.target.checked
                                ? [...selected.zoneIds, zone.id]
                                : selected.zoneIds.filter(
                                    id => id !== zone.id,
                                  ),
                            })
                          }
                        />
                        <span>
                          {zone.name}
                          <small>{zone.type}</small>
                        </span>
                      </label>
                    ))}
                  </div>

                  {!catalog.zones.length && (
                    <p>
                      Crea primero las zonas en{' '}
                      <Link to="/helpdesk/operations">
                        configuración de ubicaciones
                      </Link>.
                    </p>
                  )}
                </details>
              </section>

              <section className="hdgp-panel">
                <details open>
                  <summary>3. Técnicos, prioridad y relevos</summary>
                  <p>
                    Prioridad 1: principal. Prioridad 2: siguiente o
                    relevo. Se comprueba horario, disponibilidad y
                    capacidad.
                  </p>

                  <div className="hdgp-inline">
                    <select
                      aria-label="Técnico para agregar"
                      value={staffId}
                      onChange={event => setStaffId(event.target.value)}
                    >
                      <option value="">Selecciona un técnico…</option>
                      {catalog.users
                        .filter(
                          user =>
                            user.eligible &&
                            !selected.technicians.some(
                              technician =>
                                technician.userId === user.id,
                            ),
                        )
                        .map(user => (
                          <option key={user.id} value={user.id}>
                            {user.name} · {user.email}
                          </option>
                        ))}
                    </select>

                    <button disabled={!staffId} onClick={addTech}>
                      Agregar técnico
                    </button>
                  </div>

                  <div className="hdgp-technicians">
                    {selected.technicians.map(technician => {
                      const user = catalog.users.find(
                        item => item.id === technician.userId,
                      )

                      const location =
                        user?.zoneIds.length === 1
                          ? catalog.zones.find(
                              zone => zone.id === user.zoneIds[0],
                            )?.name
                          : undefined

                      const updateSlot = (
                        index: number,
                        patch: Partial<Slot>,
                      ) =>
                        updateTech(technician.userId, {
                          slots: technician.slots.map((slot, position) =>
                            position === index
                              ? { ...slot, ...patch }
                              : slot,
                          ),
                        })

                      return (
                        <article
                          className="hdgp-technician"
                          key={technician.userId}
                        >
                          <div className="hdgp-title">
                            <div>
                              <h3>
                                {user?.name ?? 'Cuenta no disponible'}
                              </h3>
                              <small>
                                {location ?? 'Ubicación sin confirmar'} ·{' '}
                                {user?.email}
                              </small>
                            </div>

                            <button
                              className="hdgp-remove"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    '¿Quitar este técnico del grupo? ' +
                                      'Su cuenta no se elimina.',
                                  )
                                ) {
                                  update({
                                    technicians:
                                      selected.technicians.filter(
                                        item =>
                                          item.userId !==
                                          technician.userId,
                                      ),
                                  })
                                }
                              }}
                            >
                              Quitar del grupo
                            </button>
                          </div>

                          {(!location || !user?.eligible) && (
                            <p className="hdgp-warning">
                              Confirma la ubicación y el permiso
                              tickets.comment de este técnico.
                            </p>
                          )}

                          <div className="hdgp-tech-settings">
                            <label>
                              Prioridad
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={technician.priority}
                                onChange={event =>
                                  updateTech(technician.userId, {
                                    priority: Number(event.target.value),
                                  })
                                }
                              />
                            </label>

                            <label>
                              Máximo de tickets abiertos
                              <input
                                type="number"
                                min={1}
                                max={500}
                                value={technician.maxOpenTickets}
                                onChange={event =>
                                  updateTech(technician.userId, {
                                    maxOpenTickets: Number(
                                      event.target.value,
                                    ),
                                  })
                                }
                              />
                            </label>

                            <label>
                              Zona horaria
                              <input
                                value={technician.timeZoneId}
                                onChange={event =>
                                  updateTech(technician.userId, {
                                    timeZoneId: event.target.value,
                                  })
                                }
                              />
                            </label>

                            <label className="hdgp-check">
                              <input
                                type="checkbox"
                                checked={technician.isAvailable}
                                onChange={event =>
                                  updateTech(technician.userId, {
                                    isAvailable: event.target.checked,
                                  })
                                }
                              />
                              Disponible para trabajar
                            </label>

                            <label className="hdgp-check">
                              <input
                                type="checkbox"
                                checked={
                                  technician.acceptsAutomaticAssignments
                                }
                                onChange={event =>
                                  updateTech(technician.userId, {
                                    acceptsAutomaticAssignments:
                                      event.target.checked,
                                  })
                                }
                              />
                              Recibe asignaciones automáticas
                            </label>
                          </div>

                          <h4>Horario semanal</h4>
                          <p>
                            La hora final queda excluida. Si termina
                            antes de empezar, continúa al día siguiente.
                          </p>

                          <div className="hdgp-slots">
                            {technician.slots.map((slot, index) => (
                              <div className="hdgp-slot" key={index}>
                                <select
                                  aria-label="Día"
                                  value={slot.day}
                                  onChange={event =>
                                    updateSlot(index, {
                                      day: Number(event.target.value),
                                    })
                                  }
                                >
                                  {days.map((day, value) => (
                                    <option key={day} value={value}>
                                      {day}
                                    </option>
                                  ))}
                                </select>

                                <label>
                                  Desde
                                  <input
                                    type="time"
                                    value={slot.start}
                                    onChange={event =>
                                      updateSlot(index, {
                                        start: event.target.value,
                                      })
                                    }
                                  />
                                </label>

                                <label>
                                  Hasta
                                  <input
                                    type="time"
                                    value={slot.end}
                                    onChange={event =>
                                      updateSlot(index, {
                                        end: event.target.value,
                                      })
                                    }
                                  />
                                </label>

                                <button
                                  aria-label="Quitar franja"
                                  onClick={() =>
                                    updateTech(technician.userId, {
                                      slots: technician.slots.filter(
                                        (_, position) =>
                                          position !== index,
                                      ),
                                    })
                                  }
                                >
                                  Quitar
                                </button>
                              </div>
                            ))}
                          </div>

                          <div className="hdgp-actions">
                            <button
                              disabled={technician.slots.length >= 28}
                              onClick={() =>
                                updateTech(technician.userId, {
                                  slots: [
                                    ...technician.slots,
                                    {
                                      day: 1,
                                      start: '08:00',
                                      end: '17:00',
                                    },
                                  ],
                                })
                              }
                            >
                              Agregar franja
                            </button>

                            <button
                              onClick={() => {
                                if (
                                  !technician.slots.length ||
                                  window.confirm(
                                    '¿Reemplazar el horario por lunes ' +
                                      'a viernes de 08:00 a 17:00?',
                                  )
                                ) {
                                  updateTech(technician.userId, {
                                    slots: defaultSlots(),
                                  })
                                }
                              }}
                            >
                              Lunes a viernes
                            </button>

                            <span className="hdgp-tag">
                              {dirty
                                ? 'Cambios pendientes'
                                : technician.onDuty
                                  ? 'Dentro de horario'
                                  : 'Fuera de horario o sin configurar'}
                            </span>
                          </div>
                        </article>
                      )
                    })}
                  </div>

                  {!selected.technicians.length && (
                    <p>Agrega el principal y los relevos necesarios.</p>
                  )}
                </details>
              </section>

              <footer className="hdgp-save">
                <span>
                  {dirty
                    ? 'Cambios pendientes de guardar'
                    : 'Configuración cargada'}
                </span>
                <button
                  className="hdgp-primary"
                  disabled={!dirty}
                  onClick={() => void save()}
                >
                  {saving
                    ? 'Guardando…'
                    : 'Guardar configuración completa'}
                </button>
              </footer>
            </fieldset>
          )}
        </section>
      </div>
    </main>
  )
}