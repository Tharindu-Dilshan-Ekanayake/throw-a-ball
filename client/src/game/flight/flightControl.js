import { sfx } from '../../audio/sfx'
import { getGame } from '../../store/game'
import { burst } from '../fx/fxQueue'
import { RELEASE_DELAY, THROW_TIME } from '../playerPose'
import { runtime } from '../runtime'

/** How long the "+N Wins" result shows before the camera returns to the player. */
const RESULT_HOLD_MS = 2400

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
  /**
   * When the ball left the hand (performance.now), 0 until it has. Set by the renderer
   * at the moment the throw animation lets go, so the ball and the arm can't drift.
   */
  releasedAt: 0,
  /** True once the landing (sound, result, camera hold) has been handled. */
  landed: false,
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
    releasedAt: 0,
    landed: false,
  })
  runtime.player.throwTimer = THROW_TIME
  runtime.player.throwSeq += 1
  runtime.player.yaw = Math.PI
  runtime.player.frozen = true
  // The camera stays on the player through the wind-up and release; the renderer swings
  // it onto the ball (mode 'flight') the moment the ball leaves the hand.
  game.startFlight({ distance: result.distance, wins: result.wins, duration: result.duration })
  // Safety net in case the renderer never reports the landing.
  timers.push(setTimeout(landFlight, (RELEASE_DELAY + result.duration) * 1000 + 800))
}

/**
 * The ball has touched down: its thud, the Wins arriving, the burst of gold, and the
 * result hold before the camera returns. Called by the renderer the frame the ball lands
 * (once; further calls do nothing).
 */
export function landFlight() {
  if (!flight.active || flight.landed) return
  flight.landed = true
  const game = getGame()
  sfx.land()
  setTimeout(sfx.wins, 250)
  if (runtime.flightFocus) {
    const f = runtime.flightFocus
    burst({ x: f.x, y: f.y + 0.5, z: f.z - 3, count: 40, palette: 'gold', speed: 8 })
  }
  game.endFlight()
  timers.push(setTimeout(finishFlight, RESULT_HOLD_MS))
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
