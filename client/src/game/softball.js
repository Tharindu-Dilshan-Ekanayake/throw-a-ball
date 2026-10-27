import {
  BufferGeometry,
  CanvasTexture,
  Color,
  Euler,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  RepeatWrapping,
  SphereGeometry,
  Vector3,
} from 'three'

import { createGlowInstances, disposeGlow, glowTime } from './glow'

/**
 * Softballs: the thing every player throws.
 *
 * One smooth sphere mesh for all of them. Each ball's look - base colour, thread colour
 * and one of twenty surface designs - is per instance, and the designs are drawn in the
 * fragment shader. The red-thread seam is the same on every ball, so it comes from one
 * tiny shared mask texture. So every ball in the game, in any design, shares one
 * geometry, one material and one compiled shader program, and a shelf of twenty
 * different balls is a single draw call.
 *
 * Local frame: a sphere of radius BALL_RADIUS, poles on Y.
 */

export const BALL_RADIUS = 0.32

/**
 * Looks by ball id (the ids and stats live in shared/balance.js; the ids are the original
 * plane ids so existing saves keep working). `design` picks the surface pattern (see
 * DESIGN_GLSL), `accent` colours both the pattern and the stitching, `glow` is the halo
 * every ball of that kind carries.
 */
export const SOFTBALL_STYLES = {
  paper: { color: '#e6f53c', accent: '#e0312a', glow: '#f4ff7a', design: 0 },
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
  Object.fromEntries(Object.entries(SOFTBALL_STYLES).map(([id, s]) => [id, new Color(s[key])]))
const COLORS = parse('color')
const ACCENTS = parse('accent')
const GLOWS = parse('glow')

export const softballColor = (id) => COLORS[id] || COLORS.paper
export const softballAccent = (id) => ACCENTS[id] || ACCENTS.paper
export const softballGlow = (id) => GLOWS[id] || GLOWS.paper
export const softballDesign = (id) => (SOFTBALL_STYLES[id] || SOFTBALL_STYLES.paper).design

// --- Geometry ------------------------------------------------------------------------

let baseGeometry = null
function softballBaseGeometry() {
  // 28 x 20: a clean round silhouette up close; the shop shows twenty of them.
  if (!baseGeometry) baseGeometry = new SphereGeometry(BALL_RADIUS, 28, 20)
  return baseGeometry
}

// --- Seam mask -----------------------------------------------------------------------

const MASK_W = 512
const MASK_H = 256

/**
 * The classic two-lobe seam curve on the unit sphere, poles on Y: |p| is constant when
 * c = 2 sqrt(a b), so it stays on the surface. Returns [x, y, z] for t in 0..2pi.
 */
const SEAM_A = 0.78
const SEAM_B = 0.22
const SEAM_C = 2 * Math.sqrt(SEAM_A * SEAM_B)
function seamPoint(t, out) {
  out[0] = SEAM_A * Math.cos(t) + SEAM_B * Math.cos(3 * t)
  out[2] = SEAM_A * Math.sin(t) - SEAM_B * Math.sin(3 * t)
  out[1] = SEAM_C * Math.sin(2 * t)
  return out
}

/** Equirectangular canvas position of a point on the unit sphere. */
function toMask(p, out) {
  const lon = Math.atan2(p[2], p[0])
  const lat = Math.asin(Math.max(-1, Math.min(1, p[1] / Math.hypot(p[0], p[1], p[2]))))
  out[0] = (lon / (Math.PI * 2) + 0.5) * MASK_W
  out[1] = (0.5 - lat / Math.PI) * MASK_H
  return out
}

let maskTexture = null
/**
 * One shared mask: red = a stitch of thread, green = the groove the seam runs in. Drawn
 * once on a 512x256 canvas (about 0.5 MB on the GPU); every ball samples it.
 */
function stitchMask() {
  if (maskTexture) return maskTexture
  const canvas = document.createElement('canvas')
  canvas.width = MASK_W
  canvas.height = MASK_H
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, MASK_W, MASK_H)
  // Channels add up where strokes overlap, so the groove (green) and stitches (red) can
  // share a texel without one erasing the other.
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'

  const p = [0, 0, 0]
  const q = [0, 0, 0]
  const a = [0, 0]
  const STEPS = 720
  // The groove: a soft green band along the whole curve. A texel near the poles spans
  // less of the sphere, so the stroke is drawn at a few horizontal offsets for the wrap.
  ctx.strokeStyle = 'rgb(0,255,0)'
  ctx.lineWidth = 3.8
  for (const dx of [-MASK_W, 0, MASK_W]) {
    ctx.beginPath()
    let prevX = null
    for (let i = 0; i <= STEPS; i += 1) {
      toMask(seamPoint((i / STEPS) * Math.PI * 2, p), a)
      // Break the stroke where the curve wraps around the sphere's back.
      if (prevX !== null && Math.abs(a[0] - prevX) > MASK_W / 2) {
        ctx.stroke()
        ctx.beginPath()
        prevX = null
      }
      if (prevX === null) ctx.moveTo(a[0] + dx, a[1])
      else ctx.lineTo(a[0] + dx, a[1])
      prevX = a[0]
    }
    ctx.stroke()
  }

  // The stitches: short ticks across the seam, evenly spaced along it, each leaning the
  // way a real softball's red thread does (a V along the seam).
  ctx.strokeStyle = 'rgb(255,0,0)'
  ctx.lineWidth = 3.6
  const TICKS = 108
  const tangent = [0, 0, 0]
  for (let i = 0; i < TICKS; i += 1) {
    const t = (i / TICKS) * Math.PI * 2
    seamPoint(t, p)
    seamPoint(t + 0.002, q)
    tangent[0] = q[0] - p[0]
    tangent[1] = q[1] - p[1]
    tangent[2] = q[2] - p[2]
    const tl = Math.hypot(tangent[0], tangent[1], tangent[2])
    tangent[0] /= tl
    tangent[1] /= tl
    tangent[2] /= tl
    // Across the seam, along the surface: position x tangent.
    const side = [
      p[1] * tangent[2] - p[2] * tangent[1],
      p[2] * tangent[0] - p[0] * tangent[2],
      p[0] * tangent[1] - p[1] * tangent[0],
    ]
    // Each stitch crosses the seam, leaning one way then the other along it, so the
    // thread reads as a row of Vs.
    const lean = (i % 2 ? 1 : -1) * 0.035
    const ends = [1, -1].map((dir) =>
      toMask(
        [
          p[0] + side[0] * 0.09 * dir + tangent[0] * lean * dir,
          p[1] + side[1] * 0.09 * dir + tangent[1] * lean * dir,
          p[2] + side[2] * 0.09 * dir + tangent[2] * lean * dir,
        ],
        [0, 0],
      ),
    )
    // Skip ticks that straddle the wrap at the ball's back; they're drawn from the
    // offset copies instead.
    if (Math.abs(ends[0][0] - ends[1][0]) > MASK_W / 2) continue
    for (const dx of [-MASK_W, 0, MASK_W]) {
      ctx.beginPath()
      ctx.moveTo(ends[0][0] + dx, ends[0][1])
      ctx.lineTo(ends[1][0] + dx, ends[1][1])
      ctx.stroke()
    }
  }

  maskTexture = new CanvasTexture(canvas)
  // It is data, not colour: no colour-space conversion.
  maskTexture.wrapS = RepeatWrapping
  maskTexture.minFilter = LinearMipmapLinearFilter
  maskTexture.magFilter = LinearFilter
  maskTexture.anisotropy = 1
  return maskTexture
}

// --- Material ------------------------------------------------------------------------

const vertexHead = /* glsl */ `
  attribute vec3 aAccent;
  attribute float aDesign;
  varying vec3 vBLocal;
  varying vec3 vBAccent;
  varying float vBDesign;
`

const vertexBody = /* glsl */ `
  vBLocal = position;
  vBAccent = aAccent;
  vBDesign = aDesign;
`

const fragmentHead = /* glsl */ `
  varying vec3 vBLocal;
  varying vec3 vBAccent;
  varying float vBDesign;
  uniform float uBTime;
  uniform sampler2D uBStitch;

  const float BTAU = 6.2831853;
  const float BPI = 3.1415927;

  float bHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  // Anti-aliased band of y between a and b.
  float bBand(float y, float a, float b, float w) {
    return smoothstep(a - w, a + w, y) * (1.0 - smoothstep(b - w, b + w, y));
  }
  // Round dots on a lat/lon grid (offset every other row); cells are 'cols' around.
  float bDots(vec2 ll, float cols, float rows, float size, float stagger) {
    vec2 cell = vec2(ll.x / BTAU * cols, ll.y / BPI * rows);
    cell.x += step(1.0, mod(floor(cell.y), 2.0)) * stagger;
    vec2 f = fract(cell) - 0.5;
    return 1.0 - smoothstep(size * 0.8, size, length(f * vec2(1.0, 1.4)));
  }
`

/** The twenty surface designs, chosen per instance by vBDesign. */
const DESIGN_GLSL = /* glsl */ `
  float bSeam = 0.0;
  float bGroove = 0.0;
  float bGlowMask = 0.0;
  // How glossy this ball's cover is (leather balls are satin, premium ones lacquered),
  // how strongly it shimmers through the rainbow at grazing angles, and its sparkle.
  float bGloss = 0.5;
  float bIrid = 0.0;
  float bSparkle = 0.0;
  {
    vec3 p = normalize(vBLocal);
    float lat = asin(clamp(p.y, -1.0, 1.0));
    float lon = atan(p.z, p.x);
    vec2 ll = vec2(lon, lat);
    float w = max(fwidth(p.y), 0.01);
    float d = vBDesign + 0.5;
    float m = 0.0;
    vec3 tint = vBAccent;
    if (d < 1.0) {
      // Classic: nothing but the optic-yellow cover.
      m = 0.0;
    } else if (d < 2.0) {
      // Sky: fluffy white clouds drifting round.
      m = bDots(ll, 7.0, 5.0, 0.42, 0.5);
    } else if (d < 3.0) {
      // Sunny: orange rays fanning out from the poles.
      m = step(0.5, fract(lon / BTAU * 12.0)) * smoothstep(0.35, 0.5, abs(p.y));
    } else if (d < 4.0) {
      // Pizza: pepperoni on the cheese.
      m = bDots(ll, 6.0, 4.0, 0.42, 0.5);
    } else if (d < 5.0) {
      // Racer: a stripe round the middle with a chequered edge.
      float chk = step(0.5, fract(lon / BTAU * 24.0)) * bBand(abs(p.y), 0.16, 0.3, w);
      m = bBand(abs(p.y), 0.0, 0.14, w) + chk;
    } else if (d < 6.0) {
      // Wave: rolling bands.
      m = step(0.5, fract((p.y + sin(lon * 4.0) * 0.08) * 3.0 + 0.25));
    } else if (d < 7.0) {
      // Jungle: leafy spots.
      m = bDots(ll, 9.0, 6.0, 0.4, 0.5);
    } else if (d < 8.0) {
      // Royal: a gold band and a scatter of gold stars.
      m = bBand(abs(p.y), 0.0, 0.1, w) + bDots(ll, 10.0, 7.0, 0.22, 0.5) * step(0.12, abs(p.y));
    } else if (d < 9.0) {
      // Crystal: cut facets.
      float f = fract(lon / BTAU * 8.0 + p.y * 2.2);
      m = (1.0 - smoothstep(0.0, 0.07, abs(f - 0.5))) * 0.9;
    } else if (d < 10.0) {
      // Golden: a sunburst round each pole.
      m = step(0.5, fract(lon / BTAU * 16.0)) * smoothstep(0.55, 0.7, abs(p.y)) * 0.8;
    } else if (d < 11.0) {
      // Candy: a lollipop swirl.
      m = step(0.5, fract(lon / BTAU * 3.0 + p.y * 1.6));
    } else if (d < 12.0) {
      // Ice: a frosty cap with icicles hanging from it.
      float drip = 0.5 + 0.18 * abs(fract(lon / BTAU * 9.0) - 0.5) * 4.0;
      m = smoothstep(drip - 0.02, drip + 0.02, p.y);
    } else if (d < 13.0) {
      // Lava: dark crust split by glowing cracks.
      float n = sin(lon * 5.0 + sin(p.y * 7.0) * 1.5) * sin(p.y * 9.0 + sin(lon * 3.0) * 2.0);
      float flick = 0.5 + 0.5 * sin(uBTime * 3.0 + lon * 2.0);
      m = (1.0 - smoothstep(0.0, 0.16, abs(n)));
      bGlowMask = m * (0.6 + 0.4 * flick);
    } else if (d < 14.0) {
      // Thunder: a lightning bolt zig-zagging round the middle.
      float zig = abs(p.y - 0.22 * (abs(fract(lon / BTAU * 3.0) - 0.5) * 4.0 - 1.0));
      m = 1.0 - smoothstep(0.045, 0.08, zig);
      bGlowMask = m * 0.7;
    } else if (d < 15.0) {
      // Neon: glowing rings with a pulse running pole to pole.
      float pulse = 0.5 + 0.5 * sin(uBTime * 3.0 - p.y * 9.0);
      m = (bBand(abs(p.y), 0.05, 0.1, w) + bBand(abs(p.y), 0.4, 0.45, w) + bBand(abs(p.y), 0.72, 0.77, w)) * (0.55 + 0.45 * pulse);
      bGlowMask = m * 0.9;
    } else if (d < 16.0) {
      // Galaxy: a spiral sprinkled with stars.
      float arms = step(0.62, fract(lon / BTAU * 2.0 + p.y * 1.4)) * 0.5;
      float stars = step(0.93, bHash(floor(vec2(lon / BTAU * 40.0, lat / BPI * 24.0))));
      m = max(arms, stars);
      bGlowMask = stars * 0.6;
    } else if (d < 17.0) {
      // Dragon: rows of golden scales.
      m = bDots(ll, 12.0, 9.0, 0.5, 0.5);
    } else if (d < 18.0) {
      // Rainbow: every colour, in bands from pole to pole.
      m = 1.0;
      tint = 0.5 + 0.5 * cos(BTAU * (p.y * 0.6 + vec3(0.0, 0.33, 0.67)));
    } else if (d < 19.0) {
      // Diamond: faceted in two bright tones.
      m = step(0.5, fract(lon / BTAU * 10.0 + floor(p.y * 4.0) * 0.5)) * 0.6;
    } else {
      // Cosmic: a ring and a starfield in shifting colours.
      float stars = step(0.94, bHash(floor(vec2(lon / BTAU * 44.0, lat / BPI * 26.0))));
      m = max(stars, bBand(abs(p.y), 0.0, 0.08, w));
      tint = 0.5 + 0.5 * cos(BTAU * (lon / BTAU + uBTime * 0.15 + vec3(0.0, 0.33, 0.67)));
      bGlowMask = m * 0.8;
    }

    vec3 col = mix(diffuseColor.rgb, tint, clamp(m, 0.0, 1.0));

    // Premium tiers: lacquered, and the top ones catch rainbow light and sparkle.
    if ((d > 7.0 && d < 10.0) || d > 15.0) bGloss = 1.0;
    else if (d > 4.0) bGloss = 0.75;
    if ((d > 8.0 && d < 9.0) || (d > 17.0 && d < 20.0) || (d > 14.0 && d < 15.0)) bIrid = 1.0;
    if (d > 8.0) {
      vec2 sc = vec2(lon / BTAU * 70.0, lat / BPI * 40.0);
      float h = bHash(floor(sc));
      bSparkle = step(0.985, h) * (0.5 + 0.5 * sin(uBTime * 5.0 + h * 80.0));
    }
    // A fine leather grain, a little shallower on the lacquered ones.
    float grain = bHash(floor(vec2(lon / BTAU * 150.0, lat / BPI * 90.0)));
    col *= 1.0 + (grain - 0.5) * 0.09 * (1.1 - bGloss * 0.6);

    // The shared seam mask. The texture's own wrap would give mipmapping a jump at the
    // back of the ball, so take the gradients from whichever longitude is continuous.
    vec2 uv = vec2(lon / BTAU + 0.5, lat / BPI + 0.5);
    vec2 uvAlt = vec2(fract(uv.x + 0.5), uv.y);
    vec2 gx = dFdx(uv);
    vec2 gy = dFdy(uv);
    vec2 ax = dFdx(uvAlt);
    vec2 ay = dFdy(uvAlt);
    if (abs(ax.x) < abs(gx.x)) gx = ax;
    if (abs(ay.x) < abs(gy.x)) gy = ay;
    vec3 mask = textureGrad(uBStitch, uv, gx, gy).rgb;
    bSeam = mask.r;
    bGroove = mask.g;
    // The stitches stand up from the cover: lit on their upper-left edge, shaded on the
    // lower-right, from the mask's slope.
    vec2 ex = vec2(1.6 / 512.0, 0.0);
    vec2 ey = vec2(0.0, 1.6 / 256.0);
    float sx = textureGrad(uBStitch, uv + ex, gx, gy).r - textureGrad(uBStitch, uv - ex, gx, gy).r;
    float sy = textureGrad(uBStitch, uv + ey, gx, gy).r - textureGrad(uBStitch, uv - ey, gx, gy).r;
    float emboss = clamp(-sx * 0.6 + sy * 0.8, -1.0, 1.0);
    // Thread in the accent colour (red on the classic), a darker groove around it.
    col *= 1.0 - 0.22 * bGroove;
    col = mix(col, vBAccent * 0.95 + vec3(0.04) + emboss * 0.22, clamp(bSeam, 0.0, 1.0) * 0.95);
    col *= 1.0 + emboss * 0.18 * (1.0 - bSeam);
    // The lacquered tiers carry a slow band of light sweeping round the ball.
    float sweep = 1.0 - smoothstep(0.0, 0.09, abs(fract((p.x + p.z) * 0.7 - uBTime * 0.35) - 0.5));
    bGlowMask += 0.0;
    if (bGloss > 0.99) totalEmissiveRadiance += vec3(1.0, 0.98, 0.92) * sweep * 0.3;
    diffuseColor.rgb = col;
    totalEmissiveRadiance += tint * bGlowMask + vec3(1.0, 0.97, 0.9) * bSparkle * 0.9;
  }
`

/**
 * Glossy cover, after lighting: a highlight from a fixed light up and to the side of the
 * view, and a rim light round the silhouette.
 */
const SHINE_GLSL = /* glsl */ `
  {
    vec3 bV = normalize(vViewPosition);
    vec3 bN = normalize(normal);
    // A cheap studio environment: a sky gradient above, warm ground bounce below and a
    // soft sun, reflected off the cover and blended in by fresnel, the way a clear
    // coat picks up its surroundings.
    vec3 bUp = normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0));
    vec3 bSunDir = normalize(mat3(viewMatrix) * normalize(vec3(-0.35, 0.9, 0.25)));
    vec3 bR = reflect(-bV, bN);
    float bRy = dot(bR, bUp);
    vec3 bSky = mix(vec3(0.82, 0.92, 1.0), vec3(0.3, 0.52, 0.95), smoothstep(0.0, 1.0, bRy));
    vec3 bEnv = mix(vec3(0.5, 0.46, 0.38), bSky, smoothstep(-0.2, 0.2, bRy));
    float bNV = max(dot(bN, bV), 0.0);
    float bFres = pow(1.0 - bNV, 4.0);
    float bSun = pow(max(dot(bR, bSunDir), 0.0), 70.0);
    float bOpen = 1.0 - 0.85 * bSeam;
    // Reflection of the surroundings, the sun's sharp glint and a soft broad sheen.
    outgoingLight += bEnv * (0.03 + 0.5 * bFres) * bGloss * bOpen;
    outgoingLight += vec3(1.0, 0.97, 0.9) * (bSun * 1.4 + pow(max(dot(bR, bSunDir), 0.0), 8.0) * 0.12) * bGloss * bOpen;
    // Grazing-angle rainbow sheen on the top tiers.
    vec3 bIridCol = 0.5 + 0.5 * cos(BTAU * (bFres * 1.3 + bNV * 0.4 + uBTime * 0.05 + vec3(0.0, 0.33, 0.67)));
    outgoingLight += bIridCol * bFres * 0.7 * bIrid;
    // A thin glow of the ball's own colour round the edge.
    outgoingLight += vBAccent * pow(1.0 - bNV, 2.6) * 0.16;
  }
`

let sharedMaterial = null

/** The one material every softball uses. */
export function softballMaterial() {
  if (!sharedMaterial) {
    sharedMaterial = new MeshLambertMaterial({
      color: 0xffffff,
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
      shader.uniforms.uBTime = glowTime
      shader.uniforms.uBStitch = { value: stitchMask() }
    }
    sharedMaterial.customProgramCacheKey = () => 'softball-v3'
  }
  return sharedMaterial
}

const WHITE = new Color('#ffffff')

/**
 * Up to `max` softballs in one draw call. Place them with setMatrixAt and style them with
 * `setStyle(index, ballId)`; set `.count` to how many to draw.
 */
export function createSoftballMesh(max) {
  const base = softballBaseGeometry()
  // Own geometry object (it needs its own per-instance attributes), sharing the sphere's
  // vertex buffers.
  const geometry = new BufferGeometry()
  geometry.setIndex(base.index)
  for (const name of ['position', 'normal', 'uv']) geometry.setAttribute(name, base.getAttribute(name))
  const accent = new InstancedBufferAttribute(new Float32Array(max * 3), 3)
  const design = new InstancedBufferAttribute(new Float32Array(max), 1)
  geometry.setAttribute('aAccent', accent)
  geometry.setAttribute('aDesign', design)

  const mesh = new InstancedMesh(geometry, softballMaterial(), max)
  mesh.setColorAt(0, WHITE)
  mesh.count = 0
  mesh.frustumCulled = false
  mesh.castShadow = true
  const styled = new Array(max).fill(null)

  /** Styles instance `i` as ball `id`; cheap to call every frame. */
  mesh.setStyle = (i, id) => {
    if (styled[i] === id) return
    styled[i] = id
    mesh.setColorAt(i, softballColor(id))
    const a = softballAccent(id)
    accent.setXYZ(i, a.r, a.g, a.b)
    design.setX(i, softballDesign(id))
    mesh.instanceColor.needsUpdate = true
    accent.needsUpdate = true
    design.needsUpdate = true
  }
  return mesh
}

/** Frees a mesh made by createSoftballMesh (the shared sphere, mask and material stay). */
export function disposeSoftballMesh(mesh) {
  mesh.geometry.dispose()
  mesh.dispose()
}

const IDENTITY = new Matrix4()
const _spin = new Quaternion()
const _tilt = new Quaternion()
const _euler = new Euler()
const _up = new Vector3(0, 1, 0)

/**
 * A flying ball's orientation: spun `spin` radians about its own axis, then tilted
 * (`tiltX` forward/back, `tiltZ` sideways) so the seam rolls as it travels. Writes into
 * `out`; allocates nothing.
 */
export function softballOrientation(out, spin, tiltX = 0, tiltZ = 0) {
  _spin.setFromAxisAngle(_up, spin)
  _tilt.setFromEuler(_euler.set(tiltX, 0, tiltZ))
  return out.multiplyQuaternions(_tilt, _spin)
}

/**
 * A single softball with its glowing halo, for the one in your hand and the one in the
 * air. `setSoftball(id)` restyles it; `dispose()` frees what it owns.
 *
 * @param {{ glowSize?: number, glowIntensity?: number }} options halo diameter relative
 *   to the ball's, and brightness
 */
export function createSoftballModel({ glowSize = 1.6, glowIntensity = 0.9 } = {}) {
  const ball = createSoftballMesh(1)
  ball.setMatrixAt(0, IDENTITY)
  ball.count = 1
  // An instanced halo of one, so it shares the shader program with every other halo.
  const glow = createGlowInstances(1, glowIntensity)
  glow.setMatrixAt(0, IDENTITY)
  glow.count = 1
  glow.scale.setScalar(glowSize)

  const group = new Group()
  group.add(glow, ball)
  let current = null

  group.setSoftball = (id) => {
    if (id === current) return
    current = id
    ball.setStyle(0, id)
    glow.setColorAt(0, softballGlow(id))
    glow.instanceColor.needsUpdate = true
  }
  /** Halo size multiplier, e.g. from the quality preset. */
  group.setGlowSize = (size) => glow.scale.setScalar(size)
  group.dispose = () => {
    disposeSoftballMesh(ball)
    disposeGlow(glow)
  }

  group.setSoftball('paper')
  return group
}
