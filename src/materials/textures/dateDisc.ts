import * as THREE from 'three'
import { finish, makeSurface } from './canvas'

const SIZE = 2048

/**
 * The date disc: 31 numerals around a ring, white ground with black numerals to
 * match the ref. 126234 blue dial. The disc is a flat annulus whose UVs are
 * planar, so the numerals are drawn in place and rotate with the disc.
 */
export function makeDateDiscMap(
  discRadiusMm: number,
  numeralRadiusMm: number,
  ground = '#f2f2f0',
  ink = '#141414',
) {
  const s = makeSurface(SIZE)
  const { ctx } = s
  const toPx = (mm: number) => (mm / (2 * discRadiusMm)) * SIZE

  ctx.fillStyle = ground
  ctx.fillRect(0, 0, SIZE, SIZE)

  ctx.fillStyle = ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const fontPx = toPx(1.85)
  ctx.font = `600 ${fontPx}px "Helvetica Neue", Helvetica, Arial, sans-serif`

  for (let d = 1; d <= 31; d++) {
    // Date 1 sits at 3 o'clock (the aperture position) and advances clockwise.
    const a = ((d - 1) / 31) * Math.PI * 2
    const x = SIZE / 2 + Math.cos(a) * toPx(numeralRadiusMm)
    const y = SIZE / 2 + Math.sin(a) * toPx(numeralRadiusMm)
    ctx.save()
    ctx.translate(x, y)
    // Pre-rotate by +a so that when the disc turns by -a to bring this numeral to
    // the 3 o'clock window, it arrives perfectly upright.
    ctx.rotate(a)
    ctx.fillText(String(d), 0, 0)
    ctx.restore()
  }

  return finish(new THREE.CanvasTexture(s.canvas), { srgb: true })
}
