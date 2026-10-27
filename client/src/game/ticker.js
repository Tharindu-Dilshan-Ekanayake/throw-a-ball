import { isLaneUnlocked } from '@shared/logic'
import {
  eggStandNear,
  FREE_REWARD,
  inThrowArea,
  LANE_COUNT,
  laneAt,
  laneRect,
  padAt,
  PORTAL,
  SPHINX_STAND,
} from '@shared/world'

import { sfx } from '../audio/sfx'
import { actions } from '../net/actions'
import { getGame, useGame } from '../store/game'
import { runtime } from './runtime'

const TICK_MS = 100

function sameZone(a, b) {
  return (
    a.lane === b.lane &&
    a.laneNear === b.laneNear &&
    a.sphinx === b.sphinx &&
    a.throwArea === b.throwArea &&
    a.pad === b.pad &&
    a.egg === b.egg &&
    a.portal === b.portal &&
    a.freeReward === b.freeReward
  )
}

/** Locked lanes become solid walls for the controller. */
function syncLockedLanes(profile) {
  const walls = []
  for (let i = 0; i < LANE_COUNT; i += 1) {
    if (!isLaneUnlocked(profile, i)) walls.push(laneRect(i))
  }
  runtime.dynamicColliders = walls
}

/**
 * The 10 Hz bridge between the frame-rate world and the UI: works out which zone the
 * player stands in, tells the authority about lane changes, and keeps locked-lane walls
 * in step with the profile. This - not the render loop - is what writes zone state into
 * the store, and only when something actually changed.
 *
 * @returns {() => void} stop
 */
export function startGameTicker() {
  let lastLane = -1

  syncLockedLanes(getGame().profile)
  const unsubscribe = useGame.subscribe((state, prev) => {
    if (state.profile !== prev.profile) syncLockedLanes(state.profile)
  })

  const tick = () => {
    const game = getGame()
    const p = runtime.player.position
    const egg = eggStandNear(p.x, p.z)
    const zone = {
      lane: laneAt(p.x, p.z, -0.2),
      // Standing at a lane's edge (a locked lane's wall stops you there).
      laneNear: laneAt(p.x, p.z, 1.3),
      sphinx: Math.hypot(p.x - SPHINX_STAND.x, p.z - SPHINX_STAND.z) < 5.5,
      throwArea: inThrowArea(p.x, p.z),
      pad: padAt(p.x, p.z),
      egg: egg ? egg.eggId : null,
      portal: Math.hypot(p.x - PORTAL.x, p.z - PORTAL.z) < PORTAL.radius,
      freeReward: Math.hypot(p.x - FREE_REWARD.x, p.z - FREE_REWARD.z) < FREE_REWARD.radius,
    }
    if (!sameZone(zone, game.zone)) {
      if (zone.portal && !game.zone.portal) actions.portal()
      game.setZone(zone)
    }

    if (zone.lane !== lastLane) {
      if (zone.lane >= 0 && isLaneUnlocked(game.profile, zone.lane)) {
        actions.enterLane(zone.lane)
        sfx.laneEnter()
      }
      else if (lastLane >= 0) actions.leaveLane()
      lastLane = zone.lane
    }

  }

  const id = setInterval(tick, TICK_MS)
  return () => {
    clearInterval(id)
    unsubscribe()
  }
}
