import { CylinderGeometry, TorusGeometry } from 'three'

import { STAGE, STAGE_STEP_DEPTH, STAGE_STEPS, THROW_AREA } from '@shared/world'

import { STYLE } from '../materials'

const WHITE = '#f4f7fb'
const BLUE = '#2f7fe6'
const NAVY = '#1f3c96'
const SKY = '#7fe2ff'
const GOLD = '#ffd21f'

const DISC = new CylinderGeometry(1, 1, 1, 32)

/**
 * The THROW! sign on the arch's beam, centred on it: its panel's size and the height of
 * its middle. Its face is 1.0 in front of the beam's centre line.
 */
export const ARCH_SIGN = { width: 9.6, height: 2.7, y: STAGE.height + 9.6, faceZ: STAGE.minZ + 1 + 0.95 }
const LAMP = new CylinderGeometry(1, 0.75, 1, 12)
const RIM = new TorusGeometry(1, 0.11, 8, 40)

/**
 * The throw stage: a raised white-and-blue platform at the north end of the lobby with
 * steps up its south side, the painted throw pad, light strips, spotlights, and a launch
 * arch over its front edge that the frisbees fly out through, crowned by a giant
 * frisbee. A railing along the front marks the end of the lobby.
 *
 * Boxes go into the world's block set and the round parts into its props, so the whole
 * stage still rides in those two draw calls. `detail` (off on LOW) adds the small
 * trimmings: bulbs and checker bands.
 *
 * No two faces here share a plane: every layer stands a clear step proud of what it
 * sits on (flush faces flicker, worst on phones' coarser depth buffers).
 */
export function buildStage(blocks, props, { detail = true } = {}) {
  const { minX, maxX, minZ, maxZ, height } = STAGE
  const width = maxX - minX
  const depth = maxZ - minZ
  const midZ = (minZ + maxZ) / 2

  // Body, with a blue band around its sides.
  blocks.addOn(0, -0.1, midZ, width, height + 0.1, depth, WHITE)
  blocks.addOn(0, 0.15, midZ, width + 0.3, height * 0.45, depth + 0.3, BLUE)
  // Glowing strips along the top edges.
  for (const side of [-1, 1]) {
    blocks.addOn(side * (width / 2 - 0.25), height, midZ, 0.35, 0.08, depth - 0.6, SKY, STYLE.GLOW)
  }
  // Racing checker band along each side, above the blue band.
  if (detail) {
    const tiles = Math.floor(depth / 0.9)
    for (const side of [-1, 1]) {
      for (let i = 0; i < tiles; i += 1) {
        const z = minZ + (depth - tiles * 0.9) / 2 + (i + 0.5) * 0.9
        blocks.addOn(side * (width / 2 + 0.04), 0.75, z, 0.08, 0.38, 0.86, i % 2 ? WHITE : NAVY, STYLE.SMOOTH)
      }
    }
  }

  // The throw pad: an orange border with the yellow fill raised on it.
  const padX = (THROW_AREA.minX + THROW_AREA.maxX) / 2
  const padZ = (THROW_AREA.minZ + THROW_AREA.maxZ) / 2
  const padW = THROW_AREA.maxX - THROW_AREA.minX
  const padD = THROW_AREA.maxZ - THROW_AREA.minZ
  blocks.addOn(padX, height, padZ, padW + 0.8, 0.06, padD + 0.8, '#ff9a1f')
  blocks.addOn(padX, height + 0.06, padZ, padW, 0.06, padD, '#ffd54a')
  // Glowing corner marks around the pad.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = padX + sx * (padW / 2 + 0.75)
      const z = padZ + sz * (padD / 2 + 0.75)
      blocks.addOn(x - sx * 0.35, height, z, 0.9, 0.1, 0.2, SKY, STYLE.GLOW)
      blocks.addOn(x, height, z - sz * 0.35, 0.2, 0.1, 0.9, SKY, STYLE.GLOW)
    }
  }

  // Steps up the south side, matching the walkable steps. Each block covers only its
  // own tread (from the next step's front to its own), so neighbouring steps never
  // overlap and their sides can't fight.
  for (let i = 0; i < STAGE_STEPS; i += 1) {
    const front = (STAGE_STEPS - i) * STAGE_STEP_DEPTH
    const back = (STAGE_STEPS - i - 1) * STAGE_STEP_DEPTH
    const stepHeight = (height * (i + 1)) / (STAGE_STEPS + 1)
    blocks.addOn(0, -0.1, maxZ + (front + back) / 2, width - 4, stepHeight + 0.1, front - back, i % 2 ? '#dbe8f6' : WHITE)
    // Glowing nosing on top of the tread, set back from its front edge.
    blocks.addOn(0, stepHeight, maxZ + front - 0.25, width - 4.4, 0.05, 0.3, SKY, STYLE.GLOW)
  }
  // Blue cheek walls either side of the steps, capped with a light strip.
  const stairs = STAGE_STEPS * STAGE_STEP_DEPTH
  for (const side of [-1, 1]) {
    const x = side * (width / 2 - 1.55)
    blocks.addOn(x, -0.1, maxZ + stairs / 2 - 0.1, 1.2, height + 0.1, stairs - 0.2, BLUE)
    blocks.addOn(x, height, maxZ + stairs / 2 - 0.1, 0.5, 0.08, stairs - 0.6, SKY, STYLE.GLOW)
  }

  // Front railing: posts and a glowing rail. The frisbee flies over it.
  const railZ = minZ + 0.25
  for (let x = minX + 0.5; x <= maxX - 0.4; x += 2) blocks.addOn(x, height, railZ, 0.25, 1, 0.25, WHITE)
  blocks.addOn(0, height + 0.9, railZ, width - 0.4, 0.22, 0.3, SKY, STYLE.GLOW)
  blocks.addOn(0, height + 0.4, railZ, width - 0.4, 0.12, 0.2, WHITE)

  // Launch arch over the front: striped pillars on the corners, a beam across the top
  // carrying the THROW! sign and a rainbow crest, and a glowing orb on each pillar.
  const archTop = height + 9
  const archZ = minZ + 1
  for (const side of [-1, 1]) {
    const x = side * (width / 2 - 1)
    blocks.addOn(x, height, archZ, 1.8, 0.6, 1.8, NAVY)
    blocks.addOn(x, height + 0.6, archZ, 1.4, archTop - height - 0.6, 1.4, BLUE, STYLE.STRIPES)
    blocks.addOn(x, archTop + 1.2, archZ, 1.9, 1.9, 1.9, GOLD, STYLE.GLOW)
    // Marquee bulbs up the front of each pillar.
    if (detail) {
      for (let y = height + 1.6; y < archTop - 0.6; y += 1.1) {
        blocks.add(x, y, archZ + 0.78, 0.3, 0.3, 0.16, Math.round(y) % 2 ? '#ffffff' : GOLD, STYLE.GLOW)
      }
    }
  }
  blocks.addOn(0, archTop - 0.2, archZ, width - 1, 1.4, 1.2, BLUE, STYLE.STRIPES)
  blocks.addOn(0, archTop - 0.45, archZ, width - 2.6, 0.25, 1.3, SKY, STYLE.GLOW)
  blocks.addOn(0, archTop + 1.2, archZ, width - 4, 0.3, 1, '#ffffff', STYLE.RAINBOW)
  // The THROW! sign hung on the beam's face: a navy panel in a blue frame, with the
  // lettering painted on it (see throwArea.js, ARCH_SIGN).
  blocks.addOn(0, ARCH_SIGN.y - ARCH_SIGN.height / 2 - 0.15, archZ + 0.75, ARCH_SIGN.width + 0.6, ARCH_SIGN.height + 0.3, 0.3, BLUE)
  blocks.addOn(0, ARCH_SIGN.y - ARCH_SIGN.height / 2, archZ + 0.8, ARCH_SIGN.width, ARCH_SIGN.height, 0.3, NAVY, STYLE.SMOOTH)
  // Marquee bulbs along the beam's face, either side of the sign.
  if (detail) {
    for (let x = -9; x <= 9.01; x += 1) {
      if (Math.abs(x) < ARCH_SIGN.width / 2 + 0.7) continue
      blocks.add(x, archTop + 0.85, archZ + 0.68, 0.3, 0.3, 0.16, Math.abs(x) % 2 ? GOLD : '#ffffff', STYLE.GLOW)
      blocks.add(x + 0.5, archTop + 0.05, archZ + 0.68, 0.3, 0.3, 0.16, Math.abs(x) % 2 ? '#ffffff' : GOLD, STYLE.GLOW)
    }
  }

  // The crown: a giant frisbee standing on the beam, leaning back to face the lobby.
  const discY = archTop + 4.6
  const lean = [Math.PI / 2 - 0.28, 0, 0]
  blocks.addOn(0, archTop + 1.5, archZ, 0.6, discY - archTop - 3.6, 0.6, NAVY)
  props.add(DISC, { position: [0, discY, archZ], rotation: lean, scale: [2.7, 0.5, 2.7], color: BLUE })
  props.add(DISC, { position: [0, discY, archZ], rotation: lean, scale: [1.75, 0.62, 1.75], color: '#ffffff' })
  props.add(DISC, { position: [0, discY, archZ], rotation: lean, scale: [0.75, 0.74, 0.75], color: GOLD, style: STYLE.GLOW })
  props.add(RIM, { position: [0, discY, archZ], rotation: [lean[0] - Math.PI / 2, 0, 0], scale: [2.75, 2.75, 2.6], color: GOLD, style: STYLE.GLOW })

  // Light poles on the back corners, each topped with a spotlight aimed at the arch.
  const poleTop = height + 6.5
  for (const side of [-1, 1]) {
    const x = side * (width / 2 - 0.6)
    const z = maxZ - 0.6
    blocks.addOn(x, height, z, 0.22, 6.5, 0.22, WHITE)
    blocks.addOn(x, poleTop, z, 0.5, 0.3, 0.5, NAVY)
    props.add(LAMP, { position: [x, poleTop + 0.65, z - 0.1], rotation: [-1.2, 0, 0], scale: [0.36, 0.8, 0.36], color: '#30363f' })
    props.add(DISC, { position: [x, poleTop + 0.83, z - 0.5], rotation: [-1.2, 0, 0], scale: [0.27, 0.06, 0.27], color: '#fff7c2', style: STYLE.GLOW })
  }
}
