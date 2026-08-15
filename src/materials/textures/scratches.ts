import { makeSurface, mulberry32, type Surface } from './canvas'

export interface ScratchOptions {
  seed?: number
  count?: number
  /** Mean length as a fraction of the texture. Real handling marks are short. */
  length?: number
  /** 0 = fully random directions, 1 = all aligned to `angle`. */
  alignment?: number
  angle?: number
  size?: number
}

/**
 * Micro-scratch / handling-wear height field, centred on mid-grey.
 *
 * THIS BELONGS ON EVERY METAL. A perfectly clean surface is the single most common
 * tell of a CG render. It is composited at very low amplitude — the roughness delta
 * it drives is about +-0.03, never +-0.2, or the watch reads as damaged rather than
 * merely real.
 */
export function makeScratchSurface(opts: ScratchOptions = {}): Surface {
  const {
    seed = 4242,
    count = 1100,
    length = 0.05,
    alignment = 0,
    angle = 0,
    size = 1024,
  } = opts

  const rng = mulberry32(seed)
  const s = makeSurface(size)
  const { ctx } = s

  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, size, size)
  ctx.lineCap = 'round'

  for (let i = 0; i < count; i++) {
    const x = rng() * size
    const y = rng() * size
    const free = rng() * Math.PI * 2
    const a = free * (1 - alignment) + angle * alignment + (rng() - 0.5) * 0.25
    const len = length * size * (0.25 + rng() * 1.75)
    // Half the marks sit slightly proud, half slightly sunken — like real wear.
    const strength = 0.06 + rng() * 0.12
    ctx.strokeStyle = rng() > 0.5
      ? `rgba(255,255,255,${strength})`
      : `rgba(0,0,0,${strength})`
    ctx.lineWidth = 0.5 + rng() * 1.4
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
    ctx.stroke()
  }

  return s
}
