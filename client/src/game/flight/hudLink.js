/**
 * The flight's distance counter is a DOM element written from the frame loop. The
 * overlay registers it here; the renderer writes to it at most UPDATE_HZ times a second
 * and only when the whole-metre value changes, so React never re-renders during a
 * flight and the outlined text isn't repainted every frame.
 */
const UPDATE_MS = 1000 / 15

/** The two stacked text spans (outline and fill) that show the distance. */
let spans = []
let shown = -1
let lastWrite = 0

export function setDistanceElement(el) {
  spans = el ? [...el.querySelectorAll('[data-distance]')] : []
  shown = -1
  lastWrite = 0
}

/** 12345 -> "12,345" without toLocaleString's per-call cost. */
function withCommas(n) {
  let s = String(n)
  for (let i = s.length - 3; i > 0; i -= 3) s = `${s.slice(0, i)},${s.slice(i)}`
  return s
}

export function writeDistance(meters, now = performance.now()) {
  const m = Math.floor(meters)
  if (spans.length === 0 || m === shown || now - lastWrite < UPDATE_MS) return
  shown = m
  lastWrite = now
  const text = `${withCommas(m)}m`
  for (const span of spans) span.textContent = text
}
