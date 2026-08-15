import * as THREE from 'three'
import { finish, makeSurface, type Surface } from './canvas'
import { normalFromHeight } from './normalFromHeight'

export interface Layer {
  surface: Surface
  /** Blend weight. Layers are averaged around mid-grey, so weights need not sum to 1. */
  weight: number
}

/** Blends grey-centred height layers into one surface at the largest layer's size. */
export function blendHeights(layers: Layer[]): Surface {
  const size = Math.max(...layers.map((l) => l.surface.size))
  const out = makeSurface(size)
  const img = new ImageData(size, size)
  const px = img.data

  const sources = layers.map((l) => ({
    weight: l.weight,
    size: l.surface.size,
    data: l.surface.ctx.getImageData(0, 0, l.surface.size, l.surface.size).data,
  }))

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let acc = 0.5
      for (const s of sources) {
        const sx = ((x / size) * s.size) | 0
        const sy = ((y / size) * s.size) | 0
        acc += (s.data[(sy * s.size + sx) * 4] / 255 - 0.5) * s.weight
      }
      const i = (y * size + x) * 4
      const v = Math.max(0, Math.min(1, acc)) * 255
      px[i] = px[i + 1] = px[i + 2] = v
      px[i + 3] = 255
    }
  }
  out.ctx.putImageData(img, 0, 0)
  return out
}

export interface MetalFinishOptions {
  /** Directional grain. Omit for a mirror polish. */
  streak?: Surface
  streakRoughness?: Surface
  /** Micro-wear layer. Always supply one. */
  scratches: Surface
  /** How hard the scratches bite into roughness. Keep at ~0.03. */
  scratchRoughness?: number
  /** How much the scratches contribute to the normal relative to the grain. */
  scratchHeight?: number
  /** Flat roughness used when there is no streak layer (polished surfaces). */
  baseRoughness?: number
  normalStrength?: number
}

export interface MetalMaps {
  roughnessMap: THREE.Texture
  normalMap: THREE.Texture
}

/**
 * Composites grain + micro-wear into a single coherent map pair.
 *
 * Heights are blended BEFORE the Sobel pass rather than blending two normal maps,
 * which is both cheaper and more correct.
 */
export function composeMetalMaps(opts: MetalFinishOptions): MetalMaps {
  const {
    streak,
    streakRoughness,
    scratches,
    scratchRoughness = 0.03,
    scratchHeight = 0.3,
    baseRoughness = 0.04,
    normalStrength = 1.2,
  } = opts

  const layers: Layer[] = [{ surface: scratches, weight: scratchHeight }]
  if (streak) layers.unshift({ surface: streak, weight: 1 })
  const height = blendHeights(layers)
  const normalMap = normalFromHeight(height, normalStrength)

  // Roughness: grain (or a flat base) with the scratch field nudged in.
  const size = streakRoughness?.size ?? scratches.size
  const out = makeSurface(size)
  const img = new ImageData(size, size)
  const px = img.data
  const grain = streakRoughness
    ? streakRoughness.ctx.getImageData(0, 0, streakRoughness.size, streakRoughness.size).data
    : null
  const wear = scratches.ctx.getImageData(0, 0, scratches.size, scratches.size).data

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const base = grain ? grain[i] / 255 : baseRoughness
      const wx = ((x / size) * scratches.size) | 0
      const wy = ((y / size) * scratches.size) | 0
      const w = wear[(wy * scratches.size + wx) * 4] / 255 - 0.5
      const v = Math.max(0, Math.min(1, base + w * 2 * scratchRoughness)) * 255
      px[i] = px[i + 1] = px[i + 2] = v
      px[i + 3] = 255
    }
  }
  out.ctx.putImageData(img, 0, 0)

  return { roughnessMap: finish(new THREE.CanvasTexture(out.canvas)), normalMap }
}
