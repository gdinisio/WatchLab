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

/** Draws letter-spaced, centred text. Rolex dial text is widely tracked. */
function tracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  centreXmm: number,
  baselineYmm: number,
  sizeMm: number,
  trackingEm: number,
  weight = '500',
) {
  const px = toPx(sizeMm)
  ctx.font = `${weight} ${px}px ${FONT}`
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

  // ---- Coronet at 12 ------------------------------------------------------
  drawCoronet(ctx, cx(0), cy(8.55), toPx(DIAL.coronet.width), toPx(1.5))

  // ---- Upper text block ---------------------------------------------------
  tracked(ctx, DIAL.text.brand, 0, 6.85, 1.42, 0.16, '600')
  tracked(ctx, DIAL.text.line1, 0, 4.85, 0.66, 0.1)
  tracked(ctx, DIAL.text.line2, 0, 3.55, 0.72, 0.1, '600')

  // ---- Lower certification block -----------------------------------------
  // Deliberately small and light. On the real dial this is near-microprint; sized up
  // it shouts, and the dial stops looking like a Rolex.
  tracked(ctx, DIAL.text.certLine1, 0, -4.35, 0.42, 0.07, '400')
  tracked(ctx, DIAL.text.certLine2, 0, -5.32, 0.42, 0.07, '400')

  // ---- SWISS MADE at the rim, split by a coronet -------------------------
  // The tiny coronet BETWEEN the two words is the detail everyone forgets.
  const swissY = -13.1
  const swissSize = 0.4
  const crownW = 0.62
  ctx.font = `600 ${toPx(swissSize)}px ${FONT}`
  const half = ctx.measureText('SWISS ').width / 2 / toPx(1)
  tracked(ctx, 'SWISS', -(crownW / 2 + half * 0.62), swissY, swissSize, 0.12, '600')
  tracked(ctx, 'MADE', crownW / 2 + half * 0.62, swissY, swissSize, 0.12, '600')
  drawCoronet(ctx, cx(0), cy(swissY - 0.04), toPx(crownW), toPx(crownW * 0.8))
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

  const grain = makeAngularNoise(2024, 2600)

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
    const sun = 0.24 + (grain(u, v) - 0.5) * 0.3
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
