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
   * The lug starts at the WAIST, z = 0.
   *
   * This is the whole reason the case reads as one machined mass. An Oyster's lugs
   * are not four tabs stuck onto a cylinder: on each side of the watch the 12 and 6
   * lugs are the two ends of ONE continuous arc that runs the length of the case.
   * Starting each lug at |z|=8 left a stretch of bare circular case between them, so
   * the four lugs read as separate fins no matter how well each one blended.
   *
   * Running the loft from the waist out, with its root cut to the case's own
   * silhouette, means the two halves meet flush at z = 0 and the arc is unbroken.
   */
  rootZ: 0,
  /** Lug-to-lug ~44mm on a 36mm case: the 1.22 ratio measured off the plan view. */
  tipZ: 22.0,
  /**
   * The outer edge is ONE ARC, not a width taper.
   *
   * Driving it from a width that fell off with distance produced two curves joined
   * end to end. The width held up early, so the edge ran near-parallel from the
   * waist out to the shoulder — a visibly FLAT stretch — and only then broke into
   * the taper. The side of an Oyster is a single continuous arc from the waist right
   * out to the lug tip, with no straight section anywhere along it.
   *
   * So the edge is a circle fitted through three points. The waist point is supplied
   * at build time from the flank's own widest radius, so the arc and the case meet
   * exactly and share a vertical tangent there; `shoulder` sets how full the side
   * is, and `tip` is the outer corner of the lug. Moving `shoulder` makes the side
   * fuller or leaner and it stays a single arc either way.
   */
  shoulder: [16.36, 11.0] as const,
  tip: [12.7, 22.0] as const,
  /**
   * At the waist the lug is AS TALL AS THE CASE — because there it IS the case.
   *
   * These match the flank profile's own extent exactly, so in profile the lug's
   * shoulder fills the full height of the middle case instead of being a half-height
   * fin riding on the side of it. Nothing stops the section being this tall once the
   * inner face is held outside the bore (see `boreGuardRadius`); what used to stop it
   * was the inner face driving in to 10mm while the top was still above the dial,
   * which surfaced the lug straight through it.
   */
  topAtRoot: 2.0,
  bottomAtRoot: -5.3,
  /**
   * The tip is set by the BRACELET, not by the case.
   *
   * A link's arched outer edge spans 2.53mm, centred on -3.15. The lug tip is sized
   * to straddle that with a couple of tenths proud top and bottom, so the lug closes
   * around the end link instead of running alongside it.
   */
  topAtTip: -1.72,
  bottomAtTip: -4.58,
  /**
   * Fraction of the length over which the tip curves down and tails off.
   *
   * Longer than it was. The lug does not stop at the bracelet, it CURVES DOWN and
   * runs out to nothing over its last few millimetres — collapsing the section over
   * a mere eighth of the length made that a blunt stub instead of a taper.
   */
  noseFraction: 0.24,
  /**
   * Radius broken onto the section's edges at the ROOT, tightening toward the tip.
   *
   * A generous radius belongs at the waist, where the lug is part of the case's
   * curved flank. Carried out to a tip only 2.9mm tall it rounds the section into a
   * blob; the real lug end is a defined edge.
   */
  cornerRadius: 0.85,
  cornerRadiusAtTip: 0.34,
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
  rootBlend: 0.5,
  /**
   * How far inside the case skin the root sits, as a fraction of its radius.
   *
   * Only enough to stop the lug's surface being exactly coplanar with the flank at
   * the waist, which would z-fight. It does not need to hide an open end: the +z and
   * -z lofts have identical sections at z = 0, so mirroring closes the surface
   * through the waist on its own.
   */
  rootBury: 0.008,
  /**
   * Thickness of the band the lug starts life as, at the waist.
   *
   * The inner face cannot sit at `innerX` all the way back to z = 0 — that would be
   * a slab reaching from x=10 to the case skin right across the middle of the watch,
   * straight through the movement. So the root is a thin shell hugging the flank
   * that only thickens inward as the lug emerges.
   */
  rootShell: 1.5,
  /**
   * Radius of the cylinder the lug is forbidden to enter, whatever else it is doing.
   *
   * Outside the movement bore (15.0), the dial (14.7) and the calibre (14.25) with a
   * little to spare. Holding the inner face outside this is what lets the lug be full
   * case height at the shoulder: it is exactly how the real monobloc is made, the
   * bore is bored and the lugs are what is left standing outside it.
   */
  boreGuardRadius: 15.2,
  /** How far the tip turns down over its tail-off. */
  tipDroop: 0.85,
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

/**
 * The circle through three points, as centre and radius in the (x, z) plane.
 *
 * Returns null when the points are collinear — which for the side arc would mean a
 * dead straight lug edge, so the caller falls back rather than dividing by zero.
 */
function circleThrough(
  p: readonly [number, number],
  q: readonly [number, number],
  r: readonly [number, number],
): { cx: number; cz: number; radius: number } | null {
  const d = 2 * (p[0] * (q[1] - r[1]) + q[0] * (r[1] - p[1]) + r[0] * (p[1] - q[1]))
  if (Math.abs(d) < 1e-9) return null
  const sp = p[0] * p[0] + p[1] * p[1]
  const sq = q[0] * q[0] + q[1] * q[1]
  const sr = r[0] * r[0] + r[1] * r[1]
  const cx = (sp * (q[1] - r[1]) + sq * (r[1] - p[1]) + sr * (p[1] - q[1])) / d
  const cz = (sp * (r[0] - q[0]) + sq * (p[0] - r[0]) + sr * (q[0] - p[0])) / d
  return { cx, cz, radius: Math.hypot(p[0] - cx, p[1] - cz) }
}

/**
 * The case side in plan, from the waist out to the lug tip.
 *
 * The waist point is taken from the flank at the lug's own mid-height, so the arc
 * starts exactly on the case and — since both curves have a vertical tangent at
 * z = 0 — leaves it smoothly rather than stepping off it.
 */
type Arc = { cx: number; cz: number; radius: number } | null
let sideArcCache: Arc | undefined

// Fitted lazily, not at module load: the waist point comes from `flankRadius`, whose
// FLANK table is declared further down the file. Function declarations hoist but
// `const` does not, so evaluating this eagerly reads it inside its dead zone.
function sideArc(): Arc {
  if (sideArcCache === undefined) {
    const midY = (LUG.topAtRoot + LUG.bottomAtRoot) / 2
    sideArcCache = circleThrough([flankRadius(midY), 0], LUG.shoulder, LUG.tip)
  }
  return sideArcCache
}

/** How far out the side arc reaches at `z`. */
function sideArcX(z: number): number {
  const arc = sideArc()
  if (!arc) return LUG.tip[0]
  return arc.cx + Math.sqrt(Math.max(0.04, arc.radius ** 2 - (z - arc.cz) ** 2))
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
  cornerRadius: number,
): THREE.Vector2 {
  const mid = (top + bot) / 2
  const r = Math.min(
    cornerRadius,
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
    const blend = v >= LUG.rootBlend ? 0 : 1 - smoothstep(v / LUG.rootBlend)
    const mid = (top + bot) / 2
    const edge = sideArcX(z)

    /**
     * Near the root the section takes on the case's own VERTICAL taper — narrowing
     * top and bottom exactly as the flank does — while keeping the arc's magnitude.
     *
     * Interpolating the magnitude toward the silhouette instead, as this did, pulled
     * the outline off the arc and down onto the case circle for the first few
     * millimetres. The circle turns in far harder than the arc does, so the side
     * picked up an inflection right where it is supposed to be smoothest.
     */
    const outerAt = (y: number) => {
      if (blend <= 0) return edge
      const shape = caseSilhouetteX(y, z) / caseSilhouetteX(mid, z)
      const scaled = edge * (1 + (shape - 1) * blend) * (1 - LUG.rootBury * blend)
      return Math.max(LUG.innerX + 0.4, scaled)
    }

    /**
     * The inner face walks OUT as the lug retreats into the case.
     *
     * At the tip and along the visible run it is the flat wall at `innerX` that the
     * end link sits against; back at the waist it closes up to a thin shell on the
     * flank, so the root is buried in the case skin rather than driven across the
     * middle of the watch through the movement.
     */
    const emerge = 1 - blend
    const shell = LUG.innerX + (outerAt(mid) - LUG.rootShell - LUG.innerX) * blend
    // Never inside the bore. Near the waist this dominates; by the time the lug has
    // run out past z = 11 or so the cylinder has fallen away behind it and the flat
    // wall the end link sits against takes over.
    const guard = Math.sqrt(Math.max(0, LUG.boreGuardRadius ** 2 - z * z))
    const innerX = Math.max(shell, Math.min(LUG.innerX, guard))

    // The tail-off: a quarter-circle collapse of the section over the last stretch,
    // so the loft closes on itself instead of needing an end cap.
    let shrink = 1
    let droop = 0
    if (v > 1 - LUG.noseFraction) {
      const t = (v - (1 - LUG.noseFraction)) / LUG.noseFraction
      shrink = Math.sqrt(Math.max(0, 1 - t * t))
      // And it CURVES DOWN as it goes. A section that only shrinks reads as a stub
      // sawn off square; the real lug end turns under toward the bracelet as it
      // thins, which is what gives the tip its hooked profile.
      droop = LUG.tipDroop * t * t
    }

    const p = lugSectionPoint(
      u, innerX, outerAt, bot, top,
      LUG.crown * emerge,
      lerp(LUG.cornerRadius, LUG.cornerRadiusAtTip, Math.pow(v, 0.8)),
    )
    const cy = mid
    const cx = (innerX + outerAt(cy)) / 2
    target.set(cx + (p.x - cx) * shrink, cy + (p.y - cy) * shrink - droop, -z)
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
  /**
   * Curvature below the apex — very gentle.
   *
   * At 0.085 the flank drew in by 2.35mm on the way down to the caseback, which is
   * what made the case read as a thin disc that tapers away rather than the solid
   * block an Oyster is machined from. The real case keeps almost its full width all
   * the way to the back, leaving a broad flat annulus around the caseback.
   */
  kBelow: 0.042,
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
      ...flankProfile(2.0, -5.25, 26),
      // Underside tucks monotonically inward to the caseback aperture. Stepping
      // back outward here produced a self-intersecting lathe and a phantom flange.
      [flankRadius(-5.55) - 0.35, -5.75],
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
/**
 * The sapphire crystal — with the Cyclops aperture bored straight through it.
 *
 * The lens is NOT a second pane sitting on top. Stacking two transmissive bodies over
 * the date meant each one refracted the other rather than the dial: drei's
 * transmission renders the scene into a buffer that excludes only the mesh it is
 * attached to, so the lens's buffer was full of crystal and the crystal's was full of
 * lens, and between them the date could not be read at all. One bore, one plug, one
 * glass path — and the lens becomes thick enough for its curvature to actually bend
 * anything.
 *
 * Losing the lathe costs the crystal its 0.16mm dome, which on a 30mm pane is a
 * rounding error, and a Datejust crystal is near-flat to begin with.
 */
export function buildCrystal(): THREE.BufferGeometry {
  return cached('case/crystal', () => {
    const pane = new THREE.Shape()
    pane.absarc(0, 0, CRYSTAL.radius, 0, Math.PI * 2, false)
    const bore = new THREE.Path()
    // Undersized by a hair so the plug overlaps rather than meeting it face to face:
    // coincident walls z-fight, and a gap the other way would show as a bright ring.
    bore.absarc(CRYSTAL.cyclops.distanceFromCentre, 0, CRYSTAL.cyclops.radius - 0.03, 0, Math.PI * 2, true)
    pane.holes.push(bore)

    const g = flatExtrude(pane, {
      thickness: CRYSTAL.thickness,
      bevel: 0.09,
      bevelSegments: 3,
      curveSegments: 72,
    })
    return toCreasedNormals(g, Math.PI / 5)
  })
}

/**
 * The Cyclops, modelled as a PLUG rather than a cap.
 *
 * It fills the crystal's bore over the full pane thickness and then domes above it,
 * so the only thing between the date and the eye is one continuous piece of sapphire
 * a little over 2mm thick. That depth is what makes the magnification real: a lens
 * skimmed onto the surface has barely any path length to refract over.
 *
 * Local y = 0 is the crystal's TOP face, so the part positions on `Y.crystalTop`.
 */
export function buildCyclops(): THREE.BufferGeometry {
  return cached('case/cyclops', () => {
    const { radius, rise, curvature } = CRYSTAL.cyclops
    const skirt = CRYSTAL.thickness
    const steps = 24
    const profile: P2[] = [[0, -skirt], [radius, -skirt]]
    // Convex face, worked from the rim back in to the axis.
    for (let i = steps; i >= 0; i--) {
      const r = (i / steps) * radius
      profile.push([r, rise - (curvature - Math.sqrt(Math.max(0, curvature * curvature - r * r)))])
    }
    return buildLathe(profile, { segments: 96, creaseAngle: Math.PI / 3 })
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

    /**
     * The body NECKS IN over the grip, to the depth of the flute valleys.
     *
     * This is why the crown had no flutes. `buildKnurledBand` cuts its teeth INWARD
     * from the nominal radius, and the body's wall was a smooth cylinder at that same
     * radius over the same span — so every tooth was sealed inside solid metal. The
     * body now runs at the valley radius across the grip and only returns to full
     * radius for the narrow rims top and bottom, leaving the band to form the
     * surface between them.
     */
    const valley = radius - fluteDepth
    const gripFrom = -face + 0.45
    const gripTo = face - 0.62

    const body = buildLathe(
      [
        [0, -face],
        [radius - 0.5, -face],
        [radius, -face + 0.36],        // lower rim, full diameter
        [radius, gripFrom - 0.06],
        [valley, gripFrom],            // neck in behind the teeth
        [valley, gripTo],
        [radius, gripTo + 0.06],       // upper rim
        [radius, face - 0.5],
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
      height: gripTo - gripFrom,
      notches: fluteCount,
      depth: fluteDepth,
      yStart: gripFrom,
      chamfer: 0.06,
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
