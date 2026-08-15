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
   * Crest shaping. <1 broadens the crests and narrows the valleys, which is how a
   * real fluted bezel is cut; 1 is a plain cosine.
   */
  sharpness?: number
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
    sharpness = 0.7,
    segmentsPerFlute = 10,
    creaseAngle = Math.PI / 7,
  } = opts

  // Profile runs from the inner top aperture, out and down the fluted face, around
  // the outer edge and back along the underside.
  const ribs: Rib[] = [
    { r: innerRadius, y: height - 0.55, w: 0 },
    { r: innerRadius + 0.06, y: height - 0.2, w: 0 },
    { r: innerRadius + 0.34, y: height, w: 0 },          // polished top rim
    { r: innerRadius + 0.85, y: height - 0.05, w: 0.35 },
    { r: innerRadius + 1.5, y: height - 0.3, w: 1 },     // fluted face
    { r: outerRadius - 1.5, y: height - 1.15, w: 1 },
    { r: outerRadius - 0.45, y: height - 1.85, w: 0.8 },
    { r: outerRadius - 0.08, y: height - 2.15, w: 0.25 },
    { r: outerRadius, y: height - 2.3, w: 0 },           // outer edge
    { r: outerRadius, y: 0.12, w: 0 },
    { r: outerRadius - 0.16, y: 0, w: 0 },
    { r: innerRadius, y: 0, w: 0 },                      // underside
  ]

  const profile = densify(ribs, 5)
  const uSegments = Math.max(64, fluteCount * segmentsPerFlute)

  const geometry = parametricSurface(uSegments, profile.length - 1, (u, v, target) => {
    const i = Math.min(profile.length - 1, Math.round(v * (profile.length - 1)))
    const { r, y, w } = profile[i]
    const theta = u * Math.PI * 2
    const c = Math.cos(theta * fluteCount)
    // Biased toward the crest: broad polished ridges separated by narrow V cuts.
    const shaped = Math.pow((c + 1) / 2, sharpness) * 2 - 1
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
}): THREE.BufferGeometry {
  const {
    radius, height, notches, depth,
    yStart = 0, chamfer = 0.12, sharpness = 1.1,
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
      const c = Math.cos(theta * notches)
      const shaped = Math.sign(c) * Math.pow(Math.abs(c), sharpness)
      const rr = r + shaped * depth * 0.5 * w - depth * 0.5 * w
      target.set(Math.sin(theta) * rr, y, Math.cos(theta) * rr)
    },
  )

  return toCreasedNormals(geometry, Math.PI / 8)
}
