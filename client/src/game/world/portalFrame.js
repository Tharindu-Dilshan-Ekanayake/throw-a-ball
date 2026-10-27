import { PORTAL } from '@shared/world'

import { STYLE } from '../materials'

/** Height of the portal ring's centre. */
export const PORTAL_CENTER_Y = PORTAL.radius + 0.6

const STONES = ['#2a1740', '#3d2166']

/**
 * The World 2 portal's frame: a haunted ring of dark purple stones standing upright and
 * facing the plaza, with a jack-o'-lantern glowing at every fifth stone, on a stepped
 * black base trimmed in orange. (The Halloween trimmings round it are in halloween.js.)
 */
export function buildPortalFrame(blocks) {
  const segments = 20
  const r = PORTAL.radius
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2
    const x = PORTAL.x + Math.cos(a) * r
    const y = PORTAL_CENTER_Y + Math.sin(a) * r
    const lit = i % 5 === 2
    // Neighbouring stones overlap, so every one gets its own depth and size: no two
    // front faces lie in the same plane (they would flicker against each other).
    const depth = lit ? 1.58 : 1.3 + (i % 3) * 0.07
    const size = 1.16 + (i % 4) * 0.045
    blocks.add(x, y, PORTAL.z, size, size, depth, lit ? '#ff8a1e' : STONES[i % 2], lit ? STYLE.GLOW : STYLE.STUDS, 0, 0, a)
  }
  // Stepped base: black slab, purple slab, and a glowing orange line round its front.
  blocks.addOn(PORTAL.x, 0, PORTAL.z, r * 2 + 3, 0.5, 2.8, '#1a0f26')
  blocks.addOn(PORTAL.x, 0.5, PORTAL.z, r * 2 + 1.5, 0.3, 2.4, '#3d2166')
  blocks.addOn(PORTAL.x, 0.5, PORTAL.z + 1.25, r * 2 + 1.2, 0.1, 0.12, '#ff8a1e', STYLE.GLOW)
}
