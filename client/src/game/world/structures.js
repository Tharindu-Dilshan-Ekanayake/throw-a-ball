import {
  LANE_COUNT,
  LANE_FAR_X,
  LANE_FLOOR_HEIGHT,
  LANE_NEAR_X,
  LANE_TARGET_X,
  LANE_WIDTH,
  laneCenterZ,
  SHOP_BOARD,
  SHOP_STAGES,
} from '@shared/world'

import { STYLE } from '../materials'

/**
 * Static lobby structures, added as plain boxes to the world's shared BlockSet so they
 * render in the same single draw call as the hills.
 */

/** Per-lane look, in lane order (matches LANES in shared/balance.js). */
export const LANE_THEMES = [
  { floor: '#5d626e', edge: '#f4f6f9', style: STYLE.PLATE, text: '#ffffff' },
  { floor: '#1d9a2b', edge: '#82f540', style: STYLE.PLATE, text: '#8dff4f' },
  { floor: '#1f57e0', edge: '#46cbff', style: STYLE.PLATE, text: '#5fd6ff' },
  { floor: '#6b31d8', edge: '#b17cff', style: STYLE.PLATE, text: '#c69bff' },
  { floor: '#e5bf18', edge: '#fff16c', style: STYLE.PLATE, text: '#ffe45c' },
  { floor: '#ff7a1c', edge: '#ffa646', style: STYLE.LAVA, text: '#ff9a3c' },
  { floor: '#ff2b2b', edge: '#ff5c5c', style: STYLE.LAVA, text: '#ff5a5a' },
  { floor: '#ffffff', edge: '#ffffff', style: STYLE.RAINBOW, text: '#ffffff' },
  { floor: '#1b2266', edge: '#8a63ff', style: STYLE.GALAXY, text: '#a98bff' },
]

const EDGE = 0.6

/** Lane floors with raised rims, and the target pedestals at their west ends. */
export function buildLanes(blocks) {
  const length = LANE_NEAR_X - LANE_FAR_X
  const midX = (LANE_NEAR_X + LANE_FAR_X) / 2

  for (let i = 0; i < LANE_COUNT; i += 1) {
    const theme = LANE_THEMES[i]
    const cz = laneCenterZ(i)
    const h = LANE_FLOOR_HEIGHT

    blocks.addOn(midX, -0.1, cz, length - EDGE * 2, h + 0.1, LANE_WIDTH - EDGE * 2, theme.floor, theme.style)

    // Raised rim on all four sides.
    const rimH = h + 0.15
    const rimStyle = theme.style === STYLE.RAINBOW ? STYLE.RAINBOW : STYLE.STUDS
    blocks.addOn(midX, -0.1, cz - LANE_WIDTH / 2 + EDGE / 2, length, rimH, EDGE, theme.edge, rimStyle)
    blocks.addOn(midX, -0.1, cz + LANE_WIDTH / 2 - EDGE / 2, length, rimH, EDGE, theme.edge, rimStyle)
    blocks.addOn(LANE_NEAR_X - EDGE / 2, -0.1, cz, EDGE, rimH, LANE_WIDTH - EDGE * 2, theme.edge, rimStyle)
    blocks.addOn(LANE_FAR_X + EDGE / 2, -0.1, cz, EDGE, rimH, LANE_WIDTH - EDGE * 2, theme.edge, rimStyle)

    // Target pedestal; the board itself is a prop.
    blocks.addOn(LANE_TARGET_X, 0, cz, 1.8, 0.8, 3.2, theme.edge, rimStyle)
    blocks.addOn(LANE_TARGET_X, 0.8, cz, 1.2, 0.4, 2.4, theme.floor, theme.style === STYLE.PLATE ? STYLE.STUDS : theme.style)
  }
}

const WHITE = '#f4f7fb'
const BLUE = '#2f7fe6'
const NAVY = '#1f3c96'
const SKY = '#7fe2ff'
const GOLD = '#ffd21f'

/**
 * The frisbee shop: two open display stages (the stands on them are PlaneShop's) and
 * the big board behind, built like the throw stage - white decks on a blue band with
 * light strips round the edges. `detail` (off on LOW) adds the board's bulbs.
 *
 * No two faces here share a plane: every layer stands a clear step proud of what it
 * sits on.
 */
export function buildShop(blocks, { detail = true } = {}) {
  for (const s of SHOP_STAGES) {
    const w = s.maxX - s.minX
    const d = s.maxZ - s.minZ
    const cx = (s.minX + s.maxX) / 2
    const cz = (s.minZ + s.maxZ) / 2
    blocks.addOn(cx, -0.1, cz, w, s.height + 0.1, d, WHITE)
    blocks.addOn(cx, 0, cz, w + 0.3, s.height * 0.5, d + 0.3, BLUE)
    // Light strips along all four top edges, and a gold post at each corner.
    for (const side of [-1, 1]) {
      blocks.addOn(cx + side * (w / 2 - 0.25), s.height, cz, 0.35, 0.08, d - 1.4, SKY, STYLE.GLOW)
      blocks.addOn(cx, s.height, cz + side * (d / 2 - 0.25), w - 1.4, 0.08, 0.35, SKY, STYLE.GLOW)
      for (const end of [-1, 1]) {
        blocks.addOn(cx + side * (w / 2 - 0.35), s.height, cz + end * (d / 2 - 0.35), 0.6, 0.7, 0.6, GOLD, STYLE.GLOW)
      }
    }
  }

  // The board: two striped legs, a navy panel in a blue frame, a gold cap.
  const { x, minZ, maxZ, top } = SHOP_BOARD
  const length = maxZ - minZ
  const midZ = (minZ + maxZ) / 2
  const bottom = top - 8.2
  for (const z of [minZ + 1.5, maxZ - 1.5]) blocks.addOn(x + 0.1, 0, z, 0.9, bottom + 0.3, 0.9, BLUE, STYLE.STRIPES)
  blocks.addOn(x, bottom, midZ, 0.6, top - bottom, length, BLUE)
  blocks.addOn(x - 0.1, bottom + 0.5, midZ, 0.6, top - bottom - 1, length - 1, NAVY, STYLE.SMOOTH)
  blocks.addOn(x, top, midZ, 0.9, 0.4, length + 0.4, GOLD, STYLE.GLOW)
  if (detail) {
    for (let z = minZ + 1; z <= maxZ - 0.99; z += 1.5) {
      blocks.add(x - 0.42, bottom + 0.25, z, 0.16, 0.3, 0.3, Math.round(z) % 2 ? '#ffffff' : GOLD, STYLE.GLOW)
      blocks.add(x - 0.42, top - 0.25, z + 0.75, 0.16, 0.3, 0.3, Math.round(z) % 2 ? GOLD : '#ffffff', STYLE.GLOW)
    }
  }
}
