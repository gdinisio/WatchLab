import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { parametricSurface } from './utils'

/** A profile vertex: radius, height, and how strongly flutes modulate it. */
interface Rib {
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
function fluteWave(phase: number, sharpness: number, triangleness: number): number {
  const cos = Math.cos(phase)
  const t = (phase / (Math.PI * 2)) % 1
  const tri = 1 - 4 * Math.abs((t < 0 ? t + 1 : t) - 0.5)
  const blended = cos * (1 - triangleness) + tri * triangleness
  // Sign-preserving power so crest and valley stay symmetric about the base radius.
  return Math.sign(blended) * Math.pow(Math.abs(blended), sharpness)
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

export interface FlutedBezelOptions {
  outerRadius: number
  innerRadius: number
  height: number
  fluteCount: number
  fluteDepth: number
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
  segmentsPerFlute?: number
  creaseAngle?: number
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
    fluteDepth,
    sharpness = 1.0,
    triangleness = 0.94,
    segmentsPerFlute = 18,
    creaseAngle = Math.PI / 12,
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
    { r: at(0.11), y: height, w: 0 },             // polished inner rim, unfluted
    { r: at(0.15), y: height - 0.02, w: 0 },
    { r: at(0.19), y: height - 0.05, w: 1 },      // flutes start at FULL depth
    { r: at(0.42), y: height - 0.3, w: 1 },
    { r: at(0.68), y: height - 0.78, w: 1 },
    { r: at(0.84), y: height - 1.16, w: 1 },      // ...and hold it right across
    { r: at(0.88), y: height - 1.28, w: 0 },      // stop cleanly
    { r: at(0.94), y: height - 1.46, w: 0 },      // polished outer band
    { r: at(1), y: height - 1.74, w: 0 },         // outer edge
    { r: at(1), y: 0.12, w: 0 },
    { r: at(0.96), y: 0, w: 0 },
    { r: at(0), y: 0, w: 0 },                     // underside
  ]

  const profile = densify(ribs, 7)
  const uSegments = Math.max(64, fluteCount * segmentsPerFlute)

  const geometry = parametricSurface(uSegments, profile.length - 1, (u, v, target) => {
    const i = Math.min(profile.length - 1, Math.round(v * (profile.length - 1)))
    const { r, y, w } = profile[i]
    const theta = u * Math.PI * 2
    const shaped = fluteWave(theta * fluteCount, sharpness, triangleness)
    const rr = r + shaped * fluteDepth * 0.5 * w
    target.set(Math.sin(theta) * rr, y, Math.cos(theta) * rr)
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
      const shaped = fluteWave(theta * notches, sharpness, triangleness)
      // Offset so the teeth are cut INTO the nominal radius rather than proud of it.
      const rr = r + shaped * depth * 0.5 * w - depth * 0.5 * w
      target.set(Math.sin(theta) * rr, y, Math.cos(theta) * rr)
    },
  )

  return toCreasedNormals(geometry, Math.PI / 8)
}
