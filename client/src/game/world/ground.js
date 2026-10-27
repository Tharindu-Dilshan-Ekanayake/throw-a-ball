import {
  BufferAttribute,
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearMipmapLinearFilter,
  NearestFilter,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'

import {
  EGG_STANDS,
  FREE_REWARD,
  SHOP,
  LANE_COUNT,
  LANE_NEAR_X,
  LANE_TARGET_X,
  LANE_WIDTH,
  laneCenterZ,
  LEADERBOARDS,
  PLAZA,
  PORTAL,
  STAGE,
  THROW_LINE_Z,
  WATERFALL,
} from '@shared/world'

import { PALETTE } from '../sceneStyle'

/**
 * The plaza floor: one big plane whose colours come from a tiny "ground map" texture
 * painted at one texel per world unit. Paths, aprons and pads are rectangles painted
 * into it, so their edges always fall on the stud-tile seams, and the whole floor is a
 * single draw call regardless of how many painted regions it has.
 */

const MAP = { minX: -64, maxX: 64, minZ: -44, maxZ: 48 }
const MAP_W = MAP.maxX - MAP.minX
const MAP_H = MAP.maxZ - MAP.minZ

/** Where the ground plane ends to the north: the track's own floor takes over there. */
export const GROUND_NORTH_EDGE = THROW_LINE_Z

function painter(ctx) {
  const rect = (r, color) => {
    ctx.fillStyle = color
    ctx.fillRect(
      Math.round(r.minX - MAP.minX),
      Math.round(r.minZ - MAP.minZ),
      Math.round(r.maxX - r.minX),
      Math.round(r.maxZ - r.minZ),
    )
  }
  const bordered = (r, fill, edge) => {
    rect(r, edge)
    rect({ minX: r.minX + 1, maxX: r.maxX - 1, minZ: r.minZ + 1, maxZ: r.maxZ - 1 }, fill)
  }
  const disc = (x, z, radius, color) => {
    ctx.fillStyle = color
    for (let dz = -radius; dz < radius; dz += 1) {
      for (let dx = -radius; dx < radius; dx += 1) {
        if ((dx + 0.5) ** 2 + (dz + 0.5) ** 2 <= radius * radius) {
          ctx.fillRect(Math.floor(x + dx - MAP.minX), Math.floor(z + dz - MAP.minZ), 1, 1)
        }
      }
    }
  }
  return { rect, bordered, disc }
}

export function createGroundMap(maxTexture) {
  const canvas = document.createElement('canvas')
  canvas.width = MAP_W
  canvas.height = MAP_H
  const ctx = canvas.getContext('2d')
  const { rect, bordered, disc } = painter(ctx)

  rect(MAP, PALETTE.plaza)

  // Lane apron along the west side, behind the lane floors.
  const lanesMinZ = laneCenterZ(LANE_COUNT - 1) - LANE_WIDTH / 2 - 2
  const lanesMaxZ = laneCenterZ(0) + LANE_WIDTH / 2 + 2
  bordered({ minX: LANE_TARGET_X - 3, maxX: LANE_NEAR_X + 3, minZ: lanesMinZ, maxZ: lanesMaxZ }, PALETTE.apron, PALETTE.apronEdge)

  // Paths: a walkway along the lane entrances, spawn to the stage steps, spawn to the
  // lanes, the shop, the eggs, and a spur up to the portal.
  const eggsZ = EGG_STANDS[0].z
  const paths = [
    { minX: LANE_NEAR_X + 3, maxX: LANE_NEAR_X + 8, minZ: lanesMinZ, maxZ: lanesMaxZ },
    { minX: -5, maxX: 5, minZ: STAGE.maxZ, maxZ: 16 },
    { minX: LANE_NEAR_X + 3, maxX: -5, minZ: 11, maxZ: 17 },
    { minX: 5, maxX: SHOP.minX + 1, minZ: -12, maxZ: -6 },
    { minX: 5, maxX: 46, minZ: eggsZ - 8, maxZ: eggsZ - 4 },
    { minX: PORTAL.x - 3, maxX: PORTAL.x + 3, minZ: PORTAL.z + 3, maxZ: -12 },
  ]
  for (const p of paths) bordered(p, PALETTE.path, PALETTE.pathEdge)
  // Paths overlap; repaint the interiors so crossings don't show edges.
  for (const p of paths) {
    rect({ minX: p.minX + 1, maxX: p.maxX - 1, minZ: p.minZ + 1, maxZ: p.maxZ - 1 }, PALETTE.path)
  }
  bordered({ minX: -9, maxX: 9, minZ: 7, maxZ: 21 }, PALETTE.path, PALETTE.pathEdge)

  // Egg plaza and the shop yard.
  bordered({ minX: 6, maxX: PLAZA.maxX - 1, minZ: eggsZ - 4, maxZ: LEADERBOARDS[0].z - 1 }, PALETTE.apron, PALETTE.apronEdge)
  rect({ minX: SHOP.minX, maxX: SHOP.maxX, minZ: SHOP.minZ, maxZ: SHOP.maxZ }, PALETTE.shopFloor)

  disc(PORTAL.x, PORTAL.z, 6, PALETTE.apronEdge)
  disc(PORTAL.x, PORTAL.z, 5, PALETTE.apron)
  disc(FREE_REWARD.x, FREE_REWARD.z, 4, PALETTE.apronEdge)

  // Waterfall pool at the foot of the north cliff.
  rect({ minX: WATERFALL.x - 6, maxX: WATERFALL.x + 6, minZ: WATERFALL.z, maxZ: WATERFALL.z + 5 }, PALETTE.water)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.anisotropy = maxTexture > 512 ? 4 : 1
  return texture
}

/**
 * The ground plane, with UVs computed from world position so the map lands exactly
 * on the world grid. Outside the map, clamp-to-edge repeats the plaza colour.
 */
export function createGroundGeometry() {
  const minX = -280
  const maxX = 280
  const minZ = GROUND_NORTH_EDGE
  const maxZ = 280
  const geometry = new PlaneGeometry(maxX - minX, maxZ - minZ)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2)

  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const z = position.getZ(i)
    uv.setXY(i, (x - MAP.minX) / MAP_W, 1 - (z - MAP.minZ) / MAP_H)
  }
  uv.needsUpdate = true
  geometry.setAttribute('aStyle', new BufferAttribute(new Float32Array(position.count), 1))
  return geometry
}
