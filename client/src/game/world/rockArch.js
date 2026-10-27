import { STYLE } from '../materials'
import { PALETTE } from '../sceneStyle'
import { addTree } from './terrain'

/**
 * Building blocks for the rock gateways: ragged towers of stacked stone with mossy caps,
 * and thin sheets of falling water in the animated water style. All plain boxes for a
 * BlockSet, so they ride in the draw call of whatever set they are added to.
 */

/**
 * The same stone as the lobby's hills: chequered tan-and-brown sides under a grass cap
 * (STYLE.TERRAIN). A few shades of the hills' dirt keep neighbouring courses apart.
 */
export const ROCK = PALETTE.dirt
const ROCKS = [PALETTE.dirt, '#d2a468', '#bf9156', '#c99a5f']
export const WATER_COLOR = '#38d6ff'
const FOAM = '#e9fcff'

const pick = (rand, list) => list[Math.floor(rand() * list.length)]

/**
 * A tower of irregular stone standing on `y0` up to about `top`: each course a little
 * off-centre and turned, narrowing slowly, with a moss cap and a few tufts.
 *
 * @param {import('../blocks').BlockSet} b
 * @param {() => number} rand seeded random
 */
export function rockTower(b, x, y0, z, top, w, d, rand, tree = true) {
  let y = y0
  let ww = w
  let dd = d
  let courseTop = y0
  while (y < top - 0.3) {
    const h = Math.min(1.3 + rand() * 1.3, top - y + 0.2)
    b.addOn(
      x + (rand() - 0.5) * 0.5,
      y,
      z + (rand() - 0.5) * 0.5,
      ww * (0.9 + rand() * 0.2),
      h,
      dd * (0.9 + rand() * 0.2),
      pick(rand, ROCKS),
      STYLE.TERRAIN,
      (rand() - 0.5) * 0.5,
    )
    courseTop = y + h
    y += h * 0.85
    ww *= 0.985
    dd *= 0.985
  }
  // A little tree on the summit, as on the lobby's hills.
  if (tree && ww > 2) addTree(b, x, courseTop, z, 0.55 + rand() * 0.25, rand)
}

/**
 * A waterfall column hanging from `top` to the ground, `width` wide along Z and facing
 * along X: a main sheet, a paler core, thin ribbons either side, and a foam-edged pool.
 */
export function waterSheet(b, x, top, z, width) {
  b.addOn(x, 0, z, 0.5, top, width, WATER_COLOR, STYLE.WATER)
  b.addOn(x, 0.4, z, 0.8, top - 0.8, width * 0.4, '#8be9ff', STYLE.WATER)
  for (const side of [-1, 1]) b.addOn(x, 0, z + side * (width / 2 + 0.9), 0.4, top * 0.7, 0.8, '#a8efff', STYLE.WATER)
  b.addOn(x, 0, z, 3, 0.25, width + 2.4, WATER_COLOR, STYLE.WATER)
  b.addOn(x, 0.25, z, 1.6, 0.18, width + 0.6, FOAM, STYLE.WATER)
}
