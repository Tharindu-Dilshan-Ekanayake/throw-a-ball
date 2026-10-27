import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'

import { remotePlayers } from '../../net/remotePlayers'
import { getQuality } from '../../store/quality'
import { BloxityAvatar } from '../PlayerAvatar'
import { FACE_FLAT, FACE_UPRIGHT, GRIP_FLAT, GRIP_UPRIGHT, heldFlatness } from '../playerPose'
import { runtime } from '../runtime'

/** How often the set of fully drawn players is reconsidered. */
const PICK_MS = 500
/** A sprint: full stride amplitude, as for your own character. */
const MAX_SPEED = 7.5 * 1.45

/**
 * One other player as their real Bloxity avatar, dressed as they are and posed by the
 * same playerPose as yours, from what the network says they're doing: walking pace,
 * jumping, and each throw. Their frisbee is drawn by RemotePlayers, which reads the
 * grip this component keeps on their palm (`r.grip`).
 */
function RemoteAvatar({ sessionId, look }) {
  const groupRef = useRef(null)
  const handRef = useRef(null)
  const gripRef = useRef(null)
  const lastY = useRef(null)
  const motionRef = useRef({ time: 0, speed: 0, grounded: true, maxSpeed: MAX_SPEED, vy: 0, stride: 0, throwT: 0, catchT: 0 })

  useEffect(() => {
    const r = remotePlayers.get(sessionId)
    if (r) r.grip = gripRef.current
    return () => {
      const gone = remotePlayers.get(sessionId)
      if (gone) gone.grip = null
    }
  }, [sessionId])

  useFrame((_state, rawDelta) => {
    const group = groupRef.current
    const r = remotePlayers.get(sessionId)
    if (!group || !r) return
    const delta = Math.min(rawDelta, 0.05)
    group.visible = runtime.camera.mode === 'follow'
    group.position.copy(r.position)
    group.rotation.y = r.yaw

    const m = motionRef.current
    m.time += delta
    m.speed = r.speed
    m.grounded = r.anim !== 'jump'
    // Vertical speed from the interpolated height, smoothed: rising vs falling.
    const y = r.position.y
    if (lastY.current !== null) m.vy += ((y - lastY.current) / Math.max(delta, 1e-3) - m.vy) * 0.3
    lastY.current = y
    m.stride += delta * (5 + 6 * Math.min(1, r.speed / MAX_SPEED))
    m.throwT = r.throwT
    m.catchT = r.catchT

    const grip = gripRef.current
    if (grip) {
      const flat = heldFlatness(r.throwT, r.catchT)
      grip.position.lerpVectors(GRIP_UPRIGHT, GRIP_FLAT, flat)
      grip.quaternion.slerpQuaternions(FACE_UPRIGHT, FACE_FLAT, flat)
    }
  })

  return (
    <group ref={groupRef}>
      <group ref={handRef}>
        <group ref={gripRef} scale={0.95} />
      </group>
      <BloxityAvatar equipped={look?.equipped} proportions={look?.proportions} motionRef={motionRef} handRef={handRef} targetHeight={1.8} />
    </group>
  )
}

/**
 * The other players nearest the camera, as their real avatars: as many as the quality
 * preset allows (`remoteAvatars`), within `remoteAvatarDistance`. Everyone else is the
 * cheap blocky figure RemotePlayers draws (`r.fullAvatar` tells it who's covered).
 * Chosen twice a second, never per frame, so React only re-renders when the set of
 * players (or an outfit) actually changes.
 */
export function RemoteAvatars() {
  const camera = useThree((s) => s.camera)
  const [shown, setShown] = useState([])

  useEffect(() => {
    const pick = () => {
      const settings = getQuality()
      const near = []
      for (const r of remotePlayers.values()) {
        r.fullAvatar = false
        const d = camera.position.distanceTo(r.position)
        if (d < settings.remoteAvatarDistance) near.push([d, r])
      }
      near.sort((a, b) => a[0] - b[0])
      const next = near
        .slice(0, settings.remoteAvatars)
        .map(([, r]) => r)
        .sort((a, b) => (a.sessionId < b.sessionId ? -1 : 1))
      for (const r of next) r.fullAvatar = true
      setShown((prev) => {
        const same = prev.length === next.length && prev.every((p, i) => p.sessionId === next[i].sessionId && p.lookKey === next[i].lookKey)
        return same ? prev : next.map((r) => ({ sessionId: r.sessionId, look: r.look, lookKey: r.lookKey }))
      })
    }
    pick()
    const id = setInterval(pick, PICK_MS)
    return () => clearInterval(id)
  }, [camera])

  return shown.map((s) => (
    <Suspense key={`${s.sessionId}:${s.lookKey}`} fallback={null}>
      <RemoteAvatar sessionId={s.sessionId} look={s.look} />
    </Suspense>
  ))
}

export default RemoteAvatars
