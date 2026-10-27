import { sfx } from '../audio/sfx'
import { beginFlight } from '../game/flight/flightControl'
import { burst, queueTrainFx } from '../game/fx/fxQueue'
import { runtime } from '../game/runtime'
import { getGame } from '../store/game'

const atPlayer = (dy = 1.2) => {
  const p = runtime.player.position
  return { x: p.x, y: p.y + dy, z: p.z }
}

/**
 * Applies one authority event to the client: updates the store and kicks off any
 * visual effect. The same handler serves the Colyseus connection and offline mode.
 */
export function handleServerEvent(type, payload) {
  const game = getGame()
  switch (type) {
    case 'profile': {
      const before = game.profile
      game.setProfile(payload.profile, payload.session)
      // Celebrate the big moments, whatever caused them.
      if (game.profileLoaded && payload.profile.rebirths > before.rebirths) {
        sfx.rebirth()
        burst({ ...atPlayer(), count: 60, speed: 9 })
      } else if (game.profileLoaded && payload.profile.ownedPlanes.length > before.ownedPlanes.length) {
        sfx.buy()
        burst({ ...atPlayer(2.5), count: 30, palette: 'gold' })
      }
      break
    }

    case 'train':
      game.patchProfile({
        power: payload.power,
        level: payload.level,
        levelProgress: payload.levelProgress,
        // Click throws (lane -1) don't count as training in a lane.
        ...(payload.lane >= 0 ? { lastLane: payload.lane } : {}),
      })
      queueTrainFx(payload)
      if (payload.leveledUp) {
        sfx.levelUp()
        burst({ ...atPlayer(1.8), count: 24, palette: 'power', speed: 6 })
      }
      break

    case 'throw':
      sfx.throw()
      beginFlight(payload)
      break

    case 'hatch':
      game.setHatch({ eggId: payload.eggId, pets: payload.pets, id: Date.now() })
      if (payload.eggId) {
        setTimeout(sfx.crack, 1100)
        setTimeout(sfx.reveal, 1250)
      } else {
        sfx.reveal()
      }
      break

    case 'offline':
      game.openPanel('offline', payload)
      break

    case 'badge':
      sfx.wins()
      break

    default:
      break
  }
}
