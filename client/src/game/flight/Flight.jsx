import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Quaternion,
  TorusGeometry,
  Vector3,
} from 'three'

import { TROPHY_FIRST, TROPHY_SPACING, ZONES } from '@shared/balance'
import { formatNumber } from '@shared/format'
import { trophyValue, winsMultiplier, zoneIndexAt } from '@shared/logic'
import { mulberry32 } from '@shared/rng'
import { THROW_LINE_Z } from '@shared/world'

import { sfx } from '../../audio/sfx'
import { getGame } from '../../store/game'
import { getQuality, useQuality } from '../../store/quality'
import { iconUrl } from '../../ui/icons'
import { BlockSet, createToyInstances, disposeBlocks, PropBuilder } from '../blocks'
import { spawnPopup } from '../fx/popups'
import { createFrisbeeModel, frisbeeOrientation } from '../frisbee'
import { LabelBatch } from '../labels/LabelBatch'
import { sharedMaterials, STYLE } from '../materials'
import { RELEASE_DELAY } from '../playerPose'
import { runtime } from '../runtime'
import { FOG, SKY } from '../sceneStyle'
import { skyUniforms } from '../skyState'
import { flight } from './flightControl'
import { writeDistance } from './hudLink'
import { buildChunk, CHUNK, GATES, ZONE_THEMES, zAt } from './track'

/**
 * Above this speed (m/s) the flight goes to "warp": no new scenery is built, a plain
 * zone-coloured floor rushes past under the speed lines, and only the chunks around the
 * landing point are prepared. Streaming real chunks at thousands of m/s would cost
 * more CPU than a phone has, for scenery nobody could see.
 */
const WARP_ON = 220
const WARP_OFF = 160
/** Length of the warp floor, centred a little ahead of the plane. */
const WARP_LENGTH = 1400
/** Builder passes between prefetch builds while in warp (~1 chunk per 120 ms). */
const PREFETCH_EVERY = 4

/** Warp-floor colours and styles per zone, parsed once. */
const WARP_THEMES = ZONES.map((z) => {
  const t = ZONE_THEMES[z.id]
  return {
    ground: t.ground ? new Color(t.ground) : null,
    road: new Color(t.road),
    kerb: new Color(t.kerb),
    roadStyle: t.roadStyle,
    kerbStyle: t.kerbStyle ?? STYLE.STUDS,
    roadHalf: t.roadHalf,
    kerbHalf: t.kerbHalf,
  }
})

/** Chunks kept behind the focus point, and how many may be built per builder pass. */
const BEHIND = 60
const MAX_BUILDS_PER_FRAME = 2
/** How often the chunk builder runs (between frames, not inside them). */
const BUILD_INTERVAL_MS = 30
/** Chunks never thrown away: the stretch visible from the lobby. */
const PINNED_CHUNKS = 3
const CACHE_LIMIT = 14
const CRUISE_HEIGHT = 5.5
const MAX_TROPHIES = 16
const STREAKS = 36

const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3()
const _v = new Vector3()
const _look = new Vector3()
const _prevPlane = new Vector3()
/** Stable vector for runtime.flightFocus (the scratch ones are reused mid-frame). */
const planeFocus = new Vector3()
const _skyTop = new Color()
const _skyHorizon = new Color()

/** At most one trophy popup this often; the trophies in between are summed into it. */
const TROPHY_POPUP_MS = 180
const TROPHY_ICON = iconUrl('trophy')

/** Built chunks by index. Module-level: one track exists at a time. */
const chunkCache = new Map()
/** The chunk window the frame loop wants; the builder makes it so. */
const trackWindow = { first: 0, last: 0, density: 1, shadows: false, warp: false, prefetchFirst: 0, prefetchLast: -1 }

/** Speed-line streaks, made once. */
const streakState = (() => {
  const r = mulberry32(5)
  return Array.from({ length: STREAKS }, () => ({ a: r() * Math.PI * 2, r: 1.6 + r() * 3.2, z: -r() * 30 }))
})()

const ZONE_SKIES = ZONES.map((z) => ZONE_THEMES[z.id].sky.map((c) => new Color(c)))
const DEFAULT_TOP = new Color(SKY.top)
const DEFAULT_HORIZON = new Color(SKY.horizon)

const ease = (t) => 1 - Math.pow(1 - t, 2.4)
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function createTrophyGeometry() {
  const p = new PropBuilder()
  const gold = '#ffcc1f'
  p.add(new CylinderGeometry(0.42, 0.24, 0.62, 12), { position: [0, 0.55, 0], color: gold, style: STYLE.GLOW })
  p.add(new TorusGeometry(0.2, 0.06, 6, 10, Math.PI), { position: [-0.42, 0.62, 0], rotation: [0, 0, Math.PI / 2], color: gold })
  p.add(new TorusGeometry(0.2, 0.06, 6, 10, Math.PI), { position: [0.42, 0.62, 0], rotation: [0, 0, -Math.PI / 2], color: gold })
  p.add(new CylinderGeometry(0.08, 0.08, 0.3, 6), { position: [0, 0.12, 0], color: gold })
  p.box(0, -0.05, 0, 0.5, 0.14, 0.5, '#ffb01e', STYLE.SMOOTH)
  return p.build()
}

let warpZone = -1

/** Moves the warp floor under the plane and restyles it when the zone changes. */
function updateWarpFloor(floor, meter) {
  const zi = zoneIndexAt(meter)
  const theme = WARP_THEMES[zi]
  const centerZ = zAt(meter + WARP_LENGTH * 0.35)
  const parts = [
    // [width, height, top, colour, style]
    [theme.ground ? 340 : 0, 1, -0.06, theme.ground, STYLE.STUDS],
    [theme.roadHalf * 2, 0.25, 0.0, theme.road, theme.roadStyle],
    [theme.kerbHalf - theme.roadHalf, 0.3, 0.08, theme.kerb, theme.kerbStyle],
    [theme.kerbHalf - theme.roadHalf, 0.3, 0.08, theme.kerb, theme.kerbStyle],
  ]
  const kerbX = (theme.roadHalf + theme.kerbHalf) / 2
  parts.forEach(([w, h, top, color, style], i) => {
    const x = i === 2 ? -kerbX : i === 3 ? kerbX : 0
    _p.set(x, top - h / 2, centerZ)
    _s.set(Math.max(w, 0.0001), h, WARP_LENGTH)
    _q.identity()
    floor.setMatrixAt(i, _m.compose(_p, _q, _s))
    if (zi !== warpZone && color) floor.setColorAt(i, color)
    if (zi !== warpZone) floor.geometry.getAttribute('aStyle').array[i] = style
  })
  floor.instanceMatrix.needsUpdate = true
  if (zi !== warpZone) {
    warpZone = zi
    if (floor.instanceColor) floor.instanceColor.needsUpdate = true
    floor.geometry.getAttribute('aStyle').needsUpdate = true
  }
  // Instance bounds changed; keep the whole floor in view.
  floor.frustumCulled = false
}

/** Where the plane is at normalised time `t` (0-1) of the current flight. */
function planePosition(t, start, out) {
  const end = zAt(flight.distance)
  const s = ease(t)
  const z = start.z + (end - start.z) * s
  const travelled = start.z - z
  const rise = 1 - Math.exp(-travelled / 9)
  const landing = smoothstep(0.86, 1, t)
  const cruise = start.y + (CRUISE_HEIGHT - start.y) * rise + Math.sin(t * 9) * 0.3 * (1 - landing)
  const y = cruise + (0.35 - cruise) * landing
  const x = start.x * (1 - smoothstep(0, 0.25, t)) + Math.sin(travelled * 0.015) * 1.4 * (1 - landing)
  return out.set(x, y, z)
}

/**
 * Lazily loaded: the track, the flying frisbee and its chase camera. While nobody is
 * flying it still streams the first stretch of track, which is the street you see
 * leading out of the lobby.
 */
export default function Flight() {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const rootRef = useRef(null)
  const groupRef = useRef(null)
  const warpRef = useRef(null)
  const planeRef = useRef(null)
  const trophyRef = useRef(null)
  const streakRef = useRef(null)
  const starsRef = useRef(null)
  const flightStart = useRef(new Vector3())
  const startedFor = useRef(0)
  /** Trophies popped so far this flight: index of the next, Wins not yet shown. */
  const trophyTally = useRef({ next: 0, pending: 0, shownAt: 0 })
  const wasActive = useRef(false)
  const gatesRef = useRef(null)
  const speedLines = useQuality((s) => s.settings.speedLines)
  const particles = useQuality((s) => s.settings.particles)

  const assets = useMemo(() => {
    const trophies = createToyInstances(createTrophyGeometry(), sharedMaterials().toy, MAX_TROPHIES)

    const planeModel = createFrisbeeModel({ glowSize: 1.9 })
    planeModel.scale.setScalar(2)
    planeModel.visible = false

    const streakMaterial = new MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.55,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
    const streakMesh = new InstancedMesh(new BoxGeometry(0.035, 0.035, 1), streakMaterial, STREAKS)
    streakMesh.frustumCulled = false
    streakMesh.count = 0

    const rand = mulberry32(99)
    const starPositions = new Float32Array(500 * 3)
    for (let i = 0; i < 500; i += 1) {
      _v.set(rand() * 2 - 1, rand() * 1.2 - 0.2, rand() * 2 - 1).normalize().multiplyScalar(140)
      starPositions.set([_v.x, _v.y, _v.z], i * 3)
    }
    const starGeometry = new BufferGeometry()
    starGeometry.setAttribute('position', new BufferAttribute(starPositions, 3))
    const stars = new Points(starGeometry, new PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }))
    stars.frustumCulled = false
    stars.visible = false

    // Warp floor: ground, road and two kerbs, sitting a hair below real chunks so any
    // built chunk shows through on top of it.
    const warpSet = new BlockSet()
    for (let i = 0; i < 4; i += 1) warpSet.add(0, -0.5, 0, 1, 1, 1, '#ffffff', STYLE.STUDS)
    const warpFloor = warpSet.build(sharedMaterials().blocks)
    warpFloor.visible = false
    warpFloor.matrixAutoUpdate = false

    return { trophies, planeModel, streakMesh, streakMaterial, stars, warpFloor }
  }, [])

  // This module loads after the lobby is on screen; compile its shaders in the
  // background before showing it, so the first throw doesn't stall on them.
  useEffect(() => {
    const root = rootRef.current
    // Skipped in dev, where StrictMode's remount disposes materials mid-compile (see
    // ShaderWarmup).
    if (!root || import.meta.env.DEV) return undefined
    let cancelled = false
    root.visible = false
    gl.compileAsync(root, camera, scene)
      .catch(() => null)
      .finally(() => {
        if (!cancelled) root.visible = true
      })
    return () => {
      cancelled = true
    }
  }, [gl, camera, scene])

  // Zone names over the gate arches: their own small label batch.
  useEffect(() => {
    const batch = new LabelBatch({ pageSize: Math.min(512, getQuality().maxTexture) })
    for (const g of GATES) {
      batch.add(`gate-${g.zone.id}`, [0, 16.4, zAt(g.meter)], { lines: [{ text: g.zone.name, size: 64, fill: '#ffffff' }], pxPerUnit: 26 }, { fade: 400 })
    }
    let cancelled = false
    batch.build().then((meshes) => {
      if (cancelled || !gatesRef.current) return
      for (const mesh of meshes) gatesRef.current.add(mesh)
    })
    return () => {
      cancelled = true
      batch.dispose()
    }
  }, [])

  // Streams track chunks in and out between frames: at most two builds per pass.
  useEffect(() => {
    const group = groupRef.current
    let pass = 0
    const build = (i, density) => {
      const mesh = buildChunk(i, { density }).build(sharedMaterials().blocks)
      mesh.receiveShadow = trackWindow.shadows
      chunkCache.set(i, mesh)
      group.add(mesh)
    }
    const id = setInterval(() => {
      if (!group) return
      const want = trackWindow
      pass += 1
      if (want.warp) {
        // Only get the landing site ready, one chunk at a time.
        if (pass % PREFETCH_EVERY === 0) {
          for (let i = want.prefetchFirst; i <= want.prefetchLast; i += 1) {
            if (chunkCache.has(i)) continue
            build(i, want.density)
            break
          }
        }
      } else {
        let built = 0
        for (let i = want.first; i <= want.last && built < MAX_BUILDS_PER_FRAME; i += 1) {
          if (chunkCache.has(i)) continue
          build(i, want.density)
          built += 1
        }
      }
      if (chunkCache.size <= CACHE_LIMIT) return
      for (const [i, mesh] of chunkCache) {
        const wanted = (i >= want.first && i <= want.last) || (i >= want.prefetchFirst && i <= want.prefetchLast)
        if (!wanted && i >= PINNED_CHUNKS) {
          group.remove(mesh)
          disposeBlocks(mesh)
          chunkCache.delete(i)
        }
      }
    }, BUILD_INTERVAL_MS)
    return () => {
      clearInterval(id)
      for (const mesh of chunkCache.values()) disposeBlocks(mesh)
      chunkCache.clear()
      assets.trophies.geometry.dispose()
      assets.trophies.dispose()
      assets.planeModel.dispose()
      assets.streakMesh.geometry.dispose()
      assets.streakMaterial.dispose()
      assets.streakMesh.dispose()
      assets.stars.geometry.dispose()
      assets.stars.material.dispose()
      disposeBlocks(assets.warpFloor)
      skyUniforms.topColor.value.copy(DEFAULT_TOP)
      skyUniforms.horizonColor.value.copy(DEFAULT_HORIZON)
    }
  }, [assets])

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const group = groupRef.current
    if (!group) return
    const settings = getQuality()
    const now = performance.now()

    // --- Plane --------------------------------------------------------------------
    let focus = Math.max(0, THROW_LINE_Z - runtime.player.position.z)
    let speed = 0
    const plane = planeRef.current
    if (flight.active) {
      if (startedFor.current !== flight.startedAt) {
        startedFor.current = flight.startedAt
        flightStart.current.copy(runtime.player.frisbeeAt)
        trophyTally.current = { next: 0, pending: 0, shownAt: 0 }
        _prevPlane.copy(flightStart.current)
      }
      // Rides in the hand through the wind-up and leaves it at the release.
      const elapsed = (now - flight.startedAt) / 1000
      if (elapsed < RELEASE_DELAY) flightStart.current.copy(runtime.player.frisbeeAt)
      const t = Math.min(1, Math.max(0, elapsed - RELEASE_DELAY) / flight.duration)
      planePosition(t, flightStart.current, _p)
      flight.meter = Math.max(0, Math.min(flight.distance, THROW_LINE_Z - _p.z))
      focus = flight.meter
      speed = _prevPlane.distanceTo(_p) / Math.max(delta, 1e-3)
      // Climbing or dropping tips the disc a little; it banks gently side to side.
      const climb = Math.max(-0.4, Math.min(0.4, (_p.y - _prevPlane.y) * 6))
      _prevPlane.copy(_p)
      if (plane) {
        // The one in the hand is shown until the release.
        plane.visible = elapsed >= RELEASE_DELAY
        // The rush of air while it flies, swelling with its speed, gone as it lands.
        if (elapsed >= RELEASE_DELAY && t < 1) {
          sfx.windStart()
          sfx.windSet(speed / 90)
        } else if (t >= 1) {
          sfx.windStop()
        }
        plane.position.copy(_p)
        frisbeeOrientation(plane.quaternion, now * 0.022, 0.12 + climb, Math.sin(now * 0.0025) * 0.22 * (1 - t))
        plane.setFrisbee(getGame().profile.equippedPlane)
        plane.setGlowSize(1.9 * settings.frisbeeGlow)
      }
      runtime.flightFocus = planeFocus.copy(_p)
      writeDistance(flight.meter)

      // Chase camera: behind and above, looking down the track. Locked to the plane
      // along the track (at warp speed any lag leaves it hundreds of metres behind);
      // eased sideways and vertically so the bobbing stays smooth.
      if (runtime.camera.mode === 'flight') {
        const k = 1 - Math.exp(-6 * delta)
        camera.position.set(
          camera.position.x + (_p.x * 0.6 - camera.position.x) * k,
          camera.position.y + (_p.y + 2.3 - camera.position.y) * k,
          _p.z + 7.5,
        )
        _look.set(_p.x * 0.8, _p.y + 0.3, _p.z - 12)
        camera.lookAt(_look)
      }
    } else if (plane) {
      plane.visible = false
    }
    if (wasActive.current && !flight.active) {
      sfx.windStop()
      skyUniforms.topColor.value.copy(DEFAULT_TOP)
      skyUniforms.horizonColor.value.copy(DEFAULT_HORIZON)
      if (scene.fog) scene.fog.color.set(FOG.color)
    }
    wasActive.current = flight.active

    // --- Track chunks -------------------------------------------------------------
    // Only decide what should exist; the builder below does the allocating, outside
    // the frame loop.
    const ahead = settings.viewDistance
    const want = trackWindow
    want.first = Math.max(0, Math.floor((focus - BEHIND) / CHUNK))
    want.last = Math.floor((focus + ahead) / CHUNK)
    // Fewer props when screaming past at hundreds of metres a second.
    want.density = settings.decorDensity * (speed > 300 ? 0.35 : speed > 120 ? 0.65 : 1)
    want.shadows = settings.shadows === 'realtime'
    for (const [i, mesh] of chunkCache) mesh.visible = i >= want.first && i <= want.last

    if (!flight.active) want.warp = false
    else if (!want.warp && speed > WARP_ON) want.warp = true
    else if (want.warp && speed < WARP_OFF) want.warp = false
    if (flight.active) {
      // The landing site, built ahead of time while warping towards it.
      want.prefetchFirst = Math.max(0, Math.floor((flight.distance - 150) / CHUNK))
      want.prefetchLast = Math.floor((flight.distance + Math.min(ahead, 240)) / CHUNK)
    } else {
      want.prefetchLast = -1
    }
    const floor = warpRef.current
    if (floor) {
      floor.visible = want.warp
      if (want.warp) updateWarpFloor(floor, focus)
    }

    // --- Trophies -----------------------------------------------------------------
    if (flight.active) {
      // Tally the ones just flown through. The Wins were granted with the throw; this
      // is the visual receipt. At speed the plane passes dozens a second, so they're
      // summed into one popup at most every TROPHY_POPUP_MS.
      const tally = trophyTally.current
      if (tally.next < 0) tally.next = 0
      const trophies = flight.trophies
      while (tally.next < trophies.length && trophies[tally.next] <= flight.meter) {
        tally.pending += trophyValue(trophies[tally.next])
        tally.next += 1
      }
      if (tally.pending > 0 && now - tally.shownAt >= TROPHY_POPUP_MS) {
        const multiplier = winsMultiplier(getGame().profile, Date.now())
        spawnPopup(`+${formatNumber(Math.round(tally.pending * multiplier))}`, { x: _prevPlane.x, y: _prevPlane.y + 1, z: _prevPlane.z - 2 }, { iconUrl: TROPHY_ICON, scale: 1.2 })
        sfx.trophy()
        tally.pending = 0
        tally.shownAt = now
      }
    }
    const trophies = trophyRef.current
    if (trophies) {
      const spin = now * 0.003
      let count = 0
      const k0 = Math.max(0, Math.ceil((focus - 10 - TROPHY_FIRST) / TROPHY_SPACING))
      for (let m = TROPHY_FIRST + k0 * TROPHY_SPACING; m < focus + ahead * 0.8 && count < MAX_TROPHIES; m += TROPHY_SPACING) {
        if (flight.active && m <= flight.meter) continue
        const height = flight.active ? CRUISE_HEIGHT : 1.8
        _p.set(Math.sin(m * 0.5) * 2.5, height + Math.sin(spin + m) * 0.25, zAt(m))
        _q.setFromAxisAngle(_v.set(0, 1, 0), spin + m)
        _s.setScalar(1.5)
        trophies.setMatrixAt(count, _m.compose(_p, _q, _s))
        count += 1
      }
      trophies.count = count
      trophies.instanceMatrix.needsUpdate = true
    }

    // --- Sky tint by zone ---------------------------------------------------------
    if (flight.active) {
      const zi = zoneIndexAt(flight.meter)
      const blend = smoothstep(ZONES[zi].start, ZONES[zi].start + 80, flight.meter)
      const prev = ZONE_SKIES[Math.max(0, zi - 1)]
      const cur = ZONE_SKIES[zi]
      _skyTop.copy(prev[0]).lerp(cur[0], zi === 0 ? 1 : blend)
      _skyHorizon.copy(prev[1]).lerp(cur[1], zi === 0 ? 1 : blend)
      skyUniforms.topColor.value.copy(_skyTop)
      skyUniforms.horizonColor.value.copy(_skyHorizon)
      if (scene.fog) scene.fog.color.copy(_skyHorizon)

      const stars = starsRef.current
      if (stars && particles) {
        const spaceBlend = zi === ZONES.length - 1 ? blend : 0
        stars.visible = spaceBlend > 0.01
        stars.material.opacity = spaceBlend
        stars.position.copy(camera.position)
      }
    } else if (starsRef.current) {
      starsRef.current.visible = false
    }

    // --- Speed lines --------------------------------------------------------------
    const lines = streakRef.current
    if (lines) {
      const active = flight.active && speedLines && speed > 25
      if (!active) {
        lines.count = 0
      } else {
        const travel = Math.min(speed, 400) * delta * 0.6
        lines.count = STREAKS
        for (let i = 0; i < STREAKS; i += 1) {
          const st = streakState[i]
          st.z += travel
          if (st.z > 4) st.z -= 34
          _v.set(Math.cos(st.a) * st.r, Math.sin(st.a) * st.r * 0.7, st.z - 4)
          _v.applyQuaternion(camera.quaternion).add(camera.position)
          _q.copy(camera.quaternion)
          _s.set(1, 1, 2 + Math.min(speed, 400) * 0.02)
          lines.setMatrixAt(i, _m.compose(_v, _q, _s))
        }
        lines.instanceMatrix.needsUpdate = true
      }
    }
  })

  return (
    <group ref={rootRef}>
      <group ref={groupRef} />
      <group ref={gatesRef} />
      <primitive ref={planeRef} object={assets.planeModel} />
      <primitive ref={warpRef} object={assets.warpFloor} />
      <primitive ref={trophyRef} object={assets.trophies} />
      <primitive ref={streakRef} object={assets.streakMesh} />
      <primitive ref={starsRef} object={assets.stars} />
    </group>
  )
}
