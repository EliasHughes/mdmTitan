import {
  Activity,
  ArrowRight,
  BarChart3,
  FileBarChart,
  Gauge,
  Timer,
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

interface AnalyticsCard {
  title: string
  description: string
  path: string
  icon: typeof BarChart3
  permission: string
}

export function HelpdeskAnalyticsHome() {
  const navigate =
    useNavigate()

  const {
    hasPermission,
  } =
    useAuth()

  const cards:
    AnalyticsCard[] = [
      {
        title:
          'SLA y seguimiento',

        description:
          'Casos en riesgo, vencimientos, tiempos de primera respuesta y resolución.',

        path:
          '/helpdesk/seguimiento?workspace=helpdesk',

        icon:
          Timer,

        permission:
          helpdeskPermissions.slaView,
      },

      {
        title:
          'KPI operativos',

        description:
          'Backlog, autoasignación, productividad, carga y desempeño por técnico.',

        path:
          '/helpdesk/centro/kpis?workspace=helpdesk',

        icon:
          Gauge,

        permission:
          helpdeskPermissions.kpiView,
      },

      {
        title:
          'Gráficos',

        description:
          'Tendencias de tickets, categorías, prioridades, Sites y carga de servicio.',

        path:
          '/helpdesk/centro/graficos?workspace=helpdesk',

        icon:
          BarChart3,

        permission:
          helpdeskPermissions.analyticsView,
      },

      {
        title:
          'Reportes',

        description:
          'Consulta consolidada y exportación de información operacional.',

        path:
          '/helpdesk/reportes?workspace=helpdesk',

        icon:
          FileBarChart,

        permission:
          helpdeskPermissions.reportsView,
      },
    ]

  const visible =
    cards.filter(
      card =>
        hasPermission(
          card.permission,
        )
        ||
        hasPermission(
          helpdeskPermissions.adminAccess,
        ),
    )

  return (
    <main
      className={
        'titan-page ' +
        'helpdesk-page ' +
        'helpdesk-hub'
      }
    >
      <header
        className="helpdesk-hub__hero"
      >
        <div>
          <span
            className="helpdesk-hub__eyebrow"
          >
            <Activity
              size={15}
            />

            SERVICE INTELLIGENCE
          </span>

          <h1>
            Analítica de Mesa de Ayuda
          </h1>

          <p>
            Supervisa rendimiento,
            cumplimiento SLA,
            demanda y capacidad
            operativa desde un único
            centro de análisis.
          </p>
        </div>
      </header>

      <section
        className="helpdesk-hub__grid"
      >
        {visible.map(
          card => {
            const Icon =
              card.icon

            return (
              <button
                key={
                  card.title
                }
                type="button"
                className="helpdesk-hub__card"
                onClick={
                  () =>
                    navigate(
                      card.path,
                    )
                }
              >
                <span
                  className="helpdesk-hub__icon"
                >
                  <Icon
                    size={22}
                  />
                </span>

                <div>
                  <h2>
                    {card.title}
                  </h2>

                  <p>
                    {
                      card.description
                    }
                  </p>
                </div>

                <ArrowRight
                  size={18}
                />
              </button>
            )
          },
        )}
      </section>
    </main>
  )
}