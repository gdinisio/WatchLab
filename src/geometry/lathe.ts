import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { chamferProfile, type P2 } from './utils'

export interface LatheOptions {
  segments?: number
  /**
   * Edges sharper than this stay hard; everything else is smoothed.
   * This is what lets one mesh carry both a mirror-smooth curve and a crisp
   * chamfer — without it, lathed parts look like soap.
   */
  creaseAngle?: number
  /** Chamfer inserted at every interior corner of the profile, in mm. */
  chamfer?: number
  phiStart?: number
  phiLength?: number
}

/**
 * Revolves a (radius, height) profile around Y.
 *
 * LatheGeometry lays out UVs with u running around the circumference, which is the
 * property the whole material system leans on: for any lathed part, tangent +X
 * already follows the tangential direction, so
 *   anisotropyRotation = 0    -> circular grain  (caseback, wheels)
 *   anisotropyRotation = PI/2 -> radial grain
 * with no direction map needed at all.
 */
export function buildLathe(profile: P2[], options: LatheOptions = {}): THREE.BufferGeometry {
  const {
    segments = 192,
    creaseAngle = Math.PI / 5,
    chamfer = 0,
    phiStart = 0,
    phiLength = Math.PI * 2,
  } = options

  const pts = (chamfer > 0 ? chamferProfile(profile, chamfer) : profile).map(
    ([r, y]) => new THREE.Vector2(r, y),
  )
  const g = new THREE.LatheGeometry(pts, segments, phiStart, phiLength)
  return toCreasedNormals(g, creaseAngle)
}

/** A flat annulus in the XZ plane, with planar UVs suited to printed artwork. */
export function buildDisc(
  innerRadius: number,
  outerRadius: number,
  thickness: number,
  options: { segments?: number; chamfer?: number } = {},
): THREE.BufferGeometry {
  const { segments = 192, chamfer = 0.04 } = options
  const h = thickness / 2
  const profile: P2[] =
    innerRadius > 0
      ? [[innerRadius, -h], [outerRadius, -h], [outerRadius, h], [innerRadius, h], [innerRadius, -h]]
      : [[0, -h], [outerRadius, -h], [outerRadius, h], [0, h]]
  return buildLathe(profile, { segments, chamfer, creaseAngle: Math.PI / 6 })
}

/**
 * Replaces polar lathe UVs with planar ones derived from XZ position, so printed
 * artwork (dial, date disc) maps correctly. Radius normalises to the 0..1 range.
 */
export function planarUV(g: THREE.BufferGeometry, radius: number): THREE.BufferGeometry {
  const pos = g.getAttribute('position')
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / (2 * radius) + 0.5
    uv[i * 2 + 1] = -pos.getZ(i) / (2 * radius) + 0.5
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}
