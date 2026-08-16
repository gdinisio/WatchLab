import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MOVEMENT } from '../config/datejust36'
import { buildEscapeWheel, buildGear, buildPinion } from '../geometry/gears'
import { buildLathe } from '../geometry/lathe'
import { buildJewel, buildScrew } from '../geometry/screws'
import { flatExtrude, roundedRect } from '../geometry/shapes'
import { cached, type P2, mergeAll } from '../geometry/utils'

const R = MOVEMENT.radius

/**
 * Bridges and cocks are extruded from hand-drawn outlines with a generous bevel.
 *
 * THE BEVEL IS THE ANGLAGE. On a finished movement the chamfered edge of every
 * bridge is mirror-polished while its top face is grained, and that bright polished
 * line tracing the outline is the single strongest signal of hand finishing. A
 * bridge extruded with a hard 90° edge reads as a CAD part, not a watch component.
 */
function bridge(shape: THREE.Shape, thickness: number, bevel = 0.055): THREE.BufferGeometry {
  const g = flatExtrude(shape, { thickness, bevel, bevelSegments: 4, curveSegments: 20 })
  return toCreasedNormals(g, Math.PI / 4)
}

function pinHole(shape: THREE.Shape, x: number, y: number, r: number) {
  const p = new THREE.Path()
  p.absarc(x, y, r, 0, Math.PI * 2, true)
  shape.holes.push(p)
}

/** Main plate: the full-diameter foundation, pierced for the train and barrel. */
export function buildMainPlate(): THREE.BufferGeometry {
  return cached('mvt/mainPlate', () => {
    const shape = new THREE.Shape()
    shape.absarc(0, 0, R, 0, Math.PI * 2, false)
    // Centre bore, barrel arbor, train pivots and the balance opening.
    pinHole(shape, 0, 0, 1.15)
    pinHole(shape, -5.0, 3.4, 4.4)   // barrel seat
    pinHole(shape, 4.6, 2.1, 0.9)
    pinHole(shape, 6.4, -1.6, 0.8)
    pinHole(shape, 3.1, -5.2, 0.75)
    pinHole(shape, -1.8, -7.4, 2.6)  // balance aperture
    pinHole(shape, -9.4, -4.2, 1.1)
    return bridge(shape, 0.95, 0.06)
  })
}

export function buildBarrelBridge(): THREE.BufferGeometry {
  return cached('mvt/barrelBridge', () => {
    const s = new THREE.Shape()
    s.moveTo(-12.4, 1.2)
    s.quadraticCurveTo(-12.8, 8.0, -6.0, 10.2)
    s.quadraticCurveTo(1.6, 12.2, 6.6, 8.2)
    s.quadraticCurveTo(10.2, 5.2, 8.4, 1.0)
    s.quadraticCurveTo(6.6, -2.6, 1.2, -1.2)
    s.quadraticCurveTo(-4.4, 0.4, -8.0, -2.2)
    s.quadraticCurveTo(-11.6, -4.6, -12.4, 1.2)
    pinHole(s, -5.0, 3.4, 0.62)
    pinHole(s, 4.6, 2.1, 0.5)
    return bridge(s, 0.72)
  })
}

export function buildTrainBridge(): THREE.BufferGeometry {
  return cached('mvt/trainBridge', () => {
    const s = new THREE.Shape()
    s.moveTo(9.8, 4.6)
    s.quadraticCurveTo(12.4, 0.6, 9.4, -3.8)
    s.quadraticCurveTo(6.4, -8.0, 1.4, -7.0)
    s.quadraticCurveTo(-2.0, -6.2, -1.0, -3.0)
    s.quadraticCurveTo(0.4, 0.6, 4.4, 1.2)
    s.quadraticCurveTo(8.0, 1.8, 9.8, 4.6)
    pinHole(s, 6.4, -1.6, 0.5)
    pinHole(s, 3.1, -5.2, 0.46)
    return bridge(s, 0.68)
  })
}

/**
 * The traversing balance bridge — a Rolex signature, and the reason their balances
 * hold rate under shock where a cantilevered cock flexes.
 *
 * It has to be a BAR anchored at both ends, with the balance jewel in the middle of
 * the span. What was here was a closed blob covering the whole balance aperture:
 * structurally a cock, and from the caseback it hid the balance wheel completely,
 * which is the one thing anyone looks at.
 */
export function buildBalanceBridge(): THREE.BufferGeometry {
  return cached('mvt/balanceBridge', () => {
    // Anchors either side of the balance staff, in shape space (shape y = -world z).
    const A: [number, number] = [-12.2, -6.6]
    const J: [number, number] = [-5.4, -9.6]
    const B: [number, number] = [0.4, -11.2]
    const halfWidth = 1.65
    const bossWidth = 2.05

    const unit = (p: [number, number], q: [number, number]): [number, number] => {
      const d = Math.hypot(q[0] - p[0], q[1] - p[1])
      return [(q[0] - p[0]) / d, (q[1] - p[1]) / d]
    }
    const dA = unit(A, J)
    const dB = unit(J, B)
    /** Left-hand normal of a direction. */
    const nrm = (d: [number, number]): [number, number] => [-d[1], d[0]]
    const off = (
      p: [number, number], n: [number, number], k: number,
    ): [number, number] => [p[0] + n[0] * k, p[1] + n[1] * k]

    const nA = nrm(dA)
    const nB = nrm(dB)
    const nJ = nrm(unit(A, B))

    const s = new THREE.Shape()
    s.moveTo(...off(A, nA, halfWidth))
    s.quadraticCurveTo(...off(J, nJ, bossWidth + 0.2), ...off(B, nB, halfWidth))
    // Rounded anchor end at B.
    s.quadraticCurveTo(B[0] + dB[0] * 2.1, B[1] + dB[1] * 2.1, ...off(B, nB, -halfWidth))
    s.quadraticCurveTo(...off(J, nJ, -(bossWidth + 0.2)), ...off(A, nA, -halfWidth))
    // Rounded anchor end at A.
    s.quadraticCurveTo(A[0] - dA[0] * 2.1, A[1] - dA[1] * 2.1, ...off(A, nA, halfWidth))
    s.closePath()

    pinHole(s, J[0], J[1], 0.85)  // balance staff jewel setting
    return bridge(s, 0.82, 0.07)
  })
}

export function buildPalletCock(): THREE.BufferGeometry {
  return cached('mvt/palletCock', () => {
    const s = new THREE.Shape()
    s.moveTo(1.2, -4.0)
    s.quadraticCurveTo(4.6, -3.0, 5.4, -5.4)
    s.quadraticCurveTo(6.0, -7.6, 3.6, -8.4)
    s.quadraticCurveTo(0.8, -9.2, -0.2, -6.8)
    s.quadraticCurveTo(-0.8, -5.0, 1.2, -4.0)
    pinHole(s, 3.4, -6.4, 0.4)
    return bridge(s, 0.6)
  })
}

export function buildAutoBridge(): THREE.BufferGeometry {
  return cached('mvt/autoBridge', () => {
    const s = new THREE.Shape()
    s.moveTo(-11.0, 5.4)
    s.quadraticCurveTo(-4.0, 9.6, 3.6, 6.6)
    s.quadraticCurveTo(9.6, 4.2, 8.4, -1.4)
    s.quadraticCurveTo(7.4, -6.0, 2.0, -5.0)
    s.quadraticCurveTo(-4.0, -3.8, -8.4, -0.4)
    s.quadraticCurveTo(-12.4, 2.6, -11.0, 5.4)
    pinHole(s, -2.4, 2.2, 1.5)
    pinHole(s, 3.8, 0.4, 1.2)
    return bridge(s, 0.7)
  })
}

/** Barrel: the mainspring housing, toothed on its outer rim. */
export function buildBarrel(): THREE.BufferGeometry {
  return cached('mvt/barrel', () => {
    const { radius, height, teeth } = MOVEMENT.barrel
    const drum = buildLathe(
      [
        [0.42, -height / 2], [radius - 0.35, -height / 2],
        [radius - 0.35, -height / 2 + 0.22],
        [radius - 0.35, height / 2 - 0.22],
        [radius - 0.35, height / 2], [0.42, height / 2],
      ],
      { segments: 96, chamfer: 0.05 },
    )
    const ring = buildGear({
      teeth, module: (radius * 2) / teeth, thickness: height * 0.42,
      boreRadius: radius - 0.42, bevel: 0.02,
    })
    const merged = mergeAll([drum, ring], 'movement')
    return toCreasedNormals(merged, Math.PI / 4)
  })
}

export function buildMainspring(): THREE.BufferGeometry {
  return cached('mvt/mainspring', () => {
    // A flat coiled ribbon, swept as a tube along an archimedean spiral.
    const turns = 7
    const points: THREE.Vector3[] = []
    const steps = turns * 48
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const a = t * turns * Math.PI * 2
      const r = 1.05 + t * 3.5
      points.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r))
    }
    const curve = new THREE.CatmullRomCurve3(points)
    return new THREE.TubeGeometry(curve, steps, 0.055, 5, false)
  })
}

/** Balance wheel with Microstella regulating nuts on the inner rim. */
export function buildBalanceWheel(): THREE.BufferGeometry {
  return cached('mvt/balance', () => {
    const { radius, rimThickness } = MOVEMENT.balance
    const rim = buildLathe(
      [
        [radius - rimThickness, -0.28], [radius, -0.28],
        [radius, 0.28], [radius - rimThickness, 0.28],
        [radius - rimThickness, -0.28],
      ],
      { segments: 128, chamfer: 0.04 },
    )
    const arms: THREE.BufferGeometry[] = []
    for (let i = 0; i < 2; i++) {
      const arm = flatExtrude(roundedRect(radius * 2 - rimThickness, 0.52, 0.2), {
        thickness: 0.34, bevel: 0.04, bevelSegments: 2,
      })
      arm.rotateY((i / 2) * Math.PI)
      arms.push(arm)
    }
    const staff = buildLathe(
      [[0, -1.1], [0.5, -0.9], [0.5, 0.3], [0.22, 0.4], [0.22, 1.5], [0, 1.5]],
      { segments: 24, chamfer: 0.02 },
    )
    const nuts: THREE.BufferGeometry[] = []
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      const nut = buildLathe(
        [[0, -0.14], [0.2, -0.14], [0.2, 0.14], [0, 0.14]],
        { segments: 12, chamfer: 0.02 },
      )
      nut.rotateZ(Math.PI / 2)
      nut.translate(Math.cos(a) * (radius - rimThickness * 0.5), 0, Math.sin(a) * (radius - rimThickness * 0.5))
      nuts.push(nut)
    }
    const merged = mergeAll([rim, ...arms, staff, ...nuts], 'movement')
    return toCreasedNormals(merged, Math.PI / 4)
  })
}

/** Parachrom bleu hairspring: a flat Breguet-less spiral with a terminal curve. */
export function buildHairspring(): THREE.BufferGeometry {
  return cached('mvt/hairspring', () => {
    const { hairspringTurns, hairspringInnerRadius, hairspringOuterRadius } = MOVEMENT.balance
    const points: THREE.Vector3[] = []
    const steps = hairspringTurns * 40
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const a = t * hairspringTurns * Math.PI * 2
      const r = hairspringInnerRadius + t * (hairspringOuterRadius - hairspringInnerRadius)
      points.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r))
    }
    const curve = new THREE.CatmullRomCurve3(points)
    return new THREE.TubeGeometry(curve, steps, 0.028, 4, false)
  })
}

export function buildPalletFork(): THREE.BufferGeometry {
  return cached('mvt/palletFork', () => {
    const s = new THREE.Shape()
    s.moveTo(-0.22, -0.55)
    s.lineTo(-1.85, -1.5)   // entry pallet arm
    s.lineTo(-2.15, -1.05)
    s.lineTo(-0.42, -0.1)
    s.lineTo(-0.42, 0.1)
    s.lineTo(-2.15, 1.05)   // exit pallet arm
    s.lineTo(-1.85, 1.5)
    s.lineTo(-0.22, 0.55)
    s.lineTo(2.6, 0.3)      // fork horn
    s.lineTo(3.05, 0.62)
    s.lineTo(3.35, 0.1)
    s.lineTo(3.35, -0.1)
    s.lineTo(3.05, -0.62)
    s.lineTo(2.6, -0.3)
    s.closePath()
    return bridge(s, 0.24, 0.02)
  })
}

/**
 * The Perpetual rotor.
 *
 * A heavy CRESCENT, not a ring. The winding mass has to be concentrated on one side
 * or it cannot wind at all — a full ring is balanced, so it would just hang there.
 * Modelled the same way it is made: a segment of solid gold spanning a little over
 * half the disc, its light side scooped away almost to the hub, turning on a central
 * boss. Built as a ring with one spoke it also blocked the entire movement from
 * view, which is the other reason it was wrong.
 */
export function buildRotor(): THREE.BufferGeometry {
  return cached('mvt/rotor', () => {
    const { radius, thickness } = MOVEMENT.rotor
    /** Angular span of the solid mass. */
    const sweep = Math.PI * 1.18
    /** How close the scooped light side comes to the centre. */
    const waist = 2.5
    const STEPS = 48

    const s = new THREE.Shape()
    s.absarc(0, 0, radius, -sweep / 2, sweep / 2, false)
    // Scoop back round the light side, dipping in toward the hub at its deepest.
    const gap = Math.PI * 2 - sweep
    for (let i = 1; i <= STEPS; i++) {
      const f = i / STEPS
      const a = sweep / 2 + gap * f
      const r = radius - (radius - waist) * Math.sin(Math.PI * f) ** 0.7
      s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    s.closePath()

    // Central boss carrying the bearing. Kept separate because the scoop above comes
    // within 2.5mm of the axis, so a bore punched into the segment itself would cross
    // its own outline — and drawn wider than the waist so the boss stands clear of
    // the crescent on the light side instead of being swallowed by it.
    const hub = new THREE.Shape()
    hub.absarc(0, 0, 4.6, 0, Math.PI * 2, false)
    pinHole(hub, 0, 0, 1.5)

    const merged = mergeAll(
      [
        flatExtrude(s, { thickness, bevel: 0.11, bevelSegments: 4, curveSegments: 20 }),
        flatExtrude(hub, { thickness, bevel: 0.08, bevelSegments: 3, curveSegments: 24 }),
      ],
      'rotor',
    )
    return toCreasedNormals(merged, Math.PI / 4)
  })
}

export function buildRotorBearing(): THREE.BufferGeometry {
  return cached('mvt/rotorBearing', () =>
    buildLathe(
      [[1.5, -0.45], [2.9, -0.45], [2.9, 0.45], [1.5, 0.45], [1.5, -0.45]],
      { segments: 64, chamfer: 0.05 },
    ),
  )
}

/** Generic train wheel: gilt rim, crossed out, on a steel pinion. */
export function buildTrainWheel(name: string, teeth: number, radius: number): THREE.BufferGeometry {
  return cached(`mvt/wheel-${name}`, () =>
    buildGear({
      teeth,
      module: (radius * 2) / teeth,
      thickness: 0.16,
      boreRadius: 0.3,
      crossings: 5,
      hubRadius: radius * 0.28,
      rimWidth: radius * 0.14,
    }),
  )
}

export function buildWheelPinion(radius: number, height: number): THREE.BufferGeometry {
  return cached(`mvt/pinion-${radius}-${height}`, () =>
    buildPinion({ leaves: 8, radius, height, boreRadius: 0.14 }),
  )
}

export function buildChronergyEscapeWheel(): THREE.BufferGeometry {
  return cached('mvt/escapeWheel', () =>
    buildEscapeWheel({
      teeth: MOVEMENT.escapeWheel.teeth,
      radius: MOVEMENT.escapeWheel.radius,
      thickness: 0.14,
    }),
  )
}

export function buildRatchetWheel(): THREE.BufferGeometry {
  return cached('mvt/ratchet', () =>
    buildGear({ teeth: 42, module: 0.155, thickness: 0.3, boreRadius: 0.55 }),
  )
}

export function buildCrownWheel(): THREE.BufferGeometry {
  return cached('mvt/crownWheel', () =>
    buildGear({ teeth: 30, module: 0.16, thickness: 0.28, boreRadius: 0.4 }),
  )
}

export function buildDateJumper(): THREE.BufferGeometry {
  return cached('mvt/dateJumper', () => {
    const s = new THREE.Shape()
    s.moveTo(0, -0.3)
    s.quadraticCurveTo(2.4, -1.4, 4.4, -0.5)
    s.lineTo(4.9, 0.2)
    s.lineTo(4.2, 0.5)
    s.quadraticCurveTo(2.2, -0.3, 0, 0.35)
    s.closePath()
    return bridge(s, 0.24, 0.02)
  })
}

export function buildKeylessLever(): THREE.BufferGeometry {
  return cached('mvt/keylessLever', () => {
    const s = new THREE.Shape()
    s.moveTo(0, -0.42)
    s.lineTo(3.2, -0.8)
    s.quadraticCurveTo(4.4, -0.5, 4.2, 0.3)
    s.lineTo(2.4, 0.62)
    s.lineTo(0, 0.42)
    s.closePath()
    pinHole(s, 0.9, 0, 0.28)
    return bridge(s, 0.26, 0.025)
  })
}

export function buildYoke(): THREE.BufferGeometry {
  return cached('mvt/yoke', () => {
    const s = new THREE.Shape()
    s.moveTo(-2.6, 0.4)
    s.quadraticCurveTo(0.4, 1.4, 2.6, 0.2)
    s.lineTo(2.6, -0.5)
    s.quadraticCurveTo(0.2, 0.4, -2.6, -0.4)
    s.closePath()
    return bridge(s, 0.24, 0.02)
  })
}

export function buildCannonPinion(): THREE.BufferGeometry {
  return cached('mvt/cannonPinion', () =>
    buildLathe(
      [[0.28, -0.9], [0.62, -0.9], [0.62, -0.2], [0.44, -0.1],
       [0.44, 0.8], [0.28, 0.9]],
      { segments: 32, chamfer: 0.03 },
    ),
  )
}

export function buildHourWheel(): THREE.BufferGeometry {
  return cached('mvt/hourWheel', () =>
    buildGear({ teeth: 40, module: 0.115, thickness: 0.22, boreRadius: 0.66 }),
  )
}

export function buildMovementScrew(): THREE.BufferGeometry {
  return cached('mvt/screw', () =>
    buildScrew({
      headRadius: 0.42, headHeight: 0.17,
      shankRadius: 0.2, shankLength: 0.62,
    }),
  )
}

export function buildMovementJewel(): THREE.BufferGeometry {
  return cached('mvt/jewel', () => buildJewel(0.4, 0.22))
}

/** Paraflex shock absorber setting: the sprung jewel housing over the balance staff. */
export function buildShockSetting(): THREE.BufferGeometry {
  return cached('mvt/shock', () => {
    const cup: P2[] = [
      [0.3, -0.2], [0.82, -0.2], [0.82, 0.1], [0.66, 0.22], [0.3, 0.22],
    ]
    return buildLathe(cup, { segments: 32, chamfer: 0.02 })
  })
}
