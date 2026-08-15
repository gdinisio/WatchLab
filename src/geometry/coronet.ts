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
  { x: 0.0, y: 1.0, r: 0.15 },
  { x: 0.52, y: 0.9, r: 0.135 },
  { x: -0.52, y: 0.9, r: 0.135 },
  { x: 1.0, y: 0.62, r: 0.13 },
  { x: -1.0, y: 0.62, r: 0.13 },
]

/** Where every stem converges, as a fraction of height. */
const WAIST_Y = 0.2
const BASE_Y = 0.06
const BASE_HALF_WIDTH = 0.62
const BASE_HEIGHT = 0.16

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
  // Tapered stems fanning out from the waist to each ball.
  for (const p of PRONGS) {
    const bx = px(p.x)
    const by = py(p.y)
    const stemHalf = p.r * hw * 0.52
    ctx.moveTo(px(p.x * 0.18) - stemHalf * 0.8, py(WAIST_Y))
    ctx.lineTo(bx - stemHalf, by)
    ctx.lineTo(bx + stemHalf, by)
    ctx.lineTo(px(p.x * 0.18) + stemHalf * 0.8, py(WAIST_Y))
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
  ctx.moveTo(px(-0.3), py(WAIST_Y + 0.02))
  ctx.lineTo(px(0.3), py(WAIST_Y + 0.02))
  ctx.lineTo(px(BASE_HALF_WIDTH * 0.8), py(BASE_Y + BASE_HEIGHT))
  ctx.lineTo(px(-BASE_HALF_WIDTH * 0.8), py(BASE_Y + BASE_HEIGHT))
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
    const stemHalf = p.r * hw * 0.52
    const stem = new THREE.Shape()
    stem.moveTo(p.x * 0.18 * hw - stemHalf * 0.8, WAIST_Y * height)
    stem.lineTo(bx - stemHalf, by)
    stem.lineTo(bx + stemHalf, by)
    stem.lineTo(p.x * 0.18 * hw + stemHalf * 0.8, WAIST_Y * height)
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
  neck.moveTo(-0.3 * hw, WAIST_Y * height)
  neck.lineTo(0.3 * hw, WAIST_Y * height)
  neck.lineTo(BASE_HALF_WIDTH * 0.8 * hw, by1)
  neck.lineTo(-BASE_HALF_WIDTH * 0.8 * hw, by1)
  neck.closePath()
  shapes.push(neck)

  return shapes
}
