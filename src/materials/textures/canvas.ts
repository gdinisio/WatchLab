import * as THREE from 'three'

export interface Surface {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  size: number
}

export function makeSurface(size: number): Surface {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  return { canvas, ctx, size }
}

/** Deterministic PRNG so every generated texture is reproducible across reloads. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const smooth = (t: number) => t * t * (3 - 2 * t)

/** Seeded 1D value noise with smooth interpolation, periodic over `period`. */
export function makeValueNoise1D(seed: number, period: number) {
  const rng = mulberry32(seed)
  const table = new Float32Array(period)
  for (let i = 0; i < period; i++) table[i] = rng()
  return (x: number) => {
    const xi = Math.floor(x)
    const f = x - xi
    const a = table[((xi % period) + period) % period]
    const b = table[(((xi + 1) % period) + period) % period]
    return a + (b - a) * smooth(f)
  }
}

/** Fractal sum of 1D value noise. Returns roughly 0..1. */
export function fbm1D(seed: number, period: number, octaves: number, gain = 0.5) {
  const layers = Array.from({ length: octaves }, (_, o) =>
    makeValueNoise1D(seed + o * 7919, Math.max(2, Math.floor(period * 2 ** o))),
  )
  let norm = 0
  const amps = layers.map((_, o) => {
    const a = gain ** o
    norm += a
    return a
  })
  return (x: number) => {
    let sum = 0
    for (let o = 0; o < layers.length; o++) sum += layers[o](x * 2 ** o) * amps[o]
    return sum / norm
  }
}

/** Applies the renderer's max anisotropy and marks the texture for repeat tiling. */
export function finish(
  tex: THREE.Texture,
  opts: { srgb?: boolean; repeat?: [number, number] } = {},
) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = opts.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  if (opts.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1])
  tex.anisotropy = 16
  tex.needsUpdate = true
  return tex
}

/**
 * Writes an RGB field via a per-pixel callback returning 0..1 triples.
 * Like `fillField`, the callback receives CANVAS-ROW space, row 0 at the top.
 */
export function fillRGB(
  src: Surface,
  fn: (u: number, v: number) => [number, number, number],
) {
  const { size } = src
  const img = new ImageData(size, size)
  const px = img.data
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = fn(x / size, y / size)
      const i = (y * size + x) * 4
      px[i] = Math.max(0, Math.min(1, r)) * 255
      px[i + 1] = Math.max(0, Math.min(1, g)) * 255
      px[i + 2] = Math.max(0, Math.min(1, b)) * 255
      px[i + 3] = 255
    }
  }
  src.ctx.putImageData(img, 0, 0)
}
