import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Matrix4, Quaternion, Vector3 } from 'three'

import { formatNumber } from '@shared/format'

import { sfx } from '../../audio/sfx'
import { getGame } from '../../store/game'
import { getQuality } from '../../store/quality'
import { iconUrl } from '../../ui/icons'
import { createFrisbeeMesh, disposeFrisbeeMesh, frisbeeGlow, frisbeeOrientation } from '../frisbee'
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

const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _prev = new Vector3()
const _s = new Vector3(0.75, 0.75, 0.75)
const _popupAt = new Vector3()
const _glowScale = new Vector3()

const LEVEL_GRADIENT = 'linear-gradient(180deg, #e0faff 0%, #7fe2ff 45%, #2fa8ff 100%)'

/**
 * Training feedback: the character's throw, the frisbee flying into the target, and the
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
    })),
  )

  const mesh = useMemo(() => createFrisbeeMesh(MAX_SHOTS), [])

  const glow = useMemo(() => createGlowInstances(MAX_SHOTS), [])

  useEffect(
    () => () => {
      disposeFrisbeeMesh(mesh)
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
      shot.lane = event.lane
      shot.t = 0
      shot.gain = event.gain
      shot.leveledUp = event.leveledUp
    })

    const frisbeeId = getGame().profile.equippedPlane
    const glowColor = frisbeeGlow(frisbeeId)
    const glowSize = 1.3 * getQuality().frisbeeGlow
    const spin = state.clock.elapsedTime * 25
    let count = 0
    for (const shot of shots.current) {
      if (!shot.active) continue
      shot.t += delta
      const flight = (shot.t - RELEASE_DELAY) / FLIGHT_TIME
      if (flight < 0) continue
      // Leaves from wherever the hand has swung the frisbee to at the release.
      if (!shot.released) {
        shot.released = true
        shot.from.copy(player.frisbeeAt)
        sfx.swish()
      }
      if (flight >= 1) {
        shot.active = false
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
        continue
      }
      const arc = Math.sin(flight * Math.PI) * ARC_HEIGHT
      _prev.lerpVectors(shot.from, shot.to, Math.max(0, flight - 0.05))
      _prev.y += Math.sin(Math.max(0, flight - 0.05) * Math.PI) * ARC_HEIGHT
      _p.lerpVectors(shot.from, shot.to, flight)
      _p.y += arc
      // Flat and spinning, tipped a little towards the target.
      frisbeeOrientation(_q, spin + count, 0.25, 0)
      instanced.setMatrixAt(count, _m.compose(_p, _q, _s))
      instanced.setStyle(count, frisbeeId)
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
