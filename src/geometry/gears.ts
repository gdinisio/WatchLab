import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { flatExtrude } from './shapes'

const DEG = Math.PI / 180
/** Involute function: inv(a) = tan(a) - a. */
const inv = (a: number) => Math.tan(a) - a

export interface GearOptions {
  teeth: number
  /** Pitch diameter = module × teeth. Watch wheels run very fine modules. */
  module: number
  thickness: number
  pressureAngle?: number
  boreRadius?: number
  /** Lightening openings between the hub and the rim, as on a real train wheel. */
  crossings?: number
  hubRadius?: number
  /** Radial width of the toothed rim left solid. */
  rimWidth?: number
  bevel?: number
}

/**
 * A true involute spur gear.
 *
 * The involute of a circle is P(t) = rb·(cos t + t·sin t, sin t − t·cos t), whose
 * radius is rb·√(1+t²) and whose polar angle is inv(atan t). Building the flanks from
 * that — rather than faking trapezoidal teeth — is what makes a train of wheels read
 * as a real gear train when you look closely.
 */
export function buildGearShape(opts: GearOptions): THREE.Shape {
  const {
    teeth: z,
    module: m,
    pressureAngle = 20 * DEG,
    boreRadius = 0,
    crossings = 0,
    hubRadius,
    rimWidth,
  } = opts

  const rp = (m * z) / 2
  const rb = rp * Math.cos(pressureAngle)
  const ra = rp + m
  const rf = Math.max(rb * 1.001, rp - 1.25 * m)

  const halfToothBase = Math.PI / (2 * z) + inv(pressureAngle)
  /** Half angular tooth thickness at radius r. */
  const psi = (r: number) => {
    const cosPhi = Math.min(1, rb / r)
    return Math.max(0, halfToothBase - inv(Math.acos(cosPhi)))
  }

  const shape = new THREE.Shape()
  const STEPS = 7
  const rStart = Math.max(rf, rb * 1.0005)
  const polar = (a: number, r: number) => [Math.cos(a) * r, Math.sin(a) * r] as const

  for (let i = 0; i < z; i++) {
    const centre = (i / z) * Math.PI * 2

    // Start of this tooth's rising flank. The straight run from the previous
    // tooth's trailing flank forms the root gap.
    const startA = centre - psi(rStart)
    if (i === 0) shape.moveTo(...polar(startA, rStart))
    else shape.lineTo(...polar(startA, rStart))

    for (let s = 1; s <= STEPS; s++) {
      const r = rStart + (ra - rStart) * (s / STEPS)
      shape.lineTo(...polar(centre - psi(r), r))
    }
    // Tip land across the top of the tooth.
    shape.lineTo(...polar(centre + psi(ra), ra))
    for (let s = STEPS - 1; s >= 0; s--) {
      const r = rStart + (ra - rStart) * (s / STEPS)
      shape.lineTo(...polar(centre + psi(r), r))
    }
  }
  shape.closePath()

  if (boreRadius > 0) {
    const bore = new THREE.Path()
    bore.absarc(0, 0, boreRadius, 0, Math.PI * 2, true)
    shape.holes.push(bore)
  }

  if (crossings > 0) {
    const inner = hubRadius ?? Math.max(boreRadius * 2.2, rf * 0.3)
    const outer = rf - (rimWidth ?? m * 1.6)
    if (outer > inner + 0.12) {
      const spokeHalf = Math.PI / crossings / 3.1
      for (let c = 0; c < crossings; c++) {
        const mid = (c / crossings) * Math.PI * 2 + Math.PI / crossings
        const from = mid - Math.PI / crossings + spokeHalf
        const to = mid + Math.PI / crossings - spokeHalf
        const hole = new THREE.Path()
        hole.absarc(0, 0, outer, from, to, false)
        hole.absarc(0, 0, inner, to, from, true)
        hole.closePath()
        shape.holes.push(hole)
      }
    }
  }

  return shape
}

export function buildGear(opts: GearOptions): THREE.BufferGeometry {
  const g = flatExtrude(buildGearShape(opts), {
    thickness: opts.thickness,
    bevel: opts.bevel ?? 0.02,
    bevelSegments: 2,
    curveSegments: 12,
  })
  return toCreasedNormals(g, Math.PI / 4)
}

/**
 * The Chronergy escape wheel: skeletonised, with asymmetric club teeth whose
 * impulse faces are what actually drive the pallet fork.
 */
export function buildEscapeWheel(opts: {
  teeth: number
  radius: number
  thickness: number
  boreRadius?: number
}): THREE.BufferGeometry {
  const { teeth, radius, thickness, boreRadius = 0.28 } = opts
  const rInner = radius * 0.74
  const shape = new THREE.Shape()

  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2
    const step = (Math.PI * 2) / teeth
    const p = (ang: number, r: number) => [Math.cos(ang) * r, Math.sin(ang) * r] as const

    // Rim, then the tooth: a slim curved neck rising to a hooked club head with a
    // flat impulse plane on its leading side.
    const [x0, y0] = p(a0, rInner)
    if (i === 0) shape.moveTo(x0, y0)
    else shape.lineTo(x0, y0)

    shape.lineTo(...p(a0 + step * 0.06, rInner))
    shape.lineTo(...p(a0 + step * 0.1, radius * 0.9))
    shape.lineTo(...p(a0 + step * 0.1, radius))       // heel
    shape.lineTo(...p(a0 + step * 0.36, radius))      // club head land
    shape.lineTo(...p(a0 + step * 0.36, radius * 0.9))// impulse face (flat, radial)
    shape.lineTo(...p(a0 + step * 0.44, radius * 0.86))
    shape.lineTo(...p(a0 + step * 0.95, rInner))
  }
  shape.closePath()

  const bore = new THREE.Path()
  bore.absarc(0, 0, boreRadius, 0, Math.PI * 2, true)
  shape.holes.push(bore)

  // Skeletonising: large lightening openings, the visual signature of Chronergy.
  const spokes = 6
  for (let c = 0; c < spokes; c++) {
    const mid = (c / spokes) * Math.PI * 2 + Math.PI / spokes
    const half = Math.PI / spokes - 0.16
    const hole = new THREE.Path()
    hole.absarc(0, 0, rInner - 0.18, mid - half, mid + half, false)
    hole.absarc(0, 0, boreRadius + 0.32, mid + half, mid - half, true)
    hole.closePath()
    shape.holes.push(hole)
  }

  const g = flatExtrude(shape, { thickness, bevel: 0.015, bevelSegments: 2, curveSegments: 10 })
  return toCreasedNormals(g, Math.PI / 4)
}

/** A pinion: the small high-tooth-count driver a wheel sits on. */
export function buildPinion(opts: {
  leaves: number
  radius: number
  height: number
  boreRadius?: number
}): THREE.BufferGeometry {
  const { leaves, radius, height, boreRadius = 0 } = opts
  const shape = new THREE.Shape()
  const rRoot = radius * 0.62
  const step = (Math.PI * 2) / leaves

  for (let i = 0; i < leaves; i++) {
    const a = i * step
    const pt = (ang: number, r: number) => [Math.cos(ang) * r, Math.sin(ang) * r] as const
    if (i === 0) shape.moveTo(...pt(a, rRoot))
    else shape.lineTo(...pt(a, rRoot))
    shape.lineTo(...pt(a + step * 0.18, radius * 0.94))
    shape.lineTo(...pt(a + step * 0.32, radius))
    shape.lineTo(...pt(a + step * 0.5, radius))
    shape.lineTo(...pt(a + step * 0.64, radius * 0.94))
    shape.lineTo(...pt(a + step * 0.82, rRoot))
  }
  shape.closePath()

  if (boreRadius > 0) {
    const bore = new THREE.Path()
    bore.absarc(0, 0, boreRadius, 0, Math.PI * 2, true)
    shape.holes.push(bore)
  }

  const g = flatExtrude(shape, { thickness: height, bevel: 0.012, bevelSegments: 1, curveSegments: 8 })
  return toCreasedNormals(g, Math.PI / 4)
}
