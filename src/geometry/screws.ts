import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { buildLathe } from './lathe'
import { parametricSurface, type P2, mergeAll } from './utils'

export interface ScrewOptions {
  headRadius: number
  headHeight: number
  shankRadius: number
  shankLength: number
  /** Driver slot width. Set 0 for a plain head. */
  slotWidth?: number
  slotDepth?: number
}

/**
 * A slotted movement screw.
 *
 * The head top is a parametric disc whose height dips inside the slot band, so the
 * slot is real recessed geometry that catches light — screws are prominent in an
 * exploded movement, and a featureless disc gives the game away immediately.
 */
export function buildScrew(opts: ScrewOptions): THREE.BufferGeometry {
  const {
    headRadius, headHeight, shankRadius, shankLength,
    slotWidth = headRadius * 0.34, slotDepth = headHeight * 0.34,
  } = opts

  // Body: head sides, underside, and threaded shank.
  const profile: P2[] = [
    [headRadius, headHeight / 2 - 0.012],
    [headRadius, -headHeight / 2 + 0.02],
    [headRadius - 0.02, -headHeight / 2],
    [shankRadius, -headHeight / 2],
    [shankRadius, -headHeight / 2 - shankLength],
    [shankRadius * 0.6, -headHeight / 2 - shankLength],
  ]
  const body = buildLathe(profile, { segments: 48, chamfer: 0.008 })

  const half = slotWidth / 2
  const top = parametricSurface(48, 10, (u, v, target) => {
    const theta = u * Math.PI * 2
    const r = v * headRadius
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r
    // Slot runs along Z; the dip is a smooth well rather than a hard-edged cut,
    // which at sub-millimetre scale is indistinguishable and far cheaper.
    const t = Math.min(1, Math.abs(x) / half)
    const dip = slotWidth > 0 ? (1 - t * t) * slotDepth : 0
    target.set(x, headHeight / 2 - dip, z)
  })

  const merged = mergeAll([body, top], 'screws')
  return toCreasedNormals(merged, Math.PI / 5)
}

/** Synthetic ruby jewel: a pierced, olived bearing. */
export function buildJewel(radius = 0.42, height = 0.24): THREE.BufferGeometry {
  return buildLathe(
    [
      [radius * 0.24, height / 2],
      [radius * 0.55, height / 2],
      [radius, height / 2 - 0.03],
      [radius, -height / 2 + 0.03],
      [radius * 0.55, -height / 2],
      [radius * 0.24, -height / 2],
    ],
    { segments: 32, chamfer: 0.01 },
  )
}
