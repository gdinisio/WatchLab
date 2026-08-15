import * as THREE from 'three'
import { DIAL } from '../../config/datejust36'
import { drawCoronet } from '../../geometry/coronet'
import { fillRGB, finish, makeSurface } from './canvas'
import { makeAngularNoise, radialDirection } from './sunburst'
import { normalFromHeight } from './normalFromHeight'

const SIZE = 2048
/** The texture spans the full dial diameter, matching the planar disc UVs. */
const R = DIAL.radius

/** mm (dial space, +y = 12 o'clock) -> canvas px. Canvas y grows downward. */
const toPx = (mm: number) => (mm / (2 * R)) * SIZE
const cx = (xmm: number) => SIZE / 2 + toPx(xmm)
const cy = (ymm: number) => SIZE / 2 - toPx(ymm)

const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif'
/**
 * The ROLEX wordmark is a SERIF face, matching the corporate logotype — while
 * OYSTER PERPETUAL and DATEJUST below it stay sans. Setting the whole dial in one
 * face loses that contrast, which is a large part of how the dial reads.
 */
const SERIF = 'Garamond, "Times New Roman", Times, serif'

/** Draws letter-spaced, centred text. Rolex dial text is widely tracked. */
function tracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  centreXmm: number,
  baselineYmm: number,
  sizeMm: number,
  trackingEm: number,
  weight = '500',
  face: string = FONT,
) {
  const px = toPx(sizeMm)
  ctx.font = `${weight} ${px}px ${face}`
  const track = px * trackingEm
  const widths = [...text].map((ch) => ctx.measureText(ch).width)
  const total = widths.reduce((a, b) => a + b, 0) + track * (text.length - 1)
  let x = cx(centreXmm) - total / 2
  const y = cy(baselineYmm)
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], x, y)
    x += widths[i] + track
  }
}

/**
 * Draws letter-spaced text along a circular arc, each glyph rotated to stand upright
 * relative to the centre.
 *
 * `centreAngle` is measured from 6 o'clock going clockwise: the glyph is pushed out
 * along canvas +y, which is downward, so angle 0 lands at the bottom of the dial.
 * Increasing angle runs CLOCKWISE round the dial, which from 6 o'clock heads toward
 * 7 and 8 — i.e. leftward on screen. So `dir` +1 lays glyphs out leftward (and must
 * therefore consume the string in reverse to still read left-to-right), and -1 lays
 * them out rightward in normal order. SWISS takes +1, MADE takes -1.
 */
function arcText(
  ctx: CanvasRenderingContext2D,
  text: string,
  radiusMm: number,
  centreAngle: number,
  dir: 1 | -1,
  sizeMm: number,
  trackingEm: number,
  weight: string,
  angleOffset: number,
) {
  const px = toPx(sizeMm)
  ctx.font = `${weight} ${px}px ${FONT}`
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'center'

  const glyphs = dir === 1 ? [...text].reverse() : [...text]
  const radiusPx = toPx(radiusMm)
  let angle = centreAngle + angleOffset

  for (const ch of glyphs) {
    const advance = (ctx.measureText(ch).width + px * trackingEm) / radiusPx
    angle += dir * advance * 0.5
    ctx.save()
    ctx.translate(cx(0), cy(0))
    // Canvas +y is downward, so a clockwise dial angle maps straight to a canvas
    // rotation of the same sign once the glyph is pushed out along -y.
    ctx.rotate(angle)
    // Pushing out along canvas +y already leaves the glyph's up-direction pointing
    // back toward the dial centre, which is exactly upright at 6 o'clock. Adding a
    // further PI turn here flipped every letter on its head.
    ctx.translate(0, radiusPx)
    ctx.fillText(ch, 0, 0)
    ctx.restore()
    angle += dir * advance * 0.5
  }
  ctx.textAlign = 'left'
}

/** Everything printed or applied on the dial face, drawn white-on-black as a mask. */
function drawPrintMask(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#fff'
  ctx.textBaseline = 'alphabetic'

  // ---- Minute track -------------------------------------------------------
  const trackR = DIAL.minuteTrackRadius
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2
    const major = i % 5 === 0
    const len = major ? 0.62 : 0.38
    const w = major ? 0.16 : 0.085
    const sin = Math.sin(a)
    const cos = Math.cos(a)
    const x0 = sin * trackR
    const y0 = cos * trackR
    const x1 = sin * (trackR - len)
    const y1 = cos * (trackR - len)
    ctx.lineWidth = toPx(w)
    ctx.lineCap = 'butt'
    ctx.beginPath()
    ctx.moveTo(cx(x0), cy(y0))
    ctx.lineTo(cx(x1), cy(y1))
    ctx.stroke()
  }

  // No printed coronet at 12: the APPLIED coronet is the 12 marker, and printing
  // one underneath it just doubles the logo up.

  // ---- Upper text block ---------------------------------------------------
  // Reference stacks these tightly under the coronet, with OYSTER PERPETUAL and
  // DATEJUST clearly legible rather than shrunk to a whisper beneath ROLEX.
  tracked(ctx, DIAL.text.brand, 0, 6.45, 1.62, 0.1, '600', SERIF)
  tracked(ctx, DIAL.text.line1, 0, 4.85, 0.8, 0.09, '500')
  tracked(ctx, DIAL.text.line2, 0, 3.55, 0.86, 0.09, '600')

  // ---- Lower certification block -----------------------------------------
  // Deliberately small and light. On the real dial this is near-microprint; sized up
  // it shouts, and the dial stops looking like a Rolex.
  tracked(ctx, DIAL.text.certLine1, 0, -4.35, 0.42, 0.07, '400')
  tracked(ctx, DIAL.text.certLine2, 0, -5.32, 0.42, 0.07, '400')

  // ---- SWISS MADE, curved along the rim and split by a coronet ------------
  // It follows the dial edge rather than sitting on a straight baseline, and the
  // tiny coronet BETWEEN the two words is the detail everyone forgets.
  const swissRadius = 13.15
  const swissSize = 0.46
  const crownW = 0.72
  // Angular half-gap the coronet occupies, plus a little breathing room.
  const gapHalf = (crownW * 0.85) / swissRadius
  arcText(ctx, 'SWISS', swissRadius, 0, 1, swissSize, 0.1, '600', gapHalf)
  arcText(ctx, 'MADE', swissRadius, 0, -1, swissSize, 0.1, '600', -gapHalf)
  drawCoronet(ctx, cx(0), cy(-swissRadius + crownW * 0.42), toPx(crownW), toPx(crownW * 0.82))
}

export interface DialMaps {
  map: THREE.Texture
  roughnessMap: THREE.Texture
  normalMap: THREE.Texture
  anisotropyMap: THREE.Texture
}

/**
 * The complete dial texture set, composited so every map stays consistent.
 *
 * Sunburst grain and printing are combined into ONE height field before the Sobel
 * pass, which is both cheaper and more correct than blending two normal maps. The
 * print reads as genuinely printed because it is simultaneously raised, matte
 * against the gloss lacquer, and non-anisotropic where the sunburst is radial.
 */
export function makeDialMaps(colour = DIAL.colour): DialMaps {
  const printSurface = makeSurface(SIZE)
  drawPrintMask(printSurface.ctx)
  const printData = printSurface.ctx.getImageData(0, 0, SIZE, SIZE).data
  /**
   * Sampled in CANVAS-ROW space (row 0 = top), which is the space `fillField` and
   * `fillRGB` hand to their callbacks. Mixing this up with uv space flips every map
   * vertically against the print and mirrors all the dial text.
   */
  const printAt = (u: number, row: number) => {
    const x = Math.min(SIZE - 1, Math.max(0, (u * SIZE) | 0))
    const y = Math.min(SIZE - 1, Math.max(0, (row * SIZE) | 0))
    return printData[(y * SIZE + x) * 4] / 255
  }

  const grain = makeAngularNoise(2024, 3200)

  // Height: fine sunray grain everywhere, plus raised print on top.
  const height = makeSurface(SIZE)
  const hImg = new ImageData(SIZE, SIZE)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE
      const row = y / SIZE
      const h = grain(u, row) * 0.35 + printAt(u, row) * 0.65
      const i = (y * SIZE + x) * 4
      hImg.data[i] = hImg.data[i + 1] = hImg.data[i + 2] = h * 255
      hImg.data[i + 3] = 255
    }
  }
  height.ctx.putImageData(hImg, 0, 0)
  const normalMap = normalFromHeight(height, 0.85)

  // Colour: deep blue lacquer, printing in near-white.
  const base = new THREE.Color(colour)
  const ink = new THREE.Color('#eef1f4')
  const col = makeSurface(SIZE)
  fillRGB(col, (u, v) => {
    const p = printAt(u, v)
    return [
      base.r + (ink.r - base.r) * p,
      base.g + (ink.g - base.g) * p,
      base.b + (ink.b - base.b) * p,
    ]
  })

  // Roughness: glossy sunray lacquer, matte where printed.
  const rough = makeSurface(SIZE)
  fillRGB(rough, (u, v) => {
    const p = printAt(u, v)
    // Wide roughness swing is what makes the sunray wing sweep visibly.
    const sun = 0.17 + (grain(u, v) - 0.5) * 0.46
    const r = sun + (0.62 - sun) * p
    return [r, r, r]
  })

  // Anisotropy: radial everywhere, strength killed under the print.
  const aniso = makeSurface(SIZE)
  fillRGB(aniso, (u, v) => {
    const [dx, dy] = radialDirection(u, v)
    return [dx, dy, 1 - printAt(u, v)]
  })

  return {
    map: finish(new THREE.CanvasTexture(col.canvas), { srgb: true }),
    roughnessMap: finish(new THREE.CanvasTexture(rough.canvas)),
    normalMap,
    anisotropyMap: finish(new THREE.CanvasTexture(aniso.canvas)),
  }
}
