import { Matrix4, OctahedronGeometry, SphereGeometry, TorusGeometry } from 'three'

import { LANE_COUNT, LANE_TARGET_X, laneCenterZ } from '@shared/world'

import { disc, star } from '../geometry'
import { STYLE } from '../materials'

/**
 * The target board at the end of each training lane, one design per lane as in the
 * reference: red/white bullseye, green ring, blue star, purple gem, gold wheel, lava
 * hexagon, red crystal, rainbow ring and galaxy portal.
 *
 * All nine are merged into the props mesh, so they cost nothing extra to draw.
 */

/** Height of the board centre; the pedestal top is at 1.2. */
export const TARGET_Y = 3
/** Where training shots aim: the board face, which looks east down its lane. */
export const targetPoint = (lane) => [LANE_TARGET_X + 0.35, TARGET_Y, laneCenterZ(lane)]

/**
 * Designs are written facing +Z at the origin (z = 0 is the board, FACE its front) and
 * turned to face east (+X) at their lane's end by buildTargets.
 */
const BOARD_Z = 0
const FACE = BOARD_Z + 0.2

function board(props, x, color, frame, style = STYLE.STUDS) {
  props.box(x, TARGET_Y, BOARD_Z, 3.4, 3.4, 0.3, frame, style)
  props.box(x, TARGET_Y, BOARD_Z + 0.08, 3.0, 3.0, 0.3, color, style)
  // Post down to the pedestal.
  props.box(x, 1.5, BOARD_Z - 0.05, 0.6, 0.6, 0.4, frame)
}

function rings(props, x, list) {
  list.forEach(([radius, color, style = STYLE.SMOOTH], i) => {
    props.add(disc(radius, 0.08, 36), { position: [x, TARGET_Y, FACE + 0.06 + i * 0.03], color, style })
  })
}

const DESIGNS = [
  // 0: classic bullseye on a white board.
  (p, x) => {
    board(p, x, '#ffffff', '#c9d2dc')
    rings(p, x, [
      [1.35, '#e8232f'],
      [1.08, '#ffffff'],
      [0.8, '#e8232f'],
      [0.52, '#ffffff'],
      [0.26, '#e8232f'],
    ])
  },
  // 1: green ring.
  (p, x) => {
    board(p, x, '#25b43a', '#7ef040')
    rings(p, x, [
      [1.35, '#9dff4f'],
      [1.05, '#178a2b'],
      [0.75, '#9dff4f'],
      [0.42, '#0e5f1e'],
    ])
  },
  // 2: yellow star on blue.
  (p, x) => {
    board(p, x, '#2357e4', '#48c8ff')
    p.add(star(5, 1.38, 0.6, 0.3), { position: [x, TARGET_Y, FACE + 0.2], color: '#ffd21f', style: STYLE.SMOOTH })
  },
  // 3: purple gem.
  (p, x) => {
    board(p, x, '#5b28c4', '#b07bff')
    p.add(new OctahedronGeometry(1, 0), { position: [x, TARGET_Y, FACE + 0.2], scale: [0.95, 1.35, 0.45], color: '#b47cff', style: STYLE.GLOW })
    p.add(new OctahedronGeometry(1, 0), { position: [x, TARGET_Y + 0.15, FACE + 0.45], scale: [0.45, 0.65, 0.2], color: '#ead6ff' })
  },
  // 4: gold wheel.
  (p, x) => {
    board(p, x, '#c48a12', '#ffe25a')
    const z = FACE + 0.2
    p.add(new TorusGeometry(1.1, 0.2, 10, 28), { position: [x, TARGET_Y, z], color: '#ffd02a', style: STYLE.GLOW })
    p.add(disc(0.38, 0.3), { position: [x, TARGET_Y, z], color: '#fff07a' })
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2
      p.box(x + Math.cos(a) * 0.55, TARGET_Y + Math.sin(a) * 0.55, z, 0.95, 0.14, 0.14, '#ffd02a', STYLE.SMOOTH, [0, 0, a])
      p.box(x + Math.cos(a) * 1.35, TARGET_Y + Math.sin(a) * 1.35, z, 0.36, 0.3, 0.3, '#ffe25a', STYLE.SMOOTH, [0, 0, a])
    }
  },
  // 5: lava hexagon.
  (p, x) => {
    board(p, x, '#2b1609', '#ff8a1e')
    rings(p, x, [
      [1.42, '#ff7a14', STYLE.GLOW],
      [0.95, '#ffb347'],
      [0.5, '#ff6a00', STYLE.GLOW],
    ])
  },
  // 6: red crystal burst.
  (p, x) => {
    board(p, x, '#3a0810', '#ff3b3b')
    p.add(star(8, 1.45, 0.65, 0.3), { position: [x, TARGET_Y, FACE + 0.2], color: '#ff2a3a', style: STYLE.GLOW })
    p.add(new OctahedronGeometry(0.5, 0), { position: [x, TARGET_Y, FACE + 0.45], color: '#ffb3b3' })
  },
  // 7: rainbow ring, VERY OP!
  (p, x) => {
    p.box(x, 1.6, BOARD_Z, 0.5, 1.2, 0.5, '#ffffff')
    const hues = ['#ff3b5c', '#ff8a1f', '#ffe53b', '#4ef05a', '#2fc6ff', '#5a6cff', '#c35cff', '#ff4fd8']
    hues.forEach((color, i) => {
      const g = new TorusGeometry(1.45, 0.32, 8, 6, (Math.PI * 2) / hues.length + 0.02)
      p.add(g, { position: [x, TARGET_Y + 0.2, FACE], rotation: [0, 0, (i / hues.length) * Math.PI * 2], color, style: STYLE.GLOW })
    })
    p.add(disc(1.1, 0.06), { position: [x, TARGET_Y + 0.2, FACE - 0.05], color: '#ffffff', style: STYLE.GLOW })
  },
  // 8: galaxy portal, BEST OVERALL!
  (p, x) => {
    board(p, x, '#101650', '#7a5cff', STYLE.GALAXY)
    p.add(new SphereGeometry(0.75, 20, 14), { position: [x, TARGET_Y, FACE + 0.6], color: '#9a5cff', style: STYLE.GLOW })
    p.add(new TorusGeometry(1.25, 0.1, 6, 36), { position: [x, TARGET_Y, FACE + 0.6], rotation: [1.2, 0.35, 0], color: '#66e3ff', style: STYLE.GLOW })
  },
]

export function buildTargets(props) {
  const turn = new Matrix4()
  for (let i = 0; i < LANE_COUNT; i += 1) {
    props.transform = turn.makeRotationY(Math.PI / 2).setPosition(LANE_TARGET_X, 0, laneCenterZ(i))
    DESIGNS[i](props, 0)
  }
  props.transform = null
}
