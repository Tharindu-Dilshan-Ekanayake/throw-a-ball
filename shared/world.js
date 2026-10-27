/**
 * Lobby layout: every gameplay-relevant position and trigger area.
 *
 * Shared by the client (which renders it) and the server (which validates positions
 * against it), so the two can never disagree about where a lane or the throw area is.
 *
 * Units are roughly metres - the avatar is 1.8 tall. +X is east, -Z is north, which is
 * "forward" from spawn and the direction planes are thrown.
 *
 * Seen from spawn: the throw stage straight ahead (north), the training lanes along the
 * left (west) side, the plane hangar on the right (east), eggs and leaderboards behind.
 *
 * Rects are `{ minX, maxX, minZ, maxZ }` on the ground plane.
 */

export const SPAWN = { x: 0, z: 14 }

/** The flat, walkable plaza. Hills surround it on every side but the throw track. */
export const PLAZA = { minX: -50, maxX: 50, minZ: -40, maxZ: 36 }

// --- Throw stage --------------------------------------------------------------------

/**
 * The raised stage players throw from. Its north edge is the end of the lobby: a
 * railing stops players there, and the track starts on the other side.
 */
export const STAGE = { minX: -11, maxX: 11, minZ: -40, maxZ: -26, height: 1.2 }
/** Steps up to the stage along its south edge. */
export const STAGE_STEPS = 3
export const STAGE_STEP_DEPTH = 1.2

/** Track metre `m` is at world z = THROW_LINE_Z - m. */
export const THROW_LINE_Z = STAGE.minZ
export const TRACK_HALF_WIDTH = 9

/** Painted "THROW AREA" on the stage: standing in it shows the THROW button. */
export const THROW_AREA = { minX: -7, maxX: 7, minZ: -37, maxZ: -29 }

/** Walkable ground; the controller clamps the player into it. Nothing past the stage. */
export const WALKABLE = [PLAZA]

// --- Training lanes -----------------------------------------------------------------

/**
 * Lanes line the west side of the plaza, side by side. Each runs east-west: you walk in
 * from the plaza (east end) and throw at the target board at the west end.
 */
export const LANE_COUNT = 9
export const LANE_WIDTH = 5.6
export const LANE_PITCH = 7
/** Entrance edge (east) and target edge (west) of every lane floor. */
export const LANE_NEAR_X = -24
export const LANE_FAR_X = -42
/** Where the target board stands, just past the far edge. */
export const LANE_TARGET_X = -44.4
export const LANE_FLOOR_HEIGHT = 0.15
/** Lane 0 (the free one) is the southernmost, nearest spawn; the rest run north. */
const LANE0_Z = 26

export const laneCenterZ = (index) => LANE0_Z - index * LANE_PITCH

export function laneRect(index) {
  const cz = laneCenterZ(index)
  return {
    minX: LANE_FAR_X,
    maxX: LANE_NEAR_X,
    minZ: cz - LANE_WIDTH / 2,
    maxZ: cz + LANE_WIDTH / 2,
  }
}

// --- Frisbee shop -------------------------------------------------------------------

/**
 * The frisbee shop: an open-air yard east of the plaza with two display stages, the
 * first ten frisbees on the low front one and the next ten on the higher back one,
 * and a big FRISBEES board behind. Both stages are low enough to walk straight onto.
 */
export const SHOP = { minX: 22, maxX: 48, minZ: -26, maxZ: 12 }
export const SHOP_STAGES = [
  { minX: 23.5, maxX: 34, minZ: -25, maxZ: 11, height: 0.5 },
  { minX: 36.5, maxX: 47, minZ: -25, maxZ: 11, height: 1 },
]
/** The board along the back (east) edge, facing the plaza, high enough that its lettering clears the price labels. */
export const SHOP_BOARD = { x: 48.6, minZ: -23, maxZ: 9, top: 16 }
export const PAD_SIZE = 4.4

/** Rows of display stands, nearest the plaza first: two rows on each stage. */
const PAD_ROWS_X = [26, 31.5, 39, 44.5]

/**
 * Twenty stands, five to a row 7 m apart. `row` (0-3, front to back) lets the labels
 * above them step up so nearer ones don't hide farther ones.
 */
export const PLANE_PADS = Array.from({ length: 20 }, (_, i) => {
  const row = Math.floor(i / 5)
  return {
    index: i,
    row,
    x: PAD_ROWS_X[row],
    z: (SHOP.minZ + SHOP.maxZ) / 2 - 14 + (i % 5) * 7,
    y: SHOP_STAGES[row < 2 ? 0 : 1].height,
  }
})

export const padRect = (pad) => ({
  minX: pad.x - PAD_SIZE / 2,
  maxX: pad.x + PAD_SIZE / 2,
  minZ: pad.z - PAD_SIZE / 2,
  maxZ: pad.z + PAD_SIZE / 2,
})

// --- Eggs, showcases, boards --------------------------------------------------------

export const EGG_STANDS = [
  { eggId: 'basic', x: 12, z: 22 },
  { eggId: 'meadow', x: 20, z: 22 },
  { eggId: 'sunset', x: 28, z: 22 },
  { eggId: 'unicorn', x: 36, z: 22 },
  { eggId: 'demon', x: -12, z: -14, big: true },
]
export const EGG_TRIGGER_RADIUS = 4.2

/** Limited premium pet on display. */
export const SPHINX_STAND = { x: 45, z: 21 }

export const LEADERBOARDS = [
  { id: 'rebirths', x: 12, z: 33.5 },
  { id: 'playtime', x: 24, z: 33.5 },
  { id: 'power', x: 36, z: 33.5 },
]

export const PORTAL = { x: 24, z: -34, radius: 3.4 }
export const FREE_REWARD = { x: 12, z: 10, radius: 3 }
export const WATERFALL = { x: 38, z: -40 }

// --- Collision ----------------------------------------------------------------------

const box = (x, z, halfX, halfZ) => ({
  minX: x - halfX,
  maxX: x + halfX,
  minZ: z - halfZ,
  maxZ: z + halfZ,
})

/** Solid, never-changing obstacles. Locked lanes add their own walls at runtime. */
export const STATIC_COLLIDERS = [
  // The shop's board.
  { minX: SHOP_BOARD.x - 0.5, maxX: SHOP_BOARD.x + 0.5, minZ: SHOP_BOARD.minZ - 0.5, maxZ: SHOP_BOARD.maxZ + 0.5 },
  // Egg pedestals.
  ...EGG_STANDS.map((s) => box(s.x, s.z, s.big ? 2.1 : 1.6, s.big ? 2.1 : 1.6)),
  box(SPHINX_STAND.x, SPHINX_STAND.z, 3, 3),
  ...LEADERBOARDS.map((b) => box(b.x, b.z, 4.6, 0.5)),
  box(FREE_REWARD.x, FREE_REWARD.z, 1.4, 1.4),
  // The portal ring's base; the swirl itself is walk-through.
  box(PORTAL.x - PORTAL.radius, PORTAL.z, 0.6, 0.8),
  box(PORTAL.x + PORTAL.radius, PORTAL.z, 0.6, 0.8),
  // Stage pillars at its front corners, and the railing along its north edge.
  box(STAGE.minX + 1, STAGE.minZ + 1, 0.9, 0.9),
  box(STAGE.maxX - 1, STAGE.minZ + 1, 0.9, 0.9),
  { minX: STAGE.minX, maxX: STAGE.maxX, minZ: STAGE.minZ - 1, maxZ: STAGE.minZ + 0.4 },
  // Target pedestals at the far end of each lane.
  ...Array.from({ length: LANE_COUNT }, (_, i) => box(LANE_TARGET_X, laneCenterZ(i), 0.9, 1.6)),
]

/** Raised floors the player stands on, as rects with a height. */
export const PLATFORMS = [
  ...SHOP_STAGES.map((s) => ({ ...s })),
  { ...STAGE },
  // Steps up the stage's south side, lowest first.
  ...Array.from({ length: STAGE_STEPS }, (_, i) => ({
    minX: STAGE.minX + 2,
    maxX: STAGE.maxX - 2,
    minZ: STAGE.maxZ,
    maxZ: STAGE.maxZ + (STAGE_STEPS - i) * STAGE_STEP_DEPTH,
    height: (STAGE.height * (i + 1)) / (STAGE_STEPS + 1),
  })),
  ...Array.from({ length: LANE_COUNT }, (_, i) => ({ ...laneRect(i), height: LANE_FLOOR_HEIGHT })),
]

// --- Helpers ------------------------------------------------------------------------

export const inRect = (r, x, z, margin = 0) =>
  x >= r.minX - margin && x <= r.maxX + margin && z >= r.minZ - margin && z <= r.maxZ + margin

/** Index of the lane whose floor contains (x, z), or -1. */
export function laneAt(x, z, margin = 0) {
  for (let i = 0; i < LANE_COUNT; i += 1) {
    if (inRect(laneRect(i), x, z, margin)) return i
  }
  return -1
}

export const inThrowArea = (x, z, margin = 0) => inRect(THROW_AREA, x, z, margin)

/** Index of the plane pad under (x, z), or -1. */
export function padAt(x, z) {
  for (const pad of PLANE_PADS) {
    if (inRect(padRect(pad), x, z)) return pad.index
  }
  return -1
}

/** The egg stand within reach of (x, z), or null. */
export function eggStandNear(x, z) {
  for (const stand of EGG_STANDS) {
    const reach = EGG_TRIGGER_RADIUS + (stand.big ? 1 : 0)
    if (Math.hypot(stand.x - x, stand.z - z) <= reach) return stand
  }
  return null
}

/** Height of the floor at (x, z): raised platforms, else the ground at 0. */
export function groundHeightAt(x, z) {
  let h = 0
  for (const p of PLATFORMS) {
    if (p.height > h && inRect(p, x, z)) h = p.height
  }
  return h
}

/** Clamps (x, z) into the walkable union, returning the nearest walkable point. */
export function clampToWalkable(x, z, out = { x: 0, z: 0 }) {
  let best = Infinity
  for (const r of WALKABLE) {
    const cx = Math.min(r.maxX, Math.max(r.minX, x))
    const cz = Math.min(r.maxZ, Math.max(r.minZ, z))
    const d = (cx - x) ** 2 + (cz - z) ** 2
    if (d < best) {
      best = d
      out.x = cx
      out.z = cz
      if (d === 0) break
    }
  }
  return out
}

/** Fastest a player can legitimately move, for the server's anti-teleport check. */
export const MAX_MOVE_SPEED = 14
