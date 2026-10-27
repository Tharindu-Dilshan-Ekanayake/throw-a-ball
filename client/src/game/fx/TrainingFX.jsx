import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Matrix4, Quaternion, Vector3 } from 'three'

import { formatNumber } from '@shared/format'

import { sfx } from '../../audio/sfx'
import { getGame } from '../../store/game'
import { getQuality } from '../../store/quality'
import { iconUrl } from '../../ui/icons'
import { BALL_RADIUS, createSoftballMesh, disposeSoftballMesh, softballGlow, softballOrientation } from '../softball'
import { createGlowInstances, disposeGlow } from '../glow'
import { RELEASE_AT, RELEASE_DELAY, THROW_TIME } from '../playerPose'
import { runtime } from '../runtime'
import { targetPoint } from '../world/targets'
import { drainTrainFx } from './fxQueue'
import { spawnPopup, updatePopups } from './popups'

const MAX_SHOTS = 8
const FLIGHT_TIME = 0.42
/** How far ahead a click throw lands. */
const CLICK_RANGE = 9
const ARC_HEIGHT = 0.9
/** After landing: gravity, how much of the speed a bounce keeps, and when it stops. */
const BOUNCE_GRAVITY = 24
const BOUNCE_KEEP = 0.56
const BOUNCE_ROLL_KEEP = 0.8
const BOUNCE_MIN_SPEED = 1.4
const BOUNCE_MAX_TIME = 2.4
const BOUNCE_ROLL_DRAG = 2.5

const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _prev = new Vector3()
const _s = new Vector3(0.75, 0.75, 0.75)
const _popupAt = new Vector3()
const _glowScale = new Vector3()
const _dir = new Vector3()

const LEVEL_GRADIENT = 'linear-gradient(180deg, #e0faff 0%, #7fe2ff 45%, #2fa8ff 100%)'

/**
 * Training feedback: the character's throw, the softball flying into the target, and the
 * "+N POWER" popup when it hits. Shots come from a fixed pool in one InstancedMesh.
 */
export function TrainingFX() {
  const size = useThree((s) => s.size)
  const meshRef = useRef(null)
  const glowRef = useRef(null)
  const shots = useRef(
    Array.from({ length: MAX_SHOTS }, () => ({
      active: false,
      released: false,
      lane: -1,
      t: 0,
      gain: 0,
      leveledUp: false,
      from: new Vector3(),
      to: new Vector3(),
      // After it lands the ball bounces on under its own physics.
      landed: false,
      bounceT: 0,
      pos: new Vector3(),
      vel: new Vector3(),
    })),
  )

  const mesh = useMemo(() => createSoftballMesh(MAX_SHOTS), [])

  const glow = useMemo(() => createGlowInstances(MAX_SHOTS), [])

  useEffect(
    () => () => {
      disposeSoftballMesh(mesh)
      disposeGlow(glow)
    },
    [mesh, glow],
  )

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const instanced = meshRef.current
    const halos = glowRef.current
    if (!instanced || !halos) return
    const player = runtime.player

    drainTrainFx((event) => {
      // A new swing once the last one has let go; quick clicks before that ride along
      // on the swing already under way.
      if (player.throwTimer <= THROW_TIME * (1 - RELEASE_AT)) {
        player.throwTimer = THROW_TIME
        player.throwSeq += 1
      }
      const shot = shots.current.find((s) => !s.active) || shots.current[0]
      if (event.lane >= 0) {
        shot.to.fromArray(targetPoint(event.lane))
        // Face the target while training, unless walking somewhere.
        if (player.speed < 0.5) player.yaw = Math.atan2(shot.to.x - player.position.x, shot.to.z - player.position.z)
      } else {
        // A click throw lands on the ground ahead, wherever you're facing.
        shot.to.set(
          player.position.x + Math.sin(player.yaw) * CLICK_RANGE,
          player.position.y + 0.4,
          player.position.z + Math.cos(player.yaw) * CLICK_RANGE,
        )
      }
      shot.active = true
      shot.released = false
      shot.landed = false
      shot.lane = event.lane
      shot.t = 0
      shot.gain = event.gain
      shot.leveledUp = event.leveledUp
    })

    const ballId = getGame().profile.equippedPlane
    const glowColor = softballGlow(ballId)
    const glowSize = 1.3 * getQuality().ballGlow
    const spin = state.clock.elapsedTime * 25
    let count = 0
    for (const shot of shots.current) {
      if (!shot.active) continue
      shot.t += delta
      const flight = (shot.t - RELEASE_DELAY) / FLIGHT_TIME
      if (flight < 0) continue
      // Leaves from wherever the hand has swung the softball to at the release.
      if (!shot.released) {
        shot.released = true
        shot.from.copy(player.ballAt)
        sfx.swish()
      }
      if (flight >= 1 && !shot.landed) {
        shot.landed = true
        shot.bounceT = 0
        shot.pos.copy(shot.to)
        // A click throw bounces on ahead, a lane shot rebounds off its target.
        _dir.subVectors(shot.to, shot.from).setY(0).normalize()
        const away = shot.lane >= 0 ? -0.5 : 1
        shot.vel.set(_dir.x * 6.5 * away, shot.lane >= 0 ? 3 : 7, _dir.z * 6.5 * away)
        _popupAt.set(
          player.position.x + (Math.random() - 0.5) * 3,
          player.position.y + 0.6 + Math.random() * 1.4,
          player.position.z + (Math.random() - 0.5) * 1.5,
        )
        spawnPopup(`+${formatNumber(shot.gain)} POWER`, _popupAt, { iconUrl: iconUrl('muscle') })
        // A lane's target takes a thwack; a click throw just lands.
        if (shot.lane >= 0) sfx.targetHit()
        else sfx.power()
        if (shot.leveledUp) {
          _popupAt.set(player.position.x, player.position.y + 2.6, player.position.z)
          spawnPopup('LEVEL UP!', _popupAt, { gradient: LEVEL_GRADIENT, scale: 1.5, life: 1600 })
        }
      }
      if (shot.landed) {
        // Falls, bounces off the floor losing height each time, and rolls to a stop.
        shot.bounceT += delta
        shot.vel.y -= BOUNCE_GRAVITY * delta
        shot.pos.addScaledVector(shot.vel, delta)
        const floorY = player.position.y + _s.x * BALL_RADIUS
        if (shot.pos.y < floorY) {
          shot.pos.y = floorY
          if (shot.vel.y < -BOUNCE_MIN_SPEED) {
            sfx.bounce(Math.min(1, -shot.vel.y / 9))
            shot.vel.y *= -BOUNCE_KEEP
            shot.vel.x *= BOUNCE_ROLL_KEEP
            shot.vel.z *= BOUNCE_ROLL_KEEP
          } else {
            // Too soft to hop again: it rolls on, slowing under drag.
            shot.vel.y = 0
            const drag = Math.exp(-BOUNCE_ROLL_DRAG * delta)
            shot.vel.x *= drag
            shot.vel.z *= drag
          }
        }
        if (shot.bounceT > BOUNCE_MAX_TIME || (shot.vel.y === 0 && Math.hypot(shot.vel.x, shot.vel.z) < 0.4)) {
          shot.active = false
          continue
        }
        softballOrientation(_q, spin * 0.6 + count, 0.25, shot.bounceT * 6)
        instanced.setMatrixAt(count, _m.compose(shot.pos, _q, _s))
        instanced.setStyle(count, ballId)
        halos.setMatrixAt(count, _m.compose(shot.pos, _q, _glowScale.setScalar(glowSize * 0.7)))
        halos.setColorAt(count, glowColor)
        count += 1
        continue
      }
      const arc = Math.sin(flight * Math.PI) * ARC_HEIGHT
      _prev.lerpVectors(shot.from, shot.to, Math.max(0, flight - 0.05))
      _prev.y += Math.sin(Math.max(0, flight - 0.05) * Math.PI) * ARC_HEIGHT
      _p.lerpVectors(shot.from, shot.to, flight)
      _p.y += arc
      // Flat and spinning, tipped a little towards the target.
      softballOrientation(_q, spin + count, 0.25, 0)
      instanced.setMatrixAt(count, _m.compose(_p, _q, _s))
      instanced.setStyle(count, ballId)
      halos.setMatrixAt(count, _m.compose(_p, _q, _glowScale.setScalar(glowSize)))
      halos.setColorAt(count, glowColor)
      count += 1
    }
    instanced.count = count
    halos.count = count
    instanced.instanceMatrix.needsUpdate = true
    halos.instanceMatrix.needsUpdate = true
    if (halos.instanceColor) halos.instanceColor.needsUpdate = true

    updatePopups(state.camera, size.width, size.height)
  })

  return (
    <>
      <primitive ref={glowRef} object={glow} />
      <primitive ref={meshRef} object={mesh} />
    </>
  )
}

export default TrainingFX
