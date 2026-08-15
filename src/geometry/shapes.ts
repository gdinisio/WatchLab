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

/**
 * Extrudes a section drawn in the X–Y plane along Z, centred on the origin.
 *
 * The companion to `flatExtrude`, and the right tool whenever the piece is CURVED
 * ACROSS its extrusion — a bracelet link, a curved case band. Putting the curve in
 * the section outline means it is sampled as finely as the shape is, where extruding
 * the plan outline and displacing the caps afterwards cannot work at all: an
 * extruded cap is earcut from its outline alone, so its interior is a handful of
 * triangles spanning the whole piece and any arch collapses into a tent.
 */
export function sectionExtrude(
  shape: THREE.Shape | THREE.Shape[],
  opts: { depth: number; bevel?: number; bevelSegments?: number; curveSegments?: number },
): THREE.BufferGeometry {
  const { depth, bevel = 0.05, bevelSegments = 3, curveSegments = 12 } = opts
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments,
    curveSegments,
  })
  g.translate(0, 0, -depth / 2)
  return g
}

/**
 * Bends a piece into a shallow transverse arc across X, crown at x = 0.
 *
 * For pieces whose plan outline rules out `sectionExtrude` — an end link hugging the
 * round case, a clasp cover. Run `subdivide` first or the displacement has nothing
 * to act on across the middle of the faces.
 */
export function archAcrossX(
  g: THREE.BufferGeometry,
  halfWidth: number,
  rise: number,
  exponent = 2.4,
): THREE.BufferGeometry {
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.abs(pos.getX(i)) / halfWidth)
    pos.setY(i, pos.getY(i) - rise * Math.pow(t, exponent))
  }
  pos.needsUpdate = true
  g.computeVertexNormals()
  return g
}
