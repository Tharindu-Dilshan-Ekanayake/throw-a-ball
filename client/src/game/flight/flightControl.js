import { sfx } from '../../audio/sfx'
import { getGame } from '../../store/game'
import { burst } from '../fx/fxQueue'
import { THROW_TIME } from '../playerPose'
import { runtime } from '../runtime'

/** How long the "+N Wins" result shows before the camera returns to the player. */
const RESULT_HOLD_MS = 1500

/**
 * The flight currently being watched, read every frame by the flight renderer.
 * `null` when nothing is flying.
 */
export const flight = {
  active: false,
  startedAt: 0,
  distance: 0,
  duration: 1,
  trophies: [],
  wins: 0,
  /** Metres flown so far; written by the renderer, read by the counter. */
  meter: 0,
}

let timers = []

function clearTimers() {
  for (const id of timers) clearTimeout(id)
  timers = []
}

/**
 * Starts replaying a throw the authority already resolved. Everything is known up
 * front (distance, Wins, trophy positions), so the client just plays it back: no
 * per-frame network traffic for flights.
 */
export function beginFlight(result) {
  clearTimers()
  const game = getGame()
  Object.assign(flight, {
    active: true,
    startedAt: performance.now(),
    distance: result.distance,
    duration: result.duration,
    trophies: result.trophies,
    wins: result.wins,
    meter: 0,
  })
  runtime.player.throwTimer = THROW_TIME
  runtime.player.throwSeq += 1
  runtime.player.yaw = Math.PI
  runtime.player.frozen = true
  runtime.camera.mode = 'flight'
  game.startFlight({ distance: result.distance, wins: result.wins, duration: result.duration })

  timers.push(
    setTimeout(() => {
      sfx.land()
      setTimeout(sfx.wins, 250)
      if (runtime.flightFocus) {
        const f = runtime.flightFocus
        burst({ x: f.x, y: f.y + 0.5, z: f.z - 3, count: 40, palette: 'gold', speed: 8 })
      }
      game.endFlight()
      timers.push(setTimeout(finishFlight, RESULT_HOLD_MS))
    }, result.duration * 1000),
  )
}

/** Hands the camera back to the player. */
export function finishFlight() {
  clearTimers()
  flight.active = false
  runtime.flightFocus = null
  runtime.player.frozen = false
  runtime.camera.mode = 'follow'
  runtime.camera.snap = true
  getGame().clearThrowResult()
}
