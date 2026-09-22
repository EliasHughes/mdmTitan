import {
  useEffect,
  useRef,
} from 'react'

import type {
  TitanAnimationState,
  TitanFacingDirection,
  TitanVelocity,
} from '../context/TitanAssistantContext'

interface TitanAvatarCanvasProps {
  animation:
    TitanAnimationState

  velocity:
    TitanVelocity

  direction:
    TitanFacingDirection

  pointerX: number

  pointerY: number

  reducedMotion: boolean

  onClick: () => void
}

interface Pose {
  bodyTilt: number

  bodyBob: number

  headTilt: number

  leftArm: number

  rightArm: number

  leftUpperLeg: number

  rightUpperLeg: number

  leftKnee: number

  rightKnee: number

  thruster: number
}

const WIDTH = 130

const HEIGHT = 190

const lerp = (
  current: number,
  target: number,
  amount: number,
) =>
  current +
  (
    target - current
  ) *
    amount

function smoothFactor(
  speed: number,
  deltaTime: number,
) {
  return (
    1 -
    Math.exp(
      -speed * deltaTime,
    )
  )
}

export function TitanAvatarCanvas({
  animation,
  velocity,
  direction,
  pointerX,
  pointerY,
  reducedMotion,
  onClick,
}: TitanAvatarCanvasProps) {
  const canvasRef =
    useRef<HTMLCanvasElement>(
      null,
    )

  const animationRef =
    useRef(animation)

  const velocityRef =
    useRef(velocity)

  const directionRef =
    useRef(direction)

  const pointerRef =
    useRef({
      x: pointerX,
      y: pointerY,
    })

  const reducedMotionRef =
    useRef(reducedMotion)

  useEffect(() => {
    animationRef.current =
      animation
  }, [animation])

  useEffect(() => {
    velocityRef.current =
      velocity
  }, [velocity])

  useEffect(() => {
    directionRef.current =
      direction
  }, [direction])

  useEffect(() => {
    pointerRef.current = {
      x: pointerX,
      y: pointerY,
    }
  }, [
    pointerX,
    pointerY,
  ])

  useEffect(() => {
    reducedMotionRef.current =
      reducedMotion
  }, [reducedMotion])

  useEffect(() => {
    const canvas =
      canvasRef.current

    if (!canvas) {
      return
    }

    const context =
      canvas.getContext(
        '2d',
      )

    if (!context) {
      return
    }

    const dpr =
      Math.min(
        window.devicePixelRatio ||
          1,
        2,
      )

    canvas.width =
      WIDTH * dpr

    canvas.height =
      HEIGHT * dpr

    context.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0,
    )

    let frameId = 0

    let previousTime =
      performance.now()

    let elapsed = 0

    let walkPhase = 0

    let blinkTimer = 0

    let blinking = false

    const pose: Pose = {
      bodyTilt: 0,

      bodyBob: 0,

      headTilt: 0,

      leftArm: 0,

      rightArm: 0,

      leftUpperLeg: 0,

      rightUpperLeg: 0,

      leftKnee: 0,

      rightKnee: 0,

      thruster: 0,
    }

    const render = (
      timestamp: number,
    ) => {
      const deltaTime =
        Math.min(
          (
            timestamp -
            previousTime
          ) / 1000,

          0.033,
        )

      previousTime =
        timestamp

      elapsed += deltaTime

      const state =
        animationRef.current

      const currentVelocity =
        velocityRef.current

      const speed =
        Math.hypot(
          currentVelocity.x,
          currentVelocity.y,
        )

      const facing =
        directionRef.current ===
        'left'
          ? -1
          : 1

      const walking =
        state === 'walking' ||
        state === 'running'

      const flying =
        state === 'flying'

      const takeoff =
        state ===
          'prepare-takeoff' ||
        state === 'takeoff'

      const landing =
        state === 'landing'

      const talking =
        state === 'talking'

      const thinking =
        state === 'thinking'

      const warning =
        state === 'warning'

      const pointing =
        state === 'pointing'

      if (walking) {
        const cadence =
          4.5 +
          Math.min(
            speed / 55,
            4.5,
          )

        walkPhase +=
          deltaTime *
          cadence
      }

      const stride =
        walking
          ? Math.sin(
              walkPhase,
            )
          : 0

      const oppositeStride =
        walking
          ? Math.sin(
              walkPhase +
                Math.PI,
            )
          : 0

      const strideAmount =
        walking
          ? Math.min(
              0.58,
              0.2 +
                speed /
                  420,
            )
          : 0

      let targetBodyTilt = 0

      let targetBodyBob =
        Math.sin(
          elapsed * 2.1,
        ) * 1.6

      let targetHeadTilt =
        Math.sin(
          elapsed * 1.3,
        ) * 0.025

      let targetLeftArm = 0

      let targetRightArm = 0

      let targetLeftLeg = 0

      let targetRightLeg = 0

      let targetLeftKnee =
        0.06

      let targetRightKnee =
        0.06

      let targetThruster = 0

      if (walking) {
        targetBodyBob =
          Math.abs(
            Math.sin(
              walkPhase * 2,
            ),
          ) * -2.5

        targetBodyTilt =
          0.035 * facing

        targetLeftLeg =
          stride *
          strideAmount

        targetRightLeg =
          oppositeStride *
          strideAmount

        targetLeftArm =
          oppositeStride *
          strideAmount *
          0.72

        targetRightArm =
          stride *
          strideAmount *
          0.72

        targetLeftKnee =
          Math.max(
            0,
            -stride,
          ) * 0.62

        targetRightKnee =
          Math.max(
            0,
            -oppositeStride,
          ) * 0.62
      }

      if (takeoff) {
        targetBodyBob = 4

        targetBodyTilt = 0

        targetLeftLeg =
          -0.14

        targetRightLeg =
          0.14

        targetLeftKnee =
          0.48

        targetRightKnee =
          0.48

        targetLeftArm =
          -0.18

        targetRightArm =
          0.18

        targetThruster = 1
      }

      if (flying) {
        const velocityAngle =
          Math.atan2(
            currentVelocity.y,
            Math.max(
              Math.abs(
                currentVelocity.x,
              ),
              1,
            ),
          )

        targetBodyTilt =
          facing *
          Math.min(
            0.48,
            0.24 +
              speed / 1800,
          )

        targetBodyTilt +=
          velocityAngle * 0.2

        targetBodyBob =
          Math.sin(
            elapsed * 5,
          ) * 1.4

        targetLeftArm =
          -0.3

        targetRightArm =
          0.3

        targetLeftLeg =
          -0.22

        targetRightLeg =
          0.22

        targetLeftKnee =
          0.55

        targetRightKnee =
          0.55

        targetThruster = 1
      }

      if (landing) {
        targetBodyBob = 3

        targetLeftKnee =
          0.5

        targetRightKnee =
          0.5

        targetThruster =
          0.35
      }

      if (thinking) {
        targetHeadTilt =
          -0.12
      }

      if (talking) {
        targetHeadTilt =
          Math.sin(
            elapsed * 7,
          ) * 0.035
      }

      if (warning) {
        targetHeadTilt =
          Math.sin(
            elapsed * 9,
          ) * 0.04
      }

      if (pointing) {
        if (
          directionRef.current ===
          'right'
        ) {
          targetRightArm =
            -1.12
        } else {
          targetLeftArm =
            1.12
        }
      }

      if (
        reducedMotionRef.current
      ) {
        targetBodyBob = 0
      }

      const smoothing =
        smoothFactor(
          10,
          deltaTime,
        )

      pose.bodyTilt =
        lerp(
          pose.bodyTilt,
          targetBodyTilt,
          smoothing,
        )

      pose.bodyBob =
        lerp(
          pose.bodyBob,
          targetBodyBob,
          smoothing,
        )

      pose.headTilt =
        lerp(
          pose.headTilt,
          targetHeadTilt,
          smoothing,
        )

      pose.leftArm =
        lerp(
          pose.leftArm,
          targetLeftArm,
          smoothing,
        )

      pose.rightArm =
        lerp(
          pose.rightArm,
          targetRightArm,
          smoothing,
        )

      pose.leftUpperLeg =
        lerp(
          pose.leftUpperLeg,
          targetLeftLeg,
          smoothing,
        )

      pose.rightUpperLeg =
        lerp(
          pose.rightUpperLeg,
          targetRightLeg,
          smoothing,
        )

      pose.leftKnee =
        lerp(
          pose.leftKnee,
          targetLeftKnee,
          smoothing,
        )

      pose.rightKnee =
        lerp(
          pose.rightKnee,
          targetRightKnee,
          smoothing,
        )

      pose.thruster =
        lerp(
          pose.thruster,
          targetThruster,
          smoothing,
        )

      blinkTimer +=
        deltaTime

      if (
        blinkTimer > 3.8
      ) {
        blinking = true

        if (
          blinkTimer > 3.95
        ) {
          blinking = false

          blinkTimer = 0
        }
      }

      drawRobot(
        context,
        pose,
        elapsed,
        facing,
        blinking,
        warning,
        pointerRef.current,
      )

      frameId =
        requestAnimationFrame(
          render,
        )
    }

    frameId =
      requestAnimationFrame(
        render,
      )

    return () => {
      cancelAnimationFrame(
        frameId,
      )
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="titan-avatar-canvas"
      width={WIDTH}
      height={HEIGHT}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label="Abrir Titan Assistant"
      onKeyDown={(event) => {
        if (
          event.key ===
            'Enter' ||
          event.key === ' '
        ) {
          onClick()
        }
      }}
    />
  )
}

function drawRobot(
  context:
    CanvasRenderingContext2D,

  pose: Pose,

  elapsed: number,

  facing: number,

  blinking: boolean,

  warning: boolean,

  pointer: {
    x: number
    y: number
  },
) {
  context.clearRect(
    0,
    0,
    WIDTH,
    HEIGHT,
  )

  context.save()

  context.translate(
    WIDTH / 2,
    89 + pose.bodyBob,
  )

  context.rotate(
    pose.bodyTilt,
  )

  drawShadow(
    context,
    pose,
  )

  drawThrusters(
    context,
    pose,
    elapsed,
  )

  drawLeg(
    context,
    -12,
    pose.leftUpperLeg,
    pose.leftKnee,
  )

  drawLeg(
    context,
    12,
    pose.rightUpperLeg,
    pose.rightKnee,
  )

  drawArm(
    context,
    -22,
    pose.leftArm,
    -1,
  )

  drawArm(
    context,
    22,
    pose.rightArm,
    1,
  )

  drawTorso(
    context,
  )

  drawHead(
    context,
    pose,
    facing,
    blinking,
    warning,
    pointer,
  )

  context.restore()
}

function drawShadow(
  context:
    CanvasRenderingContext2D,

  pose: Pose,
) {
  context.save()

  context.globalAlpha =
    0.16

  context.fillStyle =
    '#263b69'

  context.beginPath()

  context.ellipse(
    0,
    88,
    28 -
      pose.thruster * 6,
    5 -
      pose.thruster * 1.5,
    0,
    0,
    Math.PI * 2,
  )

  context.fill()

  context.restore()
}

function drawTorso(
  context:
    CanvasRenderingContext2D,
) {
  const gradient =
    context.createLinearGradient(
      -20,
      -10,
      20,
      45,
    )

  gradient.addColorStop(
    0,
    '#ffffff',
  )

  gradient.addColorStop(
    0.55,
    '#e7edff',
  )

  gradient.addColorStop(
    1,
    '#b8c8f4',
  )

  context.fillStyle =
    gradient

  context.strokeStyle =
    '#9db2ea'

  context.lineWidth = 1.5

  context.beginPath()

  context.roundRect(
    -19,
    -5,
    38,
    50,
    17,
  )

  context.fill()
  context.stroke()

  context.fillStyle =
    '#4f73e8'

  context.beginPath()

  context.roundRect(
    -8,
    10,
    16,
    17,
    6,
  )

  context.fill()

  context.strokeStyle =
    '#ffffff'

  context.lineWidth = 1.5

  context.beginPath()

  context.moveTo(
    0,
    13,
  )

  context.lineTo(
    0,
    23,
  )

  context.moveTo(
    -4,
    18,
  )

  context.lineTo(
    4,
    18,
  )

  context.stroke()
}

function drawHead(
  context:
    CanvasRenderingContext2D,

  pose: Pose,

  facing: number,

  blinking: boolean,

  warning: boolean,

  pointer: {
    x: number
    y: number
  },
) {
  context.save()

  context.translate(
    0,
    -27,
  )

  context.rotate(
    pose.headTilt,
  )

  const gradient =
    context.createLinearGradient(
      -27,
      -20,
      27,
      22,
    )

  gradient.addColorStop(
    0,
    '#ffffff',
  )

  gradient.addColorStop(
    1,
    '#cbd8fb',
  )

  context.fillStyle =
    gradient

  context.strokeStyle =
    '#9db2ea'

  context.lineWidth = 1.5

  context.beginPath()

  context.roundRect(
    -28,
    -21,
    56,
    42,
    17,
  )

  context.fill()
  context.stroke()

  const visor =
    context.createLinearGradient(
      0,
      -10,
      0,
      12,
    )

  visor.addColorStop(
    0,
    '#18325d',
  )

  visor.addColorStop(
    1,
    '#08172f',
  )

  context.fillStyle =
    visor

  context.beginPath()

  context.roundRect(
    -21,
    -12,
    42,
    24,
    10,
  )

  context.fill()

  const lookX =
    Math.max(
      -2.5,
      Math.min(
        2.5,
        (
          pointer.x -
          window.innerWidth /
            2
        ) /
          300,
      ),
    ) * facing

  const eyeHeight =
    blinking
      ? 1.2
      : 5

  context.fillStyle =
    warning
      ? '#ff6b6b'
      : '#71a7ff'

  context.shadowColor =
    context.fillStyle

  context.shadowBlur = 7

  context.beginPath()

  context.roundRect(
    -12 + lookX,
    -2.5,
    5,
    eyeHeight,
    3,
  )

  context.roundRect(
    7 + lookX,
    -2.5,
    5,
    eyeHeight,
    3,
  )

  context.fill()

  context.shadowBlur = 0

  context.strokeStyle =
    '#8199dc'

  context.lineWidth = 2

  context.beginPath()

  context.moveTo(
    0,
    -21,
  )

  context.lineTo(
    0,
    -31,
  )

  context.stroke()

  context.fillStyle =
    warning
      ? '#ff6b6b'
      : '#557cf1'

  context.beginPath()

  context.arc(
    0,
    -34,
    3.8,
    0,
    Math.PI * 2,
  )

  context.fill()

  context.restore()
}

function drawArm(
  context:
    CanvasRenderingContext2D,

  shoulderX: number,

  angle: number,

  side: number,
) {
  context.save()

  context.translate(
    shoulderX,
    3,
  )

  context.rotate(
    angle,
  )

  context.strokeStyle =
    '#a8b9e8'

  context.lineWidth = 8

  context.lineCap =
    'round'

  context.beginPath()

  context.moveTo(
    0,
    0,
  )

  context.lineTo(
    side * 3,
    22,
  )

  context.stroke()

  context.fillStyle =
    '#e4ebff'

  context.beginPath()

  context.arc(
    side * 3,
    23,
    5,
    0,
    Math.PI * 2,
  )

  context.fill()

  context.restore()
}

function drawLeg(
  context:
    CanvasRenderingContext2D,

  hipX: number,

  upperAngle: number,

  kneeAngle: number,
) {
  context.save()

  context.translate(
    hipX,
    40,
  )

  context.rotate(
    upperAngle,
  )

  context.strokeStyle =
    '#a8b9e8'

  context.lineWidth = 9

  context.lineCap =
    'round'

  context.beginPath()

  context.moveTo(
    0,
    0,
  )

  context.lineTo(
    0,
    24,
  )

  context.stroke()

  context.translate(
    0,
    24,
  )

  context.rotate(
    kneeAngle,
  )

  context.strokeStyle =
    '#bdcaf0'

  context.lineWidth = 8

  context.beginPath()

  context.moveTo(
    0,
    0,
  )

  context.lineTo(
    0,
    23,
  )

  context.stroke()

  context.translate(
    0,
    23,
  )

  context.fillStyle =
    '#7793df'

  context.beginPath()

  context.roundRect(
    -5,
    -2,
    16,
    7,
    4,
  )

  context.fill()

  context.restore()
}

function drawThrusters(
  context:
    CanvasRenderingContext2D,

  pose: Pose,

  elapsed: number,
) {
  if (
    pose.thruster <
    0.05
  ) {
    return
  }

  const pulse =
    1 +
    Math.sin(
      elapsed * 25,
    ) * 0.18

  for (
    const x
    of [-11, 11]
  ) {
    const gradient =
      context.createLinearGradient(
        x,
        45,
        x,
        72,
      )

    gradient.addColorStop(
      0,
      'rgba(100,160,255,0.95)',
    )

    gradient.addColorStop(
      0.5,
      'rgba(85,125,255,0.72)',
    )

    gradient.addColorStop(
      1,
      'rgba(80,130,255,0)',
    )

    context.fillStyle =
      gradient

    context.beginPath()

    context.moveTo(
      x - 4,
      43,
    )

    context.lineTo(
      x + 4,
      43,
    )

    context.lineTo(
      x,
      43 +
        25 *
          pose.thruster *
          pulse,
    )

    context.closePath()

    context.fill()
  }
}