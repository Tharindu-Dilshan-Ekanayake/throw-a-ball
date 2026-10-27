/**
 * Every tunable number in the game. Rules live in logic.js; this file is only data,
 * so balancing never means touching code.
 *
 * Shared by client (display) and server (authority): both always agree on costs and
 * multipliers because they read the same table.
 */

// --- Training ---------------------------------------------------------------------

/** Seconds between auto-throws while standing in a lane. */
export const TRAIN_INTERVAL = 0.6
/**
 * Click throws: anywhere in the lobby outside the throw area, each click throws the
 * frisbee from your hand for a x1 training throw. This is the fastest they count, in
 * seconds (about six a second).
 */
export const CLICK_INTERVAL = 0.16
/** Training throws per level. */
export const LEVEL_STEPS = 10
/** Each level adds this fraction to the frisbee's base power: gain x (1 + level x k). */
export const LEVEL_GAIN = 0.15

/**
 * Training lanes, west to east order matches world.js lane indices.
 * `rebirths` = rebirths needed; `product` = the SHOP item that unlocks it instead.
 */
export const LANES = [
  { id: 'target', name: 'Target', mult: 1, rebirths: 0 },
  { id: 'ring', name: 'Green Ring', mult: 2, rebirths: 1 },
  { id: 'star', name: 'Blue Star', mult: 3, rebirths: 3 },
  { id: 'diamond', name: 'Purple Diamond', mult: 5, rebirths: 6 },
  { id: 'wheel', name: 'Gold Wheel', mult: 8, rebirths: 9 },
  { id: 'hex', name: 'Lava Hex', mult: 12, rebirths: 12 },
  { id: 'crystal', name: 'Red Crystal', mult: 18, rebirths: 15 },
  { id: 'rainbow', name: 'Rainbow Ring', mult: 30, product: 'laneVeryOp', tag: 'VERY OP!' },
  { id: 'galaxy', name: 'Galaxy Portal', mult: 100, product: 'laneBestOverall', tag: 'BEST OVERALL!' },
]

// --- Rebirth ----------------------------------------------------------------------

/** Max level by rebirth count: R0 = 2, R1 = 15, R2 = 25, then +10 per rebirth. */
export function levelCap(rebirths) {
  if (rebirths <= 0) return 2
  if (rebirths === 1) return 15
  return 25 + (rebirths - 2) * 10
}

/** Power multiplier from rebirths: R0 = x1, R1 = x2, R2 = x3 ... */
export const rebirthMultiplier = (rebirths) => rebirths + 1

// --- Frisbees ---------------------------------------------------------------------

/**
 * The frisbees you throw. `power` is base power per training throw; `cost` is in Wins.
 *
 * The table (and the profile's `equippedPlane` / `ownedPlanes`) keep their original
 * plane names and ids, so saves from before the switch to frisbees still load.
 */
export const PLANES = [
  { id: 'paper', name: 'Classic Frisbee', power: 1, cost: 0 },
  { id: 'sky', name: 'Sky Disc', power: 2, cost: 3 },
  { id: 'newspaper', name: 'Sunny Disc', power: 5, cost: 28 },
  { id: 'cardboard', name: 'Pizza Disc', power: 11, cost: 110 },
  { id: 'racer', name: 'Racer Disc', power: 21, cost: 280 },
  { id: 'ocean', name: 'Wave Disc', power: 46, cost: 840 },
  { id: 'jungle', name: 'Jungle Disc', power: 98, cost: 2100 },
  { id: 'royal', name: 'Royal Disc', power: 210, cost: 5600 },
  { id: 'crystal', name: 'Crystal Disc', power: 490, cost: 14000 },
  { id: 'golden', name: 'Golden Disc', power: 1100, cost: 35000 },
  // The second stage: same curve, each about 2.5x the Wins for 2.2x the power.
  { id: 'candy', name: 'Candy Disc', power: 2400, cost: 90000 },
  { id: 'ice', name: 'Ice Disc', power: 5300, cost: 225000 },
  { id: 'lava', name: 'Lava Disc', power: 11500, cost: 560000 },
  { id: 'thunder', name: 'Thunder Disc', power: 25000, cost: 1400000 },
  { id: 'neon', name: 'Neon Disc', power: 55000, cost: 3500000 },
  { id: 'galaxy', name: 'Galaxy Disc', power: 120000, cost: 8800000 },
  { id: 'dragon', name: 'Dragon Disc', power: 260000, cost: 22000000 },
  { id: 'rainbow', name: 'Rainbow Disc', power: 570000, cost: 55000000 },
  { id: 'diamond', name: 'Diamond Disc', power: 1250000, cost: 140000000 },
  { id: 'cosmic', name: 'Cosmic Disc', power: 2750000, cost: 350000000 },
]

// --- Throwing ---------------------------------------------------------------------

/** distance (m) = base + k * sqrt(power). Tuned so 7.3K power flies ~460 m. */
export const DISTANCE_BASE = 10
export const DISTANCE_K = 5.27

/** Themed track segments. `start` in metres; later zones pay more Wins per metre. */
export const ZONES = [
  { id: 'neighbourhood', name: 'Neighbourhood', start: 0, winsPerMeter: 0.3 },
  { id: 'city', name: 'City', start: 150, winsPerMeter: 0.5 },
  { id: 'forest', name: 'Forest', start: 450, winsPerMeter: 0.8 },
  { id: 'desert', name: 'Desert', start: 900, winsPerMeter: 1.2 },
  { id: 'snow', name: 'Snow', start: 1500, winsPerMeter: 1.8 },
  { id: 'volcano', name: 'Volcano', start: 2400, winsPerMeter: 2.6 },
  { id: 'space', name: 'Space', start: 3600, winsPerMeter: 4 },
]

/** Trophy pickups along the track: first at 15 m, then every 30 m. */
export const TROPHY_FIRST = 15
export const TROPHY_SPACING = 30
/** A trophy is worth this many metres of its zone's Wins. */
export const TROPHY_METERS = 10

/** Seconds a throw of `distance` metres takes to watch. Logarithmic: long throws stay short. */
export const flightDuration = (distance) => 2.6 + 1.5 * Math.log(1 + distance / 40)
/** Landing + result popup after the flight, before the next throw is allowed. */
export const THROW_RECOVERY = 1.2

// --- Pets & eggs ------------------------------------------------------------------

export const RARITIES = {
  common: { name: 'Common', color: '#b9c3cf', order: 0 },
  uncommon: { name: 'Uncommon', color: '#4ade80', order: 1 },
  rare: { name: 'Rare', color: '#38bdf8', order: 2 },
  epic: { name: 'Epic', color: '#b15cff', order: 3 },
  legendary: { name: 'Legendary', color: '#ffc41f', order: 4 },
  mythic: { name: 'Mythic', color: '#ff3b6b', order: 5 },
  secret: { name: 'Secret', color: '#ff5bd8', order: 6 },
}

/** `mult` multiplies training power. Equipped pets stack additively (see logic.js). */
export const PETS = {
  cat: { name: 'Cat', rarity: 'common', mult: 1.2 },
  dog: { name: 'Dog', rarity: 'common', mult: 1.3 },
  bunny: { name: 'Bunny', rarity: 'uncommon', mult: 1.5 },
  bear: { name: 'Bear', rarity: 'rare', mult: 2 },
  cow: { name: 'Cow', rarity: 'uncommon', mult: 2.5 },
  parrot: { name: 'Parrot', rarity: 'rare', mult: 3 },
  fox: { name: 'Fox', rarity: 'epic', mult: 4 },
  tiger: { name: 'Tiger', rarity: 'legendary', mult: 6 },
  flamingo: { name: 'Flamingo', rarity: 'uncommon', mult: 8 },
  turtle: { name: 'Turtle', rarity: 'rare', mult: 10 },
  owl: { name: 'Owl', rarity: 'epic', mult: 14 },
  phoenix: { name: 'Phoenix', rarity: 'legendary', mult: 25 },
  pony: { name: 'Pony', rarity: 'rare', mult: 10 },
  unicorn: { name: 'Unicorn', rarity: 'epic', mult: 18 },
  pegasus: { name: 'Pegasus', rarity: 'legendary', mult: 30 },
  imp: { name: 'Imp', rarity: 'rare', mult: 20 },
  bat: { name: 'Bat', rarity: 'epic', mult: 30 },
  demon: { name: 'Demon', rarity: 'legendary', mult: 50 },
  hellhound: { name: 'Hellhound', rarity: 'mythic', mult: 80 },
  dragon: { name: 'Dragon', rarity: 'epic', mult: 6 },
  crab: { name: 'Lucky Crab', rarity: 'uncommon', mult: 1.5 },
  sphinx: { name: 'Sphinx', rarity: 'secret', mult: 150 },
}

/**
 * Eggs, bought with Wins. `pets` are [petId, weight] - weights are percentages and
 * sum to 100.
 */
export const EGGS = {
  basic: { name: 'Basic', cost: { wins: 25 }, pets: [['cat', 45], ['dog', 30], ['bunny', 20], ['bear', 5]] },
  meadow: { name: 'Meadow', cost: { wins: 350 }, pets: [['cow', 45], ['parrot', 30], ['fox', 20], ['tiger', 5]] },
  sunset: { name: 'Sunset', cost: { wins: 4000 }, pets: [['flamingo', 45], ['turtle', 30], ['owl', 20], ['phoenix', 5]] },
  unicorn: { name: 'Unicorn', cost: { wins: 25000 }, pets: [['pony', 50], ['unicorn', 35], ['pegasus', 15]] },
  demon: { name: 'Demon', cost: { wins: 60000 }, pets: [['imp', 50], ['bat', 30], ['demon', 15], ['hellhound', 5]] },
}

export const MAX_EQUIPPED_PETS = 3
export const MAX_PET_INVENTORY = 60
/** Multi-hatch opens this many at once, for that many times the cost. */
export const MULTI_HATCH = 3

// --- Items, boosts, rewards -------------------------------------------------------

export const POTION_DURATION_MS = 5 * 60 * 1000

export const ITEMS = {
  potionPower: { name: 'x2 Power Potion', kind: 'potion', boost: 'power', durationMs: POTION_DURATION_MS },
  potionWins: { name: 'x2 Wins Potion', kind: 'potion', boost: 'wins', durationMs: POTION_DURATION_MS },
  eggMeadow: { name: 'Meadow Egg', kind: 'egg', egg: 'meadow' },
  eggSunset: { name: 'Sunset Egg', kind: 'egg', egg: 'sunset' },
  eggUnicorn: { name: 'Unicorn Egg', kind: 'egg', egg: 'unicorn' },
  eggDemon: { name: 'Demon Egg', kind: 'egg', egg: 'demon' },
}


/** 7-day cycle; day N unlocks N x 24h after the cycle started. */
export const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000
export const DAILY_REWARDS = [
  { label: 'x2 Wins', icon: 'potionWins', sub: '5m', grant: { item: 'potionWins' } },
  { label: 'Dragon', icon: 'pet:dragon', sub: 'x1', grant: { pet: 'dragon' } },
  { label: 'x2 Power', icon: 'potionPower', sub: '5m', grant: { item: 'potionPower' } },
  { label: 'Unicorn Egg', icon: 'egg:unicorn', sub: 'x1', grant: { item: 'eggUnicorn' } },
  { label: 'x2 Power', icon: 'potionPower', sub: '5m', grant: { item: 'potionPower' } },
  { label: 'x2 Wins', icon: 'potionWins', sub: '5m', grant: { item: 'potionWins' } },
  { label: 'Demon Egg', icon: 'egg:demon', sub: 'x1', grant: { item: 'eggDemon' } },
]

/** Claimable once each per session, after this many minutes played. */
export const PLAYTIME_REWARDS = [
  { minutes: 5, label: '+50 Wins', icon: 'trophy', grant: { wins: 50 } },
  { minutes: 10, label: 'x2 Power', icon: 'potionPower', grant: { item: 'potionPower' } },
  { minutes: 15, label: 'Meadow Egg', icon: 'egg:meadow', grant: { item: 'eggMeadow' } },
  { minutes: 30, label: 'x2 Wins', icon: 'potionWins', grant: { item: 'potionWins' } },
  { minutes: 45, label: '+1K Wins', icon: 'trophy', grant: { wins: 1000 } },
  { minutes: 60, label: 'Sunset Egg', icon: 'egg:sunset', grant: { item: 'eggSunset' } },
]

/** The stand by spawn: a pet the first time, a potion on later sessions. */
export const FREE_REWARD = { firstTime: { pet: 'crab' }, repeat: { item: 'potionPower' } }

/** Offline training: a quarter of your lane's rate, for up to 8 hours away. */
export const OFFLINE_RATE = 0.25
export const OFFLINE_MAX_MS = 8 * 60 * 60 * 1000
export const OFFLINE_MIN_MS = 60 * 1000

/** Power needed to step through the World 2 portal. */
export const WORLD2_POWER = 2.5e6

// --- Premium ----------------------------------------------------------------------

/**
 * The shop. Wins are the game's only currency: everything here, like frisbees and
 * eggs, is bought with them. `pass` = permanent unlock; `consumable` = grants every
 * time. Power packs are priced at a few throws' Wins for a player at that power, so
 * they speed you up without replacing the training loop.
 */
export const SHOP = {
  power100k: { name: '+100K Power', price: 5000, kind: 'consumable', grant: { power: 1e5 } },
  power1m: { name: '+1M Power', price: 40000, kind: 'consumable', grant: { power: 1e6 } },
  power10m: { name: '+10M Power', price: 200000, kind: 'consumable', grant: { power: 1e7 } },
  laneVeryOp: { name: 'VERY OP! Lane', price: 150000, kind: 'pass' },
  laneBestOverall: { name: 'BEST OVERALL! Lane', price: 2000000, kind: 'pass' },
  sphinx: { name: 'Sphinx', price: 2500000, kind: 'consumable', grant: { pet: 'sphinx' }, stock: 1000 },
}

/** Sphinx stock shown before the server reports the live count. */
export const SPHINX_STOCK_DEFAULT = 954

// --- Tutorial & badges ------------------------------------------------------------

/** Each step completes when its event fires. */
export const TUTORIAL = [
  { text: 'Throw one time', event: 'throw', target: 'throw' },
  { text: 'Go to the FREE Training Area', event: 'train', target: 'lane0' },
  { text: 'Get your first Rebirth', event: 'rebirth', target: 'rebirth' },
  { text: 'Buy a better frisbee in the Shop', event: 'buyPlane', target: 'hangar' },
  { text: 'Hatch a pet from an egg', event: 'hatch', target: 'eggs' },
]

export const BADGES = {
  firstThrow: { name: 'First Throw' },
  firstRebirth: { name: 'First Rebirth' },
  firstPet: { name: 'Pet Owner' },
  kilometer: { name: 'Kilometre Club' },
  world2: { name: 'World Traveller' },
}
