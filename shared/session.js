import { CLICK_INTERVAL, EGGS, ITEMS, LANES, MULTI_HATCH, PLANES, SHOP, TRAIN_INTERVAL, WORLD2_POWER } from './balance.js'
import {
  advanceTutorial,
  applyClick,
  applyRebirth,
  applyThrow,
  applyTrain,
  awardBadge,
  buyPlane,
  claimDaily,
  claimFreeReward,
  claimPlaytime,
  createSession,
  deletePet,
  equipBestPets,
  equipPet,
  buyShopItem,
  equipPlane,
  hatchEgg,
  isLaneUnlocked,
  isMaxLevel,
  planeById,
  unequipPet,
  usePotion,
} from './logic.js'
import { eggStandNear, FREE_REWARD, inRect, inThrowArea, laneRect, PLANE_PADS, padRect, PORTAL } from './world.js'

const PLANES_INDEX = Object.fromEntries(PLANES.map((p, i) => [p.id, i]))

/** How far outside a lane's floor still counts as "in" it (network jitter). */
const LANE_SLACK = 0.8
/** Same for the throw area. */
const THROW_SLACK = 1.5
/** Pads are bought by standing on them; allow for a little lag. */
const PAD_SLACK = 2

/**
 * One player's authoritative session: validates intents, runs the training tick and
 * reports what happened through `emit`.
 *
 * Transport-agnostic on purpose. The Colyseus room wraps one of these per client; the
 * offline mode wraps one for the local player. Either way the rules that run are
 * byte-for-byte the same.
 *
 * Events emitted (type, payload):
 * - 'profile'  { profile, session }  full state, after anything structural
 * - 'train'    { lane, gain, power, level, levelProgress, leveledUp }  each training
 *                throw; lane -1 is a click throw
 * - 'throw'    { distance, wins, trophies, duration, multiplier }  a throw to replay
 * - 'hatch'    { eggId, pets: [{ uid, id }] }  pets to reveal
 * - 'badge'    { id, name }
 *
 * `onThrow(result)` lets the host tell other players about a throw (ghost planes).
 */
export class PlayerSession {
  /**
   * @param {object} profile normalized profile (see logic.normalizeProfile)
   * @param {{ now: number, emit: (type: string, payload?: object) => void,
   *           getPosition: () => {x: number, y: number, z: number},
   *           onPurchase?: (productId: string) => boolean }} options
   *   `onPurchase` lets the host veto or count a shop sale (stock limits).
   */
  constructor(profile, { now, emit, getPosition, onPurchase, onThrow }) {
    this.profile = profile
    this.session = createSession(now)
    this.emit = emit
    this.getPosition = getPosition
    this.onPurchase = onPurchase
    this.onThrow = onThrow

    /** Lane the client says it's in; verified against position every tick. */
    this.lane = -1
    this.trainTimer = 0
    /** Server time until which the player is watching a throw and can't train or throw. */
    this.busyUntil = 0
    /** Server time of the last click throw that counted. */
    this.lastClickAt = -Infinity
    this.dirty = false
  }

  // --- Plumbing --------------------------------------------------------------------

  sendProfile() {
    this.dirty = false
    this.emit('profile', { profile: this.profile, session: this.session })
  }

  badge(id) {
    const badge = awardBadge(this.profile, id)
    if (badge) {
      this.dirty = true
      this.emit('badge', badge)
    }
  }

  tutorial(event) {
    if (advanceTutorial(this.profile, event)) this.dirty = true
  }

  // --- Intents ---------------------------------------------------------------------

  /** Dispatches one client message. Unknown types are ignored. */
  handle(type, payload = {}, now) {
    const handler = this.handlers[type]
    if (!handler) return
    handler.call(this, payload || {}, now)
    if (this.dirty) this.sendProfile()
  }

  handlers = {
    enterLane({ lane }) {
      const index = Number(lane)
      if (!Number.isInteger(index) || !LANES[index]) return
      if (!isLaneUnlocked(this.profile, index)) return
      if (this.lane !== index) {
        this.lane = index
        // The first throw lands a beat after stepping in, not instantly.
        this.trainTimer = TRAIN_INTERVAL * 0.5
      }
    },

    leaveLane() {
      this.lane = -1
    },

    setting({ key, value }) {
      if (key !== 'autoRebirth') return
      this.profile.settings.autoRebirth = Boolean(value)
      this.dirty = true
    },

    /** A click throw: anywhere but the throw area, at most one per CLICK_INTERVAL. */
    click(_payload, now) {
      if (now < this.busyUntil || now - this.lastClickAt < CLICK_INTERVAL * 1000) return
      const p = this.getPosition()
      if (inThrowArea(p.x, p.z)) return
      this.lastClickAt = now
      this.emitTrain(-1, applyClick(this.profile, now))
    },

    rebirth() {
      const result = applyRebirth(this.profile)
      if (result.ok) this.afterRebirth()
    },

    throw(_payload, now) {
      if (now < this.busyUntil) return
      const p = this.getPosition()
      if (!inThrowArea(p.x, p.z, THROW_SLACK)) return
      const result = applyThrow(this.profile, now)
      this.busyUntil = now + result.cooldown * 1000
      this.emit('throw', {
        distance: result.distance,
        wins: result.wins,
        trophies: result.trophies,
        duration: result.duration,
        multiplier: result.multiplier,
      })
      this.onThrow?.(result)
      // The HUD holds the new Wins back until landing; the profile can go now.
      this.dirty = true
      this.tutorial('throw')
      this.badge('firstThrow')
      if (result.distance >= 1000) this.badge('kilometer')
    },

    buyPlane({ id }) {
      if (!this.nearPadFor(id)) return
      const result = buyPlane(this.profile, id)
      if (!result.ok) return
      this.dirty = true
      if (result.bought) {
        this.tutorial('buyPlane')
      } else {
      }
    },

    equipPlane({ id }) {
      const result = equipPlane(this.profile, id)
      if (result.ok) this.dirty = true
    },

    hatch({ eggId, count }) {
      const egg = EGGS[eggId]
      if (!egg) return
      const p = this.getPosition()
      if (eggStandNear(p.x, p.z)?.eggId !== eggId) return
      const n = count === MULTI_HATCH ? MULTI_HATCH : 1
      this.reveal(hatchEgg(this.profile, eggId, n))
    },

    openEggItem({ itemId }) {
      const item = ITEMS[itemId]
      if (!item || item.kind !== 'egg') return
      this.reveal(hatchEgg(this.profile, item.egg, 1, { paid: 'item' }))
    },

    equipPet({ uid }) {
      if (equipPet(this.profile, Number(uid)).ok) this.dirty = true
    },

    unequipPet({ uid }) {
      unequipPet(this.profile, Number(uid))
      this.dirty = true
    },

    equipBest() {
      equipBestPets(this.profile)
      this.dirty = true
    },

    deletePet({ uid }) {
      if (deletePet(this.profile, Number(uid)).ok) this.dirty = true
    },

    claimDaily({ day }, now) {
      const result = claimDaily(this.profile, Number(day), now)
      this.afterReward(result)
    },

    claimPlaytime({ index }, now) {
      const result = claimPlaytime(this.profile, this.session, Number(index), now)
      this.afterReward(result)
    },

    claimFreeReward() {
      const p = this.getPosition()
      if (Math.hypot(p.x - FREE_REWARD.x, p.z - FREE_REWARD.z) > FREE_REWARD.radius + 1.5) return
      const result = claimFreeReward(this.profile, this.session)
      this.afterReward(result)
    },

    portal() {
      const p = this.getPosition()
      if (Math.hypot(p.x - PORTAL.x, p.z - PORTAL.z) > PORTAL.radius + 2) return
      if (this.profile.power < WORLD2_POWER) return
      this.badge('world2')
    },

    usePotion({ itemId }, now) {
      const result = usePotion(this.profile, itemId, now)
      if (!result.ok) return
      this.dirty = true
    },

    /** Buys a SHOP item with Wins. */
    purchase({ productId }) {
      const item = SHOP[productId]
      if (!item) return
      // Checked before the host takes stock, so a short wallet never uses up a Sphinx.
      if (this.profile.wins < item.price) return
      if (item.kind === 'pass' && this.profile.passes[productId]) return
      if (this.onPurchase && !this.onPurchase(productId)) return
      const result = buyShopItem(this.profile, productId)
      if (!result.ok) return
      this.dirty = true
      this.reveal(result)
    },
  }

  afterReward(result) {
    if (!result?.ok) return
    this.dirty = true
    if (result.pets?.length) this.reveal(result)
  }

  /** Sends newly gained pets to the client's hatch animation. */
  reveal(result) {
    if (!result?.ok || !result.pets?.length) return
    this.dirty = true
    this.emit('hatch', { eggId: result.eggId ?? null, pets: result.pets })
    this.tutorial('hatch')
    this.badge('firstPet')
  }

  afterRebirth() {
    this.dirty = true
    this.tutorial('rebirth')
    if (this.profile.rebirths === 1) this.badge('firstRebirth')
  }

  // --- Simulation ------------------------------------------------------------------

  /** Whether the player stands on (or right by) the pad for plane `id`. */
  nearPadFor(id) {
    const index = PLANES_INDEX[id]
    const pad = PLANE_PADS[index]
    if (!pad) return false
    const p = this.getPosition()
    return inRect(padRect(pad), p.x, p.z, PAD_SLACK)
  }

  /** Whether the player is really standing in the lane they claim. */
  inClaimedLane() {
    if (this.lane < 0) return false
    const p = this.getPosition()
    return inRect(laneRect(this.lane), p.x, p.z, LANE_SLACK)
  }

  /** Advances training. Call at a steady rate (the room's simulation interval). */
  tick(dt, now) {
    if (this.lane >= 0 && now >= this.busyUntil && this.inClaimedLane()) {
      this.trainTimer += dt
      while (this.trainTimer >= TRAIN_INTERVAL) {
        this.trainTimer -= TRAIN_INTERVAL
        this.trainOnce(now)
      }
    } else {
      this.trainTimer = Math.min(this.trainTimer, TRAIN_INTERVAL * 0.5)
    }
    this.profile.stats.playtime += dt
    if (this.dirty) this.sendProfile()
  }

  /** Tells the client about a training throw; `lane` is -1 for a click throw. */
  emitTrain(lane, result) {
    this.emit('train', {
      lane,
      gain: result.gain,
      power: this.profile.power,
      level: this.profile.level,
      levelProgress: this.profile.levelProgress,
      leveledUp: result.leveledUp,
    })
  }

  trainOnce(now) {
    const result = applyTrain(this.profile, this.lane, now)
    if (!result.ok) {
      this.lane = -1
      return
    }
    this.emitTrain(this.lane, result)
    this.tutorial('train')
    if (this.profile.settings.autoRebirth && isMaxLevel(this.profile)) {
      const rebirth = applyRebirth(this.profile)
      if (rebirth.ok) this.afterRebirth()
    }
  }
}
