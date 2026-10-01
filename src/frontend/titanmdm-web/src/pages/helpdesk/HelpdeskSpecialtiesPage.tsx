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
  'Domingo', 'Lunes', 'Martes', 'Miércoles',
  'Jueves', 'Viernes', 'Sábado',
]

const defaults = (): Slot[] =>
  [1, 2, 3, 4, 5].map(day => ({
    day,
    start: '08:00',
    end: '17:00',
  }))

const clone = (x: Group): Group => ({
  ...x,
  tasks: [...x.tasks],
  zoneIds: [...x.zoneIds],
  technicians: x.technicians.map(t => ({
    ...t,
    slots: t.slots.map(s => ({ ...s })),
  })),
})

function message(ex: unknown) {
  return axios.isAxiosError<{
    message?: string
    detail?: string
  }>(ex)
    ? ex.response?.data?.message ??
      ex.response?.data?.detail ??
      'No se pudo completar la operación.'
    : ex instanceof Error
      ? ex.message
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
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [task, setTask] = useState('')
  const [staffId, setStaffId] = useState('')
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const busy = loading || saving

  const load = useCallback(async (id?: string) => {
    setLoading(true)

    try {
      const { data } = await apiClient.get<Catalog>(
        '/helpdesk/group-planning',
      )

      data.groups = data.groups.filter(x => x.isActive)
      setCatalog(data)

      const group =
        data.groups.find(x => x.id === id) ?? data.groups[0]

      setSelected(group ? clone(group) : null)
      setDirty(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load().catch(ex => setError(message(ex)))
  }, [load])

  const update = (patch: Partial<Group>) => {
    setSelected(x => x ? { ...x, ...patch } : null)
    setDirty(true)
    setSuccess('')
    setError('')
  }

  const tech = (id: string, patch: Partial<Technician>) => {
    if (selected) {
      update({
        technicians: selected.technicians.map(x =>
          x.userId === id ? { ...x, ...patch } : x,
        ),
      })
    }
  }

  const choose = (group: Group) => {
    if (
      dirty &&
      !window.confirm('¿Descartar los cambios sin guardar?')
    ) return

    setSelected(clone(group))
    setDirty(false)
    setError('')
    setSuccess('')
    setTask('')
    setStaffId('')
  }

  const addTask = () => {
    if (!selected) return

    const tasks = [...new Set([
      ...selected.tasks,
      ...task
        .split(/[,;\n]/)
        .map(x => x.trim().toLowerCase())
        .filter(Boolean),
    ])]

    if (
      tasks.length > 15 ||
      tasks.some(x => x.length > 50 || x.includes('|'))
    ) {
      setError('Admite hasta 15 tareas, de hasta 50 caracteres.')
      return
    }

    update({ tasks })
    setTask('')
  }

  const addTech = () => {
    if (
      !selected ||
      !staffId ||
      selected.technicians.some(x => x.userId === staffId)
    ) return

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
              ...selected.technicians.map(x => x.priority),
            ) + 1,
          ),
          timeZoneId: 'America/Santo_Domingo',
          slots: defaults(),
        },
      ],
    })

    setStaffId('')
  }

  async function save() {
    if (!selected || saving) return

    if (!selected.tasks.length || !selected.zoneIds.length) {
      setError('Agrega al menos una tarea y una zona de cobertura.')
      return
    }

    if (selected.technicians.some(x =>
      x.acceptsAutomaticAssignments && !x.slots.length,
    )) {
      setError('Cada técnico automático necesita un horario.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

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
      setSuccess(
        'Grupo, tareas, cobertura, técnicos y horarios guardados.',
      )

      try {
        await load(selected.id)
      } catch (ex) {
        setError(
          'Se guardó, pero no se pudo actualizar la pantalla. ' +
          message(ex),
        )
      }
    } catch (ex) {
      setError(message(ex))
    } finally {
      setSaving(false)
    }
  }

  async function create() {
    if (!name.trim() || saving) {
      setError('Escribe el nombre del grupo.')
      return
    }

    if (
      dirty &&
      !window.confirm(
        '¿Descartar los cambios pendientes y crear otro grupo?',
      )
    ) return

    setSaving(true)
    setError('')

    try {
      const { data } = await apiClient.post<{ id: string }>(
        '/helpdesk/group-planning/groups',
        {
          name: name.trim(),
          description: description.trim() || null,
        },
      )

      setShowCreate(false)
      setName('')
      setDescription('')

      try {
        await load(data.id)
        setSuccess(
          'Grupo creado. Configura sus tareas, zonas y técnicos.',
        )
      } catch (ex) {
        setError(
          'El grupo se creó, pero no se pudo actualizar. ' +
          message(ex),
        )
      }
    } catch (ex) {
      setError(message(ex))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (
      !selected ||
      saving ||
      !window.confirm(
        `¿Eliminar el grupo "${selected.name}"? ` +
        'Se conservará el historial. ' +
        'Los cambios sin guardar se descartarán.',
      )
    ) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const { data } = await apiClient.delete<{ message: string }>(
        `/my/helpdesk/request-form/groups/${selected.id}`,
      )

      setSelected(null)
      setDirty(false)

      try {
        await load()
        setSuccess(data.message)
      } catch (ex) {
        setError(
          'Se eliminó el grupo. Actualiza la pantalla. ' +
          message(ex),
        )
      }
    } catch (ex) {
      setError(message(ex))
    } finally {
      setSaving(false)
    }
  }

  async function refresh() {
    if (
      dirty &&
      !window.confirm(
        '¿Descartar los cambios sin guardar y actualizar?',
      )
    ) return

    setError('')

    try {
      await load(selected?.id)
    } catch (ex) {
      setError(message(ex))
    }
  }

  return (
    <main className="hdgp">
      <header className="hdgp-header">
        <div>
          <span className="hdgp-eyebrow">
            MESA DE AYUDA · ADMINISTRACIÓN
          </span>
          <h1>Grupos, tareas y turnos</h1>
          <p>
            Define qué atiende cada grupo, dónde trabaja y quién
            recibe el ticket en cada horario.
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

      {success && (
        <div className="hdgp-alert hdgp-success" role="status">
          {success}
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
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Grupo CEDI"
              />
            </label>

            <label>
              Descripción
              <input
                maxLength={500}
                value={description}
                onChange={e => setDescription(e.target.value)}
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
            onChange={e => setSearch(e.target.value)}
          />

          {catalog.groups
            .filter(x =>
              x.name.toLowerCase().includes(search.toLowerCase()),
            )
            .map(group => (
              <button
                key={group.id}
                disabled={busy}
                className={
                  `hdgp-group ${selected?.id === group.id ? 'selected' : ''}`
                }
                onClick={() => choose(group)}
              >
                <strong>{group.name}</strong>
                <span>
                  {group.tasks.length} tareas ·{' '}
                  {group.technicians.length} técnicos
                </span>
              </button>
            ))}

          {!loading && !catalog.groups.length && (
            <p>Crea el primer grupo.</p>
          )}
        </aside>

        <section className="hdgp-editor">
          {loading && (
            <div className="hdgp-panel">
              Cargando configuración…
            </div>
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

                  <div className="hdgp-actions">
                    <span className="hdgp-tag">Activo</span>
                    <button
                      className="hdgp-remove"
                      onClick={() => void remove()}
                    >
                      Eliminar grupo
                    </button>
                  </div>
                </div>

                <details open>
                  <summary>
                    1. Tareas y equipos que atiende
                  </summary>
                  <p>
                    Agrega las tareas individualmente
                    o separadas por comas.
                  </p>

                  <div className="hdgp-inline">
                    <input
                      value={task}
                      placeholder="Telefonía, cableado, RP4, mouse, monitor…"
                      onChange={e => setTask(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addTask()
                        }
                      }}
                    />
                    <button onClick={addTask}>
                      Agregar tareas
                    </button>
                  </div>

                  <div className="hdgp-chips">
                    {selected.tasks.map(value => (
                      <span key={value}>
                        {value}
                        <button
                          aria-label={`Quitar ${value}`}
                          onClick={() => update({
                            tasks: selected.tasks.filter(
                              x => x !== value,
                            ),
                          })}
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
                    La ubicación del técnico se configura
                    en Ubicaciones y usuarios.
                  </p>

                  <div className="hdgp-zones">
                    {catalog.zones.map(zone => (
                      <label key={zone.id}>
                        <input
                          type="checkbox"
                          checked={selected.zoneIds.includes(zone.id)}
                          onChange={e => update({
                            zoneIds: e.target.checked
                              ? [...selected.zoneIds, zone.id]
                              : selected.zoneIds.filter(
                                  id => id !== zone.id,
                                ),
                          })}
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
                  <summary>
                    3. Técnicos, prioridad y relevos
                  </summary>
                  <p>
                    Prioridad 1: principal. Prioridad 2: relevo.
                    Se comprueba horario, disponibilidad y capacidad.
                  </p>

                  <div className="hdgp-inline">
                    <select
                      aria-label="Técnico para agregar"
                      value={staffId}
                      onChange={e => setStaffId(e.target.value)}
                    >
                      <option value="">
                        Selecciona un técnico…
                      </option>

                      {catalog.users
                        .filter(u =>
                          u.eligible &&
                          !selected.technicians.some(
                            x => x.userId === u.id,
                          ),
                        )
                        .map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name} · {u.email}
                          </option>
                        ))}
                    </select>

                    <button
                      disabled={!staffId}
                      onClick={addTech}
                    >
                      Agregar técnico
                    </button>
                  </div>

                  <div className="hdgp-technicians">
                    {selected.technicians.map(t => {
                      const user = catalog.users.find(
                        x => x.id === t.userId,
                      )

                      const location =
                        user?.zoneIds.length === 1
                          ? catalog.zones.find(
                              x => x.id === user.zoneIds[0],
                            )?.name
                          : undefined

                      const slot = (
                        index: number,
                        patch: Partial<Slot>,
                      ) => tech(t.userId, {
                        slots: t.slots.map((x, i) =>
                          i === index ? { ...x, ...patch } : x,
                        ),
                      })

                      return (
                        <article
                          className="hdgp-technician"
                          key={t.userId}
                        >
                          <div className="hdgp-title">
                            <div>
                              <h3>
                                {user?.name ??
                                  'Cuenta no disponible'}
                              </h3>
                              <small>
                                {location ??
                                  'Ubicación sin confirmar'} ·{' '}
                                {user?.email}
                              </small>
                            </div>

                            <button
                              className="hdgp-remove"
                              onClick={() => {
                                if (window.confirm(
                                  '¿Quitar este técnico del grupo? ' +
                                  'Su cuenta no se elimina.',
                                )) {
                                  update({
                                    technicians:
                                      selected.technicians.filter(
                                        x => x.userId !== t.userId,
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
                                value={t.priority}
                                onChange={e => tech(t.userId, {
                                  priority: Number(e.target.value),
                                })}
                              />
                            </label>

                            <label>
                              Máximo de tickets abiertos
                              <input
                                type="number"
                                min={1}
                                max={500}
                                value={t.maxOpenTickets}
                                onChange={e => tech(t.userId, {
                                  maxOpenTickets:
                                    Number(e.target.value),
                                })}
                              />
                            </label>

                            <label>
                              Zona horaria
                              <input
                                value={t.timeZoneId}
                                onChange={e => tech(t.userId, {
                                  timeZoneId: e.target.value,
                                })}
                              />
                            </label>

                            <label className="hdgp-check">
                              <input
                                type="checkbox"
                                checked={t.isAvailable}
                                onChange={e => tech(t.userId, {
                                  isAvailable: e.target.checked,
                                })}
                              />
                              Disponible para trabajar
                            </label>

                            <label className="hdgp-check">
                              <input
                                type="checkbox"
                                checked={
                                  t.acceptsAutomaticAssignments
                                }
                                onChange={e => tech(t.userId, {
                                  acceptsAutomaticAssignments:
                                    e.target.checked,
                                })}
                              />
                              Recibe asignaciones automáticas
                            </label>
                          </div>

                          <h4>Horario semanal</h4>
                          <p>
                            La hora final queda excluida.
                            Si termina antes de empezar,
                            continúa al día siguiente.
                          </p>

                          <div className="hdgp-slots">
                            {t.slots.map((s, index) => (
                              <div
                                className="hdgp-slot"
                                key={index}
                              >
                                <select
                                  aria-label="Día"
                                  value={s.day}
                                  onChange={e => slot(index, {
                                    day: Number(e.target.value),
                                  })}
                                >
                                  {days.map((d, value) => (
                                    <option key={d} value={value}>
                                      {d}
                                    </option>
                                  ))}
                                </select>

                                <label>
                                  Desde
                                  <input
                                    type="time"
                                    value={s.start}
                                    onChange={e => slot(index, {
                                      start: e.target.value,
                                    })}
                                  />
                                </label>

                                <label>
                                  Hasta
                                  <input
                                    type="time"
                                    value={s.end}
                                    onChange={e => slot(index, {
                                      end: e.target.value,
                                    })}
                                  />
                                </label>

                                <button
                                  aria-label="Quitar franja"
                                  onClick={() => tech(t.userId, {
                                    slots: t.slots.filter(
                                      (_, i) => i !== index,
                                    ),
                                  })}
                                >
                                  Quitar
                                </button>
                              </div>
                            ))}
                          </div>

                          <div className="hdgp-actions">
                            <button
                              disabled={t.slots.length >= 28}
                              onClick={() => tech(t.userId, {
                                slots: [
                                  ...t.slots,
                                  {
                                    day: 1,
                                    start: '08:00',
                                    end: '17:00',
                                  },
                                ],
                              })}
                            >
                              Agregar franja
                            </button>

                            <button
                              onClick={() => {
                                if (
                                  !t.slots.length ||
                                  window.confirm(
                                    '¿Reemplazar el horario por lunes ' +
                                    'a viernes de 08:00 a 17:00?',
                                  )
                                ) {
                                  tech(t.userId, {
                                    slots: defaults(),
                                  })
                                }
                              }}
                            >
                              Lunes a viernes
                            </button>

                            <span className="hdgp-tag">
                              {dirty
                                ? 'Cambios pendientes'
                                : t.onDuty
                                  ? 'Dentro de horario'
                                  : 'Fuera de horario o sin configurar'}
                            </span>
                          </div>
                        </article>
                      )
                    })}
                  </div>

                  {!selected.technicians.length && (
                    <p>
                      Agrega el principal y los relevos necesarios.
                    </p>
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