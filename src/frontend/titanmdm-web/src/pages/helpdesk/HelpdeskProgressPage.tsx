import { Link } from 'react-router-dom'
import './HelpdeskProgressPage.css'

type State = 'repository' | 'integration' | 'pending' | 'blocked'

type WorkItem = {
  name: string
  detail: string
  state: State
}

type Phase = {
  code: string
  name: string
  objective: string
  items: WorkItem[]
}

const stateLabel: Record<State, string> = {
  repository: 'En el repositorio',
  integration: 'Código entregado; falta integrar y verificar',
  pending: 'Pendiente',
  blocked: 'Bloqueado para pruebas',
}

const phases: Phase[] = [
  {
    code: 'W9',
    name: 'Base de soporte remoto',
    objective: 'Preparar la infraestructura y los flujos iniciales de soporte remoto.',
    items: [
      {
        name: 'Base del módulo de soporte remoto',
        detail: 'Existe código del módulo en el proyecto. Falta la revisión funcional completa con dos equipos.',
        state: 'repository',
      },
      {
        name: 'Rediseño de la interfaz',
        detail: 'Quedó registrada la observación: la experiencia actual debe revisarse.',
        state: 'pending',
      },
    ],
  },
  {
    code: 'W10',
    name: 'Transporte y sesión remota',
    objective: 'Conectar los componentes necesarios para iniciar y mantener una sesión.',
    items: [
      {
        name: 'Cliente de transporte remoto',
        detail: 'Se trabajó el código en la fase anterior; su funcionamiento extremo a extremo sigue sin verificarse.',
        state: 'integration',
      },
      {
        name: 'Sesión real entre equipo A y equipo B',
        detail: 'Debe ejecutarse junto con W11 cuando el agente esté instalado en el equipo B.',
        state: 'blocked',
      },
    ],
  },
  {
    code: 'W11',
    name: 'Agente Windows',
    objective: 'Instalar y ejecutar el agente en el equipo B para completar las pruebas remotas.',
    items: [
      {
        name: 'Código del agente',
        detail: 'Hay proyectos del agente Windows en el repositorio.',
        state: 'repository',
      },
      {
        name: 'Instalación en el equipo B',
        detail: 'Pendiente de la autorización del ingeniero de ciberseguridad para el archivo bloqueado.',
        state: 'blocked',
      },
      {
        name: 'Pruebas de instalación, conexión y sesión',
        detail: 'Se realizarán después de instalar el agente en el equipo B.',
        state: 'blocked',
      },
    ],
  },
  {
    code: 'HD-1',
    name: 'Fundamentos de Mesa de Ayuda',
    objective: 'Crear tickets, consultarlos y mantener su historial.',
    items: [
      {
        name: 'Modelo y API inicial de tickets',
        detail: 'El repositorio contiene tickets, comentarios, eventos, servicio y controlador.',
        state: 'repository',
      },
      {
        name: 'Bandeja TIC y detalle del ticket',
        detail: 'Ambas páginas existen en el frontend.',
        state: 'repository',
      },
      {
        name: 'Migración de zonas, equipos y acceso al asistente',
        detail: 'Las entidades y su configuración existen; falta confirmar una migración que cree todas las tablas operativas.',
        state: 'integration',
      },
    ],
  },
  {
    code: 'HD-2',
    name: 'Operación por zonas y equipos',
    objective: 'Asignar tickets según la ubicación del solicitante, cobertura y capacidad del agente TIC.',
    items: [
      {
        name: 'Jerarquía de ubicación',
        detail: 'Definir localidad, planta, nave, edificio o área según la estructura real de la organización.',
        state: 'integration',
      },
      {
        name: 'Equipos, cobertura y disponibilidad',
        detail: 'Se entregaron bloques de administración, pero no aparecen aún en la versión revisada del repositorio.',
        state: 'integration',
      },
      {
        name: 'Asignación automática verificable',
        detail: 'Falta integrar y comprobar las reglas de zona, grupo, disponibilidad y límite de tickets.',
        state: 'integration',
      },
    ],
  },
  {
    code: 'HD-3',
    name: 'Experiencias por tipo de usuario',
    objective: 'Separar el trabajo global del personal TIC de los tickets propios del usuario común.',
    items: [
      {
        name: 'Portal personal del solicitante',
        detail: 'Se entregó código para consultar y crear tickets propios; falta integrarlo y validar el aislamiento de datos.',
        state: 'integration',
      },
      {
        name: 'Panel TIC con gráficos y KPI globales',
        detail: 'Se entregaron bloques posteriores a la bandeja inicial; falta comprobar datos, permisos y compilación.',
        state: 'integration',
      },
      {
        name: 'Rediseño final de Mesa de Ayuda',
        detail: 'Aún queda revisar la experiencia visual completa que señalaste como anticuada.',
        state: 'pending',
      },
    ],
  },
  {
    code: 'HD-4',
    name: 'Seguimiento y automatización',
    objective: 'Detectar tickets sin atención, vencimientos y trabajo acumulado.',
    items: [
      {
        name: 'Alertas y recordatorios automáticos',
        detail: 'Se entregó un servicio de monitoreo; faltan integración, persistencia comprobada y pruebas.',
        state: 'integration',
      },
      {
        name: 'SLA, escalamiento y notificaciones',
        detail: 'Debemos cerrar reglas, destinatarios y comportamiento ante vencimientos.',
        state: 'pending',
      },
      {
        name: 'Reportes operativos',
        detail: 'Pendientes las métricas históricas, filtros y exportación de Mesa de Ayuda.',
        state: 'pending',
      },
    ],
  },
  {
    code: 'HD-5',
    name: 'Entra y asistente virtual',
    objective: 'Sincronizar solicitantes e integrar Ollama solo para usuarios autorizados.',
    items: [
      {
        name: 'Configuración inicial de Entra',
        detail: 'Hay código y pantalla de configuración en el repositorio; requiere revisión de seguridad y prueba real.',
        state: 'repository',
      },
      {
        name: 'Permisos individuales del asistente',
        detail: 'Existe la entidad de acceso. La administración de concesiones se entregó después y falta verificarla.',
        state: 'integration',
      },
      {
        name: 'Conexión real de Ollama a la aplicación',
        detail: 'Ollama está descargado, pero TitanMDM todavía no lo consume. No se deben presentar sugerencias como funcionales.',
        state: 'pending',
      },
      {
        name: 'Sugerencias durante la creación del ticket',
        detail: 'Pendientes el servicio, la interfaz, los controles de acceso y la validación de resultados.',
        state: 'pending',
      },
    ],
  },
  {
    code: 'GENERAL',
    name: 'Otros módulos y cierre',
    objective: 'Resolver observaciones transversales después de estabilizar Mesa de Ayuda.',
    items: [
      {
        name: 'Reporte general',
        detail: 'Señalaste que el módulo sigue vacío.',
        state: 'pending',
      },
      {
        name: 'Kiosk',
        detail: 'Falta definir su función concreta y reparar su interfaz.',
        state: 'pending',
      },
      {
        name: 'Validación integral',
        detail: 'Compilación, migraciones, permisos, flujos por rol y pruebas con datos reales.',
        state: 'pending',
      },
    ],
  },
]

const order: State[] = ['repository', 'integration', 'pending', 'blocked']

export function HelpdeskProgressPage() {
  const allItems = phases.flatMap((phase) => phase.items)
  const totals = Object.fromEntries(
    order.map((state) => [
      state,
      allItems.filter((item) => item.state === state).length,
    ]),
  ) as Record<State, number>

  return (
    <main className="helpdesk-progress">
      <header className="helpdesk-progress__hero">
        <div>
          <p className="helpdesk-progress__eyebrow">TitanMDM · Seguimiento del proyecto</p>
          <h1>Avance de Mesa de Ayuda</h1>
          <p>
            Estado del código y de las verificaciones pendientes. «En el repositorio»
            significa que existe implementación; no significa que el flujo completo
            haya sido probado.
          </p>
        </div>
        <Link to="/helpdesk" className="helpdesk-progress__back">
          Volver a la bandeja
        </Link>
      </header>

      <section className="helpdesk-progress__summary" aria-label="Resumen del avance">
        {order.map((state) => (
          <article key={state} className={`helpdesk-progress__stat is-${state}`}>
            <strong>{totals[state]}</strong>
            <span>{stateLabel[state]}</span>
          </article>
        ))}
      </section>

      <section className="helpdesk-progress__notice">
        <h2>Próximo objetivo</h2>
        <p>
          Integrar en el repositorio los bloques de Mesa de Ayuda ya entregados,
          generar y revisar la migración operativa, compilar backend y frontend,
          y comprobar primero los permisos del usuario común y del personal TIC.
          Después conectaremos Ollama y validaremos las automatizaciones.
        </p>
        <p>
          La prueba entre equipos de W11 sigue pendiente del acceso al instalador
          en el equipo B.
        </p>
      </section>

      <div className="helpdesk-progress__phases">
        {phases.map((phase) => (
          <section className="helpdesk-progress__phase" key={phase.code}>
            <header>
              <span className="helpdesk-progress__code">{phase.code}</span>
              <div>
                <h2>{phase.name}</h2>
                <p>{phase.objective}</p>
              </div>
            </header>

            <div className="helpdesk-progress__items">
              {phase.items.map((item) => (
                <article className="helpdesk-progress__item" key={item.name}>
                  <div>
                    <h3>{item.name}</h3>
                    <p>{item.detail}</p>
                  </div>
                  <span className={`helpdesk-progress__badge is-${item.state}`}>
                    {stateLabel[item.state]}
                  </span>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}