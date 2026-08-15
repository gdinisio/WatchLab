import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import logoSource from '../assets/rolex-logo.svg?raw'

/**
 * The coronet and wordmark, taken from the real vector artwork rather than traced
 * by hand.
 *
 * Everything downstream — the applied 12 marker, the crown face, the clasp cover and
 * the printed dial mark — consumes this, so the mark is identical everywhere and
 * exact rather than approximated. The typeface in particular cannot be approximated:
 * Rolex's face is proprietary, and the outlines here ARE the letterforms.
 *
 * Two coordinate conventions collide and both matter:
 *  - SVG and canvas both run +Y DOWNWARD.
 *  - THREE.Shape runs +Y UPWARD, and `flatExtrude` maps shape +Y to world -Z, i.e.
 *    toward 12 o'clock. So shapes destined for geometry get their Y negated, while
 *    anything drawn to canvas keeps SVG orientation untouched.
 */

interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface Element {
  /** Raw SVG path data, for Path2D canvas drawing. */
  d: string
  shapes: THREE.Shape[]
  box: Box
}

/** Points sampled per curve when converting SVG outlines to shapes. */
const CURVE_DIVISIONS = 32

const EMPTY_BOX: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }

function growBox(box: Box, x: number, y: number): Box {
  return {
    minX: Math.min(box.minX, x),
    minY: Math.min(box.minY, y),
    maxX: Math.max(box.maxX, x),
    maxY: Math.max(box.maxY, y),
  }
}

function unionBox(boxes: Box[]): Box {
  return boxes.reduce(
    (acc, b) => ({
      minX: Math.min(acc.minX, b.minX),
      minY: Math.min(acc.minY, b.minY),
      maxX: Math.max(acc.maxX, b.maxX),
      maxY: Math.max(acc.maxY, b.maxY),
    }),
    EMPTY_BOX,
  )
}

function parseLogo(): { coronet: Element[]; wordmark: Element[] } {
  const parsed = new SVGLoader().parse(logoSource)
  const rawPaths = /<path\b[^>]*\bd="([^"]+)"/g
  const dList: string[] = []
  for (let m = rawPaths.exec(logoSource); m; m = rawPaths.exec(logoSource)) dList.push(m[1])

  const elements: Element[] = parsed.paths.map((shapePath, i) => {
    // Resolves holes by winding, which is what the counters in R and O and the
    // coronet's hollow base band depend on.
    const shapes = shapePath.toShapes()
    let box = EMPTY_BOX
    for (const shape of shapes) {
      for (const p of shape.getPoints(24)) box = growBox(box, p.x, p.y)
    }
    return { d: dList[i] ?? '', shapes, box }
  })

  // Split coronet from wordmark at the largest vertical gap. Doing it by geometry
  // rather than by path index means a re-exported file with different ordering
  // still lands correctly.
  const sorted = [...elements].sort((a, b) => a.box.minY - b.box.minY)
  let splitAt = 1
  let widest = -Infinity
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].box.minY - sorted[i - 1].box.maxY
    if (gap > widest) {
      widest = gap
      splitAt = i
    }
  }

  return { coronet: sorted.slice(0, splitAt), wordmark: sorted.slice(splitAt) }
}

const LOGO = parseLogo()

export const CORONET_BOX = unionBox(LOGO.coronet.map((e) => e.box))
export const WORDMARK_BOX = unionBox(LOGO.wordmark.map((e) => e.box))

/** Aspect of each mark, so callers can size one dimension and derive the other. */
export const CORONET_ASPECT =
  (CORONET_BOX.maxX - CORONET_BOX.minX) / (CORONET_BOX.maxY - CORONET_BOX.minY)
export const WORDMARK_ASPECT =
  (WORDMARK_BOX.maxX - WORDMARK_BOX.minX) / (WORDMARK_BOX.maxY - WORDMARK_BOX.minY)

/**
 * Clones the source shapes into a target box, flipping Y so the mark stands upright
 * in THREE's convention. Origin is horizontally centred with y=0 at the mark's base.
 */
function toShapes(elements: Element[], box: Box, width: number, height: number): THREE.Shape[] {
  const sx = width / (box.maxX - box.minX)
  const sy = height / (box.maxY - box.minY)
  const cx = (box.minX + box.maxX) / 2
  const map = (p: THREE.Vector2) =>
    // Negate about the base: SVG grows downward, THREE grows upward.
    new THREE.Vector2((p.x - cx) * sx, (box.maxY - p.y) * sy)

  return elements.flatMap((el) =>
    el.shapes.map((shape) => {
      // Resample rather than rewriting curve control points in place. The source
      // mixes cubics, quadratics and arcs, and each curve type stores its geometry
      // differently — sampling sidesteps that entirely, and at logo scale the
      // difference is far below a pixel.
      const { shape: outline, holes } = shape.extractPoints(CURVE_DIVISIONS)
      const out = new THREE.Shape(outline.map(map))
      out.holes = holes.map((h) => new THREE.Path(h.map(map)))
      return out
    }),
  )
}

/** The coronet, sized to `width` with its aspect preserved. Base sits at y = 0. */
export function coronetShapes(width: number, height?: number): THREE.Shape[] {
  const h = height ?? width / CORONET_ASPECT
  return toShapes(LOGO.coronet, CORONET_BOX, width, h)
}

/** The ROLEX wordmark, sized to `width`. Baseline sits at y = 0. */
export function wordmarkShapes(width: number): THREE.Shape[] {
  return toShapes(LOGO.wordmark, WORDMARK_BOX, width, width / WORDMARK_ASPECT)
}

/**
 * Fills SVG artwork onto a 2D canvas via Path2D, which consumes SVG path data
 * directly — so the printed mark comes from the very same outlines as the geometry.
 *
 * Canvas and SVG share a downward Y, so no flip is applied here.
 */
function drawElements(
  ctx: CanvasRenderingContext2D,
  elements: Element[],
  box: Box,
  centreX: number,
  bottomY: number,
  width: number,
  height: number,
) {
  const sx = width / (box.maxX - box.minX)
  const sy = height / (box.maxY - box.minY)
  ctx.save()
  ctx.translate(centreX, bottomY)
  ctx.scale(sx, sy)
  ctx.translate(-(box.minX + box.maxX) / 2, -box.maxY)
  for (const el of elements) {
    if (el.d) ctx.fill(new Path2D(el.d), 'nonzero')
  }
  ctx.restore()
}

/** Draws the coronet centred on `cx` with its BASE at `cy`. */
export function drawCoronet(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height?: number,
) {
  drawElements(ctx, LOGO.coronet, CORONET_BOX, cx, cy, width, height ?? width / CORONET_ASPECT)
}

/** Draws the ROLEX wordmark centred on `cx` with its BASELINE at `cy`. */
export function drawWordmark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
) {
  drawElements(ctx, LOGO.wordmark, WORDMARK_BOX, cx, cy, width, width / WORDMARK_ASPECT)
}
