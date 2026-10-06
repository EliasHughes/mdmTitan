import {
  ArrowRight,
  Building2,
  Clock3,
  CloudCog,
  Mail,
  Settings,
  Tags,
  Users,
} from 'lucide-react'

import {
  useNavigate,
} from 'react-router-dom'

import {
  useAuth,
} from '../../auth/AuthContext'

import {
  helpdeskPermissions,
} from '../../auth/helpdeskAccess'

import './HelpdeskPages.css'

interface AdminAction {
  title: string
  description: string
  path: string
  icon: typeof Settings
  permissions: string[]
}

interface AdminSection {
  title: string
  description: string
  actions: AdminAction[]
}

export function HelpdeskAdminHome() {
  const navigate =
    useNavigate()

  const {
    hasPermission,
  } =
    useAuth()

  const sections:
    AdminSection[] = [
      {
        title:
          'Organización operativa',

        description:
          'Define dónde se presta soporte, quién atiende y cómo se distribuye el trabajo.',

        actions: [
          {
            title:
              'Localidades y cobertura',

            description:
              'Sites, sublocalidades y cobertura territorial de Mesa de Ayuda.',

            path:
              '/helpdesk/operations?workspace=helpdesk',

            icon:
              Building2,

            permissions: [
              helpdeskPermissions
                .sitesView,

              helpdeskPermissions
                .sitesManage,
            ],
          },

          {
            title:
              'Técnicos',

            description:
              'Disponibilidad, capacidad y ubicación del personal TIC.',

            path:
              '/helpdesk/operations?tab=technicians&workspace=helpdesk',

            icon:
              Users,

            permissions: [
              helpdeskPermissions
                .techniciansView,

              helpdeskPermissions
                .techniciansManage,
            ],
          },

          {
            title:
              'Grupos de trabajo',

            description:
              'Áreas TIC, cobertura, integrantes y distribución de solicitudes.',

            path:
              '/helpdesk/especialidades?workspace=helpdesk',

            icon:
              Users,

            permissions: [
              helpdeskPermissions
                .groupsView,

              helpdeskPermissions
                .groupsManage,
            ],
          },

          {
            title:
              'Categorías',

            description:
              'Tareas y especialidades atendidas por cada grupo TIC.',

            path:
              '/helpdesk/especialidades?workspace=helpdesk',

            icon:
              Tags,

            permissions: [
              helpdeskPermissions
                .categoriesView,

              helpdeskPermissions
                .categoriesManage,
            ],
          },

          {
            title:
              'Turnos y capacidad',

            description:
              'Horarios, disponibilidad, prioridad y capacidad de técnicos.',

            path:
              '/helpdesk/especialidades?workspace=helpdesk',

            icon:
              Clock3,

            permissions: [
              helpdeskPermissions
                .schedulesView,

              helpdeskPermissions
                .schedulesManage,
            ],
          },
        ],
      },

      {
        title:
          'Integraciones',

        description:
          'Conecta TitanMDM con el directorio corporativo y el buzón de Mesa de Ayuda.',

        actions: [
          {
            title:
              'Microsoft Entra ID',

            description:
              'Directorio, sincronización de usuarios y acceso corporativo.',

            path:
              '/helpdesk/entra?workspace=helpdesk',

            icon:
              CloudCog,

            permissions: [
              helpdeskPermissions
                .adminAccess,

              'helpdesk.manage',

              'settings.manage',
            ],
          },

          {
            title:
              'Correo Microsoft 365',

            description:
              'Buzón de Mesa de Ayuda, entrada, salida, reintentos y diagnóstico Graph.',

            path:
              '/helpdesk/mail?workspace=helpdesk',

            icon:
              Mail,

            permissions: [
              helpdeskPermissions
                .mailView,

              helpdeskPermissions
                .mailManage,
            ],
          },
        ],
      },

      {
        title:
          'Configuración de servicio',

        description:
          'Parámetros operativos que ya están disponibles en TitanMDM.',

        actions: [
          {
            title:
              'SLA y reapertura',

            description:
              'Tiempos de respuesta, resolución, pausas, escalamiento y reapertura.',

            path:
              '/helpdesk/centro/configuracion?workspace=helpdesk',

            icon:
              Settings,

            permissions: [
              helpdeskPermissions
                .adminAccess,

              helpdeskPermissions
                .slaManage,
            ],
          },
        ],
      },
    ]

  return (
    <main
      className={
        'titan-page ' +
        'helpdesk-page ' +
        'helpdesk-admin-home'
      }
    >
      <header
        className="helpdesk-admin-home__hero"
      >
        <div>
          <span
            className="helpdesk-hub__eyebrow"
          >
            <Settings
              size={15}
            />

            ADMINISTRACIÓN HELPDESK
          </span>

          <h1>
            Administración de Mesa de Ayuda
          </h1>

          <p>
            Configura únicamente
            funciones operativas
            disponibles y listas para
            utilizar.
          </p>
        </div>
      </header>

      <div
        className="helpdesk-admin-home__sections"
      >
        {sections.map(
          section => {
            const actions =
              section.actions.filter(
                action =>
                  action.permissions
                    .some(
                      hasPermission,
                    )
                  ||
                  hasPermission(
                    helpdeskPermissions
                      .adminAccess,
                  ),
              )

            if (
              !actions.length
            ) {
              return null
            }

            return (
              <section
                key={
                  section.title
                }
                className="helpdesk-admin-home__section"
              >
                <header>
                  <h2>
                    {
                      section.title
                    }
                  </h2>

                  <p>
                    {
                      section.description
                    }
                  </p>
                </header>

                <div
                  className="helpdesk-admin-home__grid"
                >
                  {actions.map(
                    action => {
                      const Icon =
                        action.icon

                      return (
                        <button
                          key={
                            action.title
                          }
                          type="button"
                          className="helpdesk-admin-home__card"
                          onClick={
                            () =>
                              navigate(
                                action.path,
                              )
                          }
                        >
                          <span
                            className="helpdesk-admin-home__icon"
                          >
                            <Icon
                              size={20}
                            />
                          </span>

                          <div>
                            <h3>
                              {
                                action.title
                              }
                            </h3>

                            <p>
                              {
                                action.description
                              }
                            </p>
                          </div>

                          <ArrowRight
                            size={17}
                          />
                        </button>
                      )
                    },
                  )}
                </div>
              </section>
            )
          },
        )}
      </div>
    </main>
  )
}