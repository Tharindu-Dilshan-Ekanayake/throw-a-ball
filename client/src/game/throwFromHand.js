import { CLICK_INTERVAL } from '@shared/balance'

import { actions } from '../net/actions'
import { getGame } from '../store/game'
import { runtime } from './runtime'

let lastClickAt = -Infinity

/**
 * Throws the frisbee in your hand, if you can right now: a click throw (a x1 training
 * throw, at most one per CLICK_INTERVAL - the authority enforces it too) anywhere
 * outside the throw area. In the throw area it's the real throw off the stage, but
 * only when `stage` is set - tapping the world there does nothing, the THROW button
 * and the touch throw button do. Returns whether a throw was sent.
 *
 * @param {{ stage?: boolean }} [options]
 */
export function throwFromHand({ stage = false } = {}) {
  const game = getGame()
  if (game.panel || game.flight || game.throwResult || runtime.camera.mode !== 'follow') return false
  if (game.zone.throwArea) {
    if (!stage) return false
    actions.throwPlane()
    return true
  }
  const now = performance.now()
  if (now - lastClickAt < CLICK_INTERVAL * 1000) return false
  lastClickAt = now
  actions.click()
  return true
}
