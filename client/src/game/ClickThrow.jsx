import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

import { throwFromHand } from './throwFromHand'

/** A press shorter and stiller than this is a click; anything else is a camera drag. */
const CLICK_MS = 350
const CLICK_SLOP_PX = 8

/**
 * Click throws: a click or tap on the world (not a drag, and not on the HUD, which
 * sits above the canvas) throws the frisbee from your hand for a x1 training throw,
 * anywhere outside the throw area (see throwFromHand).
 */
export function ClickThrow() {
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    const el = gl.domElement
    /** pointerId -> { x, y, t, moved } */
    const presses = new Map()

    const onDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      presses.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: false })
    }
    const onMove = (e) => {
      const press = presses.get(e.pointerId)
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > CLICK_SLOP_PX) press.moved = true
    }
    const onUp = (e) => {
      const press = presses.get(e.pointerId)
      presses.delete(e.pointerId)
      // A drag, a long press, or one finger of a pinch.
      if (!press || press.moved || presses.size > 0) return
      if (performance.now() - press.t > CLICK_MS) return
      throwFromHand()
    }
    const onCancel = (e) => presses.delete(e.pointerId)

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
    }
  }, [gl])

  return null
}

export default ClickThrow
