import {
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  Vector2,
  Vector3,
} from 'three'

import { createGlowInstances, disposeGlow, glowTime } from './glow'

/**
 * Frisbees: the thing every player throws.
 *
 * One smooth disc mesh for all of them. Each frisbee's look - base colour, accent colour
 * and one of ten top designs - is per instance, and the designs are drawn in the
 * fragment shader. So every frisbee in the game, in any design, shares one geometry,
 * one material and one compiled shader program, and a shelf of ten different
 * frisbees is a single draw call.
 *
 * Local frame: the disc lies in XZ, top face up (+Y), radius 0.5.
 */

/**
 * Looks by frisbee id (the ids and stats live in shared/balance.js; the ids are the
 * original plane ids so existing saves keep working). `design` picks the top pattern
 * (see DESIGN_GLSL), `accent` colours it, `glow` is the halo every frisbee of that kind
 * carries.
 */
export const FRISBEE_STYLES = {
  paper: { color: '#ffffff', accent: '#2f7fe6', glow: '#9fe8ff', design: 0 },
  sky: { color: '#8fd3ff', accent: '#ffffff', glow: '#4fc3ff', design: 1 },
  newspaper: { color: '#ffd84a', accent: '#ff7a1e', glow: '#ffe066', design: 2 },
  cardboard: { color: '#ffbf5a', accent: '#d62828', glow: '#ff9a3c', design: 3 },
  racer: { color: '#ff3b3b', accent: '#ffffff', glow: '#ff5a3b', design: 4 },
  ocean: { color: '#1f6fe0', accent: '#7ff0ff', glow: '#2fa8ff', design: 5 },
  jungle: { color: '#3ccf4e', accent: '#1c6b2a', glow: '#5cff6a', design: 6 },
  royal: { color: '#8a3ee8', accent: '#ffd21f', glow: '#c77dff', design: 7 },
  crystal: { color: '#9ff6ff', accent: '#ffffff', glow: '#7ff6ff', design: 8 },
  golden: { color: '#ffc61a', accent: '#fff3b0', glow: '#ffd21f', design: 9 },
  candy: { color: '#ff8fd0', accent: '#ffffff', glow: '#ff7ad9', design: 10 },
  ice: { color: '#c9f3ff', accent: '#3f9cff', glow: '#9fe8ff', design: 11 },
  lava: { color: '#3a1410', accent: '#ff6a1e', glow: '#ff4a1c', design: 12 },
  thunder: { color: '#2b2f8f', accent: '#ffe14a', glow: '#ffe14a', design: 13 },
  neon: { color: '#16161f', accent: '#39ff88', glow: '#39ff88', design: 14 },
  galaxy: { color: '#2a1450', accent: '#ffffff', glow: '#a46bff', design: 15 },
  dragon: { color: '#1f8a4a', accent: '#ffd21f', glow: '#4cff7a', design: 16 },
  rainbow: { color: '#ffffff', accent: '#ffffff', glow: '#ff7ad9', design: 17 },
  diamond: { color: '#d9f7ff', accent: '#5fc8ff', glow: '#bff4ff', design: 18 },
  cosmic: { color: '#120a2a', accent: '#ff5bd8', glow: '#ff5bd8', design: 19 },
}

// Parsed once, so frame code can look colours up without allocating.
const parse = (key) =>
  Object.fromEntries(Object.entries(FRISBEE_STYLES).map(([id, s]) => [id, new Color(s[key])]))
const COLORS = parse('color')
const ACCENTS = parse('accent')
const GLOWS = parse('glow')

export const frisbeeColor = (id) => COLORS[id] || COLORS.paper
export const frisbeeAccent = (id) => ACCENTS[id] || ACCENTS.paper
export const frisbeeGlow = (id) => GLOWS[id] || GLOWS.paper
export const frisbeeDesign = (id) => (FRISBEE_STYLES[id] || FRISBEE_STYLES.paper).design

// --- Geometry ------------------------------------------------------------------------

/**
 * Cross-section, centre-top outwards, round the curled rim and back underneath:
 * [radius, height]. Spun round Y into the disc.
 */
const PROFILE = [
  [0, 0.075],
  [0.12, 0.074],
  [0.24, 0.07],
  [0.34, 0.062],
  [0.42, 0.05],
  [0.47, 0.035],
  [0.5, 0.012],
  [0.505, -0.015],
  [0.495, -0.045],
  [0.47, -0.062],
  [0.45, -0.05],
  [0.44, -0.025],
  [0.3, -0.012],
  [0, -0.006],
]

let baseGeometry = null
function frisbeeBaseGeometry() {
  if (!baseGeometry) {
    baseGeometry = new LatheGeometry(
      PROFILE.map(([r, h]) => new Vector2(r, h)),
      // 24 sides: round enough at the size frisbees are seen, and the shop shows 20.
      24,
    )
  }
  return baseGeometry
}

// --- Material ------------------------------------------------------------------------

const vertexHead = /* glsl */ `
  attribute vec3 aAccent;
  attribute float aDesign;
  varying vec3 vFLocal;
  varying vec3 vFAccent;
  varying float vFDesign;
  varying float vFUp;
`

const vertexBody = /* glsl */ `
  vFLocal = position;
  vFUp = normal.y;
  vFAccent = aAccent;
  vFDesign = aDesign;
`

const fragmentHead = /* glsl */ `
  varying vec3 vFLocal;
  varying vec3 vFAccent;
  varying float vFDesign;
  varying float vFUp;
  uniform float uFTime;

  const float TAU = 6.2831853;
  // How much of this fragment is the upper face; set by the design block, read by the
  // shine pass.
  float fTop = 0.0;

  // Anti-aliased band between radii a and b.
  float fBand(float r, float a, float b, float w) {
    return smoothstep(a - w, a + w, r) * (1.0 - smoothstep(b - w, b + w, r));
  }
  // Solid disc of radius a at the centre.
  float fCore(float r, float a, float w) {
    return 1.0 - smoothstep(a - w, a + w, r);
  }
  // 'count' round dots spaced around the ring at radius 'ring'.
  float fDots(float r, float ang, float ring, float count, float size, float phase) {
    float cell = fract(ang / TAU * count + phase) - 0.5;
    vec2 p = vec2(cell * TAU * ring / count, r - ring);
    return 1.0 - smoothstep(size * 0.85, size, length(p));
  }
  float fHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  // Star: 1 inside an n-pointed star between radii inner and outer.
  float fStar(float r, float ang, float n, float inner, float outer, float w) {
    float k = abs(fract(ang / TAU * n) - 0.5) * 2.0;
    float edge = mix(outer, inner, k);
    return 1.0 - smoothstep(edge - w, edge + w, r);
  }
`

/** The twenty top designs, chosen per instance by vFDesign. */
const DESIGN_GLSL = /* glsl */ `
  {
    float r = length(vFLocal.xz) / 0.5;
    float ang = atan(vFLocal.z, vFLocal.x);
    float w = max(fwidth(r), 0.004);
    float d = vFDesign + 0.5;
    float m = 0.0;
    // What the pattern is painted in; the accent unless a design picks its own.
    vec3 tint = vFAccent;
    if (d < 1.0) {
      // Classic: target rings.
      m = fBand(r, 0.5, 0.58, w) + fBand(r, 0.74, 0.82, w) + fCore(r, 0.16, w);
    } else if (d < 2.0) {
      // Sky: a ring of puffy dots around a ring.
      m = fDots(r, ang, 0.66, 10.0, 0.11, 0.0) + fBand(r, 0.3, 0.36, w);
    } else if (d < 3.0) {
      // Sunny: sun and rays.
      float rays = step(0.5, fract(ang / TAU * 12.0));
      m = fCore(r, 0.28, w) + rays * fBand(r, 0.38, 0.88, w);
    } else if (d < 4.0) {
      // Pizza: pepperoni, with a crust ring.
      m = fDots(r, ang, 0.34, 5.0, 0.1, 0.1) + fDots(r, ang, 0.68, 9.0, 0.1, 0.0) + fCore(r, 0.1, w);
    } else if (d < 5.0) {
      // Racer: pinwheel stripes and a hub.
      m = step(0.5, fract(ang / TAU * 8.0 + r * 0.7)) * smoothstep(0.2, 0.24, r) + fBand(r, 0.08, 0.14, w);
    } else if (d < 6.0) {
      // Wave: a three-arm swirl.
      m = step(0.5, fract(ang / TAU * 3.0 + r * 1.8)) * smoothstep(0.1, 0.16, r);
    } else if (d < 7.0) {
      // Jungle: leafy spots on three rings.
      m = fDots(r, ang, 0.28, 5.0, 0.09, 0.3) + fDots(r, ang, 0.55, 8.0, 0.12, 0.1) + fDots(r, ang, 0.8, 12.0, 0.08, 0.5);
    } else if (d < 8.0) {
      // Royal: a gold star in a gold ring.
      m = fStar(r, ang + 1.5708, 5.0, 0.3, 0.68, w) + fBand(r, 0.8, 0.88, w);
    } else if (d < 9.0) {
      // Crystal: an eight-point snowflake star.
      m = fStar(r, ang, 8.0, 0.22, 0.92, w) * (1.0 - fCore(r, 0.1, w)) + fBand(r, 0.42, 0.47, w);
    } else if (d < 10.0) {
      // Golden: a sunburst with a bright hub.
      float rays = step(0.5, fract(ang / TAU * 16.0));
      m = rays * fBand(r, 0.3, 0.9, w) + fBand(r, 0.1, 0.2, w);
    } else if (d < 11.0) {
      // Candy: a lollipop swirl.
      m = step(0.5, fract(ang / TAU * 6.0 + r * 2.2)) * smoothstep(0.08, 0.12, r);
    } else if (d < 12.0) {
      // Ice: icicles hanging in from the rim round a frosty hub.
      m = fStar(r, ang, 12.0, 0.58, 0.95, w) * smoothstep(0.5, 0.56, r) + fCore(r, 0.2, w) + fBand(r, 0.34, 0.38, w);
    } else if (d < 13.0) {
      // Lava: flames flickering in from the rim round a molten core.
      float flick = 0.08 * sin(uFTime * 4.0 + ang * 7.0);
      m = (1.0 - fStar(r, ang, 7.0, 0.42 + flick, 0.82, w)) * smoothstep(0.3, 0.36, r) * (1.0 - smoothstep(0.93, 0.96, r)) + fCore(r, 0.18, w);
    } else if (d < 14.0) {
      // Thunder: a lightning bolt across the middle, inside a ring.
      vec2 q = vFLocal.xz / 0.5;
      float zig = q.x + 0.32 * (abs(fract(q.y * 1.4 + 0.25) - 0.5) * 4.0 - 1.0);
      m = (1.0 - smoothstep(0.11, 0.14, abs(zig))) * (1.0 - smoothstep(0.76, 0.8, abs(q.y))) + fBand(r, 0.86, 0.92, w);
    } else if (d < 15.0) {
      // Neon: glowing rings with a pulse running outwards.
      float pulse = 0.5 + 0.5 * sin(uFTime * 3.0 - r * 9.0);
      m = (fBand(r, 0.18, 0.22, w) + fBand(r, 0.38, 0.42, w) + fBand(r, 0.58, 0.62, w) + fBand(r, 0.78, 0.82, w)) * (0.55 + 0.45 * pulse);
    } else if (d < 16.0) {
      // Galaxy: a two-arm spiral sprinkled with stars.
      float arms = step(0.62, fract(ang / TAU * 2.0 + r * 1.3)) * smoothstep(0.12, 0.2, r) * 0.55;
      float stars = step(0.93, fHash(floor(vFLocal.xz * 70.0)));
      m = max(arms, stars) + fCore(r, 0.1, w);
    } else if (d < 17.0) {
      // Dragon: rows of golden scales round a dragon's eye.
      m = fDots(r, ang, 0.36, 7.0, 0.1, 0.0) + fDots(r, ang, 0.56, 11.0, 0.1, 0.5) + fDots(r, ang, 0.76, 15.0, 0.1, 0.0) + fCore(r, 0.14, w);
    } else if (d < 18.0) {
      // Rainbow: rings of every colour.
      m = fBand(r, 0.14, 0.93, w);
      tint = 0.5 + 0.5 * cos(TAU * (r * 1.1 + vec3(0.0, 0.33, 0.67)));
    } else if (d < 19.0) {
      // Diamond: cut facets round a bright table.
      m = mix(0.45, 1.0, step(0.5, fract(ang / TAU * 12.0))) * fBand(r, 0.3, 0.92, w) + fCore(r, 0.24, w);
    } else {
      // Cosmic: a four-point star in shifting colours over a starfield.
      float stars = step(0.94, fHash(floor(vFLocal.xz * 60.0)));
      m = max(fStar(r, ang, 4.0, 0.14, 0.82, w), stars) + fBand(r, 0.88, 0.93, w);
      tint = 0.5 + 0.5 * cos(TAU * (ang / TAU + uFTime * 0.15 + vec3(0.0, 0.33, 0.67)));
    }
    // The upper face: above the disc's midline and facing up (the lathe's normals point
    // inwards, so go by magnitude).
    float top = step(0.0, vFLocal.y) * smoothstep(0.3, 0.7, abs(vFUp));
    fTop = top;
    float mask = clamp(m, 0.0, 1.0) * top;
    vec3 col = mix(diffuseColor.rgb, tint, mask);
    // Moulded like the real thing: lighter in the middle, two flight rings pressed in
    // near the edge, the underside darker and the curled rim in the accent colour.
    col *= mix(1.08, 0.94, r) * mix(0.8, 1.0, top);
    col *= 1.0 - 0.16 * (fBand(r, 0.85, 0.87, w) + fBand(r, 0.9, 0.92, w)) * top;
    col = mix(col, vFAccent * 0.9 + diffuseColor.rgb * 0.1, smoothstep(0.95, 0.99, r) * 0.75);
    // The best of each stage are special: Royal, Crystal, Golden and Galaxy upwards
    // catch a sweeping shine, and Crystal and Diamond shimmer through the rainbow.
    float sweep = 1.0 - smoothstep(0.0, 0.07, abs(fract((vFLocal.x + vFLocal.z) * 0.9 - uFTime * 0.45) - 0.5));
    if ((d > 7.0 && d < 10.0) || d > 15.0) col += vec3(0.55) * sweep * top;
    if ((d > 8.0 && d < 9.0) || (d > 18.0 && d < 19.0)) col += 0.22 * (0.5 + 0.5 * cos(TAU * (r * 1.4 + ang / TAU + uFTime * 0.2 + vec3(0.0, 0.33, 0.67)))) * top;
    diffuseColor.rgb = col;
    // The design glows; neon much more.
    totalEmissiveRadiance += tint * mask * (d > 14.0 && d < 15.0 ? 0.8 : 0.35);
  }
`

/**
 * Glossy plastic, after lighting: a highlight from a fixed light up and to the side of
 * the view, and a rim light round the silhouette. Normals are turned to face the viewer,
 * since the disc is double sided and the lathe's point inwards.
 */
const SHINE_GLSL = /* glsl */ `
  {
    vec3 fV = normalize(vViewPosition);
    vec3 fN = normalize(normal);
    if (dot(fN, fV) < 0.0) fN = -fN;
    vec3 fH = normalize(normalize(vec3(0.45, 0.85, 0.35)) + fV);
    float fSpec = pow(max(dot(fN, fH), 0.0), 48.0);
    float fRim = pow(1.0 - max(dot(fN, fV), 0.0), 3.0);
    outgoingLight += vec3(0.6) * fSpec * (0.4 + 0.6 * fTop) + vec3(0.28) * fRim;
  }
`

let sharedMaterial = null

/** The one material every frisbee uses. */
export function frisbeeMaterial() {
  if (!sharedMaterial) {
    sharedMaterial = new MeshLambertMaterial({
      color: 0xffffff,
      side: DoubleSide,
      emissive: new Color('#ffffff'),
      emissiveIntensity: 0.12,
    })
    sharedMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${vertexHead}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexBody}`)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${fragmentHead}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${DESIGN_GLSL}`)
        .replace('#include <opaque_fragment>', `${SHINE_GLSL}\n#include <opaque_fragment>`)
      // The lobby's clock, which already ticks every frame for the halos.
      shader.uniforms.uFTime = glowTime
    }
    sharedMaterial.customProgramCacheKey = () => 'frisbee-v3'
  }
  return sharedMaterial
}

const WHITE = new Color('#ffffff')

/**
 * Up to `max` frisbees in one draw call. Place them with setMatrixAt and style them with
 * `setStyle(index, frisbeeId)`; set `.count` to how many to draw.
 */
export function createFrisbeeMesh(max) {
  const base = frisbeeBaseGeometry()
  // Own geometry object (it needs its own per-instance attributes), sharing the disc's
  // vertex buffers.
  const geometry = new BufferGeometry()
  geometry.setIndex(base.index)
  for (const name of ['position', 'normal', 'uv']) geometry.setAttribute(name, base.getAttribute(name))
  const accent = new InstancedBufferAttribute(new Float32Array(max * 3), 3)
  const design = new InstancedBufferAttribute(new Float32Array(max), 1)
  geometry.setAttribute('aAccent', accent)
  geometry.setAttribute('aDesign', design)

  const mesh = new InstancedMesh(geometry, frisbeeMaterial(), max)
  mesh.setColorAt(0, WHITE)
  mesh.count = 0
  mesh.frustumCulled = false
  mesh.castShadow = true
  const styled = new Array(max).fill(null)

  /** Styles instance `i` as frisbee `id`; cheap to call every frame. */
  mesh.setStyle = (i, id) => {
    if (styled[i] === id) return
    styled[i] = id
    mesh.setColorAt(i, frisbeeColor(id))
    const a = frisbeeAccent(id)
    accent.setXYZ(i, a.r, a.g, a.b)
    design.setX(i, frisbeeDesign(id))
    mesh.instanceColor.needsUpdate = true
    accent.needsUpdate = true
    design.needsUpdate = true
  }
  return mesh
}

/** Frees a mesh made by createFrisbeeMesh (the shared disc and material stay). */
export function disposeFrisbeeMesh(mesh) {
  mesh.geometry.dispose()
  mesh.dispose()
}

const IDENTITY = new Matrix4()
const _spin = new Quaternion()
const _tilt = new Quaternion()
const _euler = new Euler()
const _up = new Vector3(0, 1, 0)

/**
 * A flying frisbee's orientation: spun `spin` radians about its own axis, then tilted
 * (`tiltX` nose up/down, `tiltZ` banked). Writes into `out`; allocates nothing.
 */
export function frisbeeOrientation(out, spin, tiltX = 0, tiltZ = 0) {
  _spin.setFromAxisAngle(_up, spin)
  _tilt.setFromEuler(_euler.set(tiltX, 0, tiltZ))
  return out.multiplyQuaternions(_tilt, _spin)
}

/**
 * A single frisbee with its glowing halo, for the one in your hand and the one in the
 * air. `setFrisbee(id)` restyles it; `dispose()` frees what it owns.
 *
 * @param {{ glowSize?: number, glowIntensity?: number }} options halo diameter relative
 *   to the disc's, and brightness
 */
export function createFrisbeeModel({ glowSize = 1.6, glowIntensity = 0.9 } = {}) {
  const disc = createFrisbeeMesh(1)
  disc.setMatrixAt(0, IDENTITY)
  disc.count = 1
  // An instanced halo of one, so it shares the shader program with every other halo.
  const glow = createGlowInstances(1, glowIntensity)
  glow.setMatrixAt(0, IDENTITY)
  glow.count = 1
  glow.scale.setScalar(glowSize)

  const group = new Group()
  group.add(glow, disc)
  let current = null

  group.setFrisbee = (id) => {
    if (id === current) return
    current = id
    disc.setStyle(0, id)
    glow.setColorAt(0, frisbeeGlow(id))
    glow.instanceColor.needsUpdate = true
  }
  /** Halo size multiplier, e.g. from the quality preset. */
  group.setGlowSize = (size) => glow.scale.setScalar(size)
  group.dispose = () => {
    disposeFrisbeeMesh(disc)
    disposeGlow(glow)
  }

  group.setFrisbee('paper')
  return group
}
