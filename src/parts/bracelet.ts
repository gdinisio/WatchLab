import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BRACELET, CASE } from '../config/datejust36'
import { coronetShapes } from '../geometry/coronet'
import { flatExtrude, roundedRect } from '../geometry/shapes'
import { cached, mergeAll } from '../geometry/utils'
import { Y } from './layout'

/** Links are modelled at this nominal width and scaled per instance as the taper runs. */
const NOMINAL_WIDTH = 20

/**
 * An Oyster link is a three-piece assembly: a broad SATIN centre flanked by two
 * POLISHED outer sections. That finish contrast running down the bracelet is the
 * whole visual identity of an Oyster — modelling the link as one uniform block
 * throws it away, so the centre and the flanks are separate meshes with separate
 * materials.
 */
function linkBlank(widthFraction: number, offsetFraction: number): THREE.BufferGeometry {
  const w = NOMINAL_WIDTH * widthFraction
  const g = flatExtrude(roundedRect(w, BRACELET.linkLength * 0.94, 0.35), {
    thickness: BRACELET.linkThickness,
    bevel: 0.16,
    bevelSegments: 3,
    curveSegments: 12,
  })
  g.translate(NOMINAL_WIDTH * offsetFraction, 0, 0)
  return g
}

export function buildLinkCentre(): THREE.BufferGeometry {
  return cached('brc/linkCentre', () => toCreasedNormals(linkBlank(0.46, 0), Math.PI / 5))
}

export function buildLinkFlanks(): THREE.BufferGeometry {
  return cached('brc/linkFlanks', () => {
    const merged = mergeAll([linkBlank(0.25, -0.357), linkBlank(0.25, 0.357)], 'bracelet')
    return toCreasedNormals(merged, Math.PI / 5)
  })
}

/** End link: fills the gap between the lugs and curves to meet the case. */
export function buildEndLink(): THREE.BufferGeometry {
  return cached('brc/endLink', () => {
    const s = new THREE.Shape()
    s.moveTo(-CASE.lugWidth / 2, -2.6)
    s.lineTo(CASE.lugWidth / 2, -2.6)
    s.lineTo(CASE.lugWidth / 2, 1.4)
    // Concave edge hugging the round case.
    s.quadraticCurveTo(0, 4.2, -CASE.lugWidth / 2, 1.4)
    s.closePath()
    const g = flatExtrude(s, {
      thickness: BRACELET.linkThickness,
      bevel: 0.16,
      bevelSegments: 3,
      curveSegments: 20,
    })
    return toCreasedNormals(g, Math.PI / 5)
  })
}

/** Oysterclasp: folding cover with the coronet stamped into it. */
export function buildClaspCover(): THREE.BufferGeometry {
  return cached('brc/claspCover', () => {
    const { length, width, thickness } = BRACELET.clasp
    const g = flatExtrude(roundedRect(width, length, 1.1), {
      thickness,
      bevel: 0.22,
      bevelSegments: 4,
      curveSegments: 16,
    })
    return toCreasedNormals(g, Math.PI / 5)
  })
}

export function buildClaspCoronet(): THREE.BufferGeometry {
  return cached('brc/claspCoronet', () => {
    const shapes = coronetShapes(5.2, 4.1)
    const g = flatExtrude(shapes, { thickness: 0.3, bevel: 0.05, bevelSegments: 2, curveSegments: 14 })
    g.computeBoundingBox()
    const b = g.boundingBox!
    g.translate(0, 0, -(b.min.z + b.max.z) / 2)
    return toCreasedNormals(g, Math.PI / 4)
  })
}

export function buildLinkPin(): THREE.BufferGeometry {
  return cached('brc/linkPin', () => {
    const g = new THREE.CylinderGeometry(0.34, 0.34, NOMINAL_WIDTH * 0.86, 16)
    g.rotateZ(Math.PI / 2)
    return g
  })
}

export interface LinkPlacement {
  matrix: THREE.Matrix4
  /** 0 at the lug, 1 at the clasp. */
  t: number
}

/**
 * Walks the bracelet down a gentle circular arc away from the case, tapering the
 * link width from 20mm at the lugs to 16mm at the clasp.
 *
 * `side` is +1 for the 6 o'clock run (+Z) and -1 for the 12 o'clock run.
 */
export function braceletPlacements(side: 1 | -1): LinkPlacement[] {
  const out: LinkPlacement[] = []
  const n = BRACELET.linksPerSide
  const startZ = side * (CASE.lugToLug / 2 - 1.4)
  const step = BRACELET.linkLength / BRACELET.drapeRadius

  for (let i = 0; i < n; i++) {
    const angle = (i + 0.6) * step
    const t = i / (n - 1)
    const z = startZ + side * BRACELET.drapeRadius * Math.sin(angle)
    const y = Y.braceletPlane - BRACELET.drapeRadius * (1 - Math.cos(angle))
    const width = BRACELET.widthAtLug + (BRACELET.widthAtClasp - BRACELET.widthAtLug) * t

    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(0, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(side * angle, 0, 0)),
      new THREE.Vector3(width / NOMINAL_WIDTH, 1, 1),
    )
    out.push({ matrix: m, t })
  }
  return out
}

export const ALL_PLACEMENTS: LinkPlacement[] = [
  ...braceletPlacements(1),
  ...braceletPlacements(-1),
]

/** Where the clasp sits: just past the last link of the 6 o'clock run. */
export function claspTransform(): THREE.Matrix4 {
  const last = braceletPlacements(1)[BRACELET.linksPerSide - 1]
  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  last.matrix.decompose(pos, quat, scale)
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quat)
  pos.addScaledVector(forward, BRACELET.clasp.length / 2 + BRACELET.linkLength * 0.6)
  return new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 1, 1))
}
