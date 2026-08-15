import * as THREE from 'three'

/** A rounded rectangle centred on the origin, as a THREE.Shape. */
export function roundedRect(width: number, height: number, radius: number): THREE.Shape {
  const w = width / 2
  const h = height / 2
  const r = Math.min(radius, w, h)
  const s = new THREE.Shape()
  s.moveTo(-w + r, -h)
  s.lineTo(w - r, -h)
  s.quadraticCurveTo(w, -h, w, -h + r)
  s.lineTo(w, h - r)
  s.quadraticCurveTo(w, h, w - r, h)
  s.lineTo(-w + r, h)
  s.quadraticCurveTo(-w, h, -w, h - r)
  s.lineTo(-w, -h + r)
  s.quadraticCurveTo(-w, -h, -w + r, -h)
  return s
}

export function circlePath(radius: number, segments = 64): THREE.Path {
  const p = new THREE.Path()
  p.absarc(0, 0, radius, 0, Math.PI * 2, false)
  ;(p as unknown as { curves: { arcLengthDivisions: number }[] }).curves.forEach((c) => {
    c.arcLengthDivisions = segments
  })
  return p
}

export interface FlatExtrudeOptions {
  thickness: number
  bevel?: number
  bevelSegments?: number
  curveSegments?: number
}

/**
 * Extrudes a shape and lays it flat in the XZ plane with its face pointing +Y.
 * Shape +Y becomes world -Z, so a shape drawn "as you look at the dial" ends up
 * with its top at 12 o'clock.
 */
export function flatExtrude(
  shape: THREE.Shape | THREE.Shape[],
  opts: FlatExtrudeOptions,
): THREE.BufferGeometry {
  const { thickness, bevel = 0.05, bevelSegments = 3, curveSegments = 24 } = opts
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments,
    curveSegments,
  })
  g.translate(0, 0, -thickness / 2)
  g.rotateX(-Math.PI / 2)
  return g
}
