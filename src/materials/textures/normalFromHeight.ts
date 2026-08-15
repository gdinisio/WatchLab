import * as THREE from 'three'
import { finish, type Surface } from './canvas'

/**
 * Sobel-derives a tangent-space normal map from a grayscale height surface.
 * `strength` is deliberately small for watch surfaces — micro-detail, not relief.
 */
export function normalFromHeight(src: Surface, strength: number): THREE.CanvasTexture {
  const { size } = src
  const height = src.ctx.getImageData(0, 0, size, size).data
  const out = new ImageData(size, size)
  const px = out.data
  const h = (x: number, y: number) => {
    const xi = ((x % size) + size) % size
    const yi = ((y % size) + size) % size
    return height[(yi * size + xi) * 4] / 255
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Sobel gradients
      const dx =
        h(x + 1, y - 1) + 2 * h(x + 1, y) + h(x + 1, y + 1) -
        (h(x - 1, y - 1) + 2 * h(x - 1, y) + h(x - 1, y + 1))
      const dy =
        h(x - 1, y + 1) + 2 * h(x, y + 1) + h(x + 1, y + 1) -
        (h(x - 1, y - 1) + 2 * h(x, y - 1) + h(x + 1, y - 1))

      let nx = -dx * strength
      let ny = dy * strength
      const nz = 1
      const len = Math.hypot(nx, ny, nz)
      nx /= len
      ny /= len

      const i = (y * size + x) * 4
      px[i] = (nx * 0.5 + 0.5) * 255
      px[i + 1] = (ny * 0.5 + 0.5) * 255
      px[i + 2] = (nz / len) * 0.5 * 255 + 127.5
      px[i + 3] = 255
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  canvas.getContext('2d')!.putImageData(out, 0, 0)
  return finish(new THREE.CanvasTexture(canvas)) as THREE.CanvasTexture
}

/**
 * Writes a grayscale value field via a per-pixel callback.
 * The callback receives CANVAS-ROW space: (u, row) with row 0 at the top, NOT uv
 * space. Anything sampling a drawn canvas alongside it must use the same space.
 */
export function fillField(src: Surface, fn: (u: number, v: number) => number) {
  const { size } = src
  const img = new ImageData(size, size)
  const px = img.data
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.max(0, Math.min(1, fn(x / size, y / size))) * 255
      const i = (y * size + x) * 4
      px[i] = px[i + 1] = px[i + 2] = v
      px[i + 3] = 255
    }
  }
  src.ctx.putImageData(img, 0, 0)
}
