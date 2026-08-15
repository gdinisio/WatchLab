import { fbm1D, makeSurface, type Surface } from './canvas'
import { fillField } from './normalFromHeight'

export interface CotesOptions {
  seed?: number
  /** Number of stripes across the texture. */
  stripes?: number
  /** Sine wander of the stripe boundaries. */
  wobble?: number
  size?: number
}

/**
 * Côtes de Genève — parallel cylindrical-grind stripes.
 * Each stripe ramps from dark to light across its width, so the band flips
 * contrast as the light moves. Available for bridge finishing.
 */
export function makeCotesSurface(opts: CotesOptions = {}): Surface {
  const { seed = 5, stripes = 14, wobble = 0.012, size = 1024 } = opts

  const grain = fbm1D(seed, 128, 3)
  const s = makeSurface(size)

  fillField(s, (u, v) => {
    const band = v * stripes + Math.sin(u * Math.PI * 2) * wobble * stripes
    const withinBand = band - Math.floor(band)
    // Cylindrical grind: bright at the leading edge, falling across the band.
    const ramp = 0.32 + Math.pow(1 - withinBand, 1.7) * 0.5
    // Fine grind streaks running ALONG the stripe.
    const fine = (grain(u * 700) - 0.5) * 0.12
    return ramp + fine
  })

  return s
}
