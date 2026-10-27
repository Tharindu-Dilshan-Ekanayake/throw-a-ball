import { Color } from 'three'

import { PropBuilder } from '../blocks'
import { STYLE } from '../materials'

/**
 * Voxel pets in the reference's style: a chunky cube body with big glossy eyes on the
 * front, plus a few blocks of species detail (ears, horns, wings, tails).
 *
 * Every model sits on y = 0, faces +Z and is about one unit across. Each species is
 * merged into one vertex-coloured geometry, built on first use and shared by every
 * copy of that pet in the game.
 */

const EYE_WHITE = '#ffffff'
const PUPIL = '#16161c'

/** Two big eyes with highlights on the front face, at height `y`. */
function eyes(p, { y = 0.6, spread = 0.22, size = 0.3, color = PUPIL, z = 0.5 } = {}) {
  for (const x of [-spread, spread]) {
    p.box(x, y, z + 0.01, size, size * 1.12, 0.04, EYE_WHITE, STYLE.SMOOTH)
    p.box(x, y - size * 0.06, z + 0.03, size * 0.68, size * 0.82, 0.04, color, STYLE.SMOOTH)
    p.box(x - size * 0.16, y + size * 0.16, z + 0.05, size * 0.24, size * 0.24, 0.03, EYE_WHITE, STYLE.SMOOTH)
    p.box(x + size * 0.14, y - size * 0.18, z + 0.05, size * 0.1, size * 0.1, 0.03, EYE_WHITE, STYLE.SMOOTH)
  }
}

/** The cube body, feet and an optional lighter belly/face patch. */
const WHITE = new Color('#ffffff')
/** `color` a little way towards white, for highlights. */
const lighter = (color, amount = 0.28) => new Color(color).lerp(WHITE, amount)

function body(p, color, { size = 1, belly = null, feet = null, style = STYLE.STUDS, arms = true } = {}) {
  p.box(0, 0.08 + size / 2, 0, size, size, size, color, style)
  // A soft highlight on the crown, and stubby arms, so the cube reads as a cuddly body.
  p.box(0, 0.08 + size + 0.012, 0, size * 0.78, 0.03, size * 0.78, lighter(color), STYLE.SMOOTH)
  if (arms) {
    for (const side of [-1, 1]) p.box(side * (size / 2 + 0.055), 0.08 + size * 0.34, size * 0.12, 0.13, size * 0.3, 0.22, color)
  }
  if (belly) p.box(0, 0.08 + size * 0.36, size / 2 + 0.005, size * 0.56, size * 0.4, 0.03, belly, STYLE.SMOOTH)
  const foot = feet || color
  for (const x of [-0.3, 0.3]) for (const z of [-0.3, 0.3]) p.box(x * size, 0.06, z * size, 0.22, 0.14, 0.22, foot, STYLE.SMOOTH)
}

const ear = (p, x, y, color, w = 0.2, h = 0.28) => p.box(x, y, 0, w, h, 0.18, color)
const horn = (p, x, y, color, tilt = 0.25) => p.box(x, y, 0, 0.12, 0.34, 0.12, color, STYLE.SMOOTH, [0, 0, x > 0 ? -tilt : tilt])
const nose = (p, color, y = 0.42, w = 0.12) => p.box(0, y, 0.52, w, 0.08, 0.04, color, STYLE.SMOOTH)

function wings(p, color, { span = 0.55, y = 0.7, glow = false } = {}) {
  for (const side of [-1, 1]) {
    p.box(side * (0.5 + span / 2), y, -0.05, span, 0.34, 0.08, color, glow ? STYLE.GLOW : STYLE.STUDS, [0, 0, side * 0.35])
    p.box(side * (0.5 + span * 0.85), y + 0.18, -0.05, span * 0.5, 0.22, 0.08, color, glow ? STYLE.GLOW : STYLE.STUDS, [0, 0, side * 0.6])
  }
}

const tail = (p, color, { y = 0.45, len = 0.4, tip = null } = {}) => {
  p.box(0, y, -0.5 - len / 2, 0.14, 0.14, len, color)
  if (tip) p.box(0, y, -0.5 - len, 0.2, 0.2, 0.16, tip)
}

/** Pink cheeks under the eyes. */
function blush(p, color = '#ff9fb2') {
  for (const x of [-0.37, 0.37]) p.box(x, 0.37, 0.52, 0.12, 0.07, 0.02, color, STYLE.SMOOTH)
}

/** A little smile under the nose. */
function smile(p, color = '#3a2a2a') {
  p.box(0, 0.285, 0.535, 0.1, 0.035, 0.03, color, STYLE.SMOOTH)
  for (const x of [-0.075, 0.075]) p.box(x, 0.31, 0.535, 0.05, 0.035, 0.03, color, STYLE.SMOOTH)
}

/** Species that get the shared blush and smile (the rest have beaks, muzzles or their own faces). */
const NO_BLUSH = new Set(['ghost', 'skeleton', 'mummy', 'crab', 'sphinx', 'hellhound', 'demon', 'imp', 'pumpkin'])
const NO_SMILE = new Set([
  ...NO_BLUSH,
  'cow',
  'bear',
  'parrot',
  'owl',
  'flamingo',
  'phoenix',
  'bat',
  'turtle',
  'witchcat',
])

const MODELS = {
  cat: (p) => {
    body(p, '#ff9a3c', { belly: '#fff1dc' })
    for (const x of [-0.32, 0.32]) {
      ear(p, x, 1.18, '#ff9a3c')
      p.box(x, 1.16, 0.09, 0.1, 0.14, 0.02, '#ffc2c9', STYLE.SMOOTH)
    }
    for (const x of [-0.18, 0, 0.18]) p.box(x, 1.085, 0.2, 0.08, 0.02, 0.36, '#d16a12', STYLE.SMOOTH)
    eyes(p)
    nose(p, '#ff6f8f')
    tail(p, '#ff9a3c', { y: 0.6, len: 0.36, tip: '#d16a12' })
  },
  dog: (p) => {
    body(p, '#d9a066', { belly: '#f5e3c8' })
    for (const side of [-1, 1]) p.box(side * 0.56, 0.85, 0, 0.14, 0.42, 0.3, '#8a5a32')
    eyes(p)
    nose(p, '#1d1d24', 0.43, 0.16)
    tail(p, '#d9a066', { y: 0.7, len: 0.3 })
  },
  bunny: (p) => {
    body(p, '#f6f6fb', { belly: '#ffffff' })
    for (const x of [-0.22, 0.22]) {
      p.box(x, 1.36, 0, 0.18, 0.58, 0.14, '#f6f6fb')
      p.box(x, 1.36, 0.075, 0.09, 0.42, 0.02, '#ffb3c9', STYLE.SMOOTH)
    }
    eyes(p, { color: '#d6336c' })
    nose(p, '#ff7aa8')
    p.box(0, 0.5, -0.56, 0.24, 0.24, 0.14, '#ffffff')
  },
  bear: (p) => {
    body(p, '#8a5a3a', { belly: '#d8b48a' })
    for (const x of [-0.36, 0.36]) {
      p.box(x, 1.14, 0, 0.26, 0.22, 0.16, '#8a5a3a')
      p.box(x, 1.14, 0.085, 0.13, 0.1, 0.02, '#d8b48a', STYLE.SMOOTH)
    }
    eyes(p)
    p.box(0, 0.4, 0.52, 0.3, 0.2, 0.06, '#d8b48a', STYLE.SMOOTH)
    nose(p, '#2a1a10', 0.45, 0.12)
  },
  cow: (p) => {
    body(p, '#f8f8f8', { feet: '#3a3a3a' })
    p.box(0.51, 0.75, -0.1, 0.03, 0.36, 0.4, '#24242a', STYLE.SMOOTH)
    p.box(-0.51, 0.45, 0.15, 0.03, 0.3, 0.3, '#24242a', STYLE.SMOOTH)
    p.box(0.15, 1.085, -0.2, 0.36, 0.02, 0.3, '#24242a', STYLE.SMOOTH)
    for (const x of [-0.3, 0.3]) horn(p, x, 1.2, '#fff4d6', 0.1)
    for (const x of [-0.56, 0.56]) p.box(x, 0.98, 0, 0.18, 0.12, 0.16, '#f8f8f8')
    eyes(p, { y: 0.66 })
    p.box(0, 0.36, 0.53, 0.5, 0.24, 0.08, '#ffb3c0', STYLE.SMOOTH)
  },
  parrot: (p) => {
    body(p, '#ff3b3b', { belly: '#ffd23a' })
    for (const side of [-1, 1]) p.box(side * 0.52, 0.6, -0.05, 0.06, 0.5, 0.6, side > 0 ? '#2f8cff' : '#2fbf4a')
    p.box(0, 1.22, -0.1, 0.12, 0.3, 0.3, '#ffd23a')
    eyes(p, { y: 0.66, spread: 0.24 })
    p.box(0, 0.42, 0.56, 0.2, 0.18, 0.14, '#ffcf1f', STYLE.SMOOTH)
    tail(p, '#2f8cff', { y: 0.3, len: 0.36 })
  },
  fox: (p) => {
    body(p, '#ff7a1e', { belly: '#ffffff', feet: '#3a2210' })
    for (const x of [-0.32, 0.32]) {
      ear(p, x, 1.2, '#ff7a1e', 0.22, 0.32)
      p.box(x, 1.28, 0.02, 0.12, 0.12, 0.16, '#3a2210', STYLE.SMOOTH)
    }
    eyes(p)
    nose(p, '#1d1d24')
    tail(p, '#ff7a1e', { y: 0.55, len: 0.5, tip: '#ffffff' })
  },
  tiger: (p) => {
    body(p, '#ff8a1e', { belly: '#ffffff' })
    for (const y of [0.35, 0.65, 0.95]) for (const side of [-1, 1]) p.box(side * 0.505, y, 0, 0.02, 0.08, 0.6, '#1d1d24', STYLE.SMOOTH)
    for (const x of [-0.2, 0.2]) p.box(x, 1.085, 0.05, 0.08, 0.02, 0.5, '#1d1d24', STYLE.SMOOTH)
    for (const x of [-0.33, 0.33]) ear(p, x, 1.16, '#ff8a1e', 0.22, 0.2)
    eyes(p)
    nose(p, '#ff6f8f')
    tail(p, '#ff8a1e', { y: 0.65, len: 0.4, tip: '#1d1d24' })
  },
  flamingo: (p) => {
    body(p, '#ff8ac8', { belly: '#ffc2e2', feet: '#ff5fa8' })
    p.box(0, 1.25, 0.2, 0.22, 0.4, 0.22, '#ff8ac8')
    p.box(0, 1.35, 0.42, 0.14, 0.12, 0.26, '#1d1d24', STYLE.SMOOTH)
    p.box(0, 1.35, 0.32, 0.15, 0.13, 0.12, '#ffffff', STYLE.SMOOTH)
    eyes(p, { y: 0.66 })
    wings(p, '#ff6fb8', { span: 0.3, y: 0.6 })
  },
  turtle: (p) => {
    body(p, '#6fd46f', { belly: '#d8f5b0' })
    p.box(0, 1.12, -0.04, 0.9, 0.22, 0.86, '#8a5a32')
    p.box(0, 1.26, -0.04, 0.6, 0.12, 0.56, '#a8743f')
    for (const x of [-0.24, 0.24]) p.box(x, 1.12, 0.39, 0.16, 0.16, 0.06, '#5a3a20', STYLE.SMOOTH)
    eyes(p, { y: 0.58 })
  },
  owl: (p) => {
    body(p, '#9b6b3a', { belly: '#e8d0a8' })
    for (const x of [-0.34, 0.34]) p.box(x, 1.16, 0, 0.18, 0.26, 0.14, '#7a4f28', STYLE.STUDS, [0, 0, x > 0 ? -0.3 : 0.3])
    for (const x of [-0.22, 0.22]) p.box(x, 0.66, 0.505, 0.4, 0.42, 0.02, '#f5e6c8', STYLE.SMOOTH)
    eyes(p, { y: 0.66, size: 0.32, color: '#ff8a00' })
    p.box(0, 0.46, 0.55, 0.12, 0.14, 0.1, '#ffb01e', STYLE.SMOOTH)
    wings(p, '#7a4f28', { span: 0.22, y: 0.55 })
  },
  phoenix: (p) => {
    body(p, '#ff5a1e', { belly: '#ffd23a', style: STYLE.GLOW })
    for (const [x, h] of [[-0.2, 0.3], [0, 0.42], [0.2, 0.3]]) p.box(x, 1.1 + h / 2, -0.05, 0.14, h, 0.14, '#ffd23a', STYLE.GLOW)
    eyes(p, { y: 0.66 })
    p.box(0, 0.45, 0.55, 0.16, 0.14, 0.12, '#ffcf1f', STYLE.SMOOTH)
    wings(p, '#ff8a1e', { span: 0.6, glow: true })
    tail(p, '#ffd23a', { y: 0.5, len: 0.5, tip: '#ff3b1e' })
  },
  pony: (p) => {
    body(p, '#c9a8ff', { belly: '#eadcff' })
    p.box(0, 1.14, -0.15, 0.2, 0.2, 0.7, '#ff7ad9')
    for (const x of [-0.3, 0.3]) ear(p, x, 1.16, '#c9a8ff', 0.16, 0.22)
    eyes(p, { color: '#6a2fd8' })
    tail(p, '#ff7ad9', { y: 0.6, len: 0.4 })
  },
  unicorn: (p) => {
    body(p, '#ffffff', { belly: '#fff6fb' })
    const mane = ['#ff5c8a', '#ffb347', '#ffe45c', '#5cf0a0', '#5cc8ff', '#b07cff']
    mane.forEach((c, i) => p.box(0, 1.12 + (i % 2) * 0.04, 0.3 - i * 0.12, 0.2, 0.18, 0.12, c, STYLE.GLOW))
    p.box(0, 1.32, 0.3, 0.12, 0.42, 0.12, '#ffd23a', STYLE.GLOW, [0.35, 0, 0])
    for (const x of [-0.32, 0.32]) ear(p, x, 1.14, '#ffffff', 0.15, 0.2)
    eyes(p, { color: '#8a3be0' })
    tail(p, '#b07cff', { y: 0.6, len: 0.4, tip: '#5cc8ff' })
  },
  pegasus: (p) => {
    body(p, '#eaf6ff', { belly: '#ffffff' })
    p.box(0, 1.14, -0.15, 0.2, 0.2, 0.7, '#5cb8ff')
    for (const x of [-0.3, 0.3]) ear(p, x, 1.16, '#eaf6ff', 0.15, 0.2)
    eyes(p, { color: '#1f6fd8' })
    wings(p, '#ffffff', { span: 0.65, glow: true })
    tail(p, '#5cb8ff', { y: 0.6, len: 0.4 })
  },
  imp: (p) => {
    body(p, '#e83a3a', { belly: '#ff8a7a', feet: '#5a0a10' })
    for (const x of [-0.3, 0.3]) horn(p, x, 1.22, '#1d1d24')
    eyes(p, { color: '#ffd23a' })
    p.box(0, 0.36, 0.52, 0.3, 0.06, 0.04, '#5a0a10', STYLE.SMOOTH)
    tail(p, '#e83a3a', { y: 0.4, len: 0.45, tip: '#1d1d24' })
  },
  bat: (p) => {
    body(p, '#4a2a6a', { belly: '#7a5a9a' })
    for (const x of [-0.3, 0.3]) ear(p, x, 1.22, '#4a2a6a', 0.2, 0.36)
    eyes(p, { color: '#ff3b6b' })
    for (const x of [-0.1, 0.1]) p.box(x, 0.36, 0.53, 0.06, 0.1, 0.03, '#ffffff', STYLE.SMOOTH)
    wings(p, '#2a1840', { span: 0.7, y: 0.75 })
  },
  demon: (p) => {
    body(p, '#ff3b1e', { style: STYLE.LAVA, feet: '#1d0a0a' })
    for (const x of [-0.32, 0.32]) horn(p, x, 1.26, '#2a1a1a', 0.35)
    eyes(p, { color: '#ff3b1e' })
    wings(p, '#a8162a', { span: 0.6 })
    tail(p, '#1d0a0a', { y: 0.4, len: 0.5, tip: '#ff3b1e' })
  },
  hellhound: (p) => {
    body(p, '#24242c', { belly: '#3a3a46', feet: '#ff5a1e' })
    for (const x of [-0.32, 0.32]) ear(p, x, 1.2, '#24242c', 0.22, 0.32)
    p.box(0, 1.1, 0, 1.04, 0.1, 1.04, '#ff6a14', STYLE.GLOW)
    eyes(p, { color: '#ff3b1e' })
    nose(p, '#ff6a14')
    tail(p, '#24242c', { y: 0.6, len: 0.4, tip: '#ff6a14' })
  },
  dragon: (p) => {
    body(p, '#3fcf5a', { belly: '#ffe45c' })
    for (const x of [-0.28, 0.28]) horn(p, x, 1.24, '#ffffff', 0.15)
    p.box(0, 1.12, -0.25, 0.14, 0.14, 0.4, '#2a9a3e')
    eyes(p)
    for (const x of [-0.12, 0.12]) p.box(x, 0.38, 0.52, 0.06, 0.06, 0.03, '#1d1d24', STYLE.SMOOTH)
    wings(p, '#2a9a3e', { span: 0.55 })
    tail(p, '#3fcf5a', { y: 0.35, len: 0.5, tip: '#2a9a3e' })
  },
  crab: (p) => {
    body(p, '#ff4a3a', { size: 0.85, belly: '#ffb0a0' })
    for (const x of [-0.24, 0.24]) {
      p.box(x, 1.05, 0.2, 0.08, 0.3, 0.08, '#ff4a3a')
      p.box(x, 1.24, 0.2, 0.26, 0.26, 0.26, '#ffffff', STYLE.SMOOTH)
      p.box(x, 1.24, 0.34, 0.14, 0.16, 0.02, PUPIL, STYLE.SMOOTH)
    }
    for (const side of [-1, 1]) {
      p.box(side * 0.6, 0.5, 0.2, 0.3, 0.3, 0.3, '#ff4a3a')
      p.box(side * 0.68, 0.72, 0.28, 0.24, 0.16, 0.2, '#ff6a5a')
    }
  },
  sphinx: (p) => {
    body(p, '#ffcf3a', { belly: '#fff0b0' })
    // Striped headdress falling either side of the face.
    for (let i = 0; i < 5; i += 1) {
      const color = i % 2 ? '#ffcf3a' : '#2f6fe0'
      for (const side of [-1, 1]) p.box(side * 0.56, 1.0 - i * 0.16, 0.1, 0.12, 0.16, 0.5, color)
      p.box(0, 1.14, 0.4 - i * 0.2, 1.14, 0.12, 0.2, color)
    }
    p.box(0, 1.3, 0.38, 0.2, 0.24, 0.12, '#2f6fe0', STYLE.GLOW)
    eyes(p, { color: '#1f6fd8', size: 0.32 })
    nose(p, '#c98a1e')
  },
  // --- Halloween (the Spooky Egg) ---------------------------------------------------
  pumpkin: (p) => {
    body(p, '#ff8a1e', { feet: '#d96a0a' })
    // Ribs down the front, a curly stem and a leaf.
    for (const x of [-0.27, 0, 0.27]) p.box(x, 0.58, 0.505, 0.05, 0.92, 0.02, '#d96a0a', STYLE.SMOOTH)
    p.box(0, 1.2, 0, 0.2, 0.3, 0.2, '#3f7a2a', STYLE.SMOOTH)
    p.box(0.16, 1.38, 0, 0.18, 0.08, 0.1, '#3f7a2a', STYLE.SMOOTH, [0, 0, 0.5])
    p.box(-0.2, 1.24, 0, 0.26, 0.05, 0.14, '#5ccf3a', STYLE.SMOOTH, [0, 0, -0.35])
    // A carved, candle-lit face.
    for (const x of [-0.22, 0.22]) p.box(x, 0.68, 0.51, 0.18, 0.22, 0.04, '#ffe45c', STYLE.GLOW)
    p.box(0, 0.5, 0.51, 0.1, 0.1, 0.04, '#ffe45c', STYLE.GLOW)
    p.box(0, 0.3, 0.51, 0.6, 0.14, 0.04, '#ffe45c', STYLE.GLOW)
    for (const x of [-0.2, 0.2]) p.box(x, 0.2, 0.52, 0.1, 0.1, 0.04, '#d96a0a', STYLE.SMOOTH)
  },
  mummy: (p) => {
    body(p, '#eadfc4', { feet: '#cdbf9c' })
    // Wrapped in bandages: bands round the body, a dark gap across the eyes.
    for (const y of [0.26, 0.46, 0.92]) p.box(0, y, 0, 1.03, 0.07, 1.03, '#d3c4a0', STYLE.SMOOTH)
    p.box(0.1, 0.2, 0.505, 0.5, 0.06, 0.02, '#d3c4a0', STYLE.SMOOTH, [0, 0, 0.5])
    p.box(0, 0.7, 0.505, 0.92, 0.3, 0.02, '#2a2430', STYLE.SMOOTH)
    eyes(p, { y: 0.7, size: 0.26, color: '#16161c' })
    p.box(0.45, 0.06, 0.55, 0.14, 0.34, 0.05, '#eadfc4', STYLE.SMOOTH, [0, 0, 0.15])
  },
  ghost: (p) => {
    p.box(0, 0.62, 0, 1, 1, 1, '#f4f7ff', STYLE.GLOW)
    // A ragged hem and arms held up: a sheet with a boo.
    for (let i = 0; i < 5; i += 1) p.box(-0.4 + i * 0.2, i % 2 ? 0.08 : 0.04, 0, 0.2, i % 2 ? 0.16 : 0.08, 1, '#f4f7ff', STYLE.GLOW)
    for (const side of [-1, 1]) p.box(side * 0.56, 0.72, 0.1, 0.14, 0.3, 0.2, '#f4f7ff', STYLE.GLOW, [0, 0, side * -0.5])
    p.box(0, 1.14, 0, 0.8, 0.04, 0.8, '#ffffff', STYLE.GLOW)
    eyes(p, { y: 0.68, size: 0.3, color: '#16161c' })
    p.box(0, 0.4, 0.51, 0.14, 0.2, 0.04, '#2a2430', STYLE.SMOOTH)
    for (const x of [-0.38, 0.38]) p.box(x, 0.46, 0.51, 0.13, 0.07, 0.02, '#ffb3d6', STYLE.SMOOTH)
  },
  skeleton: (p) => {
    body(p, '#f1eee2', { feet: '#d8d3c0' })
    // Hollow sockets with a green spark, a nose hole and a toothy grin.
    for (const x of [-0.22, 0.22]) {
      p.box(x, 0.68, 0.51, 0.28, 0.32, 0.04, '#1b1b22', STYLE.SMOOTH)
      p.box(x, 0.66, 0.53, 0.1, 0.1, 0.04, '#7dff3a', STYLE.GLOW)
    }
    p.box(0, 0.46, 0.52, 0.1, 0.12, 0.03, '#1b1b22', STYLE.SMOOTH)
    p.box(0, 0.28, 0.51, 0.62, 0.15, 0.03, '#ffffff', STYLE.SMOOTH)
    for (const x of [-0.2, -0.1, 0, 0.1, 0.2]) p.box(x, 0.28, 0.53, 0.02, 0.15, 0.02, '#3a3640', STYLE.SMOOTH)
    // Ribs on the sides and a bow tie, for style.
    for (const y of [0.34, 0.5]) for (const side of [-1, 1]) p.box(side * 0.505, y, 0, 0.02, 0.06, 0.7, '#d8d3c0', STYLE.SMOOTH)
    p.box(0, 0.12, 0.52, 0.22, 0.12, 0.04, '#ff8a1e', STYLE.SMOOTH)
  },
  witchcat: (p) => {
    body(p, '#2a2433', { belly: '#4a3a60', feet: '#1a1420' })
    // The witch's hat: a wide brim, a bent cone and an orange band.
    p.box(0, 1.1, 0, 1.12, 0.08, 1.12, '#3d1e6d', STYLE.SMOOTH)
    p.box(0, 1.16, 0, 0.74, 0.08, 0.74, '#ff9a1e', STYLE.GLOW)
    p.box(0, 1.34, 0, 0.62, 0.3, 0.62, '#4b2a85', STYLE.SMOOTH)
    p.box(0, 1.6, 0, 0.4, 0.28, 0.4, '#4b2a85', STYLE.SMOOTH)
    p.box(0.08, 1.84, 0, 0.2, 0.28, 0.2, '#4b2a85', STYLE.SMOOTH, [0, 0, -0.35])
    // Glowing eyes, whiskers and a curled tail with a purple tip.
    eyes(p, { color: '#ffd23a' })
    nose(p, '#ff6f8f')
    for (const side of [-1, 1]) for (const dy of [-0.03, 0.04]) p.box(side * 0.42, 0.42 + dy, 0.52, 0.2, 0.014, 0.02, '#e8dcff', STYLE.SMOOTH, [0, 0, side * (0.12 + dy * 3)])
    tail(p, '#2a2433', { y: 0.7, len: 0.4, tip: '#b15cff' })
    p.box(0, 1.0, -0.62, 0.14, 0.4, 0.14, '#2a2433')
  },
}

const cache = new Map()

/** Shared geometry for a pet species. */
export function petGeometry(id) {
  if (!cache.has(id)) {
    const p = new PropBuilder()
    ;(MODELS[id] || MODELS.cat)(p)
    // The shared finishing touches: rosy cheeks and a little smile.
    if (!NO_BLUSH.has(id)) blush(p)
    if (!NO_SMILE.has(id)) smile(p)
    cache.set(id, p.build())
  }
  return cache.get(id)
}

export const PET_IDS = Object.keys(MODELS)
