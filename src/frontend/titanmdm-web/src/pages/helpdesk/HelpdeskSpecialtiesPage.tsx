import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import axios from 'axios'

import apiClient
  from '../../api/apiClient'

import './HelpdeskSpecialtiesPage.css'

type Slot = {
  day: number
  start: string
  end: string
}

type Technician = {
  userId: string

  isAvailable: boolean

  acceptsAutomaticAssignments:
    boolean

  maxOpenTickets: number

  priority: number

  timeZoneId: string

  slots: Slot[]

  configured?: boolean

  onDuty?: boolean
}

type Coverage = {
  id?: string

  siteId: string

  siteLocationId:
    string | null

  category:
    string | null

  priority: number

  isActive?: boolean
}

type Group = {
  id: string

  name: string

  description:
    string | null

  isActive: boolean

  tasks: string[]

  coverages:
    Coverage[]

  technicians:
    Technician[]
}

type Site = {
  id: string
  code: string
  name: string
  city: string | null
  province: string | null
  isActive: boolean
}

type SiteLocation = {
  id: string
  siteId: string
  name: string
  description: string | null
  isActive: boolean
}

type Staff = {
  id: string
  name: string
  email: string

  eligible: boolean

  siteId:
    string | null

  siteName:
    string | null

  siteLocationId:
    string | null

  siteLocationName:
    string | null
}

type Catalog = {
  groups: Group[]
  sites: Site[]
  locations: SiteLocation[]
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

const defaults =
  (): Slot[] =>
    [
      1,
      2,
      3,
      4,
      5,
    ].map(
      day => ({
        day,
        start:
          '08:00',

        end:
          '17:00',
      }),
    )

const clone =
  (
    group: Group,
  ): Group => ({
    ...group,

    tasks:
      [
        ...group.tasks,
      ],

    coverages:
      group.coverages.map(
        item => ({
          ...item,
        }),
      ),

    technicians:
      group.technicians.map(
        technician => ({
          ...technician,

          slots:
            technician.slots.map(
              slot => ({
                ...slot,
              }),
            ),
        }),
      ),
  })

function message(
  exception: unknown,
) {
  return axios
    .isAxiosError<{
      message?: string
      detail?: string
    }>(
      exception,
    )
      ? exception.response
          ?.data
          ?.message
        ??
        exception.response
          ?.data
          ?.detail
        ??
        'No se pudo completar la operación.'
      : exception instanceof
          Error
        ? exception.message
        : 'No se pudo completar la operación.'
}

export function HelpdeskSpecialtiesPage() {
  const [
    catalog,
    setCatalog,
  ] =
    useState<Catalog>({
      groups: [],
      sites: [],
      locations: [],
      users: [],
    })

  const [
    selected,
    setSelected,
  ] =
    useState<Group | null>(
      null,
    )

  const [
    dirty,
    setDirty,
  ] =
    useState(
      false,
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    )

  const [
    saving,
    setSaving,
  ] =
    useState(
      false,
    )

  const [
    success,
    setSuccess,
  ] =
    useState(
      '',
    )

  const [
    error,
    setError,
  ] =
    useState(
      '',
    )

  const [
    task,
    setTask,
  ] =
    useState(
      '',
    )

  const [
    staffId,
    setStaffId,
  ] =
    useState(
      '',
    )

  const [
    search,
    setSearch,
  ] =
    useState(
      '',
    )

  const [
    name,
    setName,
  ] =
    useState(
      '',
    )

  const [
    description,
    setDescription,
  ] =
    useState(
      '',
    )

  const [
    showCreate,
    setShowCreate,
  ] =
    useState(
      false,
    )

  const [
    coverageSiteId,
    setCoverageSiteId,
  ] =
    useState(
      '',
    )

  const [
    coverageLocationId,
    setCoverageLocationId,
  ] =
    useState(
      '',
    )

  const [
    coverageCategory,
    setCoverageCategory,
  ] =
    useState(
      '',
    )

  const [
    coveragePriority,
    setCoveragePriority,
  ] =
    useState(
      100,
    )

  const busy =
    loading ||
    saving

  const load =
    useCallback(
      async (
        id?: string,
      ) => {
        setLoading(
          true,
        )

        try {
          const {
            data,
          } =
            await apiClient
              .get<Catalog>(
                '/helpdesk/group-planning',
              )

          data.groups =
            data.groups.filter(
              group =>
                group.isActive,
            )

          setCatalog(
            data,
          )

          const group =
            data.groups.find(
              item =>
                item.id ===
                id,
            )
            ??
            data.groups[0]

          setSelected(
            group
              ? clone(
                  group,
                )
              : null,
          )

          setDirty(
            false,
          )
        }
        finally {
          setLoading(
            false,
          )
        }
      },
      [],
    )

  useEffect(
    () => {
      void load()
        .catch(
          exception =>
            setError(
              message(
                exception,
              ),
            ),
        )
    },
    [
      load,
    ],
  )

  const locationsForCoverage =
    useMemo(
      () =>
        catalog.locations.filter(
          location =>
            location.siteId ===
              coverageSiteId
            &&
            location.isActive,
        ),
      [
        catalog.locations,
        coverageSiteId,
      ],
    )

  const update =
    (
      patch:
        Partial<Group>,
    ) => {
      setSelected(
        current =>
          current
            ? {
                ...current,
                ...patch,
              }
            : null,
      )

      setDirty(
        true,
      )

      setSuccess(
        '',
      )

      setError(
        '',
      )
    }

  const updateTech =
    (
      id: string,
      patch:
        Partial<Technician>,
    ) => {
      if (
        !selected
      ) {
        return
      }

      update({
        technicians:
          selected.technicians.map(
            item =>
              item.userId ===
                id
                ? {
                    ...item,
                    ...patch,
                  }
                : item,
          ),
      })
    }

  const choose =
    (
      group: Group,
    ) => {
      if (
        dirty
        &&
        !window.confirm(
          '¿Descartar los cambios sin guardar?',
        )
      ) {
        return
      }

      setSelected(
        clone(
          group,
        ),
      )

      setDirty(
        false,
      )

      setError(
        '',
      )

      setSuccess(
        '',
      )

      setTask(
        '',
      )

      setStaffId(
        '',
      )
    }

  const addTask =
    () => {
      if (
        !selected
      ) {
        return
      }

      const tasks =
        [
          ...new Set(
            [
              ...selected.tasks,

              ...task
                .split(
                  /[,;\n]/,
                )
                .map(
                  value =>
                    value
                      .trim()
                      .toLowerCase(),
                )
                .filter(
                  Boolean,
                ),
            ],
          ),
        ]

      if (
        tasks.length >
          50
        ||
        tasks.some(
          value =>
            value.length >
              100
            ||
            value.includes(
              '|',
            ),
        )
      ) {
        setError(
          'Admite hasta 50 tareas de hasta 100 caracteres.',
        )

        return
      }

      update({
        tasks,
      })

      setTask(
        '',
      )
    }

  const addCoverage =
    () => {
      if (
        !selected
        ||
        !coverageSiteId
      ) {
        return
      }

      const category =
        coverageCategory
          .trim()
          .toLowerCase()
        ||
        null

      const duplicate =
        selected.coverages.some(
          item =>
            item.siteId ===
              coverageSiteId
            &&
            (
              item.siteLocationId
              ??
              null
            ) ===
              (
                coverageLocationId
                  ? coverageLocationId
                  : null
              )
            &&
            (
              item.category
              ??
              null
            ) ===
              category,
        )

      if (
        duplicate
      ) {
        setError(
          'Esa cobertura ya está agregada al grupo.',
        )

        return
      }

      update({
        coverages: [
          ...selected.coverages,

          {
            siteId:
              coverageSiteId,

            siteLocationId:
              coverageLocationId
                ? coverageLocationId
                : null,

            category,

            priority:
              coveragePriority,
          },
        ],
      })

      setCoverageLocationId(
        '',
      )

      setCoverageCategory(
        '',
      )

      setCoveragePriority(
        100,
      )
    }

  const addTech =
    () => {
      if (
        !selected
        ||
        !staffId
        ||
        selected.technicians
          .some(
            technician =>
              technician.userId ===
                staffId,
          )
      ) {
        return
      }

      update({
        technicians: [
          ...selected.technicians,

          {
            userId:
              staffId,

            isAvailable:
              true,

            acceptsAutomaticAssignments:
              true,

            maxOpenTickets:
              20,

            priority:
              Math.min(
                100,
                Math.max(
                  0,
                  ...selected.technicians
                    .map(
                      technician =>
                        technician.priority,
                    ),
                )
                +
                1,
              ),

            timeZoneId:
              'America/Santo_Domingo',

            slots:
              defaults(),
          },
        ],
      })

      setStaffId(
        '',
      )
    }

  async function save() {
    if (
      !selected
      ||
      saving
    ) {
      return
    }

    if (
      !selected.tasks
        .length
    ) {
      setError(
        'Agrega al menos una tarea o categoría al grupo.',
      )

      return
    }

    if (
      !selected.coverages
        .length
    ) {
      setError(
        'Agrega al menos una localidad de cobertura.',
      )

      return
    }

    if (
      selected.technicians
        .some(
          technician =>
            technician
              .acceptsAutomaticAssignments
            &&
            !technician.slots
              .length,
        )
    ) {
      setError(
        'Cada técnico con asignación automática necesita un horario.',
      )

      return
    }

    setSaving(
      true,
    )

    setError(
      '',
    )

    setSuccess(
      '',
    )

    try {
      await apiClient.put(
        `/helpdesk/group-planning/groups/${selected.id}`,
        {
          tasks:
            selected.tasks,

          coverages:
            selected.coverages.map(
              item => ({
                siteId:
                  item.siteId,

                siteLocationId:
                  item.siteLocationId,

                category:
                  item.category,

                priority:
                  item.priority,
              }),
            ),

          technicians:
            selected.technicians,
        },
      )

      setDirty(
        false,
      )

      setSuccess(
        'Grupo, localidades, técnicos y turnos guardados correctamente.',
      )

      await load(
        selected.id,
      )
    }
    catch (
      exception
    ) {
      setError(
        message(
          exception,
        ),
      )
    }
    finally {
      setSaving(
        false,
      )
    }
  }

  async function create() {
    if (
      !name.trim()
      ||
      saving
    ) {
      setError(
        'Escribe el nombre del grupo.',
      )

      return
    }

    setSaving(
      true,
    )

    setError(
      '',
    )

    try {
      const {
        data,
      } =
        await apiClient.post<{
          id: string
        }>(
          '/helpdesk/group-planning/groups',
          {
            name:
              name.trim(),

            description:
              description
                .trim()
              ||
              null,
          },
        )

      setShowCreate(
        false,
      )

      setName(
        '',
      )

      setDescription(
        '',
      )

      await load(
        data.id,
      )

      setSuccess(
        'Grupo creado. Configura su cobertura, técnicos y turnos.',
      )
    }
    catch (
      exception
    ) {
      setError(
        message(
          exception,
        ),
      )
    }
    finally {
      setSaving(
        false,
      )
    }
  }

  function siteLabel(
    siteId:
      string,
  ) {
    return (
      catalog.sites
        .find(
          site =>
            site.id ===
              siteId,
        )
        ?.name
      ??
      'Localidad no disponible'
    )
  }

  function locationLabel(
    id:
      string | null,
  ) {
    if (
      !id
    ) {
      return 'Toda la localidad'
    }

    return (
      catalog.locations
        .find(
          item =>
            item.id ===
              id,
        )
        ?.name
      ??
      'Sublocalidad no disponible'
    )
  }

  return (
    <main
      className="hdgp"
    >
      <header
        className="hdgp-header"
      >
        <div>
          <span
            className="hdgp-eyebrow"
          >
            MESA DE AYUDA · ADMINISTRACIÓN
          </span>

          <h1>
            Grupos, cobertura y turnos
          </h1>

          <p>
            Configura qué atiende cada grupo,
            qué localidades cubre y qué técnicos
            reciben las solicitudes.
          </p>
        </div>

        <div
          className="hdgp-actions"
        >
          <Link
            to="/helpdesk/operations?workspace=helpdesk"
          >
            Localidades
          </Link>

          <button
            disabled={
              busy
            }
            onClick={
              () =>
                void load(
                  selected
                    ?.id,
                )
            }
          >
            Actualizar
          </button>

          <button
            className="hdgp-primary"
            disabled={
              busy
            }
            onClick={
              () =>
                setShowCreate(
                  value =>
                    !value,
                )
            }
          >
            Crear grupo
          </button>
        </div>
      </header>

      {error && (
        <div
          className="hdgp-alert hdgp-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="hdgp-alert hdgp-success"
          role="status"
        >
          {success}
        </div>
      )}

      {showCreate && (
        <section
          className="hdgp-panel"
        >
          <h2>
            Nuevo grupo
          </h2>

          <fieldset
            disabled={
              busy
            }
            className="hdgp-create"
          >
            <label>
              Nombre

              <input
                maxLength={
                  120
                }
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
                placeholder={
                  'Ej.: Soporte Parque 1'
                }
              />
            </label>

            <label>
              Descripción

              <input
                maxLength={
                  500
                }
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
              />
            </label>

            <button
              className="hdgp-primary"
              onClick={
                () =>
                  void create()
              }
            >
              Crear
            </button>
          </fieldset>
        </section>
      )}

      <div
        className="hdgp-layout"
      >
        <aside
          className="hdgp-panel hdgp-sidebar"
        >
          <h2>
            Grupos de trabajo
          </h2>

          <input
            aria-label="Buscar grupo"
            placeholder="Buscar grupo…"
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
          />

          {catalog.groups
            .filter(
              group =>
                group.name
                  .toLowerCase()
                  .includes(
                    search
                      .toLowerCase(),
                  ),
            )
            .map(
              group => (
                <button
                  key={
                    group.id
                  }
                  disabled={
                    busy
                  }
                  className={
                    `hdgp-group ${
                      selected
                        ?.id ===
                      group.id
                        ? 'selected'
                        : ''
                    }`
                  }
                  onClick={
                    () =>
                      choose(
                        group,
                      )
                  }
                >
                  <strong>
                    {
                      group.name
                    }
                  </strong>

                  <span>
                    {
                      group.tasks.length
                    } tareas ·{' '}
                    {
                      group.coverages.length
                    } localidades ·{' '}
                    {
                      group.technicians.length
                    } técnicos
                  </span>
                </button>
              ),
            )}
        </aside>

        <section
          className="hdgp-editor"
        >
          {loading && (
            <div
              className="hdgp-panel"
            >
              Cargando configuración…
            </div>
          )}

          {!loading &&
            !selected && (
            <div
              className="hdgp-panel"
            >
              Crea o selecciona un grupo.
            </div>
          )}

          {selected && (
            <fieldset
              disabled={
                busy
              }
            >
              <section
                className="hdgp-panel"
              >
                <h2>
                  {
                    selected.name
                  }
                </h2>

                <p>
                  {
                    selected.description
                    ||
                    'Grupo de atención.'
                  }
                </p>

                <details
                  open
                >
                  <summary>
                    1. Tareas y categorías
                  </summary>

                  <div
                    className="hdgp-inline"
                  >
                    <input
                      value={
                        task
                      }
                      placeholder={
                        'Telefonía, cableado, ERP, impresoras…'
                      }
                      onChange={
                        event =>
                          setTask(
                            event
                              .target
                              .value,
                          )
                      }
                    />

                    <button
                      onClick={
                        addTask
                      }
                    >
                      Agregar
                    </button>
                  </div>

                  <div
                    className="hdgp-chips"
                  >
                    {selected.tasks.map(
                      value => (
                        <span
                          key={
                            value
                          }
                        >
                          {value}

                          <button
                            onClick={
                              () =>
                                update({
                                  tasks:
                                    selected.tasks
                                      .filter(
                                        item =>
                                          item !==
                                          value,
                                      ),
                                })
                            }
                          >
                            ×
                          </button>
                        </span>
                      ),
                    )}
                  </div>
                </details>
              </section>

              <section
                className="hdgp-panel"
              >
                <details
                  open
                >
                  <summary>
                    2. Cobertura por localidad
                  </summary>

                  <p>
                    Estas localidades son las mismas
                    definidas en Configuración → Localidades.
                  </p>

                  <div
                    className="hdgp-inline"
                  >
                    <select
                      value={
                        coverageSiteId
                      }
                      onChange={
                        event => {
                          setCoverageSiteId(
                            event
                              .target
                              .value,
                          )

                          setCoverageLocationId(
                            '',
                          )
                        }
                      }
                    >
                      <option
                        value=""
                      >
                        Selecciona localidad…
                      </option>

                      {catalog.sites
                        .filter(
                          site =>
                            site.isActive,
                        )
                        .map(
                          site => (
                            <option
                              key={
                                site.id
                              }
                              value={
                                site.id
                              }
                            >
                              {
                                site.name
                              }
                            </option>
                          ),
                        )}
                    </select>

                    <select
                      value={
                        coverageLocationId
                      }
                      disabled={
                        !coverageSiteId
                      }
                      onChange={
                        event =>
                          setCoverageLocationId(
                            event
                              .target
                              .value,
                          )
                      }
                    >
                      <option
                        value=""
                      >
                        Toda la localidad
                      </option>

                      {locationsForCoverage.map(
                        location => (
                          <option
                            key={
                              location.id
                            }
                            value={
                              location.id
                            }
                          >
                            {
                              location.name
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div
                    className="hdgp-inline"
                  >
                    <input
                      placeholder={
                        'Categoría opcional'
                      }
                      value={
                        coverageCategory
                      }
                      onChange={
                        event =>
                          setCoverageCategory(
                            event
                              .target
                              .value,
                          )
                      }
                    />

                    <input
                      type="number"
                      min={
                        1
                      }
                      max={
                        1000
                      }
                      value={
                        coveragePriority
                      }
                      onChange={
                        event =>
                          setCoveragePriority(
                            Number(
                              event
                                .target
                                .value,
                            ),
                          )
                      }
                    />

                    <button
                      disabled={
                        !coverageSiteId
                      }
                      onClick={
                        addCoverage
                      }
                    >
                      Agregar cobertura
                    </button>
                  </div>

                  <div
                    className="hdgp-technicians"
                  >
                    {selected.coverages.map(
                      (
                        coverage,
                        index,
                      ) => (
                        <article
                          key={
                            `${
                              coverage.siteId
                            }-${
                              coverage.siteLocationId
                              ??
                              'all'
                            }-${
                              coverage.category
                              ??
                              'all'
                            }-${index}`
                          }
                          className="hdgp-technician"
                        >
                          <div
                            className="hdgp-title"
                          >
                            <div>
                              <h3>
                                {siteLabel(
                                  coverage.siteId,
                                )}
                              </h3>

                              <small>
                                {locationLabel(
                                  coverage.siteLocationId,
                                )}

                                {' · '}

                                {
                                  coverage.category
                                  ??
                                  'Todas las categorías'
                                }

                                {' · Prioridad '}

                                {
                                  coverage.priority
                                }
                              </small>
                            </div>

                            <button
                              className="hdgp-remove"
                              onClick={
                                () =>
                                  update({
                                    coverages:
                                      selected.coverages
                                        .filter(
                                          (
                                            _,
                                            current,
                                          ) =>
                                            current !==
                                            index,
                                        ),
                                  })
                              }
                            >
                              Quitar
                            </button>
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                </details>
              </section>

              <section
                className="hdgp-panel"
              >
                <details
                  open
                >
                  <summary>
                    3. Técnicos, capacidad y turnos
                  </summary>

                  <div
                    className="hdgp-inline"
                  >
                    <select
                      value={
                        staffId
                      }
                      onChange={
                        event =>
                          setStaffId(
                            event
                              .target
                              .value,
                          )
                      }
                    >
                      <option
                        value=""
                      >
                        Selecciona técnico…
                      </option>

                      {catalog.users
                        .filter(
                          user =>
                            user.eligible
                            &&
                            !selected.technicians
                              .some(
                                technician =>
                                  technician.userId ===
                                    user.id,
                              ),
                        )
                        .map(
                          user => (
                            <option
                              key={
                                user.id
                              }
                              value={
                                user.id
                              }
                            >
                              {
                                user.name
                              } · {
                                user.email
                              }
                            </option>
                          ),
                        )}
                    </select>

                    <button
                      disabled={
                        !staffId
                      }
                      onClick={
                        addTech
                      }
                    >
                      Agregar técnico
                    </button>
                  </div>

                  <div
                    className="hdgp-technicians"
                  >
                    {selected.technicians.map(
                      technician => {
                        const user =
                          catalog.users
                            .find(
                              item =>
                                item.id ===
                                  technician.userId,
                            )

                        return (
                          <article
                            key={
                              technician.userId
                            }
                            className="hdgp-technician"
                          >
                            <div
                              className="hdgp-title"
                            >
                              <div>
                                <h3>
                                  {
                                    user?.name
                                    ??
                                    'Cuenta no disponible'
                                  }
                                </h3>

                                <small>
                                  {
                                    user?.siteName
                                    ??
                                    'Sin localidad'
                                  }

                                  {user?.siteLocationName
                                    ? ` / ${user.siteLocationName}`
                                    : ''}

                                  {' · '}

                                  {
                                    user?.email
                                  }
                                </small>
                              </div>

                              <button
                                className="hdgp-remove"
                                onClick={
                                  () =>
                                    update({
                                      technicians:
                                        selected.technicians
                                          .filter(
                                            item =>
                                              item.userId !==
                                              technician.userId,
                                          ),
                                    })
                                }
                              >
                                Quitar
                              </button>
                            </div>

                            <div
                              className="hdgp-tech-settings"
                            >
                              <label>
                                Prioridad

                                <input
                                  type="number"
                                  min={
                                    1
                                  }
                                  max={
                                    100
                                  }
                                  value={
                                    technician.priority
                                  }
                                  onChange={
                                    event =>
                                      updateTech(
                                        technician.userId,
                                        {
                                          priority:
                                            Number(
                                              event
                                                .target
                                                .value,
                                            ),
                                        },
                                      )
                                  }
                                />
                              </label>

                              <label>
                                Máximo abiertos

                                <input
                                  type="number"
                                  min={
                                    1
                                  }
                                  max={
                                    500
                                  }
                                  value={
                                    technician.maxOpenTickets
                                  }
                                  onChange={
                                    event =>
                                      updateTech(
                                        technician.userId,
                                        {
                                          maxOpenTickets:
                                            Number(
                                              event
                                                .target
                                                .value,
                                            ),
                                        },
                                      )
                                  }
                                />
                              </label>

                              <label>
                                Zona horaria

                                <input
                                  value={
                                    technician.timeZoneId
                                  }
                                  onChange={
                                    event =>
                                      updateTech(
                                        technician.userId,
                                        {
                                          timeZoneId:
                                            event
                                              .target
                                              .value,
                                        },
                                      )
                                  }
                                />
                              </label>

                              <label
                                className="hdgp-check"
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    technician.isAvailable
                                  }
                                  onChange={
                                    event =>
                                      updateTech(
                                        technician.userId,
                                        {
                                          isAvailable:
                                            event
                                              .target
                                              .checked,
                                        },
                                      )
                                  }
                                />

                                Disponible
                              </label>

                              <label
                                className="hdgp-check"
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    technician.acceptsAutomaticAssignments
                                  }
                                  onChange={
                                    event =>
                                      updateTech(
                                        technician.userId,
                                        {
                                          acceptsAutomaticAssignments:
                                            event
                                              .target
                                              .checked,
                                        },
                                      )
                                  }
                                />

                                Autoasignación
                              </label>
                            </div>

                            <h4>
                              Horario semanal
                            </h4>

                            <div
                              className="hdgp-slots"
                            >
                              {technician.slots.map(
                                (
                                  slot,
                                  index,
                                ) => (
                                  <div
                                    className="hdgp-slot"
                                    key={
                                      index
                                    }
                                  >
                                    <select
                                      value={
                                        slot.day
                                      }
                                      onChange={
                                        event =>
                                          updateTech(
                                            technician.userId,
                                            {
                                              slots:
                                                technician.slots.map(
                                                  (
                                                    current,
                                                    currentIndex,
                                                  ) =>
                                                    currentIndex ===
                                                      index
                                                      ? {
                                                          ...current,
                                                          day:
                                                            Number(
                                                              event
                                                                .target
                                                                .value,
                                                            ),
                                                        }
                                                      : current,
                                                ),
                                            },
                                          )
                                      }
                                    >
                                      {days.map(
                                        (
                                          day,
                                          dayIndex,
                                        ) => (
                                          <option
                                            key={
                                              day
                                            }
                                            value={
                                              dayIndex
                                            }
                                          >
                                            {
                                              day
                                            }
                                          </option>
                                        ),
                                      )}
                                    </select>

                                    <input
                                      type="time"
                                      value={
                                        slot.start
                                      }
                                      onChange={
                                        event =>
                                          updateTech(
                                            technician.userId,
                                            {
                                              slots:
                                                technician.slots.map(
                                                  (
                                                    current,
                                                    currentIndex,
                                                  ) =>
                                                    currentIndex ===
                                                      index
                                                      ? {
                                                          ...current,
                                                          start:
                                                            event
                                                              .target
                                                              .value,
                                                        }
                                                      : current,
                                                ),
                                            },
                                          )
                                      }
                                    />

                                    <input
                                      type="time"
                                      value={
                                        slot.end
                                      }
                                      onChange={
                                        event =>
                                          updateTech(
                                            technician.userId,
                                            {
                                              slots:
                                                technician.slots.map(
                                                  (
                                                    current,
                                                    currentIndex,
                                                  ) =>
                                                    currentIndex ===
                                                      index
                                                      ? {
                                                          ...current,
                                                          end:
                                                            event
                                                              .target
                                                              .value,
                                                        }
                                                      : current,
                                                ),
                                            },
                                          )
                                      }
                                    />

                                    <button
                                      onClick={
                                        () =>
                                          updateTech(
                                            technician.userId,
                                            {
                                              slots:
                                                technician.slots
                                                  .filter(
                                                    (
                                                      _,
                                                      currentIndex,
                                                    ) =>
                                                      currentIndex !==
                                                      index,
                                                  ),
                                            },
                                          )
                                      }
                                    >
                                      Quitar
                                    </button>
                                  </div>
                                ),
                              )}
                            </div>

                            <div
                              className="hdgp-actions"
                            >
                              <button
                                onClick={
                                  () =>
                                    updateTech(
                                      technician.userId,
                                      {
                                        slots: [
                                          ...technician.slots,

                                          {
                                            day:
                                              1,

                                            start:
                                              '08:00',

                                            end:
                                              '17:00',
                                          },
                                        ],
                                      },
                                    )
                                }
                              >
                                Agregar franja
                              </button>

                              <button
                                onClick={
                                  () =>
                                    updateTech(
                                      technician.userId,
                                      {
                                        slots:
                                          defaults(),
                                      },
                                    )
                                }
                              >
                                Lunes a viernes
                              </button>

                              <span
                                className="hdgp-tag"
                              >
                                {
                                  technician.onDuty
                                    ? 'Dentro de horario'
                                    : 'Fuera de horario'
                                }
                              </span>
                            </div>
                          </article>
                        )
                      },
                    )}
                  </div>
                </details>
              </section>

              <footer
                className="hdgp-save"
              >
                <span>
                  {
                    dirty
                      ? 'Cambios pendientes'
                      : 'Configuración guardada'
                  }
                </span>

                <button
                  className="hdgp-primary"
                  disabled={
                    !dirty
                  }
                  onClick={
                    () =>
                      void save()
                  }
                >
                  {
                    saving
                      ? 'Guardando…'
                      : 'Guardar configuración completa'
                  }
                </button>
              </footer>
            </fieldset>
          )}
        </section>
      </div>
    </main>
  )
}