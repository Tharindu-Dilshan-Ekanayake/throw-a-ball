import { RELEASE_DELAY } from '../game/playerPose'
import { createMusic } from './music'

/**
 * Sound effects and the background music, synthesised with WebAudio: no audio files
 * to download.
 *
 * Browsers only allow audio after a user gesture, so the AudioContext is created on
 * the first tap/click/key (which also starts the music) and every sound before that is
 * silently skipped.
 */

const MUTE_KEY = 'pp.muted'

let ctx = null
let master = null
let noiseBuffer = null
let brownBuffer = null
let reverb = null
let music = null
let muted = readMuted()
const lastPlayed = new Map()
const muteListeners = new Set()

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

function unlock() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume()
    return
  }
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return
  ctx = new Ctor()
  master = ctx.createGain()
  master.gain.value = muted ? 0 : 0.5
  master.connect(ctx.destination)
  // One second of white noise, reused by every whoosh and crack.
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1
  brownBuffer = makeBrownNoise(ctx)
  reverb = makeReverb(ctx, master)
  music = createMusic(ctx, master, noiseBuffer)
  music.start()
}

/** Three seconds of looping brown noise (the deep rumble of moving air), crossfaded so the loop point doesn't click. */
function makeBrownNoise(audio) {
  const length = audio.sampleRate * 3
  const fade = Math.floor(audio.sampleRate * 0.15)
  const raw = new Float32Array(length + fade)
  let last = 0
  for (let i = 0; i < raw.length; i += 1) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
    raw[i] = last * 3.5
  }
  for (let i = 0; i < fade; i += 1) raw[i] = raw[i] * (i / fade) + raw[length + i] * (1 - i / fade)
  const buffer = audio.createBuffer(1, length, audio.sampleRate)
  buffer.getChannelData(0).set(raw.subarray(0, length))
  return buffer
}

/** A small, bright room: decaying noise as an impulse response, so chimes and thuds sit in space instead of sounding dry. */
function makeReverb(audio, destination) {
  const seconds = 1.6
  const length = Math.floor(audio.sampleRate * seconds)
  const impulse = audio.createBuffer(2, length, audio.sampleRate)
  for (let c = 0; c < 2; c += 1) {
    const data = impulse.getChannelData(c)
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6)
  }
  const convolver = audio.createConvolver()
  convolver.buffer = impulse
  const wet = audio.createGain()
  wet.gain.value = 0.55
  convolver.connect(wet).connect(destination)
  return convolver
}

/** Connects a node to the output, and to the reverb in proportion to `wet` (0-1). */
function route(node, wet = 0) {
  node.connect(master)
  if (wet > 0 && reverb) {
    const send = ctx.createGain()
    send.gain.value = wet
    node.connect(send).connect(reverb)
  }
}

/** Installs the first-gesture unlock. Call once at startup. */
export function installAudioUnlock() {
  const events = ['pointerdown', 'keydown', 'touchend']
  const handler = () => {
    unlock()
    for (const e of events) window.removeEventListener(e, handler, true)
  }
  for (const e of events) window.addEventListener(e, handler, true)
  // Mobile browsers suspend audio in the background; resume on return.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx?.state === 'suspended') ctx.resume()
  })
}

export function isMuted() {
  return muted
}

export function setMuted(value) {
  muted = value
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    // Not persisted; fine.
  }
  if (master) master.gain.value = muted ? 0 : 0.5
  for (const listener of muteListeners) listener(muted)
}

/** Calls `listener(muted)` on every change; returns the unsubscribe. */
export function onMutedChange(listener) {
  muteListeners.add(listener)
  return () => muteListeners.delete(listener)
}

// --- Wind: the rush of air while a softball flies -----------------------------------

let wind = null
let windSetAt = 0

/**
 * A soft, rounded wind that is easy to listen to for a long flight: a deep rumble
 * (brown noise, low-passed), a warm body of mid-range air and a faint breath above it,
 * the whole thing rolled off above ~2.4 kHz so there is no hiss or whistle, with slow
 * gusts swelling and falling through it. `windSet(level)` (0..1, from the softball's
 * speed) opens it up; the music ducks under it until `windStop`.
 */
function windStart() {
  if (!ctx || wind || ctx.state !== 'running') return
  const stoppable = []
  const layer = (buffer, type, frequency, q, offset) => {
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = frequency
    filter.Q.value = q
    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    src.connect(filter).connect(gain)
    src.start(0, offset)
    stoppable.push(src)
    return { filter, gain }
  }
  const rumble = layer(brownBuffer, 'lowpass', 200, 0.4, 0)
  const body = layer(brownBuffer, 'bandpass', 420, 0.5, 1.1)
  const air = layer(noiseBuffer, 'bandpass', 1300, 0.35, 0.57)

  // Gusts: slow swells on everything.
  const gust = ctx.createGain()
  gust.gain.value = 0.8
  const gustLfo = ctx.createOscillator()
  gustLfo.frequency.value = 0.3
  const gustDepth = ctx.createGain()
  gustDepth.gain.value = 0.28
  gustLfo.connect(gustDepth).connect(gust.gain)
  gustLfo.start()
  stoppable.push(gustLfo)

  // A gentle roll-off over everything: nothing harsh gets through.
  const soften = ctx.createBiquadFilter()
  soften.type = 'lowpass'
  soften.frequency.value = 2400
  soften.Q.value = 0.3
  const level = ctx.createGain()
  level.gain.value = 0.0001
  for (const l of [rumble, body, air]) l.gain.connect(gust)
  gust.connect(soften).connect(level)
  route(level, 0.1)
  wind = { stoppable, level, rumble, body, air }
  music?.duck(true)
}

function windSet(amount) {
  if (!wind) return
  // Ten updates a second is plenty for a smooth swell.
  const now = performance.now()
  if (now - windSetAt < 100) return
  windSetAt = now
  const t = ctx.currentTime
  const l = Math.min(1, Math.max(0, amount))
  const { level, rumble, body, air } = wind
  level.gain.setTargetAtTime(0.06 + l * 0.26, t, 0.3)
  rumble.gain.gain.setTargetAtTime(0.9, t, 0.3)
  body.gain.gain.setTargetAtTime(0.35 + l * 0.55, t, 0.3)
  body.filter.frequency.setTargetAtTime(320 + l * 700, t, 0.35)
  air.gain.gain.setTargetAtTime(0.05 + l * 0.3, t, 0.3)
  air.filter.frequency.setTargetAtTime(1000 + l * 900, t, 0.35)
}

function windStop() {
  if (!wind) return
  const { stoppable, level } = wind
  wind = null
  level.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25)
  for (const node of stoppable) node.stop(ctx.currentTime + 1.5)
  music?.duck(false)
}

function ready(name, minGapMs = 0) {
  if (!ctx || muted || ctx.state !== 'running') return false
  const now = performance.now()
  if (minGapMs && now - (lastPlayed.get(name) || 0) < minGapMs) return false
  lastPlayed.set(name, now)
  return true
}

/** A short enveloped oscillator note. */
function tone(freq, { type = 'sine', at = 0, duration = 0.12, volume = 0.3, slideTo = null, wet = 0 } = {}) {
  const t = ctx.currentTime + at
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  route(osc.connect(gain), wet)
  osc.start(t)
  osc.stop(t + duration + 0.02)
}

/** Filtered noise: whooshes and cracks. */
function noise({ at = 0, duration = 0.3, volume = 0.25, from = 400, to = 2400, q = 1.2, type = 'bandpass', wet = 0 } = {}) {
  const t = ctx.currentTime + at
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.Q.value = q
  filter.frequency.setValueAtTime(from, t)
  filter.frequency.exponentialRampToValueAtTime(to, t + duration)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + duration * 0.3)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  route(src.connect(filter).connect(gain), wet)
  src.start(t, Math.random() * 0.5)
  src.stop(t + duration + 0.02)
}

/** A struck bell: a fundamental with two ringing overtones, a soft attack and a long tail. */
function bell(freq, { at = 0, duration = 0.9, volume = 0.12, wet = 0.4 } = {}) {
  tone(freq, { type: 'sine', at, duration, volume, wet })
  tone(freq * 2.01, { type: 'sine', at, duration: duration * 0.6, volume: volume * 0.35, wet })
  tone(freq * 3.97, { type: 'sine', at, duration: duration * 0.3, volume: volume * 0.14, wet })
}

/** A coin clink: a bright ping with a tiny metallic scrape. */
function coin(at = 0, pitch = 1) {
  tone(3136 * pitch, { type: 'sine', at, duration: 0.16, volume: 0.07, wet: 0.35 })
  tone(4699 * pitch, { type: 'sine', at, duration: 0.09, volume: 0.04, wet: 0.35 })
  noise({ at, duration: 0.03, volume: 0.05, from: 7000, to: 5000, q: 2, type: 'highpass' })
}

/** The snap of a ball leaving the fingers. */
function releaseSnap(at = 0, volume = 0.16) {
  noise({ at, duration: 0.06, volume: volume * 0.8, from: 2600, to: 1400, q: 1.1 })
  tone(560, { type: 'sine', at, duration: 0.08, volume: volume * 0.5, slideTo: 240 })
}

/**
 * A ball bouncing: a round low thump from the body of the ball, the dry "tok" of its
 * cover on the ground, and a faint ring of the air inside it. `strength` (0-1) is how
 * hard it hit: soft bounces are quieter, higher and tighter.
 */
function bounce(strength = 1) {
  if (!ready('bounce', 60)) return
  const s = Math.min(1, Math.max(0.12, strength))
  const pitch = 1 + (1 - s) * 0.4
  tone(138 * pitch, { type: 'sine', duration: 0.18, volume: 0.1 + 0.34 * s, slideTo: 60 * pitch, wet: 0.12 })
  noise({ duration: 0.055, volume: 0.04 + 0.2 * s, from: 2400, to: 900, q: 1.4 })
  tone(330 * pitch, { type: 'triangle', duration: 0.1, volume: 0.02 + 0.07 * s, slideTo: 215 * pitch, wet: 0.2 })
  if (s > 0.5) noise({ at: 0.012, duration: 0.12, volume: 0.05, from: 700, to: 250, q: 0.6 })
}

export const sfx = {
  click() {
    if (ready('click', 40)) tone(660, { type: 'triangle', duration: 0.05, volume: 0.15 })
  },
  power() {
    if (ready('power', 110)) tone(880 + Math.random() * 120, { type: 'triangle', duration: 0.07, volume: 0.07, slideTo: 1400 })
  },
  levelUp() {
    if (!ready('levelUp')) return
    ;[523, 659, 784, 1047].forEach((f, i) => bell(f, { at: i * 0.07, duration: 0.7, volume: 0.1, wet: 0.45 }))
    bell(1568, { at: 0.3, duration: 1.1, volume: 0.07, wet: 0.6 })
  },
  /**
   * Your throw: a rustle of clothes in the crouch, the arm whooshing through the air
   * and building to the release, the snap of the ball leaving the fingers, and a
   * soft push-off and landing for the jump.
   */
  throw() {
    if (!ready('throw')) return
    noise({ duration: 0.2, volume: 0.05, from: 300, to: 900, q: 0.6 })
    tone(95, { type: 'sine', at: 0.09, duration: 0.09, volume: 0.1, slideTo: 60 })
    noise({ at: RELEASE_DELAY - 0.11, duration: 0.36, volume: 0.2, from: 450, to: 2300, q: 0.7 })
    releaseSnap(RELEASE_DELAY, 0.18)
    tone(115, { type: 'sine', at: 0.45, duration: 0.14, volume: 0.1, slideTo: 58 })
    noise({ at: 0.45, duration: 0.08, volume: 0.04, from: 800, to: 300, q: 0.7 })
  },
  trophy() {
    if (!ready('trophy', 90)) return
    bell(1319, { duration: 0.5, volume: 0.1, wet: 0.35 })
    bell(1760, { at: 0.06, duration: 0.6, volume: 0.1, wet: 0.35 })
    coin(0.02, 1.1)
  },
  /** Wins arriving: a couple of coin clinks, a rising run of bells and a shimmering chord to finish. */
  wins() {
    if (!ready('wins')) return
    coin(0)
    coin(0.07, 1.12)
    ;[1047, 1319, 1568, 2093].forEach((f, i) => bell(f, { at: 0.12 + i * 0.075, duration: 0.95 - i * 0.08, volume: 0.12, wet: 0.5 }))
    ;[1568, 2093, 2637].forEach((f) => bell(f, { at: 0.46, duration: 1.2, volume: 0.06, wet: 0.65 }))
    coin(0.42, 1.2)
  },
  crack() {
    if (!ready('crack', 150)) return
    noise({ duration: 0.12, volume: 0.35, from: 1800, to: 600, q: 0.8 })
    tone(220, { type: 'square', duration: 0.08, volume: 0.08, slideTo: 90 })
  },
  reveal() {
    if (!ready('reveal')) return
    ;[392, 523, 659, 784, 1047].forEach((f, i) => tone(f, { type: 'triangle', at: i * 0.06, duration: 0.22, volume: 0.12 }))
  },
  buy() {
    if (!ready('buy')) return
    tone(1047, { type: 'square', duration: 0.07, volume: 0.08 })
    tone(1568, { type: 'square', at: 0.08, duration: 0.16, volume: 0.08 })
  },
  error() {
    if (ready('error', 200)) tone(160, { type: 'sawtooth', duration: 0.18, volume: 0.07, slideTo: 110 })
  },
  rebirth() {
    if (!ready('rebirth')) return
    noise({ duration: 0.8, volume: 0.15, from: 200, to: 4000, q: 0.6 })
    ;[262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, { type: 'sawtooth', at: 0.1 + i * 0.07, duration: 0.25, volume: 0.06 }))
  },
  /** A softball leaving the hand on a training or click throw: a quick whoosh and snap. */
  swish() {
    if (!ready('swish', 90)) return
    noise({ duration: 0.22, volume: 0.11, from: 900, to: 2200, q: 0.8 })
    releaseSnap(0.02, 0.12)
  },
  /** A training throw hitting its target: a thwack, then a bright rising ding. */
  targetHit() {
    if (!ready('targetHit', 100)) return
    noise({ duration: 0.09, volume: 0.22, from: 2400, to: 700, q: 0.9 })
    tone(330, { type: 'square', duration: 0.06, volume: 0.05, slideTo: 160 })
    tone(988 + Math.random() * 80, { type: 'triangle', at: 0.05, duration: 0.12, volume: 0.08, slideTo: 1568 })
  },
  /** Stepping onto an unlocked training lane: a soft rising chime. */
  laneEnter() {
    if (!ready('laneEnter', 400)) return
    ;[523, 784, 1047].forEach((f, i) => tone(f, { type: 'sine', at: i * 0.05, duration: 0.28, volume: 0.07 }))
  },
  /** A jump: a springy little boing. */
  jump() {
    if (ready('jump', 120)) tone(260, { type: 'triangle', duration: 0.18, volume: 0.1, slideTo: 620 })
  },
  /** Landing from a jump: a soft thump. */
  jumpLand() {
    if (!ready('jumpLand', 150)) return
    tone(140, { type: 'sine', duration: 0.12, volume: 0.12, slideTo: 70 })
    noise({ duration: 0.08, volume: 0.06, from: 900, to: 300, q: 0.7 })
  },
  /** The thrown softball coming down at the end of its flight: the first, heaviest bounce. */
  land() {
    if (!ready('land')) return
    bounce(1)
    noise({ duration: 0.45, volume: 0.07, at: 0.05, from: 1200, to: 250, q: 0.6, wet: 0.15 })
  },
  bounce,
  windStart,
  windSet,
  windStop,
}
