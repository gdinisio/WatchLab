import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { HANDS } from '../config/datejust36'
import { flatExtrude } from '../geometry/shapes'
import { cached, mergeAll } from '../geometry/utils'

/**
 * A baton hand, drawn pointing along +Y in shape space (so it points at 12 when
 * unrotated) with a hub disc at the origin.
 *
 * The tapering matters: Rolex baton hands narrow very slightly toward the tip, and
 * the chamfered long edges are what catch the light as the hand sweeps.
 */
function batonShape(length: number, width: number, tipTaper = 0.82): THREE.Shape {
  const w = width / 2
  const tw = w * tipTaper
  const s = new THREE.Shape()
  s.moveTo(-w, 0)
  s.lineTo(-tw, length - tw)
  s.quadraticCurveTo(-tw, length, 0, length)
  s.quadraticCurveTo(tw, length, tw, length - tw)
  s.lineTo(w, 0)
  s.absarc(0, 0, w, 0, -Math.PI, true)
  return s
}

function hub(radius: number, thickness: number): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.absarc(0, 0, radius, 0, Math.PI * 2, false)
  return flatExtrude(s, { thickness, bevel: 0.04, bevelSegments: 2, curveSegments: 48 })
}

export function buildHourHand(): THREE.BufferGeometry {
  return cached('hands/hour', () => {
    const { length, width, thickness } = HANDS.hour
    const body = flatExtrude(batonShape(length, width), {
      thickness, bevel: 0.055, bevelSegments: 3, curveSegments: 20,
    })
    const merged = mergeAll([body, hub(0.95, thickness + 0.14)], 'hands')
    return toCreasedNormals(merged, Math.PI / 5)
  })
}

export function buildMinuteHand(): THREE.BufferGeometry {
  return cached('hands/minute', () => {
    const { length, width, thickness } = HANDS.minute
    const body = flatExtrude(batonShape(length, width), {
      thickness, bevel: 0.05, bevelSegments: 3, curveSegments: 20,
    })
    const merged = mergeAll([body, hub(0.8, thickness + 0.12)], 'hands')
    return toCreasedNormals(merged, Math.PI / 5)
  })
}

/** Lume inserts sit in a recess and are slightly domed, never flat decals. */
export function buildHandLume(which: 'hour' | 'minute'): THREE.BufferGeometry {
  return cached(`hands/lume-${which}`, () => {
    const { length, width, thickness, lumeInset } = HANDS[which]
    const s = batonShape(length - lumeInset * 2.4, width - lumeInset * 2, 0.8)
    const g = flatExtrude(s, { thickness: thickness * 0.62, bevel: 0.03, bevelSegments: 2 })
    g.translate(0, thickness * 0.3, lumeInset * 1.1)
    return g
  })
}

/** Slim seconds hand with a counterweight tail. */
export function buildSecondsHand(): THREE.BufferGeometry {
  return cached('hands/seconds', () => {
    const { length, width, thickness, tailLength } = HANDS.seconds
    const w = width / 2
    const s = new THREE.Shape()
    s.moveTo(-w, -tailLength)
    s.lineTo(w, -tailLength)
    s.lineTo(w * 0.72, length)
    s.lineTo(-w * 0.72, length)
    s.closePath()

    const body = flatExtrude(s, { thickness, bevel: 0.025, bevelSegments: 2 })

    // Counterweight: a small disc on the tail.
    const cwShape = new THREE.Shape()
    cwShape.absarc(0, 0, 0.62, 0, Math.PI * 2, false)
    const cw = flatExtrude(cwShape, { thickness: thickness + 0.05, bevel: 0.04, bevelSegments: 2, curveSegments: 32 })
    cw.translate(0, 0, tailLength - 0.62)

    const merged = mergeAll([body, cw, hub(0.5, thickness + 0.2)], 'hands')
    return toCreasedNormals(merged, Math.PI / 5)
  })
}
