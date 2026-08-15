import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import { useViewer } from '../state/store'
import type { PartDef } from './types'

/**
 * Damped explode scalars, updated once per frame and read by every part.
 *
 * Damping the SCALAR rather than each part is both cheaper and better looking: the
 * whole assembly then shares one inertia, so a scrubbed slider feels like a single
 * mechanism opening rather than eighty independently lagging objects.
 */
export const explodeState = { t: 0, movement: 0 }

/** Fraction of the timeline each part occupies. Heavy overlap makes it flow. */
const WINDOW = 0.55

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Slight overshoot gives the cascade a mechanical snap instead of a soft glide. */
function easeOutBack(t: number, overshoot = 1.15) {
  const c = overshoot
  const p = t - 1
  return 1 + (c + 1) * p * p * p + c * p * p
}

export function partProgress(def: PartDef, maxOrder: number): number {
  const t = def.submovement
    ? Math.max(explodeState.t, explodeState.movement)
    : explodeState.t
  const start = (def.explode.order / (maxOrder + 1)) * (1 - WINDOW)
  return easeOutBack(clamp01((t - start) / WINDOW))
}

/** Drives the damped scalars. Mount once, ahead of the parts. */
export function ExplodeDriver() {
  useFrame((_, dt) => {
    const { explodeT, movementT } = useViewer.getState()
    easing.damp(explodeState, 't', explodeT, 0.24, dt)
    easing.damp(explodeState, 'movement', movementT, 0.24, dt)
  }, -1)
  return null
}

export function maxOrderOf(parts: PartDef[]): number {
  return parts.reduce((m, p) => Math.max(m, p.explode.order), 0)
}
