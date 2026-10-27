import { EGGS, LANES, PETS, PLANES, SHOP, WORLD2_POWER } from '@shared/balance'
import { formatNumber } from '@shared/format'
import {
  EGG_STANDS,
  FREE_REWARD,
  LANE_TARGET_X,
  laneCenterZ,
  PLANE_PADS,
  PORTAL,
  SPHINX_STAND,
} from '@shared/world'

import { eggHeight } from '../world/eggs'
import { LANE_THEMES } from '../world/structures'

/**
 * Text styles, as gradients top-to-bottom, matching the reference signage.
 */
export const TEXT = {
  gold: ['#fffaa8', '#ffd52a', '#ff9c00'],
  green: ['#e6ffb0', '#8dff4f', '#2fd12f'],
  price: ['#d9ff9a', '#7dff4a', '#2fd12f'],
  white: ['#ffffff', '#ffffff', '#dfe7f0'],
  red: ['#ffb0a8', '#ff4a3b', '#d4142a'],
  blue: ['#e0faff', '#7fe2ff', '#2fa8ff'],
}

const tint = (hex) => ['#ffffff', hex, hex]

/** "FREE / x1 Power", "1 Rebirth / x2 Power", "VERY OP! / 45 / x30 Power"... */
export function laneLabelSpec(index) {
  const lane = LANES[index]
  const theme = LANE_THEMES[index]
  const lines = []
  if (lane.product) {
    lines.push({ text: lane.tag, size: 50, rainbow: true })
    lines.push({ text: `${formatNumber(SHOP[lane.product].price)} Wins`, size: 44, icon: 'trophy', gradient: TEXT.gold })
  } else if (lane.rebirths === 0) {
    lines.push({ text: 'FREE', size: 50, gradient: TEXT.green })
  } else {
    const word = lane.rebirths === 1 ? 'Rebirth' : 'Rebirths'
    lines.push({ text: `${lane.rebirths} ${word}`, size: 46, icon: 'rebirth', gradient: tint(theme.text) })
  }
  lines.push({ text: `x${lane.mult} Power`, size: 50, icon: 'muscle', gradient: TEXT.gold })
  return { lines, pxPerUnit: 50 }
}

export function laneLabels() {
  return LANES.map((lane, i) => ({
    id: `lane-${i}`,
    position: [LANE_TARGET_X, lane.product ? 7.9 : 7.0, laneCenterZ(i)],
    spec: laneLabelSpec(i),
    fade: 150,
  }))
}

/** Ownership state of each shop pad: 'equipped' | 'owned' | 'buy' | 'locked'. */
export function padState(profile, index) {
  const plane = PLANES[index]
  if (profile.equippedPlane === plane.id) return 'equipped'
  if (profile.ownedPlanes.includes(plane.id)) return 'owned'
  const previous = PLANES[index - 1]
  return !previous || profile.ownedPlanes.includes(previous.id) ? 'buy' : 'locked'
}

/** "+5 / Power" over "28 Wins", "OWNED" or "EQUIPPED". */
export function padLabelSpec(index, state) {
  const plane = PLANES[index]
  const status =
    state === 'equipped'
      ? { text: 'EQUIPPED', size: 40, gradient: TEXT.gold }
      : state === 'owned'
        ? { text: 'OWNED', size: 40, gradient: TEXT.green }
        : { text: `${formatNumber(plane.cost)} Wins`, size: 40, icon: 'trophy', gradient: state === 'locked' ? TEXT.red : TEXT.gold }
  return {
    lines: [{ text: `+${formatNumber(plane.power)} / Power`, size: 38, icon: 'frisbee', fill: '#ffffff' }, status],
    pxPerUnit: 70,
  }
}

/** Largest a pad label can get, so its atlas slot fits every state. */
const padReserve = (index) => ({
  lines: [
    { text: `+${formatNumber(PLANES[index].power)} / Power`, size: 38, icon: 'frisbee' },
    { text: `${formatNumber(PLANES[index].cost)} Wins`, size: 40, icon: 'trophy' },
  ],
})

export function padLabels(profile) {
  return PLANE_PADS.map((pad) => ({
    id: `pad-${pad.index}`,
    // Each row back rides higher, so they clear the rows in front seen from the plaza.
    position: [pad.x, pad.y + 5.6 + pad.row * 1.25, pad.z],
    spec: padLabelSpec(pad.index, padState(profile, pad.index)),
    reserve: padReserve(pad.index),
    fade: 70,
  }))
}

export function eggLabels() {
  return EGG_STANDS.map((stand) => {
    const egg = EGGS[stand.eggId]
    const lines = stand.big
      ? [
          { text: 'Demon Egg', size: 54, gradient: TEXT.red },
          { text: `${formatNumber(egg.cost.wins)} Wins`, size: 46, icon: 'trophy', gradient: TEXT.gold },
        ]
      : [
          { text: egg.name, size: 50, fill: '#ffffff' },
          { text: `${formatNumber(egg.cost.wins)} Wins`, size: 44, icon: 'trophy', gradient: TEXT.gold },
        ]
    return {
      id: `egg-${stand.eggId}`,
      position: [stand.x, eggHeight(stand) + (stand.big ? 4 : 2.5), stand.z],
      spec: { lines, pxPerUnit: 62 },
      fade: 100,
    }
  })
}

/** The limited Sphinx showcase: price, hype, and live stock. */
export function sphinxLabelSpec(stock) {
  const mult = PETS.sphinx.mult
  return {
    lines: [
      { text: `${formatNumber(SHOP.sphinx.price)} Wins`, size: 46, icon: 'trophy', gradient: TEXT.gold },
      { text: 'BEST IN GAME', size: 56, gradient: TEXT.red },
      { text: 'Sphinx', size: 76, fill: '#ffffff' },
      { text: `${formatNumber(mult * 100 - 100)}% BETTER`, size: 54, rainbow: true },
      { text: `${formatNumber(stock)} Left`, size: 50, gradient: TEXT.green },
    ],
    pxPerUnit: 48,
  }
}

export function sphinxLabel(stock) {
  return {
    id: 'sphinx',
    position: [SPHINX_STAND.x, 11.5, SPHINX_STAND.z],
    spec: sphinxLabelSpec(stock),
    reserve: sphinxLabelSpec(88888),
    fade: 140,
  }
}

const freeRewardLabel = () => ({
  id: 'free-reward',
  position: [FREE_REWARD.x, 4.6, FREE_REWARD.z],
  spec: { lines: [{ text: 'FREE REWARD', size: 50, gradient: ['#fff2b0', '#ffb347', '#ff6a1e'] }], pxPerUnit: 60 },
  fade: 90,
})

const portalLabel = () => ({
  id: 'portal',
  position: [PORTAL.x, PORTAL.radius * 2 + 2.8, PORTAL.z],
  spec: {
    lines: [
      { text: 'World 2', size: 58, gradient: TEXT.blue },
      { text: `Needs ${formatNumber(WORLD2_POWER)} Power`, size: 42, icon: 'muscle', gradient: TEXT.gold },
    ],
    pxPerUnit: 56,
  },
  fade: 140,
})

/** Every label in the lobby. */
export function lobbyLabels(profile, { sphinxStock = 0 } = {}) {
  return [...laneLabels(), ...padLabels(profile), ...eggLabels(), sphinxLabel(sphinxStock), freeRewardLabel(), portalLabel()]
}
