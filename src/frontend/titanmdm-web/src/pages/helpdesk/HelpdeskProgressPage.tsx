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
  repository: 'Código listo; espera pruebas',
  integration: 'En desarrollo o integración',
  pending: 'Pendiente de desarrollar',
  blocked: 'Espera configuración o acceso externo',
}

const order: State[] = [
  'repository',
  'integration',
  'pending',
  'blocked',
]

const phases: Phase[] = [
  {
    code: '0',
    name: 'Base estable',
    objective: 'Mantener backend, frontend, migraciones y configuración coherentes.',
    items: [
      {
        name: 'Migración de importación de correo',
        detail:
          'AddHelpdeskEmailImport fue aplicada y el backend compiló. Falta comprobar la importación con mensajes reales.',
        state: 'repository',
      },
      {
        name: 'Build y consolidación integral',
        detail:
          'El backend compiló. Quedan el build completo del frontend, agentes y revisión de cambios duplicados.',
        state: 'integration',
      },
    ],
  },
  {
    code: 'HD-1',
    name: 'Operación de tickets',
    objective: 'Crear, consultar, conversar y gestionar el ciclo de vida de cada caso.',
    items: [
      {
        name: 'Creación, conversación y cierre',
        detail:
          'Se usaron en la aplicación. Conservaremos la verificación conjunta por rol para el ciclo final de pruebas.',
        state: 'repository',
      },
      {
        name: 'Estados, reapertura y separación de permisos',
        detail:
          'Hay código para estados y reapertura. Falta validar todas las transiciones y el aislamiento del usuario común.',
        state: 'repository',
      },
      {
        name: 'Adjuntos y experiencia final del ticket',
        detail:
          'Pendiente completar el flujo de adjuntos y modernizar la interfaz.',
        state: 'pending',
      },
    ],
  },
  {
    code: 'HD-2',
    name: 'Asignación autónoma',
    objective:
      'Dirigir cada caso al grupo y agente correctos por ubicación, especialidad y capacidad.',
    items: [
      {
        name: 'Zonas, grupos, miembros y cobertura',
        detail:
          'Existen entidades, API y pantalla de administración. Esperan pruebas con la estructura real de la empresa.',
        state: 'repository',
      },
      {
        name: 'Especialidades y categorías por grupo',
        detail:
          'El repositorio incluye configuración de categorías y selección por especialidad.',
        state: 'repository',
      },
      {
        name: 'Reintento de tickets sin asignar',
        detail:
          'Existe un trabajador periódico. Falta comprobar concurrencia, capacidad y cambios de disponibilidad.',
        state: 'repository',
      },
      {
        name: 'Reglas y explicación de la asignación',
        detail:
          'Estamos ajustando la prioridad entre especialidad y cobertura; cada decisión debe quedar trazada.',
        state: 'integration',
      },
    ],
  },
  {
    code: 'HD-3',
    name: 'Correo, seguimiento y reportes',
    objective:
      'Recibir casos por correo y medir atención, vencimientos y carga del equipo.',
    items: [
      {
        name: 'Importación del buzón',
        detail:
          'El importador y el trabajador existen. La recepción real espera Mail.Read y acceso al buzón.',
        state: 'blocked',
      },
      {
        name: 'Recordatorios y alertas de SLA',
        detail:
          'Hay monitoreo y eventos; faltan pruebas funcionales con plazos y agentes reales.',
        state: 'repository',
      },
      {
        name: 'KPI y reportes de Helpdesk',
        detail:
          'Hay panel y API de reportes. Deben comprobarse filtros, datos, exportación y permisos.',
        state: 'repository',
      },
    ],
  },
  {
    code: 'AI-1',
    name: 'Núcleo transversal del agente virtual',
    objective:
      'Conocer el usuario en sesión, su organización, roles, permisos y módulos disponibles.',
    items: [
      {
        name: 'Acceso individual al asistente',
        detail:
          'Existe administración inicial de concesiones. Ningún usuario debe recibir acceso por defecto.',
        state: 'repository',
      },
      {
        name: 'Identidad, catálogo de herramientas y auditoría',
        detail:
          'Pendiente construir el núcleo común que valide cada consulta y acción antes de ejecutarla.',
        state: 'pending',
      },
    ],
  },
  {
    code: 'AI-2',
    name: 'Ollama y automatización',
    objective:
      'Agilizar tareas autorizadas en Helpdesk y después en toda TitanMDM.',
    items: [
      {
        name: 'Sugerencias al crear tickets',
        detail:
          'Existe un primer endpoint y su interfaz; Ollama sigue deshabilitado y sin modelo configurado.',
        state: 'integration',
      },
      {
        name: 'Automatizaciones por módulo',
        detail:
          'Pendientes resúmenes, recomendaciones, consultas y acciones controladas en los demás módulos.',
        state: 'pending',
      },
      {
        name: 'Pruebas de permisos y resistencia a instrucciones maliciosas',
        detail:
          'Se realizarán en el ciclo conjunto de testing, con distintos roles y usuarios.',
        state: 'pending',
      },
    ],
  },
  {
    code: 'ID',
    name: 'Entra ID y acceso corporativo',
    objective:
      'Sincronizar cuentas, asignar roles e iniciar sesión con identidad empresarial.',
    items: [
      {
        name: 'Sincronización y asignación de roles',
        detail:
          'La sincronización funcionó y la asignación de rol muestra confirmación. Falta prueba integral de acceso.',
        state: 'repository',
      },
      {
        name: 'Inicio de sesión con Microsoft',
        detail:
          'El código existe; la URL de retorno definitiva y la prueba quedan para el despliegue.',
        state: 'blocked',
      },
    ],
  },
  {
    code: 'W',
    name: 'Agente Windows y soporte remoto',
    objective:
      'Completar instalación, señales, inventario y sesiones remotas entre equipos.',
    items: [
      {
        name: 'Instalador individual .exe',
        detail:
          'Probado por el responsable del proyecto; falta registrar el resultado detallado en la validación final.',
        state: 'repository',
      },
      {
        name: 'Instalación por GPO',
        detail:
          'Pendiente instalar y comprobar en un equipo del dominio.',
        state: 'blocked',
      },
      {
        name: 'Sesión remota A–B y rediseño',
        detail:
          'Faltan prueba real, fluidez, monitores, UAC, auditoría y modernización de la interfaz.',
        state: 'integration',
      },
    ],
  },
  {
    code: 'AND',
    name: 'Android Enterprise',
    objective:
      'Enrolar y administrar dispositivos Android con políticas, comandos y aplicaciones.',
    items: [
      {
        name: 'Agente, API y pantallas',
        detail:
          'Hay proyectos e implementación inicial; falta completar los flujos y validar dispositivos reales.',
        state: 'integration',
      },
      {
        name: 'Configuración Google y enrolamiento empresarial',
        detail:
          'La configuración externa y las pruebas se completarán en la fase Android.',
        state: 'blocked',
      },
    ],
  },
  {
    code: 'APP',
    name: 'Aplicaciones, reportes y Kiosk',
    objective:
      'Cerrar los módulos que todavía muestran errores o interfaces incompletas.',
    items: [
      {
        name: 'Aplicaciones y paquetes',
        detail:
          'Se reportaron fallos de carga y distribución; requieren corrección y verificación.',
        state: 'integration',
      },
      {
        name: 'Reportes generales',
        detail:
          'El módulo todavía no cumple el alcance solicitado.',
        state: 'integration',
      },
      {
        name: 'Kiosk por plataforma',
        detail:
          'Falta cerrar su comportamiento y reparar la interfaz.',
        state: 'pending',
      },
    ],
  },
  {
    code: 'UX',
    name: 'Diseño integral',
    objective:
      'Unificar la experiencia visual y completar los recorridos por tipo de usuario.',
    items: [
      {
        name: 'Sistema visual y CSS centralizado',
        detail:
          'Pendiente consolidar estilos, estados de carga, errores y diseño adaptable.',
        state: 'pending',
      },
      {
        name: 'Helpdesk y soporte remoto',
        detail:
          'Pendiente el rediseño final solicitado para ambas experiencias.',
        state: 'pending',
      },
    ],
  },
  {
    code: 'QA',
    name: 'Testing conjunto',
    objective:
      'Probar funciones, integraciones, seguridad, concurrencia y recuperación.',
    items: [
      {
        name: 'Pruebas funcionales e integración',
        detail:
          'Se ejecutarán con roles, correo, Entra, Windows, Android y datos reales al terminar el código.',
        state: 'pending',
      },
      {
        name: 'Pruebas de carga y resistencia',
        detail:
          'Mediremos tickets simultáneos, agentes, sesiones remotas, Ollama, SQL y recuperación ante fallos.',
        state: 'pending',
      },
    ],
  },
  {
    code: 'DEP',
    name: 'Documentación y despliegue',
    objective:
      'Publicar TitanMDM con procedimientos de instalación, respaldo y operación.',
    items: [
      {
        name: 'PRD, guía técnica y operación',
        detail:
          'Pendientes documentos finales, requisitos, configuración y procedimiento de reversión.',
        state: 'pending',
      },
      {
        name: 'IIS, HTTPS y direcciones definitivas',
        detail:
          'Pendiente preproducción, configuración de Entra y aceptación empresarial.',
        state: 'pending',
      },
      {
        name: 'Visualización de ponches',
        detail:
          'Módulo futuro, posterior al cierre de TitanMDM; no forma parte de esta entrega.',
        state: 'pending',
      },
    ],
  },
]

export function HelpdeskProgressPage() {
  const allItems = phases.flatMap((phase) => phase.items)

  const totals = Object.fromEntries(
    order.map((state) => [
      state,
      allItems.filter((item) => item.state === state).length,
    ]),
  ) as Record<State, number>

  const readyForTesting = phases.flatMap((phase) =>
    phase.items
      .filter((item) => item.state === 'repository')
      .map((item) => ({
        phase: phase.code,
        ...item,
      })),
  )

  return (
    <main className="helpdesk-progress">
      <header className="helpdesk-progress__hero">
        <div>
          <p className="helpdesk-progress__eyebrow">
            TitanMDM · Seguimiento del proyecto
          </p>
          <h1>Plan y avance de TitanMDM</h1>
          <p>
            «Código listo; espera pruebas» indica implementación disponible.
            La validación funcional, de permisos y de carga se realizará
            en el ciclo conjunto de testing.
          </p>
        </div>

        <Link to="/helpdesk" className="helpdesk-progress__back">
          Volver a la bandeja
        </Link>
      </header>

      <section
        className="helpdesk-progress__summary"
        aria-label="Resumen del avance"
      >
        {order.map((state) => (
          <article
            key={state}
            className={`helpdesk-progress__stat is-${state}`}
          >
            <strong>{totals[state]}</strong>
            <span>{stateLabel[state]}</span>
          </article>
        ))}
      </section>

      <section className="helpdesk-progress__notice">
        <h2>Fase activa: HD-2</h2>
        <p>
          Cerramos la asignación por especialidad, cobertura y capacidad.
          Después continuamos con el núcleo transversal del agente virtual,
          Ollama y los módulos restantes. Las configuraciones externas y
          el testing completo conservan sus fases.
        </p>
      </section>

      <section className="helpdesk-progress__notice">
        <h2>Fases con código listo que esperan pruebas</h2>
        <ul>
          {readyForTesting.map((item) => (
            <li key={`${item.phase}-${item.name}`}>
              <strong>{item.phase} · {item.name}:</strong> {item.detail}
            </li>
          ))}
        </ul>
      </section>

      <div className="helpdesk-progress__phases">
        {phases.map((phase) => (
          <section
            className="helpdesk-progress__phase"
            key={phase.code}
          >
            <header>
              <span className="helpdesk-progress__code">
                {phase.code}
              </span>

              <div>
                <h2>{phase.name}</h2>
                <p>{phase.objective}</p>
              </div>
            </header>

            <div className="helpdesk-progress__items">
              {phase.items.map((item) => (
                <article
                  className="helpdesk-progress__item"
                  key={item.name}
                >
                  <div>
                    <h3>{item.name}</h3>
                    <p>{item.detail}</p>
                  </div>

                  <span
                    className={
                      `helpdesk-progress__badge is-${item.state}`
                    }
                  >
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