import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { parametricSurface } from './utils'

/** A profile vertex: radius, height, and how strongly flutes modulate it. */
export interface Rib {
  r: number
  y: number
  /** 0 = perfectly circular here, 1 = full flute depth. */
  w: number
}

/**
 * The flute cross-section, returned in [-1, 1].
 *
 * A cosine blended toward a triangle wave: the triangle supplies the sharp V and the
 * narrow ridge of a genuinely machined flute, while the residual cosine keeps the
 * very tip of each ridge from being a shading-breaking knife edge.
 */
function fluteWave(
  phase: number,
  sharpness: number,
  triangleness: number,
  crestBias: number,
): number {
  const cos = Math.cos(phase)
  const t = (phase / (Math.PI * 2)) % 1
  const tri = 1 - 4 * Math.abs((t < 0 ? t + 1 : t) - 0.5)
  const blended = cos * (1 - triangleness) + tri * triangleness
  const shaped = Math.sign(blended) * Math.pow(Math.abs(blended), sharpness)

  /**
   * The profile is ASYMMETRIC: flat-topped ridges, sharp V valleys.
   *
   * Close inspection of the reference bezel shows each ridge carries a narrow flat
   * land while the groove between comes to a point. A symmetric triangle gives knife
   * edges at both ends, which sparkle wrongly — the flats are what hold a steady
   * highlight as the watch turns, and the sharp valleys are what read as cut.
   */
  const n = (shaped + 1) / 2
  return Math.pow(n, crestBias) * 2 - 1
}

function densify(ribs: Rib[], perSegment: number): Rib[] {
  const out: Rib[] = []
  for (let i = 0; i < ribs.length - 1; i++) {
    const a = ribs[i]
    const b = ribs[i + 1]
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment
      out.push({
        r: a.r + (b.r - a.r) * t,
        y: a.y + (b.y - a.y) * t,
        w: a.w + (b.w - a.w) * t,
      })
    }
  }
  out.push(ribs[ribs.length - 1])
  return out
}

export interface FlutedSurfaceOptions {
  /** Meridian profile, traversed clockwise in the (radius, height) plane. */
  ribs: Rib[]
  fluteCount: number
  fluteDepth: number
  /**
   * Which way the groove is cut. `radial` moves points in and out, which only shows
   * up where the profile slopes; `normal` cuts perpendicular to the surface, which
   * works on a flat face too.
   */
  cut?: 'radial' | 'normal'
  /** Interpolated steps inserted between consecutive ribs. */
  densifySteps?: number
  /**
   * Crest shaping. <1 broadens the crests and narrows the valleys; 1 is a plain
   * cosine. Applied after the triangle blend below.
   */
  sharpness?: number
  /**
   * Blend from cosine (0) toward a triangle wave (1).
   *
   * A real fluted bezel is CUT, not moulded: each flute is a V-groove with a narrow
   * ridge between it and the next, so the cross-section is close to triangular. A
   * pure cosine gives soft rounded humps that read as knurling rather than flutes,
   * and loses the crisp alternating light/dark facets that make the bezel sparkle.
   */
  triangleness?: number
  /** <1 broadens the ridge into a flat land and sharpens the valley. */
  crestBias?: number
  segmentsPerFlute?: number
  creaseAngle?: number
}

export interface FlutedBezelOptions extends Omit<FlutedSurfaceOptions, 'ribs'> {
  outerRadius: number
  innerRadius: number
  height: number
}

/**
 * The fluted bezel.
 *
 * A pure lathe cannot express this, so the bezel is a parametric surface
 * P(theta, s) whose radius is modulated by a shaped cosine of theta. The
 * modulation is windowed along the profile by `w` so the flutes are full depth
 * across the sloping face and fade to nothing at the polished top rim and the
 * underside — which is exactly how the real bezel is cut.
 *
 * `fluteCount` should be tuned visually against reference: the pitch wants to read
 * around 2.5mm at the outer edge (~44 flutes at r=18mm).
 */
export function buildFlutedBezel(opts: FlutedBezelOptions): THREE.BufferGeometry {
  const {
    outerRadius,
    innerRadius,
    height,
    fluteCount,
    ...rest
  } = opts

  /**
   * Profile runs from the inner top aperture, out and down the fluted face, around
   * the outer edge and back along the underside.
   *
   * Radii are FRACTIONS of the band width, never fixed millimetre offsets. With
   * absolute offsets, narrowing the band (as matching the reference bezel required)
   * made `inner + 1.5` overshoot `outer - 1.5`, folding the profile back on itself
   * and shredding the flutes into a ragged zigzag.
   */
  const band = outerRadius - innerRadius
  const at = (f: number) => innerRadius + f * band
  const ribs: Rib[] = [
    { r: at(0), y: height - 0.55, w: 0 },
    { r: at(0.02), y: height - 0.2, w: 0 },
    { r: at(0.08), y: height, w: 0 },             // narrow polished inner rim
    { r: at(0.12), y: height - 0.02, w: 1 },      // flutes start at FULL depth
    { r: at(0.42), y: height - 0.3, w: 1 },
    { r: at(0.68), y: height - 0.78, w: 1 },
    { r: at(0.88), y: height - 1.24, w: 1 },
    // Flutes run right OUT to the outer edge and wrap over it. The reference shows
    // the sawtooth silhouetted on the rim itself; a polished band there erased the
    // very edge where the flutes are most legible.
    { r: at(1), y: height - 1.66, w: 1 },         // outer edge
    { r: at(1), y: 0.3, w: 1 },                   // outer wall, still fluted
    { r: at(0.98), y: 0.05, w: 0.35 },
    { r: at(0.96), y: 0, w: 0 },
    { r: at(0), y: 0, w: 0 },                     // underside
  ]

  return buildFlutedSurface({ ribs, fluteCount, ...rest })
}

/**
 * The general form: any surface of revolution with flutes cut around it.
 *
 * `ribs` is the meridian profile, traversed CLOCKWISE in the (radius, height) plane
 * — outward along the top, down the outer wall, back along the underside — with `w`
 * windowing how strongly each rib is modulated.
 */
export function buildFlutedSurface(opts: FlutedSurfaceOptions): THREE.BufferGeometry {
  const {
    ribs,
    fluteCount,
    fluteDepth,
    sharpness = 1.0,
    triangleness = 0.94,
    crestBias = 0.72,
    segmentsPerFlute = 18,
    creaseAngle = Math.PI / 12,
    densifySteps = 7,
    cut = 'radial',
  } = opts

  const profile = densify(ribs, densifySteps)
  const uSegments = Math.max(64, fluteCount * segmentsPerFlute)

  /**
   * Outward surface normals in the (radius, height) plane, for `cut: 'normal'`.
   *
   * Displacing radially only produces relief where the profile SLOPES: on a flat
   * annulus, moving a point in or out just slides it along the same plane and the
   * surface stays dead flat. A caseback's notch band is nearly flat, so its teeth
   * have to be cut perpendicular to the face — which is also how the real ones are
   * machined.
   */
  const normals = profile.map((_, i) => {
    const a = profile[Math.max(0, i - 1)]
    const b = profile[Math.min(profile.length - 1, i + 1)]
    const dr = b.r - a.r
    const dy = b.y - a.y
    const len = Math.hypot(dr, dy) || 1
    // Clockwise traversal, so the outward normal is (-dy, dr) normalised.
    return { nr: -dy / len, ny: dr / len }
  })

  const geometry = parametricSurface(uSegments, profile.length - 1, (u, v, target) => {
    const i = Math.min(profile.length - 1, Math.round(v * (profile.length - 1)))
    const { r, y, w } = profile[i]
    const theta = u * Math.PI * 2
    const shaped = fluteWave(theta * fluteCount, sharpness, triangleness, crestBias)
    const amount = shaped * fluteDepth * 0.5 * w
    const rr = r + amount * (cut === 'normal' ? normals[i].nr : 1)
    const yy = y + (cut === 'normal' ? amount * normals[i].ny : 0)
    target.set(Math.sin(theta) * rr, yy, Math.cos(theta) * rr)
  })

  return toCreasedNormals(geometry, creaseAngle)
}

/**
 * Radial gripping notches — the fluted rim of a screw-down caseback, or the
 * vertical grip flutes on a winding crown. Same modulation trick, applied to a
 * cylindrical band.
 */
export function buildKnurledBand(opts: {
  radius: number
  height: number
  notches: number
  depth: number
  yStart?: number
  chamfer?: number
  sharpness?: number
  triangleness?: number
}): THREE.BufferGeometry {
  const {
    radius, height, notches, depth,
    yStart = 0, chamfer = 0.12, sharpness = 0.95, triangleness = 0.85,
  } = opts

  const ribs: Rib[] = [
    { r: radius - chamfer, y: yStart, w: 0 },
    { r: radius, y: yStart + chamfer, w: 1 },
    { r: radius, y: yStart + height - chamfer, w: 1 },
    { r: radius - chamfer, y: yStart + height, w: 0 },
  ]
  const profile = densify(ribs, 4)

  const geometry = parametricSurface(
    Math.max(96, notches * 8),
    profile.length - 1,
    (u, v, target) => {
      const i = Math.min(profile.length - 1, Math.round(v * (profile.length - 1)))
      const { r, y, w } = profile[i]
      const theta = u * Math.PI * 2
      const shaped = fluteWave(theta * notches, sharpness, triangleness, 0.85)
      // Offset so the teeth are cut INTO the nominal radius rather than proud of it.
      const rr = r + shaped * depth * 0.5 * w - depth * 0.5 * w
      target.set(Math.sin(theta) * rr, y, Math.cos(theta) * rr)
    },
  )

  return toCreasedNormals(geometry, Math.PI / 8)
}
