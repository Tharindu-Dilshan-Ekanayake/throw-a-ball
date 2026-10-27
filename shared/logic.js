import {
  BADGES,
  DAILY_INTERVAL_MS,
  DAILY_REWARDS,
  DISTANCE_BASE,
  DISTANCE_K,
  EGGS,
  flightDuration,
  FREE_REWARD,
  ITEMS,
  LANES,
  LEVEL_GAIN,
  LEVEL_STEPS,
  levelCap,
  MAX_EQUIPPED_PETS,
  MAX_PET_INVENTORY,
  OFFLINE_MAX_MS,
  OFFLINE_MIN_MS,
  OFFLINE_RATE,
  PETS,
  PLANES,
  PLAYTIME_REWARDS,
  RARITIES,
  rebirthMultiplier,
  SHOP,
  THROW_RECOVERY,
  TRAIN_INTERVAL,
  TROPHY_FIRST,
  TROPHY_METERS,
  TROPHY_SPACING,
  TUTORIAL,
  ZONES,
} from './balance.js'

/**
 * Game rules as pure functions over a plain profile object.
 *
 * The server runs these authoritatively; the client runs the very same functions for
 * offline play and for display (costs, multipliers, what a button would do). Mutating
 * functions change the profile in place and return a small result describing what
 * happened, which is what gets sent to the client as an event.
 *
 * `session` is the per-connection state that is never saved: when this session
 * started, which playtime rewards were claimed, the free-reward flag.
 */

export const PROFILE_VERSION = 1

export function createProfile(id, name) {
  return {
    v: PROFILE_VERSION,
    id,
    name,
    power: 0,
    wins: 0,
    rebirths: 0,
    level: 1,
    levelProgress: 0,
    equippedPlane: 'paper',
    ownedPlanes: ['paper'],
    pets: [],
    equippedPets: [],
    nextPetUid: 1,
    items: {},
    boosts: { power: 0, wins: 0 },
    passes: {},
    daily: { start: 0, claimed: [] },
    freeRewardClaimed: false,
    tutorialStep: 0,
    badges: [],
    stats: { throws: 0, trains: 0, bestDistance: 0, playtime: 0, bestPower: 0 },
    lastLane: -1,
    lastSeen: 0,
    settings: { autoRebirth: false },
  }
}

/** Fills in anything missing from an older or partial save. Never throws. */
export function normalizeProfile(raw, id, name) {
  const base = createProfile(id, name)
  if (!raw || typeof raw !== 'object') return base
  const p = { ...base, ...raw, id, name: name || raw.name || base.name }
  p.boosts = { ...base.boosts, ...(raw.boosts || {}) }
  p.stats = { ...base.stats, ...(raw.stats || {}) }
  p.settings = { ...base.settings, ...(raw.settings || {}) }
  p.daily = { ...base.daily, ...(raw.daily || {}) }
  p.items = { ...(raw.items || {}) }
  p.passes = { ...(raw.passes || {}) }
  p.pets = Array.isArray(raw.pets) ? raw.pets.filter((pet) => PETS[pet?.id]) : []
  p.equippedPets = Array.isArray(raw.equippedPets)
    ? raw.equippedPets.filter((uid) => p.pets.some((pet) => pet.uid === uid)).slice(0, MAX_EQUIPPED_PETS)
    : []
  p.ownedPlanes = Array.isArray(raw.ownedPlanes) && raw.ownedPlanes.length ? raw.ownedPlanes : ['paper']
  if (!p.ownedPlanes.includes(p.equippedPlane)) p.equippedPlane = p.ownedPlanes[0]
  // The tutorial is for brand-new players only: anyone who has rebirthed is past it.
  if (p.rebirths > 0) p.tutorialStep = TUTORIAL.length
  p.v = PROFILE_VERSION
  return p
}

export function createSession(now) {
  return { start: now, playtimeClaimed: [], freeRewardTaken: false }
}

// --- Lookups ------------------------------------------------------------------------

export const planeIndex = (id) => PLANES.findIndex((p) => p.id === id)
export const planeById = (id) => PLANES.find((p) => p.id === id) || PLANES[0]

export function isLaneUnlocked(profile, laneIndex) {
  const lane = LANES[laneIndex]
  if (!lane) return false
  if (lane.product) return Boolean(profile.passes[lane.product])
  return profile.rebirths >= lane.rebirths
}

// --- Multipliers --------------------------------------------------------------------

/** Equipped pets stack additively: x3 and x2 together make x4, not x6. */
export function petMultiplier(profile) {
  let total = 1
  for (const uid of profile.equippedPets) {
    const pet = profile.pets.find((p) => p.uid === uid)
    if (pet && PETS[pet.id]) total += PETS[pet.id].mult - 1
  }
  return total
}

export const isBoostActive = (profile, kind, now) => (profile.boosts[kind] || 0) > now

/** The Power potion - everything but lane, rebirths and pets. */
export function powerBoostMultiplier(profile, now) {
  return isBoostActive(profile, 'power', now) ? 2 : 1
}

export function winsMultiplier(profile, now) {
  return isBoostActive(profile, 'wins', now) ? 2 : 1
}

/** What the HUD shows as "Multiplier": lane x rebirths x boosts (pets not included). */
export function hudMultiplier(profile, laneIndex, now) {
  const area = laneIndex >= 0 && LANES[laneIndex] ? LANES[laneIndex].mult : 1
  return area * rebirthMultiplier(profile.rebirths) * powerBoostMultiplier(profile, now)
}

/** Power from one training throw in an area worth `areaMult`. */
function throwGain(profile, now, areaMult) {
  const plane = planeById(profile.equippedPlane)
  const raw =
    plane.power *
    (1 + profile.level * LEVEL_GAIN) *
    areaMult *
    rebirthMultiplier(profile.rebirths) *
    petMultiplier(profile) *
    powerBoostMultiplier(profile, now)
  return Math.max(1, Math.round(raw))
}

/** Power gained by one training throw in `laneIndex`. */
export function trainGain(profile, laneIndex, now) {
  const lane = LANES[laneIndex]
  if (!lane) return 0
  return throwGain(profile, now, lane.mult)
}

/** Power gained by one click throw: a x1 training throw, wherever you are. */
export const clickGain = (profile, now) => throwGain(profile, now, 1)

// --- Training, levels, rebirth ------------------------------------------------------

export const isMaxLevel = (profile) => profile.level >= levelCap(profile.rebirths)

/** 0..1 progress towards being able to rebirth. */
export function rebirthProgress(profile) {
  const cap = levelCap(profile.rebirths)
  if (profile.level >= cap) return 1
  const done = profile.level - 1 + profile.levelProgress / LEVEL_STEPS
  return Math.max(0, Math.min(1, done / Math.max(1, cap - 1)))
}

/** Banks a training throw's Power and its step of level progress. Returns leveledUp. */
function addTraining(profile, gain) {
  profile.power += gain
  profile.stats.trains += 1
  profile.stats.bestPower = Math.max(profile.stats.bestPower, profile.power)
  if (isMaxLevel(profile)) {
    profile.levelProgress = 0
    return false
  }
  profile.levelProgress += 1
  if (profile.levelProgress < LEVEL_STEPS) return false
  profile.levelProgress = 0
  profile.level += 1
  return true
}

export function applyTrain(profile, laneIndex, now) {
  if (!isLaneUnlocked(profile, laneIndex)) return { ok: false, error: 'Lane locked' }
  const gain = trainGain(profile, laneIndex, now)
  profile.lastLane = laneIndex
  return { ok: true, gain, leveledUp: addTraining(profile, gain) }
}

export function applyClick(profile, now) {
  const gain = clickGain(profile, now)
  return { ok: true, gain, leveledUp: addTraining(profile, gain) }
}

/**
 * Rebirth: +1 rebirth, Power and levels reset (Wins, planes and pets stay).
 */
export function applyRebirth(profile) {
  if (!isMaxLevel(profile)) return { ok: false, error: `Reach level ${levelCap(profile.rebirths)} first!` }
  profile.rebirths += 1
  profile.tutorialStep = TUTORIAL.length
  profile.power = 0
  profile.level = 1
  profile.levelProgress = 0
  return { ok: true, rebirths: profile.rebirths }
}

// --- Throwing ----------------------------------------------------------------------

export const throwDistance = (power) => DISTANCE_BASE + DISTANCE_K * Math.sqrt(Math.max(0, power))

export function zoneIndexAt(meter) {
  for (let i = ZONES.length - 1; i >= 0; i -= 1) {
    if (meter >= ZONES[i].start) return i
  }
  return 0
}

/** Metres of every trophy within `distance`. */
export function trophiesWithin(distance) {
  const out = []
  for (let m = TROPHY_FIRST; m <= distance; m += TROPHY_SPACING) out.push(m)
  return out
}

export const trophyValue = (meter) => Math.max(1, Math.round(ZONES[zoneIndexAt(meter)].winsPerMeter * TROPHY_METERS))

/** Wins for a throw before multipliers: metres flown in each zone, plus trophies. */
export function baseThrowWins(distance) {
  let wins = 0
  for (let i = 0; i < ZONES.length; i += 1) {
    const start = ZONES[i].start
    const end = i + 1 < ZONES.length ? ZONES[i + 1].start : Infinity
    const metres = Math.max(0, Math.min(distance, end) - start)
    wins += metres * ZONES[i].winsPerMeter
  }
  for (const m of trophiesWithin(distance)) wins += trophyValue(m)
  return wins
}

/**
 * A throw. Power is not consumed. Returns everything the client needs to replay the
 * flight locally: distance, duration, trophy positions and the Wins earned.
 */
export function applyThrow(profile, now) {
  const distance = Math.round(throwDistance(profile.power) * 10) / 10
  const multiplier = winsMultiplier(profile, now)
  const wins = Math.max(1, Math.round(baseThrowWins(distance) * multiplier))
  profile.wins += wins
  profile.stats.throws += 1
  profile.stats.bestDistance = Math.max(profile.stats.bestDistance, distance)
  return {
    ok: true,
    distance,
    wins,
    multiplier,
    trophies: trophiesWithin(distance),
    duration: flightDuration(distance),
    cooldown: flightDuration(distance) + THROW_RECOVERY,
  }
}

// --- Planes ------------------------------------------------------------------------

export function buyPlane(profile, planeId) {
  const plane = PLANES.find((p) => p.id === planeId)
  if (!plane) return { ok: false, error: 'Unknown frisbee' }
  if (profile.ownedPlanes.includes(planeId)) return equipPlane(profile, planeId)
  const index = planeIndex(planeId)
  // Frisbees unlock in order, like the reference's shop.
  const previous = PLANES[index - 1]
  if (previous && !profile.ownedPlanes.includes(previous.id)) {
    return { ok: false, error: `Buy the ${previous.name} first!` }
  }
  if (profile.wins < plane.cost) return { ok: false, error: 'Not enough Wins!' }
  profile.wins -= plane.cost
  profile.ownedPlanes.push(planeId)
  profile.equippedPlane = planeId
  return { ok: true, bought: true, planeId }
}

export function equipPlane(profile, planeId) {
  if (!profile.ownedPlanes.includes(planeId)) return { ok: false, error: 'You don’t own that frisbee' }
  profile.equippedPlane = planeId
  return { ok: true, equipped: true, planeId }
}

// --- Pets --------------------------------------------------------------------------

function rollPet(eggId, rand) {
  const egg = EGGS[eggId]
  const total = egg.pets.reduce((sum, [, w]) => sum + w, 0)
  let r = rand() * total
  for (const [petId, weight] of egg.pets) {
    r -= weight
    if (r < 0) return petId
  }
  return egg.pets[egg.pets.length - 1][0]
}

export function addPet(profile, petId) {
  const pet = { uid: profile.nextPetUid++, id: petId }
  profile.pets.push(pet)
  // Auto-equip into a free slot, so a first pet does something straight away.
  if (profile.equippedPets.length < MAX_EQUIPPED_PETS) profile.equippedPets.push(pet.uid)
  return pet
}

/**
 * Hatches `count` eggs. `paid` says how: 'wins' charges the egg's Wins price, 'item'
 * consumes an egg item, 'free' is for premium/reward grants already paid for.
 */
export function hatchEgg(profile, eggId, count = 1, { paid = 'wins', rand = Math.random } = {}) {
  const egg = EGGS[eggId]
  if (!egg) return { ok: false, error: 'Unknown egg' }
  if (profile.pets.length + count > MAX_PET_INVENTORY) return { ok: false, error: 'Pet inventory full!' }
  if (paid === 'wins') {
    if (!egg.cost.wins) return { ok: false, error: 'This egg is premium only' }
    const price = egg.cost.wins * count
    if (profile.wins < price) return { ok: false, error: 'Not enough Wins!' }
    profile.wins -= price
  } else if (paid === 'item') {
    const itemId = Object.keys(ITEMS).find((k) => ITEMS[k].kind === 'egg' && ITEMS[k].egg === eggId)
    if (!itemId || (profile.items[itemId] || 0) < count) return { ok: false, error: 'No eggs left' }
    profile.items[itemId] -= count
  }
  const pets = []
  for (let i = 0; i < count; i += 1) pets.push(addPet(profile, rollPet(eggId, rand)))
  return { ok: true, eggId, pets }
}

export function equipPet(profile, uid) {
  if (!profile.pets.some((p) => p.uid === uid)) return { ok: false, error: 'Unknown pet' }
  if (profile.equippedPets.includes(uid)) return { ok: true }
  if (profile.equippedPets.length >= MAX_EQUIPPED_PETS) return { ok: false, error: `Max ${MAX_EQUIPPED_PETS} pets equipped` }
  profile.equippedPets.push(uid)
  return { ok: true }
}

export function unequipPet(profile, uid) {
  profile.equippedPets = profile.equippedPets.filter((u) => u !== uid)
  return { ok: true }
}

const petScore = (pet) => PETS[pet.id]?.mult ?? 0

export function equipBestPets(profile) {
  const best = [...profile.pets].sort((a, b) => petScore(b) - petScore(a)).slice(0, MAX_EQUIPPED_PETS)
  profile.equippedPets = best.map((p) => p.uid)
  return { ok: true }
}

export function deletePet(profile, uid) {
  const before = profile.pets.length
  profile.pets = profile.pets.filter((p) => p.uid !== uid)
  profile.equippedPets = profile.equippedPets.filter((u) => u !== uid)
  return { ok: profile.pets.length < before }
}

/** Sort key for inventory display: equipped first, then rarity, then multiplier. */
export function petSortKey(profile, pet) {
  const info = PETS[pet.id]
  const equipped = profile.equippedPets.includes(pet.uid) ? 1 : 0
  return equipped * 1e6 + (RARITIES[info.rarity]?.order ?? 0) * 1e4 + info.mult
}

// --- Items & boosts ---------------------------------------------------------------

export function addItem(profile, itemId, amount = 1) {
  profile.items[itemId] = (profile.items[itemId] || 0) + amount
}

export function usePotion(profile, itemId, now) {
  const item = ITEMS[itemId]
  if (!item || item.kind !== 'potion') return { ok: false, error: 'Not a potion' }
  if ((profile.items[itemId] || 0) <= 0) return { ok: false, error: 'None left' }
  profile.items[itemId] -= 1
  // Stacks: a second potion extends the timer instead of wasting it.
  profile.boosts[item.boost] = Math.max(profile.boosts[item.boost] || 0, now) + item.durationMs
  return { ok: true, boost: item.boost, endsAt: profile.boosts[item.boost] }
}

/** Applies a reward grant: { wins } | { item } | { pet } | { power } | { hatch }. */
export function applyGrant(profile, grant, { rand = Math.random } = {}) {
  const result = { ok: true }
  if (grant.wins) profile.wins += grant.wins
  if (grant.power) {
    profile.power += grant.power
    profile.stats.bestPower = Math.max(profile.stats.bestPower, profile.power)
  }
  if (grant.item) addItem(profile, grant.item, grant.amount || 1)
  if (grant.pet) result.pets = [addPet(profile, grant.pet)]
  if (grant.hatch) {
    const hatched = hatchEgg(profile, grant.hatch, 1, { paid: 'free', rand })
    if (!hatched.ok) return hatched
    result.pets = hatched.pets
    result.eggId = grant.hatch
  }
  return result
}

// --- Daily & playtime rewards -------------------------------------------------------

/**
 * State of each daily reward: 'claimed' | 'ready' | 'next' (with `unlocksIn` ms) |
 * 'locked'. A new 7-day cycle starts on first claim after the last one finishes.
 */
export function dailyStatus(profile, now) {
  const { start, claimed } = profile.daily
  const fresh = !start || claimed.length >= DAILY_REWARDS.length
  const cycleStart = fresh ? now : start
  let nextShown = false
  return DAILY_REWARDS.map((reward, day) => {
    if (!fresh && claimed.includes(day)) return { day, state: 'claimed' }
    const unlockAt = cycleStart + day * DAILY_INTERVAL_MS
    if (now >= unlockAt) return { day, state: 'ready' }
    if (!nextShown) {
      nextShown = true
      return { day, state: 'next', unlocksIn: unlockAt - now }
    }
    return { day, state: 'locked' }
  })
}

export function claimDaily(profile, day, now, opts) {
  const status = dailyStatus(profile, now)[day]
  if (!status || status.state !== 'ready') return { ok: false, error: 'Not ready yet' }
  if (!profile.daily.start || profile.daily.claimed.length >= DAILY_REWARDS.length) {
    profile.daily = { start: now, claimed: [] }
  }
  profile.daily.claimed.push(day)
  const result = applyGrant(profile, DAILY_REWARDS[day].grant, opts)
  return { ...result, day, label: DAILY_REWARDS[day].label }
}

export function playtimeStatus(session, now) {
  const minutes = (now - session.start) / 60000
  return PLAYTIME_REWARDS.map((reward, index) => {
    if (session.playtimeClaimed.includes(index)) return { index, state: 'claimed' }
    if (minutes >= reward.minutes) return { index, state: 'ready' }
    return { index, state: 'locked', unlocksIn: (reward.minutes - minutes) * 60000 }
  })
}

export function claimPlaytime(profile, session, index, now, opts) {
  const status = playtimeStatus(session, now)[index]
  if (!status || status.state !== 'ready') return { ok: false, error: 'Not ready yet' }
  session.playtimeClaimed.push(index)
  const result = applyGrant(profile, PLAYTIME_REWARDS[index].grant, opts)
  return { ...result, index, label: PLAYTIME_REWARDS[index].label }
}

export function claimFreeReward(profile, session, opts) {
  if (session.freeRewardTaken) return { ok: false, error: 'Already claimed this session' }
  session.freeRewardTaken = true
  const grant = profile.freeRewardClaimed ? FREE_REWARD.repeat : FREE_REWARD.firstTime
  profile.freeRewardClaimed = true
  return { ...applyGrant(profile, grant, opts), grant }
}

// --- Shop ---------------------------------------------------------------------------

/** Buys a SHOP item with Wins. */
export function buyShopItem(profile, productId, opts = {}) {
  const item = SHOP[productId]
  if (!item) return { ok: false, error: 'Unknown item' }
  if (item.kind === 'pass' && profile.passes[productId]) return { ok: false, error: 'Already owned' }
  if (profile.wins < item.price) return { ok: false, error: 'Not enough Wins!' }
  if (item.kind === 'pass') {
    profile.wins -= item.price
    profile.passes[productId] = true
    return { ok: true, productId, pass: true }
  }
  const result = applyGrant(profile, item.grant || {}, opts)
  if (result.ok) profile.wins -= item.price
  return { ...result, productId }
}

// --- Offline progress -------------------------------------------------------------

/** Power earned while away, if the player logged off in a lane. */
export function applyOfflineProgress(profile, now) {
  const away = Math.min(OFFLINE_MAX_MS, now - (profile.lastSeen || now))
  if (profile.lastLane < 0 || away < OFFLINE_MIN_MS) return null
  if (!isLaneUnlocked(profile, profile.lastLane)) return null
  const throws = Math.floor(away / 1000 / TRAIN_INTERVAL)
  // Potions don't run while you're away.
  const gain = trainGain(profile, profile.lastLane, 0)
  const power = Math.floor(throws * gain * OFFLINE_RATE)
  if (power <= 0) return null
  profile.power += power
  profile.stats.bestPower = Math.max(profile.stats.bestPower, profile.power)
  return { power, ms: away }
}

// --- Tutorial & badges ------------------------------------------------------------

/** Advances the tutorial if `event` completes the current step. */
export function advanceTutorial(profile, event) {
  const step = TUTORIAL[profile.tutorialStep]
  if (step && step.event === event) {
    profile.tutorialStep += 1
    return true
  }
  return false
}

/** Awards a badge once. Returns the badge if newly awarded. */
export function awardBadge(profile, id) {
  if (!BADGES[id] || profile.badges.includes(id)) return null
  profile.badges.push(id)
  return { id, ...BADGES[id] }
}
