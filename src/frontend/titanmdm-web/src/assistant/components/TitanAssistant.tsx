import {
  MessageCircle,
  Settings2,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  useTitanAssistant,
  type TitanAnimationState,
} from '../context/TitanAssistantContext'

import {
  getTitanContextualGreeting,
} from '../config/titanContextualMessages'

import {
  TitanAnchorRegistry,
} from '../engine/TitanAnchorRegistry'

import {
  TitanBehaviorEngine,
} from '../engine/TitanBehaviorEngine'

import {
  TitanMovementEngine,
  type TitanMovementSnapshot,
} from '../engine/TitanMovementEngine'

import {
  TitanAvatarCanvas,
} from './TitanAvatarCanvas'

import {
  TitanSpeechBubble,
} from './TitanSpeechBubble'

import {
  TitanPreferencesPanel,
} from './TitanPreferencesPanel'

import '../styles/titan-assistant.css'

const TITAN_WIDTH = 130

const TITAN_HEIGHT = 190

function defaultPosition() {
  return {
    x: Math.max(
      15,
      window.innerWidth -
        TITAN_WIDTH -
        25,
    ),

    y: Math.max(
      80,
      window.innerHeight -
        TITAN_HEIGHT -
        25,
    ),
  }
}

function clampPosition(
  x: number,
  y: number,
) {
  return {
    x: Math.max(
      8,
      Math.min(
        window.innerWidth -
          TITAN_WIDTH -
          8,
        x,
      ),
    ),

    y: Math.max(
      68,
      Math.min(
        window.innerHeight -
          TITAN_HEIGHT -
          8,
        y,
      ),
    ),
  }
}

function mapLocomotionToAnimation(
  snapshot:
    TitanMovementSnapshot,
): TitanAnimationState {
  switch (
    snapshot.state
  ) {
    case 'walking':
      return 'walking'

    case 'prepare-takeoff':
      return 'prepare-takeoff'

    case 'takeoff':
      return 'takeoff'

    case 'flying':
      return 'flying'

    case 'landing':
      return 'landing'

    default:
      return 'idle'
  }
}

function anchorForModule(
  module: string,
): string | null {
  switch (module) {
    case 'dashboard':
      return 'sidebar.dashboard'

    case 'devices':
    case 'device-detail':
      return 'sidebar.devices'

    case 'groups':
      return 'sidebar.groups'

    case 'enrollment':
      return 'sidebar.enrollment'

    case 'policies':
    case 'policy-editor':
      return 'sidebar.policies'

    case 'apps':
      return 'sidebar.apps'

    case 'security':
      return 'sidebar.security'

    case 'compliance':
      return 'sidebar.compliance'

    case 'kiosk':
      return 'sidebar.kiosk'

    case 'geofencing':
      return 'sidebar.geofencing'

    case 'automation':
      return 'sidebar.automation'

    case 'remote':
      return 'sidebar.remote'

    case 'reports':
      return 'sidebar.reports'

    case 'audit':
      return 'sidebar.audit'

    case 'users':
      return 'sidebar.users'

    case 'roles':
      return 'sidebar.roles'

    case 'settings':
      return 'sidebar.settings'

    default:
      return null
  }
}

export function TitanAssistant() {
  const {
    user,
    page,

    preferences,
    runtime,

    setPosition,
    setVelocity,
    setDirection,
    setAnimation,

    say,
    clearMessage,
  } =
    useTitanAssistant()

  const rootRef =
    useRef<HTMLDivElement>(
      null,
    )

  const movementRef =
    useRef<
      TitanMovementEngine | null
    >(null)

  const behaviorRef =
    useRef(
      new TitanBehaviorEngine(),
    )

  const contextualTimerRef =
    useRef<number | null>(
      null,
    )

  const pointerReactionTimerRef =
    useRef<number | null>(
      null,
    )

  const pointerRef =
    useRef({
      x: 0,
      y: 0,
    })

  const [
    movement,
    setMovement,
  ] =
    useState<TitanMovementSnapshot>(
      {
        position:
          runtime.position.x ===
            0 &&
          runtime.position.y ===
            0
            ? defaultPosition()
            : runtime.position,

        velocity: {
          x: 0,
          y: 0,
        },

        speed: 0,

        direction:
          runtime.direction,

        state: 'idle',

        moving: false,

        target: null,
      },
    )

  const [
    visualState,
    setVisualState,
  ] =
    useState<TitanAnimationState>(
      'idle',
    )

  const [
    chatOpen,
    setChatOpen,
  ] =
    useState(false)

  const [
    preferencesOpen,
    setPreferencesOpen,
  ] =
    useState(false)

  const [
    pointer,
    setPointer,
  ] =
    useState({
      x: 0,
      y: 0,
    })

  useEffect(() => {
    const initial =
      runtime.position.x ===
        0 &&
      runtime.position.y ===
        0
        ? defaultPosition()
        : clampPosition(
            runtime.position.x,
            runtime.position.y,
          )

    const engine =
      new TitanMovementEngine(
        initial,
      )

    engine.setAllowFlight(
      preferences.allowFlight,
    )

    engine.setListener(
      (snapshot) => {
        setMovement(
          snapshot,
        )

        setVisualState(
          mapLocomotionToAnimation(
            snapshot,
          ),
        )

        if (
          rootRef.current
        ) {
          rootRef.current.style.transform =
            `translate3d(${snapshot.position.x}px, ${snapshot.position.y}px, 0)`
        }
      },
    )

    engine.setArrivalListener(
      (snapshot) => {
        setPosition(
          snapshot.position,
        )

        setVelocity({
          x: 0,
          y: 0,
        })

        setDirection(
          snapshot.direction,
        )

        setVisualState(
          'idle',
        )

        setAnimation(
          'idle',
          'autonomous',
        )
      },
    )

    movementRef.current =
      engine

    setPosition(initial)

    return () => {
      engine.destroy()

      movementRef.current =
        null
    }
  }, [])

  useEffect(() => {
    movementRef.current
      ?.setAllowFlight(
        preferences.allowFlight,
      )
  }, [
    preferences.allowFlight,
  ])

  useEffect(() => {
    const handlePointerMove =
      (
        event:
          PointerEvent,
      ) => {
        const next = {
          x: event.clientX,
          y: event.clientY,
        }

        pointerRef.current =
          next

        behaviorRef.current
          .registerPointer(
            next.x,
            next.y,
          )

        setPointer(next)
      }

    const handleInteraction =
      () => {
        behaviorRef.current
          .registerUserInteraction()
      }

    window.addEventListener(
      'pointermove',
      handlePointerMove,
      {
        passive: true,
      },
    )

    window.addEventListener(
      'pointerdown',
      handleInteraction,
      {
        passive: true,
      },
    )

    window.addEventListener(
      'keydown',
      handleInteraction,
    )

    return () => {
      window.removeEventListener(
        'pointermove',
        handlePointerMove,
      )

      window.removeEventListener(
        'pointerdown',
        handleInteraction,
      )

      window.removeEventListener(
        'keydown',
        handleInteraction,
      )
    }
  }, [])

  const moveToAnchor =
    useCallback(
      (
        anchorName:
          string,
      ) => {
        const target =
          TitanAnchorRegistry
            .getSafePointNear(
              anchorName,
            )

        if (!target) {
          return false
        }

        movementRef.current
          ?.moveTo(
            target,
            {
              allowFlight:
                preferences
                  .allowFlight &&
                !preferences
                  .reducedMotion,
            },
          )

        return true
      },
      [
        preferences.allowFlight,
        preferences.reducedMotion,
      ],
    )

  useEffect(() => {
    if (
      !user ||
      !preferences.visible
    ) {
      return
    }

    if (
      preferences
        .doNotDisturb
    ) {
      return
    }

    if (
      !preferences
        .autonomousBehavior
    ) {
      return
    }

    if (
      !behaviorRef.current
        .canReactContextually({
          autonomous:
            preferences
              .autonomousBehavior,

          followPointer:
            preferences
              .followPointer,

          doNotDisturb:
            preferences
              .doNotDisturb,

          reducedMotion:
            preferences
              .reducedMotion,
        })
    ) {
      return
    }

    behaviorRef.current
      .beginContextReaction()

    if (
      contextualTimerRef.current
    ) {
      window.clearTimeout(
        contextualTimerRef.current,
      )
    }

    contextualTimerRef.current =
      window.setTimeout(
        () => {
          const anchor =
            anchorForModule(
              page.module,
            )

          if (
            anchor &&
            TitanAnchorRegistry
              .exists(anchor)
          ) {
            moveToAnchor(
              anchor,
            )
          }

          if (
            preferences
              .proactiveComments
          ) {
            window.setTimeout(
              () => {
                const message =
                  getTitanContextualGreeting({
                    user,
                    page,
                  })

                say(
                  message,
                  'contextual',
                )

                setVisualState(
                  'talking',
                )
              },
              anchor
                ? 800
                : 250,
            )
          }
        },
        650,
      )

    return () => {
      if (
        contextualTimerRef.current
      ) {
        window.clearTimeout(
          contextualTimerRef.current,
        )
      }
    }
  }, [
    user,
    page.pathname,

    preferences.visible,
    preferences.doNotDisturb,
    preferences.autonomousBehavior,
    preferences.proactiveComments,

    moveToAnchor,
    say,
  ])

  useEffect(() => {
    if (
      !preferences.visible ||
      !preferences
        .autonomousBehavior ||
      !preferences
        .followPointer ||
      preferences
        .doNotDisturb ||
      preferences
        .reducedMotion
    ) {
      return
    }

    const interval =
      window.setInterval(
        () => {
          const behavior =
            behaviorRef.current

          if (
            !behavior
              .canReactToPointer({
                autonomous:
                  preferences
                    .autonomousBehavior,

                followPointer:
                  preferences
                    .followPointer,

                doNotDisturb:
                  preferences
                    .doNotDisturb,

                reducedMotion:
                  preferences
                    .reducedMotion,
              })
          ) {
            return
          }

          const current =
            movementRef.current
              ?.getSnapshot()

          if (
            !current ||
            current.moving
          ) {
            return
          }

          const cursor =
            pointerRef.current

          if (
            cursor.x <= 0 ||
            cursor.y <= 0
          ) {
            return
          }

          behavior
            .beginPointerReaction()

          setVisualState(
            'looking',
          )

          pointerReactionTimerRef.current =
            window.setTimeout(
              () => {
                const target =
                  clampPosition(
                    cursor.x -
                      TITAN_WIDTH /
                        2,

                    cursor.y +
                      45,
                  )

                if (
                  TitanAnchorRegistry
                    .isSafePoint(
                      target,
                    )
                ) {
                  movementRef.current
                    ?.moveTo(
                      target,
                      {
                        allowFlight:
                          false,
                      },
                    )
                }
              },
              900,
            )
        },
        5000,
      )

    return () => {
      window.clearInterval(
        interval,
      )

      if (
        pointerReactionTimerRef.current
      ) {
        window.clearTimeout(
          pointerReactionTimerRef.current,
        )
      }
    }
  }, [
    preferences.visible,
    preferences.autonomousBehavior,
    preferences.followPointer,
    preferences.doNotDisturb,
    preferences.reducedMotion,
  ])

  useEffect(() => {
    const handleResize =
      () => {
        const snapshot =
          movementRef.current
            ?.getSnapshot()

        if (!snapshot) {
          return
        }

        const corrected =
          clampPosition(
            snapshot.position.x,
            snapshot.position.y,
          )

        movementRef.current
          ?.setPosition(
            corrected,
          )

        setPosition(
          corrected,
        )
      }

    window.addEventListener(
      'resize',
      handleResize,
    )

    return () => {
      window.removeEventListener(
        'resize',
        handleResize,
      )
    }
  }, [setPosition])

  useEffect(() => {
    if (
      movement.state !==
      'idle'
    ) {
      setVelocity(
        movement.velocity,
      )

      setDirection(
        movement.direction,
      )
    }
  }, [
    movement.velocity.x,
    movement.velocity.y,
    movement.direction,
    movement.state,
    setVelocity,
    setDirection,
  ])

  useEffect(() => {
    if (
      runtime.message &&
      movement.state ===
        'idle'
    ) {
      setVisualState(
        runtime.animation ===
          'talking'
          ? 'talking'
          : runtime.animation,
      )
    }

    if (
      !runtime.message &&
      movement.state ===
        'idle'
    ) {
      setVisualState(
        'idle',
      )
    }
  }, [
    runtime.message,
    runtime.animation,
    movement.state,
  ])

  if (
    !user ||
    !preferences.visible
  ) {
    return null
  }

  return (
    <div
      ref={rootRef}
      className="titan-assistant"
      style={{
        transform:
          `translate3d(${movement.position.x}px, ${movement.position.y}px, 0)`,
      }}
    >
      {runtime.message && (
        <TitanSpeechBubble
          message={
            runtime.message
          }
          onClose={() => {
            clearMessage()

            setVisualState(
              'idle',
            )
          }}
        />
      )}

      {preferencesOpen && (
        <TitanPreferencesPanel
          onClose={() =>
            setPreferencesOpen(
              false,
            )
          }
        />
      )}

      {chatOpen && (
        <div
          className="titan-chat-preview"
          data-titan-blocking="true"
        >
          <div className="titan-chat-preview__header">
            <div>
              <strong>
                Titan Assistant
              </strong>

              <span>
                {user.fullName}
                {' · '}
                {page.module}
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                setChatOpen(
                  false,
                )
              }
            >
              ×
            </button>
          </div>

          <div className="titan-chat-preview__body">
            <strong>
              Hola,{' '}
              {user.firstName}.
            </strong>

            <p>
              Estoy usando el contexto
              de tu sesión, módulo,
              roles y permisos.
            </p>

            <span>
              La conversación con el
              modelo local se conectará
              sobre esta misma capa.
            </span>
          </div>
        </div>
      )}

      <div className="titan-assistant__toolbar">
        <button
          type="button"
          aria-label="Abrir conversación"
          onClick={() =>
            setChatOpen(
              (current) =>
                !current,
            )
          }
        >
          <MessageCircle
            size={15}
          />
        </button>

        <button
          type="button"
          aria-label="Preferencias de Titan"
          onClick={() =>
            setPreferencesOpen(
              (current) =>
                !current,
            )
          }
        >
          <Settings2
            size={15}
          />
        </button>
      </div>

      <TitanAvatarCanvas
        animation={
          visualState
        }
        velocity={
          movement.velocity
        }
        direction={
          movement.direction
        }
        pointerX={
          pointer.x
        }
        pointerY={
          pointer.y
        }
        reducedMotion={
          preferences
            .reducedMotion
        }
        onClick={() => {
          behaviorRef.current
            .registerUserInteraction()

          setChatOpen(
            (current) =>
              !current,
          )
        }}
      />
    </div>
  )
}