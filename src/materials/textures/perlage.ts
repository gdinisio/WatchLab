import { makeSurface, mulberry32, type Surface } from './canvas'

export interface PerlageOptions {
  seed?: number
  /** Circles across the texture. */
  columns?: number
  /** Circle radius as a multiple of grid spacing. >0.5 so spots overlap. */
  overlap?: number
  /** Concentric grind rings drawn inside each spot. */
  rings?: number
  size?: number
}

/**
 * Perlage (circular graining) — the overlapping swirled spots on a movement main plate.
 * Each spot is a clipped disc of concentric rings; the overlap leaves the
 * characteristic crescent edges that catch light as the movement turns.
 */
export function makePerlageSurface(opts: PerlageOptions = {}): Surface {
  const { seed = 77, columns = 22, overlap = 0.72, rings = 16, size = 1024 } = opts

  const rng = mulberry32(seed)
  const s = makeSurface(size)
  const { ctx } = s
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, size, size)

  const spacing = size / columns
  const radius = spacing * overlap

  // Draw one extra row/column beyond each edge so the pattern tiles seamlessly.
  for (let row = -1; row <= columns + 1; row++) {
    for (let col = -1; col <= columns + 1; col++) {
      const cx = col * spacing + (row % 2 ? spacing * 0.5 : 0)
      const cy = row * spacing * 0.86
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.clip()

      // Concentric grind rings.
      for (let r = 0; r < rings; r++) {
        const t = r / rings
        const light = 0.5 + Math.sin(t * Math.PI * 7 + rng() * 0.4) * 0.16
        ctx.strokeStyle = `rgba(${light * 255 | 0},${light * 255 | 0},${light * 255 | 0},0.55)`
        ctx.lineWidth = spacing / rings * 0.85
        ctx.beginPath()
        ctx.arc(cx, cy, t * radius, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Bright leading edge of the grind — this is what reads as a crescent.
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }

  return s
}
