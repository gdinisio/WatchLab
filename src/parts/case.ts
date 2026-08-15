import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BEZEL, CASE, CASEBACK, CROWN, CRYSTAL } from '../config/datejust36'
import { buildFlutedBezel, buildKnurledBand } from '../geometry/flutes'
import { coronetShapes } from '../geometry/logoSvg'
import { buildLathe } from '../geometry/lathe'
import { flatExtrude } from '../geometry/shapes'
import { cached, parametricSurface, type P2, mergeAll } from '../geometry/utils'
import { Y } from './layout'

/**
 * The lug, built as a LOFT rather than an extrusion.
 *
 * The previous version extruded a side profile along X at constant thickness, which
 * meant that in PLAN VIEW every lug was a rectangle with flat outer faces — the
 * reason they read as slabs bolted to the case. A real Oyster lug does two things
 * that a constant extrusion cannot:
 *
 *  - it TAPERS, broad where it leaves the case and narrow at the bracelet, and
 *  - its outer face is CURVED, continuing the round flank of the case so the two
 *    read as one machined mass rather than a case with fins attached.
 *
 * So the lug is lofted instead: a rounded cross-section swept along its length, with
 * the box it fills shrinking and dropping as it goes. The section is a superellipse,
 * which gives softly rounded corners without needing explicit fillets.
 */
/** Widest radius of the case flank; the lug's shoulder is cut to follow it. */
const FLANK_MAX = CASE.middleRadius

const LUG = {
  /** Inner faces sit exactly `lugWidth` apart so the bracelet fits between them. */
  innerX: CASE.lugWidth / 2,
  /**
   * Where the lug leaves the case.
   *
   * This has to be SHALLOW. The case circle narrows fast: at |z|=11.5 it only
   * reaches x=13.3, so a root there gives a 3mm sliver with nothing to blend into —
   * thin sticks poking out of a circle. At |z|=8 the circle still reaches x=15.7,
   * which is a 5.7mm shoulder that merges into the case exactly as the reference
   * does.
   *
   * The inner corner does then fall inside the 15mm movement bore, but the lug's top
   * face is held below the dial, so it cannot surface the way it did before; and in
   * the exploded view the case and movement travel apart anyway.
   */
  rootZ: 8.0,
  /** Lug-to-lug ends up ~42mm on a 36mm case, matching the reference 1.17 ratio. */
  tipZ: 21.0,
  /**
   * Outer face beyond the shoulder. Near the root the edge FOLLOWS THE CASE CIRCLE
   * exactly (see lugSection), then blends into this gentle straight taper — which is
   * what makes the lug look grown out of the case rather than merely adjacent to it.
   */
  outerAtMid: 13.7,
  outerAtTip: 12.9,
  /** How far along the lug the circle-following blends out into the straight taper. */
  blendEnd: 0.5,
  topAtRoot: 0.3,
  topAtTip: -1.6,
  bottomAtRoot: -5.4,
  bottomAtTip: -4.2,
  /** Fraction of the length over which the tip rounds off into a blunt nose. */
  noseFraction: 0.09,
  /** Superellipse exponent. Higher = squarer section, lower = rounder. */
  sectionExponent: 3.4,
} as const

interface LugSection {
  z: number
  cx: number
  cy: number
  hx: number
  hy: number
}

function lugSection(v: number): LugSection {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const z = -lerp(LUG.rootZ, LUG.tipZ, v)

  // Where the case still exists at this z, the lug's outer edge lies ON its circle,
  // so the two silhouettes are one continuous curve. Past the shoulder the circle
  // collapses toward zero, so the edge blends into a straight gentle taper instead.
  const circle = Math.sqrt(Math.max(0, FLANK_MAX * FLANK_MAX - z * z))
  const straight = lerp(LUG.outerAtMid, LUG.outerAtTip, v)
  const t = Math.min(1, v / LUG.blendEnd)
  const blend = t * t * (3 - 2 * t) // smoothstep
  const xOut = Math.max(circle * (1 - blend) + straight * blend, LUG.innerX + 0.6)
  const yTop = lerp(LUG.topAtRoot, LUG.topAtTip, Math.pow(v, 1.5))
  const yBot = lerp(LUG.bottomAtRoot, LUG.bottomAtTip, Math.pow(v, 1.7))

  // Blunt rounded nose: a quarter-circle collapse over the last stretch, so the
  // loft closes on itself instead of needing a separate end cap.
  let shrink = 1
  if (v > 1 - LUG.noseFraction) {
    const t = (v - (1 - LUG.noseFraction)) / LUG.noseFraction
    shrink = Math.sqrt(Math.max(0, 1 - t * t))
  }

  return {
    z,
    cx: (LUG.innerX + xOut) / 2,
    cy: (yTop + yBot) / 2,
    hx: ((xOut - LUG.innerX) / 2) * shrink,
    hy: ((yTop - yBot) / 2) * shrink,
  }
}

function buildLug(): THREE.BufferGeometry {
  const n = LUG.sectionExponent
  const superell = (t: number, half: number) => {
    const c = Math.cos(t)
    return Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * half
  }

  const g = parametricSurface(48, 64, (u, v, target) => {
    const s = lugSection(v)
    const t = u * Math.PI * 2
    const sn = Math.sin(t)
    target.set(
      s.cx + superell(t, s.hx),
      s.cy + Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n) * s.hy,
      s.z,
    )
  })
  return toCreasedNormals(g, Math.PI / 4)
}

/**
 * The Oyster flank is a CONTINUOUS CONVEX BULGE, not a cylinder.
 *
 * This is the single biggest thing that decides whether the silhouette reads as a
 * Rolex. Seen from the side the case swells outward to its widest point a little
 * ABOVE centre, then sweeps in a long, gentle curve down to the caseback — so the
 * whole flank is one unbroken mirror-polished surface that pulls a single bright
 * band of reflection around the watch. A straight vertical wall gives a flat,
 * lifeless stripe instead and instantly reads as a generic case.
 *
 * The curve is a pair of parabolas sharing an apex at `apexY`: tight above, gentle
 * below, which is the asymmetry visible in the reference profile.
 */
const FLANK = {
  maxRadius: FLANK_MAX,
  apexY: 0.25,
  /** Curvature above the apex — tight, so the case tucks quickly under the bezel. */
  kAbove: 0.34,
  /** Curvature below the apex — gentle, for the long sweep to the caseback. */
  kBelow: 0.085,
} as const

function flankRadius(y: number): number {
  const d = y - FLANK.apexY
  const k = d > 0 ? FLANK.kAbove : FLANK.kBelow
  return FLANK.maxRadius - k * d * d
}

function flankProfile(fromY: number, toY: number, steps: number): P2[] {
  const out: P2[] = []
  for (let i = 0; i <= steps; i++) {
    const y = fromY + (toY - fromY) * (i / steps)
    out.push([flankRadius(y), y])
  }
  return out
}

/**
 * The Oyster middle case: a lathed monobloc body with four lugs merged in.
 * The bezel seat, caseback thread shoulder and movement bore are all real steps in
 * the profile so the assembly stacks correctly.
 */
export function buildMiddleCase(): THREE.BufferGeometry {
  return cached('case/middle', () => {
    const profile: P2[] = [
      [CASE.boreRadius, Y.caseMiddleTop],
      [BEZEL.innerRadius - 0.15, Y.caseMiddleTop],
      [CASE.bezelSeatRadius, Y.caseMiddleTop - 0.02],
      [CASE.bezelSeatRadius, Y.bezelBottom - 0.4],
      // Sampled convex flank, top of the bulge down to the caseback shoulder.
      ...flankProfile(2.0, -4.9, 26),
      // Underside tucks monotonically inward to the caseback aperture. Stepping
      // back outward here produced a self-intersecting lathe and a phantom flange.
      [flankRadius(-5.2) - 0.35, -5.4],
      [CASEBACK.outerRadius + 0.55, Y.caseMiddleBottom],
      [CASEBACK.outerRadius, Y.caseMiddleBottom],
      [CASEBACK.outerRadius, Y.casebackSeat],
      [CASE.boreRadius, Y.casebackInner + 0.2],
      [CASE.boreRadius, Y.caseMiddleTop],
    ]
    // A finer crease angle keeps the whole bulge smooth while the bezel seat and
    // caseback shoulder stay crisp.
    const body = buildLathe(profile, { segments: 256, chamfer: 0.07, creaseAngle: Math.PI / 7 })

    const lugs: THREE.BufferGeometry[] = []
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const lug = buildLug()
        lug.scale(sx, 1, sz)
        lugs.push(lug)
      }
    }

    const merged = mergeAll([body, ...lugs], 'case')
    merged.computeVertexNormals()
    return toCreasedNormals(merged, Math.PI / 5)
  })
}

export function buildBezel(): THREE.BufferGeometry {
  return cached('case/bezel', () =>
    buildFlutedBezel({
      outerRadius: BEZEL.outerRadius,
      innerRadius: BEZEL.innerRadius,
      height: BEZEL.height,
      fluteCount: BEZEL.fluteCount,
      fluteDepth: BEZEL.fluteDepth,
      sharpness: BEZEL.fluteSharpness,
    }),
  )
}

/**
 * The sapphire crystal: a near-flat disc with a very slight dome, plus the Cyclops
 * lens built as a real plano-convex cap so it magnifies the date through genuine
 * refraction rather than a fake distortion shader.
 */
export function buildCrystal(): THREE.BufferGeometry {
  return cached('case/crystal', () => {
    const { radius, thickness, domeRise } = CRYSTAL
    const steps = 24
    const top: P2[] = []
    const bottom: P2[] = []
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const r = t * radius
      // Shallow spherical cap.
      const rise = domeRise * (1 - (r / radius) ** 2)
      top.push([r, thickness / 2 + rise])
      bottom.push([r, -thickness / 2 + rise * 0.25])
    }
    const profile: P2[] = [...bottom, ...top.reverse()]
    return buildLathe(profile, { segments: 192, creaseAngle: Math.PI / 3 })
  })
}

export function buildCyclops(): THREE.BufferGeometry {
  return cached('case/cyclops', () => {
    const { radius, rise, curvature } = CRYSTAL.cyclops
    const steps = 20
    const profile: P2[] = [[0, 0]]
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const r = t * radius
      // Spherical convex face of the given radius of curvature.
      const h = curvature - Math.sqrt(Math.max(0, curvature * curvature - r * r))
      profile.push([r, rise - h])
    }
    profile.push([radius, -0.35], [0, -0.35])
    return buildLathe(profile, { segments: 128, creaseAngle: Math.PI / 3 })
  })
}

export function buildCaseback(): THREE.BufferGeometry {
  return cached('case/back', () => {
    const { outerRadius, thickness, domeRise, rimNotches } = CASEBACK
    const steps = 18
    const outer: P2[] = []
    for (let i = steps; i >= 0; i--) {
      const t = i / steps
      const r = t * (outerRadius - 0.8)
      const rise = domeRise * (1 - (r / (outerRadius - 0.8)) ** 2)
      outer.push([r, -thickness / 2 - rise])
    }
    const profile: P2[] = [
      [0, thickness / 2],
      [outerRadius - 1.1, thickness / 2],
      [outerRadius - 0.15, thickness / 2 - 0.35],
      [outerRadius, thickness / 2 - 0.6],
      [outerRadius, -thickness / 2 + 0.25],
      ...outer,
    ]
    const body = buildLathe(profile, { segments: 224, chamfer: 0.07 })
    // Fluted gripping rim for the Rolex casing tool.
    const rim = buildKnurledBand({
      radius: outerRadius,
      height: thickness - 0.4,
      notches: rimNotches,
      depth: 0.22,
      yStart: -thickness / 2 + 0.22,
      chamfer: 0.08,
    })
    const merged = mergeAll([body, rim], 'case')
    return toCreasedNormals(merged, Math.PI / 6)
  })
}

/**
 * Twinlock winding crown: knurled grip band with the coronet standing proud inside a
 * shallow recessed dish on its face.
 *
 * The recess matters as much as the coronet itself — on the real crown the dish
 * shades to near-black while the crown sits in it catching light, and that contrast
 * is what makes the logo legible at 5mm across.
 */
export function buildCrown(): THREE.BufferGeometry {
  return cached('case/crown', () => {
    const { radius, length, fluteCount, fluteDepth } = CROWN
    const face = length / 2
    const dishFloor = face - 0.26

    const body = buildLathe(
      [
        [0, -face],
        [radius - 0.5, -face],
        [radius, -face + 0.4],
        [radius, face - 0.55],
        [radius - 0.28, face - 0.16],
        [radius - 0.5, face],          // narrow polished land around the dish
        [radius - 0.62, face - 0.08],  // dish wall
        [radius - 0.72, dishFloor],
        [0, dishFloor],                // recessed floor the coronet sits on
      ],
      { segments: 128, chamfer: 0.05 },
    )

    const grip = buildKnurledBand({
      radius,
      height: length - 1.05,
      notches: fluteCount,
      depth: fluteDepth,
      yStart: -face + 0.45,
      chamfer: 0.1,
    })

    // Coronet, sitting in the dish and standing just shy of the surrounding land.
    const coronet = flatExtrude(coronetShapes(radius * 1.28), {
      thickness: 0.19,
      bevel: 0.025,
      bevelSegments: 2,
      curveSegments: 12,
    })
    coronet.computeBoundingBox()
    const b = coronet.boundingBox!
    coronet.translate(0, dishFloor + 0.095, -(b.min.z + b.max.z) / 2)

    const merged = mergeAll([body, grip, coronet], 'case')
    return toCreasedNormals(merged, Math.PI / 7)
  })
}

export function buildCrownTube(): THREE.BufferGeometry {
  return cached('case/crownTube', () =>
    buildLathe(
      [
        [CROWN.tubeRadius - 0.55, -CROWN.tubeLength / 2],
        [CROWN.tubeRadius, -CROWN.tubeLength / 2],
        [CROWN.tubeRadius, CROWN.tubeLength / 2],
        [CROWN.tubeRadius - 0.55, CROWN.tubeLength / 2],
      ],
      { segments: 96, chamfer: 0.06 },
    ),
  )
}

export function buildWindingStem(): THREE.BufferGeometry {
  return cached('case/stem', () =>
    buildLathe(
      [
        [0, -7.4], [0.55, -7.4], [0.55, -2.2], [0.75, -2.0],
        [0.75, 0.6], [0.5, 0.9], [0.5, 4.2], [0.42, 4.6], [0, 4.6],
      ],
      { segments: 48, chamfer: 0.05 },
    ),
  )
}

/** O-ring gasket. `tube` is the cord thickness. */
export function buildGasket(radius: number, tube: number): THREE.BufferGeometry {
  return cached(`case/gasket-${radius}-${tube}`, () => {
    const g = new THREE.TorusGeometry(radius, tube, 20, 160)
    g.rotateX(Math.PI / 2)
    return g
  })
}

/** Casing ring: the plastic/steel spacer that centres the movement in the bore. */
export function buildCasingRing(): THREE.BufferGeometry {
  return cached('case/casingRing', () =>
    buildLathe(
      [
        [13.9, -0.9], [CASE.boreRadius - 0.1, -0.9],
        [CASE.boreRadius - 0.1, 0.9], [13.9, 0.9], [13.9, -0.9],
      ],
      { segments: 128, chamfer: 0.08 },
    ),
  )
}

export function buildSpringBar(): THREE.BufferGeometry {
  return cached('case/springBar', () => {
    const g = buildLathe(
      [
        [0, -CASE.lugWidth / 2], [0.45, -CASE.lugWidth / 2 + 0.5],
        [0.45, CASE.lugWidth / 2 - 0.5], [0, CASE.lugWidth / 2],
      ],
      { segments: 32, chamfer: 0.05 },
    )
    g.rotateZ(Math.PI / 2)
    return g
  })
}
