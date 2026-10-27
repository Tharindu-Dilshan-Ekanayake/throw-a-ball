import { PORTAL } from '@shared/world'

import { STYLE } from '../materials'
import { PORTAL_CENTER_Y } from './portalFrame'

/**
 * The Halloween dressing round the World 2 portal: jack-o'-lanterns, tombstones, dead
 * trees, a bubbling cauldron, an iron fence and a few bats overhead. Plain boxes in the
 * world's shared block set, so all of it rides in the existing draw call.
 *
 * Everything faces the plaza (+Z). `detail` (off on LOW) adds the small trimmings.
 */

const ORANGE = '#ff7a1a'
const ORANGE_LIGHT = '#ff9a3c'
const CANDLE = '#ffe45c'
const STONE = '#8e8aa0'
const WOOD = '#3a2a2e'
const IRON = '#1d1626'

/** A carved jack-o'-lantern: lobed body, green stem and a glowing face on its +Z side. */
function pumpkin(b, x, z, s = 1, face = true) {
  b.addOn(x, 0, z, 1.7 * s, 1.4 * s, 1.7 * s, ORANGE)
  for (const side of [-1, 1]) b.addOn(x + side * 0.72 * s, 0.04 * s, z, 0.9 * s, 1.3 * s, 1.5 * s, ORANGE_LIGHT)
  b.addOn(x, 1.4 * s, z, 0.3 * s, 0.5 * s, 0.3 * s, '#3f7a2a', STYLE.SMOOTH)
  if (!face) return
  const front = z + 0.88 * s
  for (const side of [-1, 1]) {
    b.addOn(x + side * 0.4 * s, 0.85 * s, front, 0.3 * s, 0.34 * s, 0.1, CANDLE, STYLE.GLOW)
  }
  b.addOn(x, 0.62 * s, front, 0.16 * s, 0.16 * s, 0.1, CANDLE, STYLE.GLOW)
  b.addOn(x, 0.22 * s, front, 1.0 * s, 0.2 * s, 0.1, CANDLE, STYLE.GLOW)
  for (const side of [-1, 1]) b.addOn(x + side * 0.42 * s, 0.38 * s, front, 0.2 * s, 0.2 * s, 0.1, CANDLE, STYLE.GLOW)
}

function tombstone(b, x, z, s = 1, rotY = 0) {
  b.addOn(x, 0, z, 1.5 * s, 1.8 * s, 0.45 * s, STONE, STYLE.STUDS, rotY)
  b.addOn(x, 1.8 * s, z, 1.1 * s, 0.4 * s, 0.45 * s, STONE, STYLE.STUDS, rotY)
  // A little moss at the foot, and a glowing cross cut into the face.
  b.addOn(x, 0, z + 0.05, 1.7 * s, 0.35 * s, 0.6 * s, '#4f7a3a', STYLE.STUDS, rotY)
  if (rotY === 0) {
    b.addOn(x, 0.8 * s, z + 0.24 * s, 0.14 * s, 0.9 * s, 0.06, '#3b3a48', STYLE.SMOOTH)
    b.addOn(x, 1.35 * s, z + 0.24 * s, 0.55 * s, 0.14 * s, 0.06, '#3b3a48', STYLE.SMOOTH)
  }
}

/** A bare, twisted tree: dark trunk and a few branches reaching out. */
function deadTree(b, x, z, s = 1) {
  b.addOn(x, 0, z, 0.8 * s, 5.4 * s, 0.8 * s, WOOD)
  b.add(x + 0.9 * s, 3.4 * s, z, 2.4 * s, 0.36 * s, 0.36 * s, WOOD, STYLE.STUDS, 0, 0, 0.55)
  b.add(x - 0.9 * s, 4.4 * s, z, 2.2 * s, 0.32 * s, 0.32 * s, WOOD, STYLE.STUDS, 0, 0, -0.65)
  b.add(x + 1.7 * s, 4.5 * s, z, 1.2 * s, 0.24 * s, 0.24 * s, WOOD, STYLE.STUDS, 0, 0, 0.9)
  b.add(x - 1.8 * s, 5.5 * s, z, 1.1 * s, 0.22 * s, 0.22 * s, WOOD, STYLE.STUDS, 0, 0, -1.0)
  b.addOn(x, 5.2 * s, z, 0.5 * s, 1.4 * s, 0.5 * s, WOOD)
}

function cauldron(b, x, z) {
  b.addOn(x, 0, z, 2.2, 1.5, 2.2, '#26232b', STYLE.SMOOTH)
  b.addOn(x, 1.5, z, 1.8, 0.14, 1.8, '#7dff3a', STYLE.GLOW)
  for (const side of [-1, 1]) {
    b.addOn(x + side * 1.05, 1.5, z, 0.3, 0.4, 2.2, '#3a3640', STYLE.SMOOTH)
    b.addOn(x, 1.5, z + side * 1.05, 1.8, 0.4, 0.3, '#3a3640', STYLE.SMOOTH)
    b.addOn(x + side * 0.9, 0, z + 1.0, 0.3, 0.5, 0.3, '#26232b', STYLE.SMOOTH)
  }
  // The green glow of its fire, round its foot.
  b.addOn(x, 0, z, 2.5, 0.12, 2.5, '#7dff3a', STYLE.GLOW)
}

/** A hanging bat: a small body and two angled wings. */
function bat(b, x, y, z, flap = 0.35) {
  b.add(x, y, z, 0.5, 0.42, 0.55, '#241338', STYLE.SMOOTH)
  for (const side of [-1, 1]) {
    b.add(x + side * 0.7, y + 0.1, z, 1.0, 0.08, 0.55, '#241338', STYLE.SMOOTH, 0, 0, side * flap)
    b.add(x + side * 1.4, y + 0.3, z, 0.6, 0.08, 0.4, '#241338', STYLE.SMOOTH, 0, 0, side * (flap + 0.4))
  }
  for (const side of [-1, 1]) b.add(x + side * 0.12, y + 0.05, z + 0.28, 0.1, 0.1, 0.06, '#ff3b3b', STYLE.GLOW)
}

/** A lantern post: iron pole and a glowing flame cage. */
function lantern(b, x, z) {
  b.addOn(x, 0, z, 0.3, 3.6, 0.3, IRON, STYLE.SMOOTH)
  b.addOn(x, 3.6, z, 0.9, 0.9, 0.9, ORANGE_LIGHT, STYLE.GLOW)
  b.addOn(x, 4.5, z, 1.2, 0.25, 1.2, IRON, STYLE.SMOOTH)
}

export function buildHalloweenDecor(blocks, { detail = true } = {}) {
  const { x: px, z: pz, radius } = PORTAL

  // Jack-o'-lanterns flanking the portal's base, and a big one either side of the path.
  pumpkin(blocks, px - radius - 2.4, pz + 1.6, 1.15)
  pumpkin(blocks, px + radius + 2.4, pz + 1.6, 1.15)
  pumpkin(blocks, px - 5.4, pz + 7.5, 0.8)
  pumpkin(blocks, px + 5.4, pz + 7.5, 0.8)
  pumpkin(blocks, px - 7.8, pz + 3.6, 0.7)
  pumpkin(blocks, px + 7.6, pz + 4.4, 0.95)

  // Spiked crown over the top half of the ring.
  const spikes = 9
  for (let i = 0; i < spikes; i += 1) {
    const a = Math.PI * (0.12 + (0.76 * i) / (spikes - 1))
    const r = radius + 1.25
    const x = px + Math.cos(a) * r
    const y = PORTAL_CENTER_Y + Math.sin(a) * r
    blocks.add(x, y, pz, 0.5 + (i % 2) * 0.06, 1.7, 0.62 + (i % 3) * 0.05, '#2a1740', STYLE.STUDS, 0, 0, a - Math.PI / 2)
    blocks.add(x + Math.cos(a) * 0.95, y + Math.sin(a) * 0.95, pz, 0.28, 0.5, 0.3 + (i % 2) * 0.06, ORANGE_LIGHT, STYLE.GLOW, 0, 0, a - Math.PI / 2)
  }

  // Graveyard corners, and dead trees framing the whole scene.
  tombstone(blocks, px - 9.5, pz + 4.2, 1.1, 0.1)
  tombstone(blocks, px - 11.2, pz + 6.2, 0.9, -0.2)
  tombstone(blocks, px + 10.2, pz + 6.6, 1, 0.15)
  deadTree(blocks, px - 11.5, pz - 1.5, 1.1)
  deadTree(blocks, px + 12, pz - 2, 1.25)
  cauldron(blocks, px + 8.2, pz + 2.6)
  lantern(blocks, px - radius - 1.2, pz + 3.4)
  lantern(blocks, px + radius + 1.2, pz + 3.4)

  if (!detail) return

  // Iron fence behind the tombstones, and bats wheeling overhead.
  for (const side of [-1, 1]) {
    const x0 = px + side * 7
    const len = 8
    blocks.addOn(x0 + side * (len / 2), 0.9, pz + 0.2, len, 0.2, 0.2, IRON, STYLE.SMOOTH)
    for (let i = 0; i <= len; i += 1.2) {
      const x = x0 + side * i
      blocks.addOn(x, 0, pz + 0.2, 0.2, 1.6, 0.2, IRON, STYLE.SMOOTH)
      blocks.addOn(x, 1.6, pz + 0.2, 0.12, 0.35, 0.12, IRON, STYLE.SMOOTH)
    }
  }
  bat(blocks, px - 3.2, PORTAL_CENTER_Y + radius + 3.4, pz + 0.8)
  bat(blocks, px + 2.4, PORTAL_CENTER_Y + radius + 4.6, pz + 1.6, 0.5)
  bat(blocks, px + 6.5, PORTAL_CENTER_Y + radius + 2.2, pz + 3, 0.25)
  bat(blocks, px - 7.5, PORTAL_CENTER_Y + radius + 1.4, pz + 2.4, 0.45)
}
