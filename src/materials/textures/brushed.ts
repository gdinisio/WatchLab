import { fbm1D, makeSurface, type Surface } from './canvas'
import { fillField } from './normalFromHeight'

export interface StreakOptions {
  seed?: number
  /**
   * Which UV axis the noise VARIES along. The grain runs perpendicular to it.
   *  - 'u': noise varies around the circumference -> streaks run along v -> RADIAL grain
   *  - 'v': noise varies along the profile -> streaks run along u -> CIRCULAR grain
   *         (caseback, movement wheels) — pair with anisotropyRotation = 0
   */
  axis?: 'u' | 'v'
  /** Streak count across the axis. Higher = finer grain. */
  frequency?: number
  octaves?: number
  /** Base roughness the streaks modulate around. */
  roughness?: number
  /** Peak-to-peak roughness variation. Keep small — this is micro-detail. */
  variation?: number
  size?: number
  /** Slight lateral wander so streaks are not perfectly straight. */
  wander?: number
}

export interface StreakSurfaces {
  height: Surface
  roughness: Surface
}

/**
 * Brushed / satin metal grain, returned as raw surfaces so it can be composited
 * with the micro-scratch layer before a single shared Sobel pass.
 *
 * Because the noise is a function of ONE uv axis only, the streaks are perfectly
 * coherent along the other — which is exactly what a directional grain looks like.
 */
export function makeStreakSurfaces(opts: StreakOptions = {}): StreakSurfaces {
  const {
    seed = 1337,
    axis = 'v',
    frequency = 900,
    octaves = 4,
    roughness = 0.32,
    variation = 0.1,
    size = 1024,
    wander = 0,
  } = opts

  const noise = fbm1D(seed, 256, octaves)
  const wobble = fbm1D(seed + 991, 16, 2)

  const sample = (u: number, v: number) => {
    const along = axis === 'u' ? v : u
    let across = axis === 'u' ? u : v
    if (wander > 0) across += (wobble(along * 6) - 0.5) * wander
    return noise(across * frequency)
  }

  const height = makeSurface(size)
  fillField(height, sample)

  const rough = makeSurface(size)
  fillField(rough, (u, v) => roughness + (sample(u, v) - 0.5) * variation)

  return { height, roughness: rough }
}
