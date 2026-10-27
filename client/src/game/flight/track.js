import { ZONES } from '@shared/balance'
import { zoneIndexAt } from '@shared/logic'
import { mulberry32 } from '@shared/rng'
import { THROW_LINE_Z } from '@shared/world'

import { BlockSet } from '../blocks'
import { STYLE } from '../materials'
import { addTree } from '../world/terrain'

/**
 * The throw track, generated in 60 m chunks on demand. Each chunk is a BlockSet (one
 * draw call); content is seeded by chunk index, so every client builds an identical
 * track and a chunk can be thrown away and rebuilt at will.
 *
 * Metre `m` sits at world z = THROW_LINE_Z - m: the front edge of the throw stage,
 * where the lobby's ground ends and the track's begins.
 */

export const CHUNK = 60
/** Where the lobby's own ground plane stops and track ground takes over. */
const LOBBY_GROUND_END = 0
/** No side scenery this close to the plaza (lanes, portal and hills live there). */
const DECOR_START = 20

export const zAt = (m) => THROW_LINE_Z - m

/** Per-zone look: ground, the strip down the middle, its kerbs, gate and sky colours. */
export const ZONE_THEMES = {
  neighbourhood: {
    ground: '#6fd44f',
    road: '#5fcb47',
    roadStyle: STYLE.STUDS,
    kerb: '#dcdcdc',
    roadHalf: 7,
    kerbHalf: 9,
    gate: '#3aa0ff',
    sky: ['#2f8ff2', '#a6d6fb'],
  },
  city: {
    ground: '#c2c6cc',
    road: '#2c3b58',
    roadStyle: STYLE.ROAD,
    kerb: '#d9d9d9',
    roadHalf: 10,
    kerbHalf: 13,
    gate: '#ff9a1f',
    sky: ['#3796f0', '#b9dcf7'],
  },
  forest: {
    ground: '#44b23a',
    road: '#b98a52',
    roadStyle: STYLE.STUDS,
    kerb: '#8a6236',
    roadHalf: 6,
    kerbHalf: 7,
    gate: '#2fbf3a',
    sky: ['#3f9ae6', '#bfe6c9'],
  },
  desert: {
    ground: '#f0cf86',
    road: '#d9ac64',
    roadStyle: STYLE.STUDS,
    kerb: '#c9965a',
    roadHalf: 7,
    kerbHalf: 8,
    gate: '#e0a43a',
    sky: ['#4aa6ee', '#f6dcaa'],
  },
  snow: {
    ground: '#f2f7ff',
    road: '#cfe3f5',
    roadStyle: STYLE.STUDS,
    kerb: '#a9cbe8',
    roadHalf: 7,
    kerbHalf: 8,
    gate: '#5cc8ff',
    sky: ['#7ab7ec', '#e8f3ff'],
  },
  volcano: {
    ground: '#3b3437',
    road: '#5a4943',
    roadStyle: STYLE.STUDS,
    kerb: '#ff6a14',
    roadHalf: 7,
    kerbHalf: 8,
    gate: '#ff4a1c',
    sky: ['#5a2a3a', '#d27a52'],
  },
  space: {
    ground: null,
    road: '#1b1f5c',
    roadStyle: STYLE.GALAXY,
    kerb: '#7a5cff',
    roadHalf: 8,
    kerbHalf: 9,
    gate: '#8a63ff',
    sky: ['#05051a', '#241544'],
    kerbStyle: STYLE.GLOW,
  },
}

export const themeAt = (m) => ZONE_THEMES[ZONES[zoneIndexAt(m)].id]

/** Gate arches: a welcome arch into the Neighbourhood, then one at each zone start. */
export const GATES = ZONES.map((zone, i) => ({ zone, meter: i === 0 ? 60 : zone.start }))

const pick = (rand, list) => list[Math.floor(rand() * list.length)]

// --- Props -----------------------------------------------------------------------

function house(b, x, z, rand, facing) {
  const w = 7 + rand() * 2
  const d = 7 + rand() * 2
  const h = 5 + rand() * 2
  b.addOn(x, 0, z, w, h, d, pick(rand, ['#f6d7a7', '#a9d8f5', '#f5b3b3', '#c9f0b0', '#e7d1ff', '#fff2a8']), STYLE.WINDOWS)
  const roof = pick(rand, ['#c0392b', '#7a4b2a', '#2f5aa8', '#4a4a4a'])
  for (let i = 0; i < 3; i += 1) {
    b.addOn(x, h + i * 0.9, z, w + 0.8 - i * 0.2, 0.9, d + 0.8 - i * (d / 3.2), roof)
  }
  b.addOn(x + facing * (w / 2 + 0.05), 0, z, 0.2, 2.4, 1.4, '#7a4b2a', STYLE.SMOOTH)
  b.addOn(x - 1.5, h + 1, z + d / 4, 0.9, 2.4, 0.9, '#8a5a3a')
}

function lampPost(b, x, z) {
  b.addOn(x, 0, z, 0.3, 5.4, 0.3, '#2b2d33', STYLE.SMOOTH)
  b.addOn(x, 5.4, z, 0.8, 0.6, 0.8, '#ffe45c', STYLE.GLOW)
  b.addOn(x, 6, z, 1, 0.2, 1, '#2b2d33', STYLE.SMOOTH)
}

function fence(b, x, z0, z1) {
  const len = Math.abs(z1 - z0)
  const zc = (z0 + z1) / 2
  b.addOn(x, 0.45, zc, 0.15, 0.2, len, '#ffffff', STYLE.SMOOTH)
  b.addOn(x, 0.95, zc, 0.15, 0.2, len, '#ffffff', STYLE.SMOOTH)
  for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z += 5) b.addOn(x, 0, z, 0.3, 1.3, 0.3, '#f2f2f2', STYLE.SMOOTH)
}

function school(b, side) {
  const x = side * 25
  const z = zAt(40)
  b.addOn(x, 0, z, 18, 11, 30, '#c95a4a', STYLE.WINDOWS)
  b.addOn(x, 11, z, 18.8, 0.8, 30.8, '#f2f2f2')
  // Clock tower.
  b.addOn(x - side * 2, 11.8, z + 11, 5, 7, 5, '#d36a56', STYLE.WINDOWS)
  b.addOn(x - side * 2, 18.8, z + 11, 5.6, 0.8, 5.6, '#f2f2f2')
  b.addOn(x - side * 2 - side * 2.55, 14, z + 11, 0.2, 2.6, 2.6, '#ffffff', STYLE.SMOOTH)
  b.addOn(x - side * 9.05, 6.5, z - 4, 0.2, 2, 6, '#2f6be0', STYLE.GLOW)
}

function court(b, side) {
  const x = side * 24
  const z = zAt(36)
  // Each layer stands a clear step on the one below, so none of the tops fight.
  b.addOn(x, 0, z, 16, 0.12, 24, '#2f7fe6')
  b.addOn(x, 0.12, z, 14, 0.08, 22, '#3a8ff0')
  b.addOn(x, 0.2, z, 14, 0.06, 0.25, '#ffffff', STYLE.SMOOTH)
  for (const dz of [-10.5, 10.5]) {
    b.addOn(x, 0, z + dz, 0.4, 4.2, 0.4, '#e8e8e8', STYLE.SMOOTH)
    b.addOn(x, 3.6, z + dz - Math.sign(dz) * 0.4, 2, 1.4, 0.2, '#ffffff', STYLE.SMOOTH)
  }
}

function building(b, x, z, rand) {
  const w = 10 + rand() * 6
  const d = 10 + rand() * 8
  const h = 14 + rand() * 22
  const color = pick(rand, ['#c9665a', '#e8c88a', '#e7a2a2', '#9fb7d6', '#d9b48f', '#b8c9a8'])
  b.addOn(x, 0, z, w, h, d, color, STYLE.WINDOWS)
  b.addOn(x, h, z, w + 0.6, 0.6, d + 0.6, '#eeeeee')
  if (rand() < 0.6) b.addOn(x + (rand() - 0.5) * w * 0.5, h + 0.6, z, 2.4, 1.4, 2, '#9aa3ad')
}

function car(b, x, z, rand) {
  const taxi = rand() < 0.3
  const color = taxi ? '#ffcf1f' : pick(rand, ['#ff4040', '#3a8ff0', '#ffffff', '#2fbf3a', '#9b4dff'])
  b.addOn(x, 0.35, z, 2.1, 0.95, 4.4, color, STYLE.SMOOTH)
  b.addOn(x, 1.3, z + 0.2, 1.9, 0.85, 2.3, color, STYLE.SMOOTH)
  b.addOn(x, 1.32, z + 0.2, 2.02, 0.6, 2.1, '#8fd3ff', STYLE.SMOOTH)
  for (const dx of [-0.95, 0.95]) for (const dz of [-1.4, 1.4]) b.addOn(x + dx, 0, z + dz, 0.4, 0.8, 0.8, '#1d1f24', STYLE.SMOOTH)
  if (taxi) b.addOn(x, 2.15, z + 0.2, 0.9, 0.35, 0.5, '#ffffff', STYLE.GLOW)
}

function pine(b, x, z, s, rand, snowy = false) {
  b.addOn(x, 0, z, 0.8 * s, 2.4 * s, 0.8 * s, '#6b3f22')
  const green = pick(rand, snowy ? ['#2d7a45', '#24683a'] : ['#2e8b3a', '#237a31', '#33994a'])
  let y = 1.8 * s
  for (const w of [5, 4, 3, 2]) {
    b.addOn(x, y, z, w * s, 1.5 * s, w * s, green)
    if (snowy) b.addOn(x, y + 1.5 * s, z, (w - 0.6) * s, 0.25 * s, (w - 0.6) * s, '#ffffff')
    y += 1.4 * s
  }
}

function rock(b, x, z, s, color) {
  b.addOn(x, -0.2, z, 2.4 * s, 1.6 * s, 2 * s, color, STYLE.STUDS, s * 0.7)
  b.addOn(x + 0.5 * s, 0.9 * s, z, 1.3 * s, 0.9 * s, 1.2 * s, color, STYLE.STUDS, s * 1.3)
}

function cactus(b, x, z, h, rand) {
  b.addOn(x, 0, z, 0.9, h, 0.9, '#3fa34d')
  const armY = h * (0.4 + rand() * 0.2)
  b.addOn(x + 0.9, armY, z, 1, 0.6, 0.6, '#3fa34d')
  b.addOn(x + 1.2, armY, z, 0.6, 1.8, 0.6, '#3fa34d')
  if (rand() < 0.6) {
    b.addOn(x - 0.9, armY + 0.8, z, 1, 0.6, 0.6, '#3fa34d')
    b.addOn(x - 1.2, armY + 0.8, z, 0.6, 1.4, 0.6, '#3fa34d')
  }
}

function pyramid(b, x, z, size) {
  for (let i = 0; i < 6; i += 1) {
    const w = size * (1 - i / 6)
    b.addOn(x, i * size * 0.14, z, w, size * 0.14, w, i % 2 ? '#e6be72' : '#dcb162')
  }
}

function palm(b, x, z, rand) {
  const h = 6 + rand() * 2
  b.addOn(x, 0, z, 0.7, h, 0.7, '#9b6a3a')
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + rand()
    b.add(x + Math.cos(a) * 1.6, h - 0.2, z + Math.sin(a) * 1.6, 3.6, 0.3, 1, '#2fae4a', STYLE.STUDS, -a, 0, -0.35)
  }
}

function snowman(b, x, z) {
  b.addOn(x, 0, z, 2.2, 2, 2.2, '#ffffff')
  b.addOn(x, 2, z, 1.6, 1.5, 1.6, '#ffffff')
  b.addOn(x, 3.5, z, 1.1, 1.1, 1.1, '#ffffff')
  b.addOn(x, 3.95, z + 0.75, 0.25, 0.25, 0.6, '#ff8a1e', STYLE.SMOOTH)
  b.addOn(x, 4.6, z, 1.3, 0.2, 1.3, '#1d1f24', STYLE.SMOOTH)
  b.addOn(x, 4.8, z, 0.8, 0.8, 0.8, '#1d1f24', STYLE.SMOOTH)
}

function iceCrystal(b, x, z, s) {
  b.add(x, 1.4 * s, z, 1 * s, 3.4 * s, 1 * s, '#9fdcff', STYLE.GLOW, 0.4, 0, 0.25)
  b.add(x + 0.8 * s, 0.9 * s, z, 0.7 * s, 2.2 * s, 0.7 * s, '#c9eeff', STYLE.GLOW, 1.1, 0, -0.35)
}

function volcano(b, x, z, size) {
  for (let i = 0; i < 6; i += 1) {
    const w = size * (1 - i / 7.5)
    b.addOn(x, i * size * 0.12, z, w, size * 0.12, w, i % 2 ? '#2f2a2d' : '#3a3337')
  }
  b.addOn(x, size * 0.72, z, size * 0.22, 0.4, size * 0.22, '#ff6a14', STYLE.LAVA)
}

function asteroid(b, x, y, z, s, rand) {
  b.add(x, y, z, 2.4 * s, 2 * s, 2.2 * s, pick(rand, ['#8a8a99', '#6f6f80', '#9a8f86']), STYLE.STUDS, rand() * 3, rand() * 3, rand() * 3)
}

function planet(b, x, y, z, r, color, ring) {
  b.add(x, y, z, r * 2, r * 1.4, r * 1.4, color, STYLE.GLOW)
  b.add(x, y, z, r * 1.4, r * 2, r * 1.4, color, STYLE.GLOW)
  b.add(x, y, z, r * 1.4, r * 1.4, r * 2, color, STYLE.GLOW)
  if (ring) b.add(x, y, z, r * 3.6, 0.3, r * 3.6, ring, STYLE.GLOW, 0.3, 0.2, 0)
}

// --- Gate --------------------------------------------------------------------------

function gate(b, meter, color) {
  const z = zAt(meter)
  for (const x of [-11.5, 11.5]) {
    b.addOn(x, 0, z, 2, 1, 2, '#e9eef5')
    b.addOn(x, 1, z, 1.6, 13, 1.6, color, STYLE.STRIPES)
  }
  b.addOn(0, 13.5, z, 25, 1.6, 1.6, color, STYLE.STRIPES)
  b.addOn(0, 11.6, z, 25, 0.4, 0.5, '#ffffff', STYLE.GLOW)
}

// --- Chunk builder -----------------------------------------------------------------

function sideItems(m0, m1, spacing, rand, density, place) {
  for (let m = m0 + spacing * rand(); m < m1; m += spacing * (0.8 + rand() * 0.6)) {
    if (m < DECOR_START) continue
    if (rand() > density) continue
    for (const side of [-1, 1]) if (rand() < 0.85) place(m, side)
  }
}

const DECOR = {
  neighbourhood(b, m0, m1, rand, density) {
    sideItems(m0, m1, 12, rand, 1, (m, side) => lampPost(b, side * 9.6, zAt(m)))
    const fenceFrom = Math.max(m0, DECOR_START)
    if (fenceFrom < m1) {
      fence(b, -10.6, zAt(fenceFrom), zAt(m1))
      fence(b, 10.6, zAt(fenceFrom), zAt(m1))
    }
    sideItems(m0, m1, 15, rand, density, (m, side) => {
      // The school and the basketball court own the first stretch.
      if (m < 62) return
      house(b, side * (19 + rand() * 6), zAt(m), rand, -side)
      if (rand() < 0.7) addTree(b, side * (13.5 + rand()), 0, zAt(m + 6), 0.8, rand)
    })
    // Woods beyond the houses, once clear of the lobby's hills.
    sideItems(m0, m1, 9, rand, density, (m, side) => {
      if (m > 125) addTree(b, side * (34 + rand() * 30), 0, zAt(m), 0.9 + rand() * 0.4, rand)
    })
    if (m0 === 0) {
      school(b, -1)
      court(b, 1)
    }
  },
  city(b, m0, m1, rand, density) {
    // Lane markings: dashes either side, double yellow down the middle. Painted a clear
    // 5 cm proud of the road (its top is at 0.05) so they don't flicker into it.
    for (let m = m0; m < m1; m += 7) {
      for (const x of [-5, 5]) b.addOn(x, 0.05, zAt(m), 0.35, 0.05, 3, '#ffffff', STYLE.SMOOTH)
    }
    for (const x of [-0.35, 0.35]) b.addOn(x, 0.05, zAt((m0 + m1) / 2), 0.25, 0.05, m1 - m0, '#ffd21f', STYLE.SMOOTH)
    sideItems(m0, m1, 15, rand, Math.max(0.6, density), (m, side) => building(b, side * (22 + rand() * 4), zAt(m), rand))
    sideItems(m0, m1, 18, rand, density, (m, side) => car(b, side * 7.6, zAt(m), rand))
    sideItems(m0, m1, 14, rand, density, (m, side) => addTree(b, side * 11.6, 0, zAt(m), 0.55, rand))
    sideItems(m0, m1, 26, rand, density, (m, side) => building(b, side * (44 + rand() * 20), zAt(m), rand))
  },
  forest(b, m0, m1, rand, density) {
    sideItems(m0, m1, 5, rand, density, (m, side) => pine(b, side * (10 + rand() * 40), zAt(m), 0.8 + rand() * 0.6, rand))
    sideItems(m0, m1, 22, rand, density, (m, side) => rock(b, side * (9 + rand() * 6), zAt(m), 0.6 + rand() * 0.5, '#8d9399'))
    sideItems(m0, m1, 30, rand, density, (m, side) => b.addOn(side * (12 + rand() * 4), 0, zAt(m), 5, 0.9, 0.9, '#7c4d29', STYLE.STUDS, rand()))
  },
  desert(b, m0, m1, rand, density) {
    sideItems(m0, m1, 9, rand, density, (m, side) => cactus(b, side * (10 + rand() * 25), zAt(m), 3 + rand() * 3, rand))
    sideItems(m0, m1, 40, rand, density, (m, side) => pyramid(b, side * (55 + rand() * 30), zAt(m), 18 + rand() * 14))
    sideItems(m0, m1, 16, rand, density, (m, side) => rock(b, side * (12 + rand() * 20), zAt(m), 0.7 + rand() * 0.6, '#c98d4f'))
    sideItems(m0, m1, 24, rand, density, (m, side) => palm(b, side * (11 + rand() * 4), zAt(m), rand))
  },
  snow(b, m0, m1, rand, density) {
    sideItems(m0, m1, 6, rand, density, (m, side) => pine(b, side * (10 + rand() * 40), zAt(m), 0.8 + rand() * 0.6, rand, true))
    sideItems(m0, m1, 24, rand, density, (m, side) => snowman(b, side * (11 + rand() * 6), zAt(m)))
    sideItems(m0, m1, 18, rand, density, (m, side) => iceCrystal(b, side * (14 + rand() * 20), zAt(m), 0.8 + rand() * 0.7))
  },
  volcano(b, m0, m1, rand, density) {
    // Lava rivers flanking the path.
    for (const side of [-1, 1]) b.addOn(side * 16, -0.3, zAt((m0 + m1) / 2), 6, 0.36, m1 - m0, '#ff6a14', STYLE.LAVA)
    sideItems(m0, m1, 40, rand, density, (m, side) => volcano(b, side * (50 + rand() * 30), zAt(m), 22 + rand() * 12))
    sideItems(m0, m1, 10, rand, density, (m, side) => rock(b, side * (21 + rand() * 20), zAt(m), 0.8 + rand() * 0.8, '#2a2427'))
  },
  space(b, m0, m1, rand, density) {
    sideItems(m0, m1, 8, rand, density, (m, side) => asteroid(b, side * (12 + rand() * 40), -6 + rand() * 24, zAt(m), 0.6 + rand() * 1.2, rand))
    if (rand() < 0.5 * density) {
      planet(b, (rand() < 0.5 ? -1 : 1) * (60 + rand() * 40), 20 + rand() * 30, zAt(m0 + rand() * CHUNK), 6 + rand() * 6, pick(rand, ['#ff7ad9', '#7fe2ff', '#ffb14a', '#9b6bff']), rand() < 0.5 ? '#ffe45c' : null)
    }
  },
}

/**
 * Builds chunk `index` (metres [index*CHUNK, (index+1)*CHUNK)).
 * @param {{ density?: number }} options 0-1 scenery density (quality and speed)
 */
export function buildChunk(index, { density = 1 } = {}) {
  const b = new BlockSet()
  const rand = mulberry32(index * 7919 + 13)
  const m0 = index * CHUNK
  const m1 = m0 + CHUNK

  // Split the chunk at zone boundaries so each part gets its own floor and scenery.
  const cuts = [m0]
  for (const zone of ZONES) if (zone.start > m0 && zone.start < m1) cuts.push(zone.start)
  cuts.push(m1)

  for (let i = 0; i < cuts.length - 1; i += 1) {
    const a = cuts[i]
    const c = cuts[i + 1]
    const theme = themeAt(a)
    const zone = ZONES[zoneIndexAt(a)]
    const groundFrom = Math.max(a, LOBBY_GROUND_END)
    const mid = (groundFrom + c) / 2
    const len = c - groundFrom
    if (len > 0) {
      if (theme.ground) b.addOn(0, -1, zAt(mid), 340, 1, len, theme.ground)
      // The road, with a raised kerb strip either side of it.
      b.addOn(0, -0.2, zAt(mid), theme.roadHalf * 2, 0.25, len, theme.road, theme.roadStyle)
      const kerbWidth = theme.kerbHalf - theme.roadHalf
      for (const side of [-1, 1]) {
        const x = side * (theme.roadHalf + kerbWidth / 2)
        b.addOn(x, -0.2, zAt(mid), kerbWidth, 0.32, len, theme.kerb, theme.kerbStyle ?? STYLE.STUDS)
      }
      // Space has no ground, so give the road a visible underside.
      if (!theme.ground) b.addOn(0, -3, zAt(mid), theme.kerbHalf * 2, 2.8, len, '#2a2f6a')
    }
    DECOR[zone.id](b, a, c, rand, density)
  }

  for (const g of GATES) {
    if (g.meter >= m0 && g.meter < m1) gate(b, g.meter, ZONE_THEMES[g.zone.id].gate)
  }
  return b
}
