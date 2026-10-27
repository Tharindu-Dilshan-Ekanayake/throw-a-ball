import { Quaternion, Vector3 } from 'three'

/**
 * The player's body language, shared by the Bloxity avatar and the blocky stand-in so
 * both move the same way.
 *
 * `computePose` turns the motion state into joint angles; each avatar applies them to
 * its own limbs. Angles are radians in character space (the character faces +Z, its
 * left side is +X), about each joint's pivot:
 *   swing - about X: negative swings a limb forward (arm up in front, knee up)
 *   sway  - about Z: positive moves a limb towards +X
 *   twist - about Y: positive turns the right shoulder forward
 * `lift` raises (or, to keep bent legs on the ground, lowers) the body, in metres.
 */

/** Seconds a throw lasts, wind-up to back in the stance. */
export const THROW_TIME = 0.42
/** Fraction of the throw at which the frisbee leaves the hand. */
export const RELEASE_AT = 0.3
/** Seconds from the start of a throw to the release. */
export const RELEASE_DELAY = THROW_TIME * RELEASE_AT
/** Seconds the catch takes, from snatching the frisbee to holding it upright again. */
export const CATCH_TIME = 0.26

export const POSED_BONES = [
  'Spine1',
  'Neck1',
  'ArmL1',
  'ArmL2',
  'ArmR1',
  'ArmR2',
  'LegL1',
  'LegL2',
  'LegR1',
  'LegR2',
]

/** Written by `computePose` every frame; one shared result, never reallocated. */
export const pose = {
  lift: 0,
  bones: Object.fromEntries(POSED_BONES.map((name) => [name, { swing: 0, sway: 0, twist: 0 }])),
}

/** Sway sign that moves a limb away from the body, per side. */
const OUT_L = 1
const OUT_R = -1

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** Adds to a joint, scaled by weight `w`. */
function add(name, swing, sway, twist, w) {
  const b = pose.bones[name]
  b.swing += swing * w
  b.sway += sway * w
  b.twist += twist * w
}

/** Pulls a joint towards an absolute angle by `k` (0 keeps it, 1 replaces it). */
function blend(name, swing, sway, twist, k) {
  const b = pose.bones[name]
  b.swing += (swing - b.swing) * k
  b.sway += (sway - b.sway) * k
  b.twist += (twist - b.twist) * k
}

/**
 * Ready stance: feet apart with the left one forward, knees soft, left arm up in front
 * for balance and the frisbee arm cocked back, all breathing gently.
 */
function stance(w, time) {
  const breath = Math.sin(time * 1.8)
  add('LegL1', -0.24, 0.12 * OUT_L, 0, w)
  add('LegL2', 0.34, 0, 0, w)
  add('LegR1', 0.12, 0.12 * OUT_R, 0, w)
  add('LegR2', 0.3, 0, 0, w)
  add('Spine1', -0.07 + breath * 0.015, 0, -0.12, w)
  add('Neck1', 0, 0, 0.12, w)
  add('ArmL1', -0.7 + breath * 0.03, 0.12 * OUT_L, 0, w)
  add('ArmL2', -0.85, 0, 0, w)
  add('ArmR1', 0.45 - breath * 0.03, 0.28 * OUT_R, 0, w)
  add('ArmR2', -0.4, 0, 0, w)
  // Bent knees shorten the legs: sink the body so the feet stay planted.
  pose.lift += (-0.04 + breath * 0.008) * w
}

/**
 * Walk to sprint: arms and legs swing against each other, the body leans in and bobs
 * once per step. `phase` advances faster with speed, so the steps quicken.
 */
function stride(phase, ratio) {
  const cycle = Math.sin(phase)
  const leg = 0.85 * ratio
  const arm = 0.75 * ratio
  add('LegL1', cycle * leg, 0, 0, 1)
  add('LegR1', -cycle * leg, 0, 0, 1)
  // Knees fold on the back swing only.
  add('LegL2', Math.max(0, -cycle) * 1.1 * ratio, 0, 0, 1)
  add('LegR2', Math.max(0, cycle) * 1.1 * ratio, 0, 0, 1)
  add('ArmL1', -cycle * arm, 0.08 * OUT_L * ratio, 0, 1)
  add('ArmR1', cycle * arm, 0.16 * OUT_R * ratio, 0, 1)
  add('ArmL2', -(0.35 + Math.max(0, -cycle) * 0.5) * ratio, 0, 0, 1)
  add('ArmR2', -(0.35 + Math.max(0, cycle) * 0.5) * ratio, 0, 0, 1)
  add('Spine1', -(0.08 + 0.14 * ratio) * ratio, 0, cycle * 0.12 * ratio, 1)
  pose.lift += (Math.abs(Math.cos(phase)) * 0.05 - 0.015) * ratio
}

/**
 * In the air: one knee up and the arms out on the way up; falling, the legs straighten
 * and reach down for the ground.
 */
function airborne(vy) {
  const f = smooth(0, 1, clamp01((2 - vy) / 9))
  add('LegL1', lerp(-1.3, -0.35, f), 0.08 * OUT_L, 0, 1)
  add('LegL2', lerp(1.6, 0.25, f), 0, 0, 1)
  add('LegR1', lerp(0.25, -0.1, f), 0.08 * OUT_R, 0, 1)
  add('LegR2', lerp(0.5, 0.2, f), 0, 0, 1)
  add('ArmL1', lerp(-0.35, -0.6, f), lerp(1.15, 1.45, f) * OUT_L, 0, 1)
  add('ArmL2', -0.35, 0, 0, 1)
  add('ArmR1', lerp(-0.25, -0.5, f), lerp(1.05, 1.35, f) * OUT_R, 0, 1)
  add('ArmR2', -0.4, 0, 0, 1)
  add('Spine1', lerp(-0.15, 0.06, f), 0, 0, 1)
}

/**
 * The throw, `p` 0..1 over THROW_TIME: wind up with the frisbee arm back and out and
 * the shoulders turned away, then both arms sweep forward as the body turns into it,
 * the frisbee leaving the hand at RELEASE_AT, then ease back into the stance.
 */
function throwing(p) {
  const k = smooth(0, 0.1, p) * (1 - smooth(0.62, 1, p))
  const s = smooth(0.17, 0.42, p)
  blend('ArmR1', lerp(0.95, -1.55, s), lerp(0.75, 0.15, s) * OUT_R, 0, k)
  blend('ArmR2', lerp(-1.15, -0.15, s), 0, 0, k)
  blend('ArmL1', lerp(-0.55, -1.35, s), lerp(0.35, 0.1, s) * OUT_L, 0, k)
  blend('ArmL2', lerp(-0.7, -0.2, s), 0, 0, k)
  blend('Spine1', lerp(0.04, -0.22, s), 0, lerp(-0.5, 0.42, s), k)
  blend('Neck1', 0, 0, lerp(0.4, -0.3, s), k)
  blend('LegL1', lerp(-0.2, -0.42, s), 0.14 * OUT_L, 0, k)
  blend('LegL2', 0.3, 0, 0, k)
  blend('LegR1', lerp(0.15, 0.38, s), 0.14 * OUT_R, 0, k)
  blend('LegR2', lerp(0.3, 0.45, s), 0, 0, k)
  pose.lift += (lerp(-0.05, -0.07, s) - pose.lift) * k
}

/** The catch, `c` 1..0 over CATCH_TIME: the arm snatches forward and settles back. */
function catching(c) {
  const k = Math.sin((1 - c) * Math.PI) * 0.7
  blend('ArmR1', -0.9, 0.25 * OUT_R, 0, k)
  blend('ArmR2', -0.6, 0, 0, k)
}

/**
 * @param {{ time?: number, speed?: number, maxSpeed?: number, grounded?: boolean,
 *   vy?: number, stride?: number, throwT?: number, catchT?: number }} motion
 *   `throwT` / `catchT` count down from THROW_TIME / CATCH_TIME.
 */
export function computePose(motion) {
  const {
    time = 0,
    speed = 0,
    maxSpeed = 6,
    grounded = true,
    vy = 0,
    stride: phase = time * 5,
    throwT = 0,
    catchT = 0,
  } = motion
  for (const name of POSED_BONES) {
    const b = pose.bones[name]
    b.swing = 0
    b.sway = 0
    b.twist = 0
  }
  pose.lift = 0

  if (grounded) {
    const ratio = clamp01(speed / Math.max(maxSpeed, 0.001))
    stance(1 - smooth(0.05, 0.4, ratio), time)
    if (ratio > 0.02) stride(phase, ratio)
  } else {
    airborne(vy)
  }
  if (throwT > 0) throwing(1 - throwT / THROW_TIME)
  if (catchT > 0) catching(catchT / CATCH_TIME)
  return pose
}

/**
 * How flat the held frisbee lies, 0 (upright at the side) to 1 (level, ready to fly):
 * it turns flat during the wind-up and comes back flat from a catch.
 */
export function heldFlatness(throwT, catchT) {
  if (throwT > 0) return smooth(0.04, RELEASE_AT, 1 - throwT / THROW_TIME)
  if (catchT > 0) return smooth(0.15, 0.85, catchT / CATCH_TIME)
  return 0
}

/*
 * The frisbee in the hand, in the hand's frame (character space with the arm hanging
 * at rest; the avatar turns that frame with the arm). Upright, it stands beside the
 * leg gripped by its back rim, its face turned out and back towards the camera. Flat,
 * it lies level in front of the hand like a backhand grip.
 */
export const GRIP_UPRIGHT = new Vector3(-0.22, -0.12, 0.3)
export const GRIP_FLAT = new Vector3(0.12, 0, 0.38)
export const FACE_UPRIGHT = new Quaternion().setFromUnitVectors(
  new Vector3(0, 1, 0),
  new Vector3(-0.8, 0.05, -0.6).normalize(),
)
export const FACE_FLAT = new Quaternion().setFromUnitVectors(
  new Vector3(0, 1, 0),
  new Vector3(-0.15, 1, 0).normalize(),
)
