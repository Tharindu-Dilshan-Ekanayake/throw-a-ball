import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Quaternion, Vector3 } from 'three'

import { clampToWalkable, groundHeightAt, STATIC_COLLIDERS } from '@shared/world'

import { sfx } from '../audio/sfx'
import { getGame } from '../store/game'
import { getQuality } from '../store/quality'
import ErrorBoundary from '../ui/ErrorBoundary'
import FallbackAvatar from './FallbackAvatar'
import { createFrisbeeModel } from './frisbee'
import PlayerAvatar from './PlayerAvatar'
import {
  CATCH_TIME,
  FACE_FLAT,
  FACE_UPRIGHT,
  GRIP_FLAT,
  GRIP_UPRIGHT,
  heldFlatness,
  RELEASE_AT,
  THROW_TIME,
} from './playerPose'
import { runtime } from './runtime'
import useKeyboard from './useKeyboard'

export const PLAYER_HEIGHT = 1.8
const RADIUS = 0.45

const WALK_SPEED = 7.5
const SPRINT_MULTIPLIER = 1.45
const ACCELERATION = 16
const GRAVITY = 32
const JUMP_SPEED = 10.5
/** Ledges up to this high are walked straight onto (the shop's back stage). */
const STEP_UP = 1.05

// Scratch objects, reused each frame so the loop allocates nothing.
const _input = new Vector3()
const _move = new Vector3()
const _camForward = new Vector3()
const _camRight = new Vector3()
const _targetQuat = new Quaternion()
const _up = new Vector3(0, 1, 0)
const _clamped = { x: 0, z: 0 }

/**
 * The equipped frisbee in the right hand, glowing in its own colour. It lives inside
 * the hand anchor the avatar moves onto the palm each frame; here it only picks its
 * grip: upright at the side, turning flat through the wind-up and coming back flat
 * from a catch. Hidden while it is away (thrown), so the flying copy reads as this one.
 */
function HeldFrisbee() {
  const ref = useRef(null)
  const model = useMemo(() => createFrisbeeModel({ glowSize: 1.5, glowIntensity: 0.6 }), [])

  useEffect(() => () => model.dispose(), [model])

  useFrame(() => {
    const group = ref.current
    if (!group) return
    const player = runtime.player
    group.setFrisbee(getGame().profile.equippedPlane)
    group.setGlowSize(1.5 * getQuality().frisbeeGlow)
    group.visible = !player.frisbeeAway
    const flat = heldFlatness(player.throwTimer, player.catchTimer)
    group.position.lerpVectors(GRIP_UPRIGHT, GRIP_FLAT, flat)
    group.quaternion.slerpQuaternions(FACE_UPRIGHT, FACE_FLAT, flat)
    // Where a throw starts from: the training shots and the stage flight read it.
    group.getWorldPosition(player.frisbeeAt)
  })

  return <primitive ref={ref} object={model} scale={0.95} />
}

/** Pushes a circle out of an axis-aligned rect. Returns true on contact. */
function pushOut(pos, rect) {
  const cx = Math.min(rect.maxX, Math.max(rect.minX, pos.x))
  const cz = Math.min(rect.maxZ, Math.max(rect.minZ, pos.z))
  const dx = pos.x - cx
  const dz = pos.z - cz
  const d2 = dx * dx + dz * dz
  if (d2 >= RADIUS * RADIUS) return false

  if (d2 > 1e-8) {
    const d = Math.sqrt(d2)
    const push = (RADIUS - d) / d
    pos.x += dx * push
    pos.z += dz * push
    return true
  }

  // Centre inside the rect (spawned in, or a wall appeared on top of us): leave by the
  // nearest side.
  const left = pos.x - rect.minX
  const right = rect.maxX - pos.x
  const near = pos.z - rect.minZ
  const far = rect.maxZ - pos.z
  const m = Math.min(left, right, near, far)
  if (m === left) pos.x = rect.minX - RADIUS
  else if (m === right) pos.x = rect.maxX + RADIUS
  else if (m === near) pos.z = rect.minZ - RADIUS
  else pos.z = rect.maxZ + RADIUS
  return true
}

/**
 * The local player: a kinematic character controller.
 *
 * No physics engine: the world is flat ground, a few raised floors and a list of
 * rectangular walls, which a circle-vs-rect push-out handles exactly. That saves the
 * ~2 MB Rapier WASM download and keeps the active rigid body count at zero.
 *
 * Reads and writes `runtime.player`; never touches React state per frame.
 *
 * @param {{ onAvatarReady?: () => void }} props
 */
export function Player({ onAvatarReady }) {
  const groupRef = useRef(null)
  const visualRef = useRef(null)
  /** Moved onto the right palm by whichever avatar is showing. */
  const handRef = useRef(null)
  const keys = useKeyboard()
  const velocity = useRef(new Vector3())
  const vy = useRef(0)

  /** Handed to the avatar so it can pose itself. A ref: written every frame. */
  const motionRef = useRef({
    time: 0,
    speed: 0,
    grounded: true,
    maxSpeed: WALK_SPEED,
    vy: 0,
    stride: 0,
    throwT: 0,
    catchT: 0,
  })

  useEffect(() => {
    const caster = { position: runtime.player.position, size: 1.1 }
    runtime.shadowCasters.add(caster)
    return () => runtime.shadowCasters.delete(caster)
  }, [])

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const player = runtime.player
    const pos = player.position
    const k = keys.current
    const joy = runtime.input

    // --- Input, relative to the camera ----------------------------------------
    _input.set(0, 0, 0)
    if (!player.frozen) {
      _input.set(
        (k.right ? 1 : 0) - (k.left ? 1 : 0) + joy.joyX,
        0,
        (k.backward ? 1 : 0) - (k.forward ? 1 : 0) - joy.joyY,
      )
    }
    const inputLength = Math.min(1, _input.length())
    const sprint = k.sprint ? SPRINT_MULTIPLIER : 1
    const maxSpeed = WALK_SPEED * sprint

    if (inputLength > 0.02) {
      _input.normalize()
      // Flatten the camera's forward onto the ground plane so "up" always means
      // "away from the camera".
      state.camera.getWorldDirection(_camForward)
      _camForward.y = 0
      _camForward.normalize()
      _camRight.crossVectors(_camForward, _up).normalize()
      _move
        .set(0, 0, 0)
        .addScaledVector(_camForward, -_input.z)
        .addScaledVector(_camRight, _input.x)
        .normalize()
        .multiplyScalar(maxSpeed * inputLength)
    } else {
      _move.set(0, 0, 0)
    }

    // Ease towards the target velocity: crisp, but no instant 0->max snaps.
    const blend = 1 - Math.exp(-ACCELERATION * delta)
    velocity.current.lerp(_move, blend)

    // --- Horizontal move + collision --------------------------------------------
    const prevX = pos.x
    const prevZ = pos.z
    pos.x += velocity.current.x * delta
    pos.z += velocity.current.z * delta

    for (const rect of STATIC_COLLIDERS) pushOut(pos, rect)
    for (const rect of runtime.dynamicColliders) pushOut(pos, rect)
    clampToWalkable(pos.x, pos.z, _clamped)
    pos.x = _clamped.x
    pos.z = _clamped.z

    // A ledge too tall to step onto acts as a wall.
    let floor = groundHeightAt(pos.x, pos.z)
    if (floor - pos.y > STEP_UP) {
      pos.x = prevX
      pos.z = prevZ
      floor = groundHeightAt(pos.x, pos.z)
    }

    // --- Vertical ---------------------------------------------------------------
    const wantJump = !player.frozen && (k.jump || joy.jump)
    if (wantJump && player.grounded) {
      vy.current = JUMP_SPEED
      player.grounded = false
      sfx.jump()
    }
    vy.current -= GRAVITY * delta
    pos.y += vy.current * delta

    if (pos.y <= floor) {
      // Coming down from a jump (not just stepping off a kerb) lands with a thump.
      if (!player.grounded && vy.current < -5) sfx.jumpLand()
      pos.y = floor
      vy.current = 0
      player.grounded = true
    } else if (pos.y - floor > 0.05) {
      // Walked off a ledge, or still rising from a jump.
      player.grounded = false
    }

    // --- Facing -----------------------------------------------------------------
    const speed = Math.hypot(velocity.current.x, velocity.current.z)
    if (speed > 0.3) player.yaw = Math.atan2(velocity.current.x, velocity.current.z)
    if (visualRef.current) {
      _targetQuat.setFromAxisAngle(_up, player.yaw)
      visualRef.current.quaternion.slerp(_targetQuat, 1 - Math.pow(0.0005, delta))
    }
    const group = groupRef.current
    if (group) {
      // Step-ups ease in over a few frames on the visual only; the logical position
      // snaps so collision and triggers stay exact.
      const steppingUp = player.grounded && pos.y > group.position.y
      const visualY = steppingUp
        ? group.position.y + (pos.y - group.position.y) * Math.min(1, delta * 18)
        : pos.y
      group.position.set(pos.x, visualY, pos.z)
    }

    // --- Throw and catch -------------------------------------------------------
    // The frisbee is away from the release until the swing ends (a training shot), or
    // for the whole flight off the stage; it comes back into the hand with a catch.
    player.throwTimer = Math.max(0, player.throwTimer - delta)
    const wasAway = player.frisbeeAway
    player.frisbeeAway =
      player.throwTimer > 0 ? player.throwTimer <= THROW_TIME * (1 - RELEASE_AT) : runtime.camera.mode === 'flight'
    player.catchTimer = wasAway && !player.frisbeeAway ? CATCH_TIME : Math.max(0, player.catchTimer - delta)
    // A new throw starts with the frisbee already in hand.
    if (player.throwTimer > 0) player.catchTimer = 0

    // --- Publish motion ---------------------------------------------------------
    player.speed = speed
    player.anim = !player.grounded ? 'jump' : player.throwTimer > 0 ? 'throw' : speed > 0.5 ? 'walk' : 'idle'

    const motion = motionRef.current
    motion.time += delta
    motion.speed = speed
    motion.grounded = player.grounded
    // Full stride amplitude at a sprint, so walking reads as a walk.
    motion.maxSpeed = WALK_SPEED * SPRINT_MULTIPLIER
    motion.vy = vy.current
    // Steps quicken with speed: the stride phase runs faster rather than jumping.
    motion.stride += delta * (5 + 6 * Math.min(1, speed / (WALK_SPEED * SPRINT_MULTIPLIER)))
    motion.throwT = player.throwTimer
    motion.catchT = player.catchTimer
  })

  return (
    <group ref={groupRef}>
      <group ref={visualRef}>
        <group ref={handRef}>
          <HeldFrisbee />
        </group>
        <ErrorBoundary fallback={<FallbackAvatar motionRef={motionRef} handRef={handRef} onReady={onAvatarReady} />}>
          <Suspense fallback={<FallbackAvatar motionRef={motionRef} handRef={handRef} />}>
            <PlayerAvatar onReady={onAvatarReady} targetHeight={PLAYER_HEIGHT} motionRef={motionRef} handRef={handRef} />
          </Suspense>
        </ErrorBoundary>
      </group>
    </group>
  )
}

export default Player
