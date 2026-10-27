import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, Matrix4, Quaternion, Vector3 } from 'three'

import { PLANES } from '@shared/balance'
import { PAD_SIZE, PLANE_PADS, SHOP_STAGES } from '@shared/world'

import { useGame } from '../../store/game'
import { getQuality } from '../../store/quality'
import { BlockSet, disposeBlocks } from '../blocks'
import { createFrisbeeMesh, disposeFrisbeeMesh, frisbeeColor, frisbeeGlow, frisbeeOrientation } from '../frisbee'
import { createGlowInstances, disposeGlow } from '../glow'
import { padLabelSpec, padState } from '../labels/lobbyLabels'
import { updateWorldLabel } from '../labels/registry'
import { sharedMaterials, STYLE } from '../materials'

/** Pad colours by state, as in the reference: green owned, yellow equipped, red not. */
const PAD_COLORS = {
  equipped: new Color('#ffd21f'),
  owned: new Color('#3fdc4a'),
  buy: new Color('#ff3b3b'),
  locked: new Color('#b0262b'),
}

const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3(2.8, 2.8, 2.8)

/** Height of a stand's glowing cap above its pad; the frisbee floats over it. */
const CAP_TOP = 1.42
const HOVER = CAP_TOP + 1.6

/**
 * Display stands, all in one block set. The first PLANE_PADS.length blocks are the
 * pads themselves (recoloured by state, so their instance index is the pad index);
 * the trimmings follow.
 */
function buildStands() {
  const set = new BlockSet()
  const slab = PAD_SIZE - 0.4
  for (const pad of PLANE_PADS) set.addOn(pad.x, pad.y - 0.1, pad.z, slab, 0.3, slab, '#ffffff', STYLE.STUDS)
  for (const pad of PLANE_PADS) {
    const id = PLANES[pad.index].id
    const { x, y, z } = pad
    // White frame, standing clear of the pad's top.
    const e = slab / 2 + 0.1
    for (const side of [-1, 1]) {
      set.addOn(x, y - 0.1, z + side * e, slab + 0.5, 0.45, 0.3, '#ffffff', STYLE.SMOOTH)
      set.addOn(x + side * e, y - 0.1, z, 0.3, 0.45, slab + 0.2, '#ffffff', STYLE.SMOOTH)
    }
    // A glowing square ring on the pad in the frisbee's own glow colour.
    const glow = frisbeeGlow(id)
    for (const side of [-1, 1]) {
      set.addOn(x, y + 0.2, z + side * 1.25, 2.68, 0.06, 0.18, glow, STYLE.GLOW)
      set.addOn(x + side * 1.25, y + 0.2, z, 0.18, 0.06, 2.32, glow, STYLE.GLOW)
    }
    // Pedestal with a cap in the frisbee's colour.
    set.addOn(x, y + 0.2, z, 1.1, 1, 1.1, '#f4f7fb', STYLE.SMOOTH)
    set.addOn(x, y + 1.2, z, 1.5, CAP_TOP - 1.2, 1.5, frisbeeColor(id), STYLE.GLOW)
  }
  // A red carpet down the aisle between the two stages, edged in gold.
  const [front, back] = SHOP_STAGES
  const aisleX = (front.maxX + back.minX) / 2
  const length = front.maxZ - front.minZ
  const midZ = (front.minZ + front.maxZ) / 2
  set.addOn(aisleX, 0, midZ, 2.4, 0.06, length, '#d8263a', STYLE.SMOOTH)
  for (const side of [-1, 1]) set.addOn(aisleX + side * 1.25, 0, midZ, 0.18, 0.1, length, '#ffd21f', STYLE.GLOW)
  return set.build(sharedMaterials().blocks)
}
const _glow = new Vector3()

/**
 * The frisbee shop: twenty display stands on the two shop stages, each a pad framed in
 * white with a glowing pedestal and its frisbee floating above it. Pads recolour and
 * their labels rewrite as you buy and equip; the frisbees spin slowly. Three draw
 * calls: stands, frisbees, halos.
 */
export function PlaneShop() {
  const owned = useGame((s) => s.profile.ownedPlanes)
  const equipped = useGame((s) => s.profile.equippedPlane)
  const padsRef = useRef(null)
  const discsRef = useRef(null)
  const glowRef = useRef(null)

  const assets = useMemo(() => {
    const pads = buildStands()

    // All ten frisbees, each in its own design, in one draw call.
    const discs = createFrisbeeMesh(PLANES.length)
    PLANES.forEach((frisbee, i) => discs.setStyle(i, frisbee.id))
    discs.count = PLANES.length
    // Each one glows in its own colour.
    const glows = createGlowInstances(PLANES.length, 0.8)
    PLANES.forEach((frisbee, i) => glows.setColorAt(i, frisbeeGlow(frisbee.id)))
    glows.count = PLANES.length
    glows.instanceColor.needsUpdate = true
    return { pads, discs, glows }
  }, [])

  useEffect(
    () => () => {
      disposeBlocks(assets.pads)
      disposeFrisbeeMesh(assets.discs)
      disposeGlow(assets.glows)
    },
    [assets],
  )

  // Recolour pads and rewrite their labels whenever ownership changes.
  useEffect(() => {
    const pads = padsRef.current
    const profile = { ownedPlanes: owned, equippedPlane: equipped }
    for (const pad of PLANE_PADS) {
      const state = padState(profile, pad.index)
      pads?.setColorAt(pad.index, PAD_COLORS[state])
      updateWorldLabel(`pad-${pad.index}`, padLabelSpec(pad.index, state))
    }
    if (pads?.instanceColor) pads.instanceColor.needsUpdate = true
  }, [owned, equipped])

  useFrame((state) => {
    const discs = discsRef.current
    const glows = glowRef.current
    if (!discs || !glows) return
    const t = state.clock.elapsedTime
    const glowSize = 4.4 * getQuality().frisbeeGlow
    for (const pad of PLANE_PADS) {
      _p.set(pad.x, pad.y + HOVER + Math.sin(t * 1.6 + pad.index) * 0.18, pad.z)
      // Stood up on edge facing the shop entrance (west) so the design shows, slowly
      // spinning about its own axis and rocking a little.
      frisbeeOrientation(_q, t * 0.8 + pad.index * 0.7, Math.sin(t + pad.index) * 0.12, 1.15)
      discs.setMatrixAt(pad.index, _m.compose(_p, _q, _s))
      glows.setMatrixAt(pad.index, _m.compose(_p, _q, _glow.setScalar(glowSize)))
    }
    discs.instanceMatrix.needsUpdate = true
    glows.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <primitive ref={padsRef} object={assets.pads} />
      <primitive ref={discsRef} object={assets.discs} />
      <primitive ref={glowRef} object={assets.glows} />
    </>
  )
}

export default PlaneShop
