import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BEZEL, CASE, CASEBACK, CROWN, CRYSTAL } from '../config/datejust36'
import { buildFlutedBezel, buildFlutedSurface, buildKnurledBand, type Rib } from '../geometry/flutes'
import { coronetShapes } from '../geometry/logoSvg'
import { buildLathe } from '../geometry/lathe'
import { flatExtrude } from '../geometry/shapes'
import { cached, flipWinding, parametricSurface, type P2, mergeAll } from '../geometry/utils'
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
 * So the lug is lofted instead: a rounded-box cross-section swept along its length,
 * with the box it fills shrinking and dropping as it goes.
 *
 * The root of that loft is cut to the CASE'S OWN SILHOUETTE and blended out of it
 * over the first third, which is what makes the junction a shoulder. Starting the
 * loft at full width instead left each lug standing off the case with a wedge of
 * daylight behind it and an open end where the section began — four blades beside a
 * cylinder, which is precisely what the case is not.
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
  /** Lug-to-lug ~44mm on a 36mm case: the 1.22 ratio measured off the plan view. */
  tipZ: 22.0,
  /**
   * The lug is driven by its WIDTH, not by an outer-edge radius.
   *
   * Chasing the case circle put all the taper in the buried root: by the time the
   * lug emerged, the edge had already flattened to near-parallel, so the visible
   * part was a rectangle. Tapering the width directly guarantees the narrowing
   * happens over the part you can actually see.
   *
   * The plan-view reference also settles a question the side views could not: the
   * lug outline flares OUTSIDE the bezel circle before tapering to the tip. Case
   * plus lugs read as a cushion, not a circle with tabs stuck on, so the shoulder
   * is meant to stand a little proud of the bezel.
   */
  widthAtRoot: 8.6,
  widthAtTip: 2.7,
  /**
   * ABOVE 1, so the width holds up.
   *
   * This was 0.7, which front-loads the taper — and since the first third of the lug
   * is buried in the case, all of the width was spent where nobody can see it: by
   * the time the lug cleared the bezel it was down to 4.7mm and read as a spike. An
   * exponent above 1 does the opposite, holding the shoulder broad out past the
   * bezel and doing the narrowing over the visible run to the tip.
   */
  taperExponent: 1.3,
  topAtRoot: 0.3,
  bottomAtRoot: -5.4,
  /**
   * The tip is set by the BRACELET, not by the case.
   *
   * A link's arched outer edge spans 2.53mm, centred on -3.15. The lug tip is sized
   * to straddle that with a couple of tenths proud top and bottom, so the lug closes
   * around the end link instead of running alongside it.
   */
  topAtTip: -1.72,
  bottomAtTip: -4.58,
  /** Fraction of the length over which the tip rounds off into a blunt nose. */
  noseFraction: 0.13,
  /** Radius broken onto every edge of the section. */
  cornerRadius: 0.85,
  /** How far the top face crowns across the lug's width. */
  crown: 0.2,
  /**
   * Fraction of the length over which the lug grows OUT OF the case flank.
   *
   * Over this stretch the outer edge is interpolated from the case's own silhouette
   * to the lug's width, which is what turns the junction into a shoulder. Without it
   * the lug simply began at full width wherever its root happened to fall, standing
   * off the case with a wedge of daylight behind it — four blades beside a cylinder
   * rather than one machined mass.
   */
  rootBlend: 0.35,
  /** How far inside the case skin the root sits, so its open end never shows. */
  rootBury: 0.3,
} as const

/**
 * How far out in x the case reaches at height `y`, `z` along the lug's axis.
 *
 * The case is a surface of revolution of radius `flankRadius(y)`, so this is just
 * that circle sliced at z — and it is the curve the lug's root is cut to.
 */
function caseSilhouetteX(y: number, z: number): number {
  const r = flankRadius(y)
  return Math.sqrt(Math.max(0.04, r * r - z * z))
}

const _sec = new THREE.Vector2()

/**
 * One point on the lug's cross-section, traversed counter-clockwise as a rounded
 * rectangle: outer face up, over the top, down the inner face, back along the base.
 *
 * A rounded rectangle rather than the superellipse this used to be, because the
 * INNER face has to be a genuine flat wall. It is the surface the end link sits
 * against, and a rounded section only ever touches the bracelet along a single line
 * — which is why the lugs read as running alongside the bracelet rather than
 * gripping it.
 *
 * The outer edge is a FUNCTION of height, not a constant, so the root can be cut to
 * the case's own silhouette while the tip is a clean flat flank.
 */
function lugSectionPoint(
  u: number,
  xIn: number,
  outerAt: (y: number) => number,
  bot: number,
  top: number,
  crown: number,
): THREE.Vector2 {
  const mid = (top + bot) / 2
  const r = Math.min(
    LUG.cornerRadius,
    (top - bot) * 0.42,
    Math.max(0.02, (outerAt(mid) - xIn) * 0.42),
  )
  const yLo = bot + r
  const yHi = top - r
  const xHi = outerAt(yHi)
  const xLo = outerAt(yLo)
  const seg = Math.floor(u * 8) % 8
  const s = (u * 8) % 1
  const quarter = (from: number) => from + (s * Math.PI) / 2

  switch (seg) {
    case 0: {
      const y = yLo + (yHi - yLo) * s
      return _sec.set(outerAt(y), y)
    }
    case 1: {
      const a = quarter(0)
      return _sec.set(xHi - r + r * Math.cos(a), yHi + r * Math.sin(a))
    }
    case 2: {
      // Top face, outer to inner. Crowned across its width: a real lug's top is a
      // shallow dome, and it is that curve which pulls a moving highlight along the
      // lug as the watch turns. Squared so it meets the corners with matching SLOPE
      // as well as matching height — a plain sine leaves a 32 degree kink there,
      // right on the crease threshold, which shows up as a hairline along the edge.
      const x0 = xHi - r
      const x1 = xIn + r
      return _sec.set(x0 + (x1 - x0) * s, top + crown * Math.sin(Math.PI * s) ** 2)
    }
    case 3: {
      const a = quarter(Math.PI / 2)
      return _sec.set(xIn + r + r * Math.cos(a), yHi + r * Math.sin(a))
    }
    case 4: {
      return _sec.set(xIn, yHi + (yLo - yHi) * s)
    }
    case 5: {
      const a = quarter(Math.PI)
      return _sec.set(xIn + r + r * Math.cos(a), yLo + r * Math.sin(a))
    }
    case 6: {
      const x0 = xIn + r
      const x1 = xLo - r
      return _sec.set(x0 + (x1 - x0) * s, bot)
    }
    default: {
      const a = quarter((3 * Math.PI) / 2)
      return _sec.set(xLo - r + r * Math.cos(a), yLo + r * Math.sin(a))
    }
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smoothstep = (t: number) => t * t * (3 - 2 * t)

function buildLug(): THREE.BufferGeometry {
  // u must divide into eight for the section's sides and corners to land on
  // segment boundaries.
  const g = parametricSurface(96, 80, (u, v, target) => {
    const z = lerp(LUG.rootZ, LUG.tipZ, v)
    const top = lerp(LUG.topAtRoot, LUG.topAtTip, Math.pow(v, 1.5))
    const bot = lerp(LUG.bottomAtRoot, LUG.bottomAtTip, Math.pow(v, 1.7))
    const width = lerp(LUG.widthAtRoot, LUG.widthAtTip, Math.pow(v, LUG.taperExponent))
    const blend = v >= LUG.rootBlend ? 0 : 1 - smoothstep(v / LUG.rootBlend)

    const outerAt = (y: number) => {
      const lugX = LUG.innerX + width
      if (blend <= 0) return lugX
      const caseX = caseSilhouetteX(y, z) - LUG.rootBury
      return Math.max(LUG.innerX + 0.4, lugX + (caseX - lugX) * blend)
    }

    // Blunt rounded nose: a quarter-circle collapse of the whole section over the
    // last stretch, so the loft closes on itself instead of needing an end cap.
    let shrink = 1
    if (v > 1 - LUG.noseFraction) {
      const t = (v - (1 - LUG.noseFraction)) / LUG.noseFraction
      shrink = Math.sqrt(Math.max(0, 1 - t * t))
    }

    const p = lugSectionPoint(u, LUG.innerX, outerAt, bot, top, LUG.crown * (1 - blend))
    const cy = (top + bot) / 2
    const cx = (LUG.innerX + outerAt(cy)) / 2
    target.set(cx + (p.x - cx) * shrink, cy + (p.y - cy) * shrink, -z)
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
        const lug = buildLug().clone()
        lug.scale(sx, 1, sz)
        // Mirroring on ONE axis reverses triangle winding, and the merge below
        // recomputes normals from winding — so two of the four lugs would light as
        // if turned inside out. Flip them back.
        if (sx * sz < 0) flipWinding(lug)
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

/**
 * The screw-down caseback.
 *
 * A plain satin centre ringed by a dense radial sawtooth — the notches the Rolex
 * casing tool bites into. Both are ONE surface of revolution with the flutes
 * windowed onto the outer annulus, rather than a smooth disc with a knurled band
 * merged on: a knurled band is cut into a cylindrical wall, so seen from behind —
 * which is the only way you ever see a caseback — it is edge-on and invisible.
 *
 * The notches are cut along the surface NORMAL. The band is nearly flat, and a
 * radial cut on a flat annulus just slides points around within the same plane and
 * leaves the surface dead level.
 */
export function buildCaseback(): THREE.BufferGeometry {
  return cached('case/back', () => {
    const { outerRadius, thickness, domeRise, rimNotches, notchInnerRadius, notchDepth } = CASEBACK
    const half = thickness / 2
    const inner = notchInnerRadius

    const ribs: Rib[] = [
      // Inside face, against the casing ring.
      { r: 0, y: half, w: 0 },
      { r: outerRadius - 1.2, y: half, w: 0 },
      { r: outerRadius - 0.2, y: half - 0.4, w: 0 },
      // Outer wall. The notches wrap over it, which is what gives the ring its
      // sawtooth silhouette where it meets the case.
      { r: outerRadius, y: half - 0.75, w: 1 },
      { r: outerRadius, y: -half + 0.3, w: 1 },
      { r: outerRadius - 0.22, y: -half + 0.06, w: 1 },
      // Notch ring, running in across the back face.
      { r: outerRadius - 0.5, y: -half, w: 1 },
      { r: inner + 0.2, y: -half - 0.1, w: 1 },
      // Flutes stop dead here: the boundary between ring and centre is a crisp
      // circle on the real caseback, not a fade.
      { r: inner, y: -half - 0.11, w: 0 },
    ]

    // Plain satin centre, very slightly domed.
    const steps = 14
    for (let i = steps - 1; i >= 0; i--) {
      const r = (i / steps) * inner
      ribs.push({ r, y: -half - 0.11 - domeRise * (1 - (r / inner) ** 2), w: 0 })
    }

    return buildFlutedSurface({
      ribs,
      fluteCount: rimNotches,
      fluteDepth: notchDepth,
      cut: 'normal',
      // Squarer than the bezel's: these are stamped gripping teeth, not cut facets.
      triangleness: 0.8,
      crestBias: 0.9,
      segmentsPerFlute: 8,
      densifySteps: 3,
      creaseAngle: Math.PI / 9,
    })
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
