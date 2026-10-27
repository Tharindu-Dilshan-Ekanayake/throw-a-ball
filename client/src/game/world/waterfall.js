import { WATERFALL, WATERFALL_CLIFF } from '@shared/world'

import { STYLE } from '../materials'

const WATER = '#38d6ff'
const FOAM = '#e9fcff'
const ROCK = '#7d8aa3'

/**
 * The big waterfall behind the lobby: a wide sheet pouring off the tall cliff south of
 * the plaza into a pool, with thin ribbons either side, a river winding back over the
 * cliff top, and foam at the foot. All blocks in the animated water style, so it costs
 * nothing beyond the world's one block draw call.
 *
 * Nothing here shares a plane with another face: every layer stands a clear step proud
 * of the one under it.
 */
export function buildWaterfall(blocks) {
  const { x, z, width } = WATERFALL
  const top = WATERFALL_CLIFF.height
  const face = z - 0.2

  // The main sheet, hugging the cliff face and rising over its lip.
  blocks.addOn(x, 0, face, width, top + 0.4, 0.5, WATER, STYLE.WATER)
  // A paler core down the middle, standing a little further out.
  blocks.addOn(x, 0.4, face - 0.3, width * 0.45, top - 0.8, 0.3, '#8be9ff', STYLE.WATER)
  // Thin ribbons either side, falling the whole way, and shorter ones beyond them.
  for (const side of [-1, 1]) {
    blocks.addOn(x + side * (width / 2 + 2), 0, face - 0.05, 1.6, top + 0.4, 0.4, '#a8efff', STYLE.WATER)
    blocks.addOn(x + side * (width / 2 + 4.6), 0, face - 0.05, 1.1, top * 0.62, 0.4, '#a8efff', STYLE.WATER)
  }

  // The river over the top of the cliff.
  blocks.addOn(x, top, z + 14, width - 2, 0.5, 30, WATER, STYLE.WATER)
  blocks.addOn(x, top, z + 40.5, width - 5, 0.5, 23, WATER, STYLE.WATER)

  // The pool at the foot, with foam where the water lands and rocks round the rim.
  const poolW = width + 6
  blocks.addOn(x, 0, z - 3.4, poolW, 0.35, 6.8, WATER, STYLE.WATER)
  blocks.addOn(x, 0.35, z - 1.2, width + 1, 0.4, 2.4, FOAM, STYLE.WATER)
  blocks.addOn(x, 0.35, z - 2.2, width * 0.7, 0.25, 1.2, FOAM, STYLE.WATER)
  for (const side of [-1, 1]) {
    blocks.addOn(x + side * (poolW / 2 + 0.7), 0, z - 3, 1.8, 1.1, 2.4, ROCK)
    blocks.addOn(x + side * (poolW / 2 + 0.5), 1.1, z - 3.4, 1.1, 0.7, 1.4, ROCK)
    blocks.addOn(x + side * (poolW / 2 - 1.5), 0, z - 6.8, 2.2, 0.7, 1.6, ROCK)
  }
}
