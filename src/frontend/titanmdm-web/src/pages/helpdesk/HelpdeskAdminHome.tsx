import {
  ArrowRight,
  Bot,
  Building2,
  ClipboardList,
  Clock3,
  Mail,
  Settings,
  Sparkles,
  Tags,
  Users,
  Workflow,
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
          'Define dónde se presta soporte y quién atiende cada área.',

        actions: [
          {
            title:
              'Localidades y cobertura',

            description:
              'Sites, ubicaciones y alcance territorial de los grupos.',

            path:
              '/helpdesk/operations?workspace=helpdesk',

            icon:
              Building2,

            permissions: [
              helpdeskPermissions.sitesView,
              helpdeskPermissions.sitesManage,
            ],
          },

          {
            title:
              'Grupos de trabajo',

            description:
              'Áreas TIC, tareas atendidas y relación con cobertura.',

            path:
              '/helpdesk/especialidades?workspace=helpdesk',

            icon:
              Users,

            permissions: [
              helpdeskPermissions.groupsView,
              helpdeskPermissions.groupsManage,
            ],
          },

          {
            title:
              'Técnicos',

            description:
              'Disponibilidad, capacidad, permisos y participación por grupo.',

            path:
              '/helpdesk/operations?tab=technicians&workspace=helpdesk',

            icon:
              Users,

            permissions: [
              helpdeskPermissions.techniciansView,
              helpdeskPermissions.techniciansManage,
            ],
          },

          {
            title:
              'Turnos',

            description:
              'Horario de servicio, prioridad y relevos de cada técnico.',

            path:
              '/helpdesk/especialidades?tab=schedules&workspace=helpdesk',

            icon:
              Clock3,

            permissions: [
              helpdeskPermissions.schedulesView,
              helpdeskPermissions.schedulesManage,
            ],
          },
        ],
      },

      {
        title:
          'Catálogo de servicio',

        description:
          'Controla cómo se clasifica y crea cada solicitud.',

        actions: [
          {
            title:
              'Categorías',

            description:
              'Catálogo de incidencias, solicitudes y especialidades.',

            path:
              '/helpdesk/especialidades?tab=categories&workspace=helpdesk',

            icon:
              Tags,

            permissions: [
              helpdeskPermissions.categoriesView,
              helpdeskPermissions.categoriesManage,
            ],
          },

          {
            title:
              'Plantillas',

            description:
              'Plantillas reutilizables para acelerar solicitudes recurrentes.',

            path:
              '/helpdesk/centro/configuracion?tab=templates&workspace=helpdesk',

            icon:
              ClipboardList,

            permissions: [
              helpdeskPermissions.templatesView,
              helpdeskPermissions.templatesManage,
            ],
          },
        ],
      },

      {
        title:
          'Automatización',

        description:
          'Reglas, flujos y servicios automáticos de Mesa de Ayuda.',

        actions: [
          {
            title:
              'Reglas automáticas',

            description:
              'Clasificación, asignación, recordatorios y escalamiento.',

            path:
              '/helpdesk/centro/alertas?workspace=helpdesk',

            icon:
              Sparkles,

            permissions: [
              helpdeskPermissions.automationView,
              helpdeskPermissions.automationManage,
            ],
          },

          {
            title:
              'Workflows',

            description:
              'Estados, transiciones y ciclo de vida de los tickets.',

            path:
              '/helpdesk/centro/configuracion?tab=workflows&workspace=helpdesk',

            icon:
              Workflow,

            permissions: [
              helpdeskPermissions.workflowsView,
              helpdeskPermissions.workflowsManage,
            ],
          },

          {
            title:
              'Correo',

            description:
              'Creación de tickets por email y notificaciones salientes.',

            path:
              '/helpdesk/mail?workspace=helpdesk',

            icon:
              Mail,

            permissions: [
              helpdeskPermissions.mailView,
              helpdeskPermissions.mailManage,
            ],
          },

          {
            title:
              'Titan AI',

            description:
              'OpenRouter, clasificación, sugerencias y automatización asistida.',

            path:
              '/helpdesk/centro/configuracion?tab=ai&workspace=helpdesk',

            icon:
              Bot,

            permissions: [
              helpdeskPermissions.aiView,
              helpdeskPermissions.aiManage,
            ],
          },
        ],
      },

      {
        title:
          'Configuración avanzada',

        description:
          'Parámetros globales y reglas administrativas.',

        actions: [
          {
            title:
              'Configuración de Helpdesk',

            description:
              'SLA, reapertura, políticas operativas y preferencias.',

            path:
              '/helpdesk/centro/configuracion?workspace=helpdesk',

            icon:
              Settings,

            permissions: [
              helpdeskPermissions.adminAccess,
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
            Configura la operación
            sin mezclar estas tareas
            con la bandeja diaria de
            los técnicos.
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
                    helpdeskPermissions.adminAccess,
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
                    {section.title}
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