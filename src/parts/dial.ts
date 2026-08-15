import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { DIAL } from '../config/datejust36'
import { coronetShapes } from '../geometry/coronet'
import { buildLathe, planarUV } from '../geometry/lathe'
import { flatExtrude, roundedRect } from '../geometry/shapes'
import { cached, mergeAll } from '../geometry/utils'

/** Outer radius of the date ring; numerals sit on DIAL.date.distanceFromCentre. */
export const DATE_DISC_RADIUS = 11.9

/**
 * The dial plate.
 *
 * Built as a PLANAR-uv disc rather than a lathe, because the printed artwork has to
 * map correctly. That means the sunray grain cannot come from a constant
 * anisotropyRotation the way it does on lathed parts — it comes from the explicit
 * radial anisotropyMap generated alongside the print.
 */
export function buildDial(): THREE.BufferGeometry {
  return cached('dial/plate', () => {
    const face = new THREE.Shape()
    face.absarc(0, 0, DIAL.radius, 0, Math.PI * 2, false)

    // Date aperture at 3 o'clock (+X in shape space).
    const aperture = roundedRect(DIAL.date.width, DIAL.date.height, 0.16)
    const offset = new THREE.Vector2(DIAL.date.distanceFromCentre, 0)
    face.holes.push(
      new THREE.Path(aperture.getPoints(32).map((pt) => pt.clone().add(offset))),
    )

    const g = flatExtrude(face, { thickness: DIAL.thickness, bevel: 0.035, curveSegments: 96 })
    return planarUV(g, DIAL.radius)
  })
}

/** Applied baton index: a chamfered white-gold trough. */
/**
 * Applied baton index, built as an open FRAME rather than a solid block.
 *
 * A Rolex applied marker is a white gold surround with a luminous compound poured
 * into the channel, and the polished inner walls of that channel are what throw the
 * hard bright line down each side of the baton. Modelling the marker solid and
 * laying lume on top loses those walls, and the index flattens into a painted
 * rectangle — the single clearest tell on a dial.
 */
export function buildIndex(double = false): THREE.BufferGeometry {
  return cached(`dial/index-${double}`, () => {
    const { length, width, height, frameWall } = DIAL.indices
    const make = (offsetX: number) => {
      const outline = roundedRect(width, length, width * 0.16)
      outline.holes.push(
        new THREE.Path(
          roundedRect(
            width - frameWall * 2,
            length - frameWall * 2,
            (width - frameWall * 2) * 0.2,
          ).getPoints(24),
        ),
      )
      const g = flatExtrude(outline, {
        thickness: height,
        bevel: 0.055,
        bevelSegments: 3,
        curveSegments: 12,
      })
      g.translate(offsetX, 0, 0)
      return g
    }
    // The 12 o'clock marker on a Datejust is a doubled baton.
    const gap = width * 1.22
    const parts = double ? [make(-gap / 2), make(gap / 2)] : [make(0)]
    const merged = parts.length > 1 ? mergeAll(parts, 'index') : parts[0]
    return toCreasedNormals(merged, Math.PI / 5)
  })
}

/** The luminous fill sitting in the index trough, slightly domed and inset. */
export function buildIndexLume(double = false): THREE.BufferGeometry {
  return cached(`dial/indexLume-${double}`, () => {
    const { length, width, height, frameWall } = DIAL.indices
    // Fills the frame channel and sits very slightly below its rim, so the polished
    // walls stay visible around it.
    const w = width - frameWall * 2
    const l = length - frameWall * 2
    const make = (offsetX: number) => {
      const g = flatExtrude(roundedRect(w, l, w * 0.18), {
        thickness: height * 0.78,
        bevel: 0.035,
        bevelSegments: 2,
        curveSegments: 10,
      })
      g.translate(offsetX, -height * 0.09, 0)
      return g
    }
    const gap = width * 1.22
    const parts = double ? [make(-gap / 2), make(gap / 2)] : [make(0)]
    return parts.length > 1 ? mergeAll(parts, 'indexLume') : parts[0]
  })
}

/** Applied coronet above the wordmark at 12. */
export function buildCoronetApplique(): THREE.BufferGeometry {
  return cached('dial/coronet', () => {
    const shapes = coronetShapes(DIAL.coronet.width, DIAL.coronet.width * 0.78)
    const g = flatExtrude(shapes, { thickness: 0.28, bevel: 0.035, bevelSegments: 2, curveSegments: 16 })
    // Shape origin is the base of the crown; centre it on its own bounding box.
    g.computeBoundingBox()
    const box = g.boundingBox!
    g.translate(0, 0, -(box.min.z + box.max.z) / 2)
    return toCreasedNormals(g, Math.PI / 4)
  })
}

/** The date ring: a flat annulus carrying 31 numerals, planar-mapped. */
export function buildDateDisc(): THREE.BufferGeometry {
  return cached('dial/dateDisc', () => {
    // The aperture sits 10.4mm from centre, so the ring has to span it.
    const outer = DATE_DISC_RADIUS
    const g = buildLathe(
      [[7.4, -0.18], [outer, -0.18], [outer, 0.18], [7.4, 0.18], [7.4, -0.18]],
      { segments: 192, chamfer: 0.05 },
    )
    return planarUV(g, outer)
  })
}

/** Dial feet — the two posts that locate the dial on the movement. */
export function buildDialFoot(): THREE.BufferGeometry {
  return cached('dial/foot', () =>
    buildLathe([[0, 0], [0.32, 0], [0.32, -1.5], [0.24, -1.7], [0, -1.7]], {
      segments: 24,
      chamfer: 0.04,
    }),
  )
}

/** Thin polished ring framing the date aperture. */
export function buildDateFrame(): THREE.BufferGeometry {
  return cached('dial/dateFrame', () => {
    const outerShape = roundedRect(DIAL.date.width + 0.34, DIAL.date.height + 0.34, 0.2)
    outerShape.holes.push(
      new THREE.Path(roundedRect(DIAL.date.width, DIAL.date.height, 0.16).getPoints(32)),
    )
    return flatExtrude(outerShape, { thickness: 0.16, bevel: 0.04, bevelSegments: 2 })
  })
}
