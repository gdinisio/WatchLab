import * as THREE from 'three'
import { fbm1D, fillRGB, finish, makeSurface } from './canvas'
import { fillField, normalFromHeight } from './normalFromHeight'

export interface SunburstOptions {
  seed?: number
  /** Streaks around the full circle. A Rolex sunray dial is very fine. */
  streaks?: number
  roughness?: number
  variation?: number
  normalStrength?: number
  size?: number
}

/**
 * Sunburst ("soleil") dial finish, generated in PLANAR uv space.
 *
 * The dial is built as a planar-uv disc so the printed artwork maps correctly, which
 * means the radial grain cannot come from a constant anisotropyRotation the way it can
 * on lathed parts. Instead the grain is generated in polar coordinates inside a planar
 * texture, and an explicit anisotropyMap carries the radial direction per texel:
 *   RG = direction in tangent space encoded to [0,1], B = strength.
 *
 * The result is the signature effect: a bright "wing" that sweeps around the dial as
 * the watch tilts. Without this the dial is dead flat and the whole render fails.
 */
export function makeAngularNoise(seed: number, streaks: number) {
  const noise = fbm1D(seed, 512, 4)
  // Sampling by theta produces perfectly radial streaks. Density is constant in
  // angle so streaks converge at the centre, exactly like a real sunray brush.
  return (u: number, v: number) => {
    const theta = Math.atan2(v - 0.5, u - 0.5)
    const r = Math.hypot(u - 0.5, v - 0.5)
    const fade = Math.min(1, r * 7)
    return 0.5 + (noise(((theta + Math.PI) / (Math.PI * 2)) * streaks) - 0.5) * fade
  }
}

/** Radial direction encoded for anisotropyMap: RG = tangent-space dir, B = strength. */
export function radialDirection(u: number, v: number): [number, number, number] {
  const dx = u - 0.5
  const dy = v - 0.5
  const len = Math.hypot(dx, dy) || 1
  return [(dx / len) * 0.5 + 0.5, (dy / len) * 0.5 + 0.5, 1]
}

export function makeSunburstMaps(opts: SunburstOptions = {}) {
  const {
    seed = 2024,
    streaks = 2600,
    roughness = 0.26,
    variation = 0.3,
    normalStrength = 0.9,
    size = 2048,
  } = opts

  const angular = makeAngularNoise(seed, streaks)

  const height = makeSurface(size)
  fillField(height, angular)
  const normalMap = normalFromHeight(height, normalStrength)

  const rough = makeSurface(size)
  fillField(rough, (u, v) => roughness + (angular(u, v) - 0.5) * variation)

  const aniso = makeSurface(size)
  fillRGB(aniso, radialDirection)

  return {
    roughnessMap: finish(new THREE.CanvasTexture(rough.canvas)),
    normalMap,
    anisotropyMap: finish(new THREE.CanvasTexture(aniso.canvas)),
  }
}
