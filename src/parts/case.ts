import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BEZEL, CASE, CASEBACK, CROWN, CRYSTAL } from '../config/datejust36'
import { buildFlutedBezel, buildKnurledBand } from '../geometry/flutes'
import { buildLathe } from '../geometry/lathe'
import { cached, type P2, mergeAll } from '../geometry/utils'
import { Y } from './layout'

/**
 * One lug, drawn as its side profile in the ZY plane and extruded across X.
 * Lugs taper and curve downward away from the case; the bevel is what gives the
 * polished flank its bright edge.
 */
/** Each lug is this thick across X; a pair straddles the 20mm bracelet gap. */
const LUG_THICKNESS = 3.45

function buildLug(): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  // Starts well inside the case body so the merge is seamless, then sweeps out and
  // down to the spring-bar boss. A Datejust lug is a thick horn, not a thin arc.
  shape.moveTo(-12.0, 2.5)
  shape.quadraticCurveTo(-17.2, 2.2, -20.2, 0.6)
  shape.quadraticCurveTo(-22.1, -0.5, -21.9, -2.2)
  shape.quadraticCurveTo(-21.7, -3.7, -20.0, -4.0)
  shape.quadraticCurveTo(-17.0, -4.4, -13.6, -5.0)
  shape.lineTo(-12.0, -5.2)
  shape.lineTo(-12.0, 2.5)

  const g = new THREE.ExtrudeGeometry(shape, {
    depth: LUG_THICKNESS,
    bevelEnabled: true,
    bevelThickness: 0.42,
    bevelSize: 0.46,
    bevelOffset: 0,
    bevelSegments: 6,
    curveSegments: 24,
  })
  // Shape is in XY; rotate so its X becomes world Z and extrude runs along world X.
  g.rotateY(Math.PI / 2)
  g.translate(0, 0, 0)
  return g
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
      [CASE.bezelSeatRadius, Y.bezelBottom - 0.35],
      [CASE.middleRadius - 0.5, Y.bezelBottom - 0.62],
      // Polished flank, very slightly barrelled.
      [CASE.middleRadius, 0.9],
      [CASE.middleRadius, -1.6],
      // Underside curves monotonically inward to the caseback aperture. Stepping
      // back outward here produced a self-intersecting lathe and a phantom flange.
      [CASE.middleRadius - 0.45, -3.1],
      [CASE.middleRadius - 1.15, -4.5],
      [CASE.middleRadius - 1.75, Y.caseMiddleBottom],
      [CASEBACK.outerRadius, Y.caseMiddleBottom],
      [CASEBACK.outerRadius, Y.casebackSeat],
      [CASE.boreRadius, Y.casebackInner + 0.2],
      [CASE.boreRadius, Y.caseMiddleTop],
    ]
    const body = buildLathe(profile, { segments: 256, chamfer: 0.09 })

    const lugs: THREE.BufferGeometry[] = []
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const lug = buildLug()
        lug.scale(1, 1, sz)
        // Inner faces must sit exactly `lugWidth` apart so a 20mm bracelet fits
        // between them — the lug body is OUTSIDE that gap, not inside it.
        lug.translate(sx * (CASE.lugWidth / 2 + LUG_THICKNESS / 2), 0, 0)
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

/** Twinlock winding crown: knurled grip band with a domed, coronet-stamped face. */
export function buildCrown(): THREE.BufferGeometry {
  return cached('case/crown', () => {
    const { radius, length, fluteCount, fluteDepth } = CROWN
    const body = buildLathe(
      [
        [0, -length / 2],
        [radius - 0.5, -length / 2],
        [radius, -length / 2 + 0.4],
        [radius, length / 2 - 0.5],
        [radius - 0.35, length / 2 - 0.1],
        [radius - 1.5, length / 2],
        [0, length / 2],
      ],
      { segments: 128, chamfer: 0.08 },
    )
    const grip = buildKnurledBand({
      radius,
      height: length - 1.0,
      notches: fluteCount,
      depth: fluteDepth,
      yStart: -length / 2 + 0.45,
      chamfer: 0.1,
    })
    const merged = mergeAll([body, grip], 'case')
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
