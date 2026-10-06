import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'

import {
  useSearchParams,
} from 'react-router-dom'

import axios
  from 'axios'

import {
  Building2,
  Headphones,
  MapPin,
  RefreshCw,
  Trash2,
  UserRound,
} from 'lucide-react'

import apiClient
  from '../../api/apiClient'

import './HelpdeskPages.css'
import './HelpdeskOperationsPage.css'

type OperationsTab =
  | 'sites'
  | 'coverage'
  | 'technicians'

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

type Team = {
  id: string
  name: string
  description: string | null
  categories: string | null
  isActive: boolean
}

type Coverage = {
  id: string
  teamId: string
  siteId: string
  siteLocationId: string | null
  category: string | null
  priority: number
  isActive: boolean
}

type Staff = {
  id: string
  name: string
  email: string

  siteId: string | null
  siteName: string | null

  siteLocationId: string | null
  siteLocationName: string | null

  canWorkTickets: boolean
  assistantEnabled: boolean
}

type Catalog = {
  sites: Site[]
  siteLocations: SiteLocation[]
  teams: Team[]
  coverages: Coverage[]
}

const emptyCatalog:
  Catalog = {
    sites: [],
    siteLocations: [],
    teams: [],
    coverages: [],
  }

function resolveTab(
  value:
    string | null,
): OperationsTab {
  if (
    value ===
      'coverage'
  ) {
    return 'coverage'
  }

  if (
    value ===
      'technicians'
  ) {
    return 'technicians'
  }

  return 'sites'
}

function errorMessage(
  error: unknown,
) {
  if (
    axios.isAxiosError(
      error,
    )
  ) {
    const data =
      error.response?.data as
        | {
            message?: string
            title?: string
          }
        | undefined

    return (
      data?.message
      ||
      data?.title
      ||
      `No se pudo completar la operación (${error.response?.status ?? 'sin conexión'}).`
    )
  }

  return error instanceof Error
    ? error.message
    : 'No se pudo completar la operación.'
}

export function HelpdeskOperationsPage() {
  const [
    searchParams,
    setSearchParams,
  ] =
    useSearchParams()

  const requestedTab =
    resolveTab(
      searchParams.get(
        'tab',
      ),
    )

  const [
    catalog,
    setCatalog,
  ] =
    useState<Catalog>(
      emptyCatalog,
    )

  const [
    staff,
    setStaff,
  ] =
    useState<Staff[]>(
      [],
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
    error,
    setError,
  ] =
    useState(
      '',
    )

  const [
    message,
    setMessage,
  ] =
    useState(
      '',
    )

  const [
    tab,
    setTab,
  ] =
    useState<OperationsTab>(
      requestedTab,
    )

  const [
    coverageTeamId,
    setCoverageTeamId,
  ] =
    useState(
      '',
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

  const disabled =
    loading
    ||
    saving

  // ============================================================
  // URL <-> TAB
  // ============================================================

  useEffect(
    () => {
      if (
        requestedTab !==
        tab
      ) {
        setTab(
          requestedTab,
        )
      }
    },
    [
      requestedTab,
      tab,
    ],
  )

  function changeTab(
    next:
      OperationsTab,
  ) {
    setTab(
      next,
    )

    setError(
      '',
    )

    setMessage(
      '',
    )

    const params =
      new URLSearchParams(
        searchParams,
      )

    if (
      next ===
      'sites'
    ) {
      params.delete(
        'tab',
      )
    }
    else {
      params.set(
        'tab',
        next,
      )
    }

    params.set(
      'workspace',
      'helpdesk',
    )

    setSearchParams(
      params,
    )
  }

  // ============================================================
  // DERIVED DATA
  // ============================================================

  const activeSites =
    useMemo(
      () =>
        catalog.sites.filter(
          site =>
            site.isActive,
        ),
      [
        catalog.sites,
      ],
    )

  const activeTeams =
    useMemo(
      () =>
        catalog.teams.filter(
          team =>
            team.isActive,
        ),
      [
        catalog.teams,
      ],
    )

  const visibleLocations =
    useMemo(
      () =>
        catalog.siteLocations
          .filter(
            item =>
              item.isActive
              &&
              item.siteId ===
                coverageSiteId,
          ),
      [
        catalog.siteLocations,
        coverageSiteId,
      ],
    )

  const activeLocationsCount =
    useMemo(
      () =>
        catalog.siteLocations
          .filter(
            item =>
              item.isActive,
          )
          .length,
      [
        catalog.siteLocations,
      ],
    )

  const enabledTechniciansCount =
    useMemo(
      () =>
        staff.filter(
          item =>
            item.canWorkTickets,
        )
          .length,
      [
        staff,
      ],
    )

  // ============================================================
  // LOAD
  // ============================================================

  const load =
    useCallback(
      async () => {
        setLoading(
          true,
        )

        try {
          const [
            catalogResult,
            staffResult,
          ] =
            await Promise.all(
              [
                apiClient
                  .get<Catalog>(
                    '/helpdesk/site-coverage/catalog',
                  ),

                apiClient
                  .get<Staff[]>(
                    '/helpdesk/staff/users',
                  ),
              ],
            )

          setCatalog(
            catalogResult.data,
          )

          setStaff(
            staffResult.data,
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

  const refresh =
    useCallback(
      async () => {
        setError(
          '',
        )

        try {
          await load()
        }
        catch (
          exception
        ) {
          setError(
            errorMessage(
              exception,
            ),
          )
        }
      },
      [
        load,
      ],
    )

  useEffect(
    () => {
      void refresh()
    },
    [
      refresh,
    ],
  )

  // ============================================================
  // SAVE HELPER
  // ============================================================

  async function save(
    action:
      () => Promise<unknown>,

    success:
      string,

    reset?:
      () => void,
  ) {
    if (
      disabled
    ) {
      return
    }

    setSaving(
      true,
    )

    setError(
      '',
    )

    setMessage(
      '',
    )

    try {
      await action()

      setMessage(
        success,
      )

      reset?.()

      await load()
    }
    catch (
      exception
    ) {
      setError(
        errorMessage(
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

  // ============================================================
  // COVERAGE CREATE
  // ============================================================

  function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      !coverageTeamId
      ||
      !coverageSiteId
    ) {
      setError(
        'Selecciona un grupo y una localidad.',
      )

      return
    }

    if (
      coveragePriority <
        1
      ||
      coveragePriority >
        1000
    ) {
      setError(
        'La prioridad debe estar entre 1 y 1000.',
      )

      return
    }

    void save(
      () =>
        apiClient.post(
          '/helpdesk/site-coverage',
          {
            teamId:
              coverageTeamId,

            siteId:
              coverageSiteId,

            siteLocationId:
              coverageLocationId
                ? coverageLocationId
                : null,

            category:
              coverageCategory
                .trim()
                .toLowerCase()
                ||
                null,

            priority:
              coveragePriority,
          },
        ),

      'Cobertura guardada correctamente.',

      () => {
        setCoverageCategory(
          '',
        )

        setCoverageLocationId(
          '',
        )
      },
    )
  }

  // ============================================================
  // COVERAGE REMOVE
  // ============================================================

  function removeCoverage(
    coverage:
      Coverage,
  ) {
    if (
      !window.confirm(
        '¿Eliminar esta cobertura para futuras asignaciones?',
      )
    ) {
      return
    }

    void save(
      () =>
        apiClient.delete(
          `/helpdesk/site-coverage/${coverage.id}`,
        ),

      'Cobertura eliminada.',
    )
  }

  // ============================================================
  // NAME HELPERS
  // ============================================================

  function siteName(
    id:
      string,
  ) {
    return (
      catalog.sites.find(
        item =>
          item.id ===
          id,
      )
        ?.name
      ??
      'Localidad no disponible'
    )
  }

  function locationName(
    id:
      string | null,
  ) {
    if (!id) {
      return 'Toda la localidad'
    }

    return (
      catalog.siteLocations.find(
        item =>
          item.id ===
          id,
      )
        ?.name
      ??
      'Ubicación no disponible'
    )
  }

  function teamName(
    id:
      string,
  ) {
    return (
      catalog.teams.find(
        item =>
          item.id ===
          id,
      )
        ?.name
      ??
      'Grupo no disponible'
    )
  }

  // ============================================================
  // PAGE TITLE BY TAB
  // ============================================================

  const pageTitle =
    tab ===
      'technicians'
      ? 'Técnicos de Mesa de Ayuda'
      : tab ===
          'coverage'
        ? 'Cobertura operativa'
        : 'Localidades y cobertura'

  const pageDescription =
    tab ===
      'technicians'
      ? 'Consulta el personal TIC habilitado, su ubicación y disponibilidad para atender tickets.'
      : tab ===
          'coverage'
        ? 'Define qué grupos atienden cada localidad, sublocalidad y categoría.'
        : 'La Mesa de Ayuda utiliza las mismas localidades corporativas de TitanMDM.'

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <main
      className={
        'titan-page ' +
        'helpdesk-page ' +
        'hd-operation'
      }
    >
      <header
        className="helpdesk-inbox__header"
      >
        <div>
          <span
            className="helpdesk-inbox__eyebrow"
          >
            <Headphones
              size={15}
            />

            ORGANIZACIÓN OPERATIVA
          </span>

          <h1>
            {pageTitle}
          </h1>

          <p>
            {pageDescription}
          </p>
        </div>

        <button
          type="button"
          className={
            'helpdesk-ui-button ' +
            'helpdesk-ui-button--secondary'
          }
          disabled={
            disabled
          }
          onClick={
            () =>
              void refresh()
          }
        >
          <RefreshCw
            size={16}
          />

          Actualizar
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="helpdesk-inbox__error"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="hd-operation__success"
        >
          {message}
        </div>
      )}

      <div
        className="hd-operation__metrics"
      >
        <div>
          <span>
            Localidades activas
          </span>

          <strong>
            {
              activeSites.length
            }
          </strong>
        </div>

        <div>
          <span>
            Sublocalidades
          </span>

          <strong>
            {
              activeLocationsCount
            }
          </strong>
        </div>

        <div>
          <span>
            Grupos activos
          </span>

          <strong>
            {
              activeTeams.length
            }
          </strong>
        </div>

        <div>
          <span>
            Técnicos habilitados
          </span>

          <strong>
            {
              enabledTechniciansCount
            }
          </strong>
        </div>
      </div>

      <nav
        className="hd-operation__tabs"
        aria-label="Organización operativa"
      >
        <button
          type="button"
          aria-pressed={
            tab ===
            'sites'
          }
          onClick={
            () =>
              changeTab(
                'sites',
              )
          }
        >
          <Building2
            size={16}
          />

          Localidades
        </button>

        <button
          type="button"
          aria-pressed={
            tab ===
            'coverage'
          }
          onClick={
            () =>
              changeTab(
                'coverage',
              )
          }
        >
          <MapPin
            size={16}
          />

          Cobertura
        </button>

        <button
          type="button"
          aria-pressed={
            tab ===
            'technicians'
          }
          onClick={
            () =>
              changeTab(
                'technicians',
              )
          }
        >
          <UserRound
            size={16}
          />

          Técnicos
        </button>
      </nav>

      {loading && (
        <p
          role="status"
        >
          Cargando configuración…
        </p>
      )}

      {/* ========================================================
          SITES
         ======================================================== */}

      {!loading &&
        tab ===
          'sites' && (
        <section
          className="hd-operation__card"
        >
          <h2>
            Localidades corporativas
          </h2>

          <p>
            Fuente única:
            Configuración →
            Localidades.
          </p>

          <div
            className="hd-operation__table"
          >
            <table>
              <thead>
                <tr>
                  <th>
                    Código
                  </th>

                  <th>
                    Localidad
                  </th>

                  <th>
                    Ciudad
                  </th>

                  <th>
                    Provincia
                  </th>

                  <th>
                    Estado
                  </th>
                </tr>
              </thead>

              <tbody>
                {!catalog.sites
                    .length ? (
                  <tr>
                    <td
                      colSpan={5}
                    >
                      No hay localidades
                      configuradas.
                    </td>
                  </tr>
                ) : (
                  catalog.sites.map(
                    site => (
                      <tr
                        key={
                          site.id
                        }
                      >
                        <td>
                          {
                            site.code
                          }
                        </td>

                        <td>
                          <strong>
                            {
                              site.name
                            }
                          </strong>
                        </td>

                        <td>
                          {
                            site.city
                            ??
                            '—'
                          }
                        </td>

                        <td>
                          {
                            site.province
                            ??
                            '—'
                          }
                        </td>

                        <td>
                          {
                            site.isActive
                              ? 'Activa'
                              : 'Inactiva'
                          }
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>

          <h3>
            Sublocalidades
          </h3>

          <div
            className="hd-operation__table"
          >
            <table>
              <thead>
                <tr>
                  <th>
                    Localidad
                  </th>

                  <th>
                    Sublocalidad
                  </th>

                  <th>
                    Descripción
                  </th>

                  <th>
                    Estado
                  </th>
                </tr>
              </thead>

              <tbody>
                {!catalog
                    .siteLocations
                    .length ? (
                  <tr>
                    <td
                      colSpan={4}
                    >
                      No hay sublocalidades
                      configuradas.
                    </td>
                  </tr>
                ) : (
                  catalog
                    .siteLocations
                    .map(
                      location => (
                        <tr
                          key={
                            location.id
                          }
                        >
                          <td>
                            {siteName(
                              location
                                .siteId,
                            )}
                          </td>

                          <td>
                            {
                              location.name
                            }
                          </td>

                          <td>
                            {
                              location.description
                              ??
                              '—'
                            }
                          </td>

                          <td>
                            {
                              location.isActive
                                ? 'Activa'
                                : 'Inactiva'
                            }
                          </td>
                        </tr>
                      ),
                    )
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========================================================
          COVERAGE
         ======================================================== */}

      {!loading &&
        tab ===
          'coverage' && (
        <section
          className="hd-operation__card"
        >
          <h2>
            Cobertura de grupos
          </h2>

          <p>
            Define qué grupo atiende
            cada localidad,
            sublocalidad y categoría.
          </p>

          <form
            onSubmit={
              handleSubmit
            }
          >
            <label>
              Grupo

              <select
                required
                disabled={
                  disabled
                }
                value={
                  coverageTeamId
                }
                onChange={
                  event =>
                    setCoverageTeamId(
                      event
                        .target
                        .value,
                    )
                }
              >
                <option value="">
                  Selecciona grupo
                </option>

                {activeTeams.map(
                  team => (
                    <option
                      key={
                        team.id
                      }
                      value={
                        team.id
                      }
                    >
                      {
                        team.name
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              Localidad

              <select
                required
                disabled={
                  disabled
                }
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
                <option value="">
                  Selecciona localidad
                </option>

                {activeSites.map(
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
            </label>

            <label>
              Sublocalidad

              <select
                value={
                  coverageLocationId
                }
                disabled={
                  disabled
                  ||
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
                <option value="">
                  Toda la localidad
                </option>

                {visibleLocations.map(
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
            </label>

            <label>
              Categoría opcional

              <input
                value={
                  coverageCategory
                }
                disabled={
                  disabled
                }
                onChange={
                  event =>
                    setCoverageCategory(
                      event
                        .target
                        .value,
                    )
                }
                placeholder="Ej.: redes"
              />
            </label>

            <label>
              Prioridad

              <input
                type="number"
                min={1}
                max={1000}
                disabled={
                  disabled
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
            </label>

            <button
              type="submit"
              className={
                'helpdesk-ui-button ' +
                'helpdesk-ui-button--primary'
              }
              disabled={
                disabled
              }
            >
              Guardar cobertura
            </button>
          </form>

          <div
            className="hd-operation__table"
          >
            <table>
              <thead>
                <tr>
                  <th>
                    Grupo
                  </th>

                  <th>
                    Localidad
                  </th>

                  <th>
                    Sublocalidad
                  </th>

                  <th>
                    Categoría
                  </th>

                  <th>
                    Prioridad
                  </th>

                  <th>
                    Estado
                  </th>

                  <th>
                    Acción
                  </th>
                </tr>
              </thead>

              <tbody>
                {!catalog.coverages
                    .length ? (
                  <tr>
                    <td
                      colSpan={7}
                    >
                      No hay coberturas
                      configuradas.
                    </td>
                  </tr>
                ) : (
                  catalog.coverages.map(
                    coverage => (
                      <tr
                        key={
                          coverage.id
                        }
                      >
                        <td>
                          {teamName(
                            coverage.teamId,
                          )}
                        </td>

                        <td>
                          {siteName(
                            coverage.siteId,
                          )}
                        </td>

                        <td>
                          {locationName(
                            coverage
                              .siteLocationId,
                          )}
                        </td>

                        <td>
                          {
                            coverage.category
                            ??
                            'Todas'
                          }
                        </td>

                        <td>
                          {
                            coverage.priority
                          }
                        </td>

                        <td>
                          {
                            coverage.isActive
                              ? 'Activa'
                              : 'Inactiva'
                          }
                        </td>

                        <td>
                          <button
                            type="button"
                            className={
                              'helpdesk-ui-button ' +
                              'helpdesk-ui-button--secondary'
                            }
                            disabled={
                              disabled
                            }
                            onClick={
                              () =>
                                removeCoverage(
                                  coverage,
                                )
                            }
                          >
                            <Trash2
                              size={14}
                            />

                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========================================================
          TECHNICIANS
         ======================================================== */}

      {!loading &&
        tab ===
          'technicians' && (
        <section
          className="hd-operation__card"
        >
          <h2>
            Técnicos y ubicación
          </h2>

          <p>
            La ubicación del técnico
            se toma directamente del
            usuario corporativo. La
            capacidad, turnos y
            autoasignación se administran
            desde Grupos y especialidades.
          </p>

          <div
            className="hd-operation__table"
          >
            <table>
              <thead>
                <tr>
                  <th>
                    Técnico
                  </th>

                  <th>
                    Correo
                  </th>

                  <th>
                    Localidad
                  </th>

                  <th>
                    Sublocalidad
                  </th>

                  <th>
                    Puede atender
                  </th>

                  <th>
                    Asistente
                  </th>
                </tr>
              </thead>

              <tbody>
                {!staff.length ? (
                  <tr>
                    <td
                      colSpan={6}
                    >
                      No hay usuarios
                      disponibles para
                      Mesa de Ayuda.
                    </td>
                  </tr>
                ) : (
                  staff.map(
                    technician => (
                      <tr
                        key={
                          technician.id
                        }
                      >
                        <td>
                          <strong>
                            {
                              technician.name
                            }
                          </strong>
                        </td>

                        <td>
                          {
                            technician.email
                          }
                        </td>

                        <td>
                          {
                            technician.siteName
                            ??
                            'Sin localidad'
                          }
                        </td>

                        <td>
                          {
                            technician
                              .siteLocationName
                            ??
                            '—'
                          }
                        </td>

                        <td>
                          {
                            technician
                              .canWorkTickets
                              ? 'Sí'
                              : 'No'
                          }
                        </td>

                        <td>
                          {
                            technician
                              .assistantEnabled
                              ? 'Habilitado'
                              : 'Deshabilitado'
                          }
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  )
}