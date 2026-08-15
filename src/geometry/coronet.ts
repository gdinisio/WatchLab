import * as THREE from 'three'

/**
 * The Rolex coronet, built parametrically.
 *
 * Five balls on tapered stems rising from a base bar: the centre prong tallest, the
 * outer pair swept out and down. Proportions are roughly 5 wide : 4 high.
 *
 * Prong layout as fractions of half-width / height.
 */
const PRONGS = [
  { x: 0.0, y: 1.0, r: 0.14 },
  { x: 0.54, y: 0.88, r: 0.125 },
  { x: -0.54, y: 0.88, r: 0.125 },
  { x: 1.0, y: 0.6, r: 0.12 },
  { x: -1.0, y: 0.6, r: 0.12 },
]

/**
 * Stem half-width as a fraction of its ball radius.
 *
 * The coronet only reads as a crown if there are clear V-shaped GAPS between the
 * prongs. Thick stems close those gaps and the whole logo collapses into a blob
 * with bumps on top — which at 2mm on a dial is exactly what you must avoid.
 */
const STEM_RATIO = 0.3

/** Where every stem converges, as a fraction of height. */
const WAIST_Y = 0.26
const BASE_Y = 0.0
const BASE_HALF_WIDTH = 0.74
const BASE_HEIGHT = 0.15
/** Half-width of the neck joining the waist to the base bar. */
const NECK_HALF_WIDTH = 0.17

/**
 * Draws the coronet into a 2D context, centred on (cx, cy) with `cy` at the BASE.
 * Canvas y grows downward, so the crown is drawn upward from cy.
 */
export function drawCoronet(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height: number,
) {
  const hw = width / 2
  const px = (fx: number) => cx + fx * hw
  const py = (fy: number) => cy - fy * height

  ctx.beginPath()
  // Slender tapered stems fanning out from the waist to each ball, leaving open
  // V-gaps between them.
  for (const p of PRONGS) {
    const bx = px(p.x)
    const by = py(p.y)
    const stemHalf = p.r * hw * STEM_RATIO
    const rootHalf = stemHalf * 1.35
    ctx.moveTo(px(p.x * 0.1) - rootHalf, py(WAIST_Y))
    ctx.lineTo(bx - stemHalf, by)
    ctx.lineTo(bx + stemHalf, by)
    ctx.lineTo(px(p.x * 0.1) + rootHalf, py(WAIST_Y))
    ctx.closePath()
  }
  ctx.fill()

  // Balls.
  for (const p of PRONGS) {
    ctx.beginPath()
    ctx.arc(px(p.x), py(p.y), p.r * hw, 0, Math.PI * 2)
    ctx.fill()
  }

  // Base bar with rounded ends.
  const bh = BASE_HEIGHT * height
  const bx0 = px(-BASE_HALF_WIDTH)
  const bx1 = px(BASE_HALF_WIDTH)
  const byTop = py(BASE_Y + BASE_HEIGHT)
  ctx.beginPath()
  ctx.roundRect(bx0, byTop, bx1 - bx0, bh, bh * 0.45)
  ctx.fill()

  // Neck joining base to waist.
  ctx.beginPath()
  ctx.moveTo(px(-NECK_HALF_WIDTH), py(WAIST_Y + 0.04))
  ctx.lineTo(px(NECK_HALF_WIDTH), py(WAIST_Y + 0.04))
  ctx.lineTo(px(NECK_HALF_WIDTH * 1.6), py(BASE_Y + BASE_HEIGHT))
  ctx.lineTo(px(-NECK_HALF_WIDTH * 1.6), py(BASE_Y + BASE_HEIGHT))
  ctx.closePath()
  ctx.fill()
}

/**
 * The same coronet as extrudable THREE.Shapes, for the applied marker at 12
 * and the clasp cover. Origin is at the centre of the base, +Y up.
 */
export function coronetShapes(width: number, height: number): THREE.Shape[] {
  const hw = width / 2
  const shapes: THREE.Shape[] = []

  for (const p of PRONGS) {
    const bx = p.x * hw
    const by = p.y * height
    const stemHalf = p.r * hw * STEM_RATIO
    const rootHalf = stemHalf * 1.35
    const stem = new THREE.Shape()
    stem.moveTo(p.x * 0.1 * hw - rootHalf, WAIST_Y * height)
    stem.lineTo(bx - stemHalf, by)
    stem.lineTo(bx + stemHalf, by)
    stem.lineTo(p.x * 0.1 * hw + rootHalf, WAIST_Y * height)
    stem.closePath()
    shapes.push(stem)

    const ball = new THREE.Shape()
    ball.absarc(bx, by, p.r * hw, 0, Math.PI * 2, false)
    shapes.push(ball)
  }

  const base = new THREE.Shape()
  const bx = BASE_HALF_WIDTH * hw
  const by0 = BASE_Y * height
  const by1 = (BASE_Y + BASE_HEIGHT) * height
  base.moveTo(-bx, by0)
  base.lineTo(bx, by0)
  base.lineTo(bx, by1)
  base.lineTo(-bx, by1)
  base.closePath()
  shapes.push(base)

  const neck = new THREE.Shape()
  neck.moveTo(-NECK_HALF_WIDTH * hw, WAIST_Y * height)
  neck.lineTo(NECK_HALF_WIDTH * hw, WAIST_Y * height)
  neck.lineTo(NECK_HALF_WIDTH * 1.6 * hw, by1)
  neck.lineTo(-NECK_HALF_WIDTH * 1.6 * hw, by1)
  neck.closePath()
  shapes.push(neck)

  return shapes
}
