import * as THREE from 'three'

/**
 * Where a selected part travels to be looked at on its own.
 *
 * Well out to the right of the assembly (the watch is only 36mm across), so once the
 * camera reframes on it the rest of the movement leaves the frame naturally. That is
 * deliberately cheaper and more robust than fading the other eighty parts out:
 * materials are SHARED between parts, so per-part opacity would mean cloning a
 * material per part and rebuilding the shader cache just to dim things.
 */
export const INSPECT_POSITION = new THREE.Vector3(88, 4, 0)

/** Radians per second the inspected part turns, so it can be read from all sides. */
export const INSPECT_SPIN_SPEED = 0.45

/**
 * How closely the camera frames an inspected part, as a multiple of its own
 * bounding radius. Also the floor, so a 0.4mm jewel does not fill the screen.
 */
export const INSPECT_FRAMING = 2.6
export const INSPECT_MIN_RADIUS = 7

/** Smoothstep, used to ease the slide so it starts and ends without a jolt. */
export function smoothstep(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return x * x * (3 - 2 * x)
}

const radiusCache = new Map<string, number>()

/**
 * Bounding radius of a part's own geometry, cached by id.
 *
 * Taken from the geometry rather than the live object because the camera needs a
 * framing target the moment the part is clicked — while it is still sliding, its
 * world bounds are somewhere between the two positions and would frame empty space.
 */
export function partRadius(id: string, geometry: THREE.BufferGeometry): number {
  const hit = radiusCache.get(id)
  if (hit !== undefined) return hit
  if (!geometry.boundingSphere) geometry.computeBoundingSphere()
  const r = geometry.boundingSphere?.radius ?? 1
  radiusCache.set(id, r)
  return r
}
