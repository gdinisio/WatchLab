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
export const explodeState = { t: 0 }

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
  const cascade = (def.explode.order / (maxOrder + 1)) * (1 - WINDOW)
  const [start, end] = def.explode.span ?? [cascade, cascade + WINDOW]
  const local = clamp01((explodeState.t - start) / (end - start))
  /**
   * A part with its own travel shaping supplies its own easing.
   *
   * `easeOutBack` front-loads hard — a fifth of the way along the slider it is
   * already nine tenths done. Running it FIRST and then splitting the result into
   * phases compressed those phases into the opening moments: a pin whose thread
   * turned over the first 16% of `p` was finished by 3% of the slider, so the whole
   * screwing motion happened in a blink nobody could see.
   */
  return def.explode.seat ? local : easeOutBack(local)
}

/** Drives the damped scalars. Mount once, ahead of the parts. */
export function ExplodeDriver() {
  useFrame((_, dt) => {
    // Slow. The pins now settle at their holes, push in and thread home over the last
    // fifth of their travel, and at 0.24 that whole sequence went past in a blink.
    easing.damp(explodeState, 't', useViewer.getState().explodeT, 0.62, dt)
  }, -1)
  return null
}

export function maxOrderOf(parts: PartDef[]): number {
  return parts.reduce((m, p) => Math.max(m, p.explode.order), 0)
}
