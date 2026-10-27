import assert from 'node:assert/strict'
import { test } from 'node:test'

import { EGGS, levelCap, PLANES, SHOP, TUTORIAL } from '../../shared/balance.js'
import { formatNumber } from '../../shared/format.js'
import {
  applyRebirth,
  applyThrow,
  applyTrain,
  buyPlane,
  createProfile,
  dailyStatus,
  hatchEgg,
  normalizeProfile,
  throwDistance,
} from '../../shared/logic.js'
import { PlayerSession } from '../../shared/session.js'
import { LANE_FAR_X, LANE_NEAR_X, laneCenterZ, PLANE_PADS } from '../../shared/world.js'

test('numbers format like the HUD', () => {
  assert.deepEqual(
    [0, 999, 1000, 1234, 7300, 14000, 2.5e6, 9999].map(formatNumber),
    ['0', '999', '1K', '1.2K', '7.3K', '14K', '2.5M', '9.9K'],
  )
})

test('level caps follow R0=2, R1=15, R2=25, +10 after', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(levelCap), [2, 15, 25, 35, 45])
})

test('7.3K power throws about 450 m', () => {
  const d = throwDistance(7300)
  assert.ok(d > 430 && d < 480, `got ${d}`)
})

test('training levels up every 10 throws and stops at the cap', () => {
  const p = createProfile('a', 'A')
  for (let i = 0; i < 30; i += 1) applyTrain(p, 0, 0)
  assert.equal(p.level, 2)
  assert.equal(p.power, 30, 'classic frisbee in the free lane: +1 per throw at levels 1-2')
})

test('rebirth needs max level, resets power, keeps wins and planes', () => {
  const p = createProfile('a', 'A')
  assert.equal(applyRebirth(p).ok, false)
  for (let i = 0; i < 10; i += 1) applyTrain(p, 0, 0)
  p.wins = 50
  assert.equal(applyRebirth(p).ok, true)
  assert.equal(p.rebirths, 1)
  assert.equal(p.power, 0)
  assert.equal(p.wins, 50)
})

test('locked lanes give nothing', () => {
  const p = createProfile('a', 'A')
  assert.equal(applyTrain(p, 1, 0).ok, false)
  assert.equal(p.power, 0)
})

test('planes are bought in order with wins', () => {
  const p = createProfile('a', 'A')
  p.wins = 1000
  assert.equal(buyPlane(p, PLANES[3].id).ok, false)
  assert.equal(buyPlane(p, PLANES[1].id).ok, true)
  assert.equal(p.wins, 1000 - PLANES[1].cost)
  assert.equal(p.equippedPlane, PLANES[1].id)
})

test('egg odds add up to 100% and hatching charges wins', () => {
  for (const [id, egg] of Object.entries(EGGS)) {
    assert.equal(egg.pets.reduce((s, [, w]) => s + w, 0), 100, id)
  }
  const p = createProfile('a', 'A')
  p.wins = 25
  const r = hatchEgg(p, 'basic', 1, { rand: () => 0 })
  assert.equal(r.ok, true)
  assert.equal(p.wins, 0)
  assert.equal(p.pets[0].id, 'cat')
  assert.deepEqual(p.equippedPets, [p.pets[0].uid])
})

test('throws pay wins and never consume power', () => {
  const p = createProfile('a', 'A')
  p.power = 7300
  const r = applyThrow(p, 0)
  assert.equal(p.power, 7300)
  assert.ok(r.wins > 0 && p.wins === r.wins)
})

test('daily rewards unlock one per day', () => {
  const p = createProfile('a', 'A')
  const states = dailyStatus(p, 0).map((d) => d.state)
  assert.deepEqual(states.slice(0, 3), ['ready', 'next', 'locked'])
})

test('corrupt or old saves load safely', () => {
  const p = normalizeProfile({ pets: [{ uid: 1, id: 'nope' }], equippedPets: [1], ownedPlanes: [] }, 'x', 'X')
  assert.deepEqual(p.pets, [])
  assert.deepEqual(p.equippedPets, [])
  assert.deepEqual(p.ownedPlanes, ['paper'])
})

test('the session only trains where the player really stands', () => {
  const events = []
  const pos = { x: 0, y: 0, z: 0 }
  const s = new PlayerSession(createProfile('a', 'A'), { now: 0, emit: (t) => events.push(t), getPosition: () => pos })
  s.handle('enterLane', { lane: 0 }, 0)
  s.tick(2, 0)
  assert.equal(s.profile.power, 0, 'claimed a lane from spawn')
  Object.assign(pos, { x: (LANE_NEAR_X + LANE_FAR_X) / 2, z: laneCenterZ(0) })
  s.tick(2, 0)
  assert.ok(s.profile.power > 0)
})

test('planes can only be bought standing on their pad', () => {
  const pos = { x: 0, y: 0, z: 0 }
  const p = createProfile('a', 'A')
  p.wins = 100
  const s = new PlayerSession(p, { now: 0, emit: () => {}, getPosition: () => pos })
  s.handle('buyPlane', { id: 'sky' }, 0)
  assert.equal(p.ownedPlanes.length, 1)
  Object.assign(pos, { x: PLANE_PADS[1].x, z: PLANE_PADS[1].z })
  s.handle('buyPlane', { id: 'sky' }, 0)
  assert.equal(p.ownedPlanes.length, 2)
})

test('click throws train at x1, rate limited and not in the throw area', () => {
  const p = createProfile('a', 'A')
  const pos = { x: 0, z: 14 }
  const s = new PlayerSession(p, { now: 0, emit: () => {}, getPosition: () => pos })
  s.handle('click', {}, 1000)
  assert.equal(p.power, 1)
  assert.equal(p.levelProgress, 1)
  s.handle('click', {}, 1050)
  assert.equal(p.power, 1)
  s.handle('click', {}, 1200)
  assert.equal(p.power, 2)
  Object.assign(pos, { x: 0, z: -33 })
  s.handle('click', {}, 2000)
  assert.equal(p.power, 2)
})

test('only brand-new players get the tutorial', () => {
  const fresh = normalizeProfile({ rebirths: 0, tutorialStep: 1 }, 'a', 'A')
  assert.equal(fresh.tutorialStep, 1)
  const reborn = normalizeProfile({ rebirths: 1, level: 0, tutorialStep: 1 }, 'b', 'B')
  assert.equal(reborn.tutorialStep, TUTORIAL.length)
})

test('the shop sells for Wins only', () => {
  const p = createProfile('a', 'A')
  const s = new PlayerSession(p, { now: 0, emit: () => {}, getPosition: () => ({ x: 0, z: 0 }) })
  s.handle('purchase', { productId: 'power100k' }, 0)
  assert.equal(p.power, 0)
  p.wins = SHOP.power100k.price + 7
  s.handle('purchase', { productId: 'power100k' }, 0)
  assert.equal(p.power, 1e5)
  assert.equal(p.wins, 7)
  p.wins = SHOP.laneVeryOp.price
  s.handle('purchase', { productId: 'laneVeryOp' }, 0)
  assert.equal(p.passes.laneVeryOp, true)
  assert.equal(p.wins, 0)
})
