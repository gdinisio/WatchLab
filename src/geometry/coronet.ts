import * as THREE from 'three'

/**
 * The Rolex coronet, traced from the reference logotype.
 *
 * The structure that matters, and that a naive reading gets wrong:
 *
 *  - The five prongs are TAPERING TRIANGULAR SPIKES, wide where they leave the body
 *    and narrowing to the ball. They are not thin parallel stems — that reads as a
 *    sea urchin. The deep, narrow V-notches between them are most of the silhouette.
 *  - The prongs FAN OUTWARD: the outer pair lean hard and sit noticeably lower than
 *    the centre, so the five balls describe a shallow arc rather than a flat line.
 *  - The body below the notches is a trapezoid that narrows downward into...
 *  - ...a HOLLOW elliptical band at the base. That ellipse is the crown's band seen
 *    slightly from above, and its open centre is a defining feature — filled solid,
 *    the whole mark reads as a generic crown.
 *
 * All coordinates are normalised: x as a fraction of half-width, y as a fraction of
 * height with 0 at the very bottom of the base band.
 */

interface Prong {
  /** Ball centre. */
  x: number
  y: number
  /** Ball radius, as a fraction of half-width. */
  r: number
  /** Centre of this prong's root, where it leaves the body. */
  baseX: number
}

const PRONGS: Prong[] = [
  { x: 0.0, y: 0.93, r: 0.163, baseX: 0.0 },
  { x: 0.46, y: 0.87, r: 0.15, baseX: 0.29 },
  { x: -0.46, y: 0.87, r: 0.15, baseX: -0.29 },
  { x: 0.85, y: 0.74, r: 0.15, baseX: 0.58 },
  { x: -0.85, y: 0.74, r: 0.15, baseX: -0.58 },
]

/** Height at which the V-notches bottom out and the solid body begins. */
const PRONG_BASE_Y = 0.38
/** Half-width of each prong root. The gaps left between roots ARE the notches. */
const PRONG_ROOT_HALF = 0.125
/** How wide the prong still is at its tip, as a fraction of the ball radius. */
const PRONG_TIP_RATIO = 0.42

const BODY_TOP_HALF = 0.71
const BODY_BOTTOM_HALF = 0.44
const BODY_BOTTOM_Y = 0.11

/** The base band, an ellipse because the crown is seen slightly from above. */
const BASE = { rx: 0.41, ry: 0.078, cy: 0.092, innerRx: 0.3, innerRy: 0.046 }

/**
 * Draws the coronet into a 2D context, centred on `cx` with `cy` at the BASE.
 * Canvas y grows downward, so the crown is drawn upward from cy.
 *
 * The hollow in the base band is punched with `destination-out` so it works
 * whatever colour the mark is being filled in.
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

  // Tapering spikes.
  ctx.beginPath()
  for (const p of PRONGS) {
    const tipHalf = p.r * PRONG_TIP_RATIO
    ctx.moveTo(px(p.baseX - PRONG_ROOT_HALF), py(PRONG_BASE_Y))
    ctx.lineTo(px(p.x - tipHalf), py(p.y))
    ctx.lineTo(px(p.x + tipHalf), py(p.y))
    ctx.lineTo(px(p.baseX + PRONG_ROOT_HALF), py(PRONG_BASE_Y))
    ctx.closePath()
  }
  ctx.fill()

  // Balls.
  for (const p of PRONGS) {
    ctx.beginPath()
    ctx.arc(px(p.x), py(p.y), p.r * hw, 0, Math.PI * 2)
    ctx.fill()
  }

  // Body: trapezoid from the notch floor down to the band.
  ctx.beginPath()
  ctx.moveTo(px(-BODY_TOP_HALF), py(PRONG_BASE_Y))
  ctx.lineTo(px(BODY_TOP_HALF), py(PRONG_BASE_Y))
  ctx.lineTo(px(BODY_BOTTOM_HALF), py(BODY_BOTTOM_Y))
  ctx.lineTo(px(-BODY_BOTTOM_HALF), py(BODY_BOTTOM_Y))
  ctx.closePath()
  ctx.fill()

  // Base band.
  ctx.beginPath()
  ctx.ellipse(px(0), py(BASE.cy), BASE.rx * hw, BASE.ry * height, 0, 0, Math.PI * 2)
  ctx.fill()

  // Punch its hollow centre.
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.ellipse(
    px(0), py(BASE.cy), BASE.innerRx * hw, BASE.innerRy * height, 0, 0, Math.PI * 2,
  )
  ctx.fill()
  ctx.restore()
}

/**
 * The same coronet as extrudable THREE.Shapes, for the applied marker at 12,
 * the crown face and the clasp cover. Origin is the centre of the base, +Y up.
 */
export function coronetShapes(width: number, height: number): THREE.Shape[] {
  const hw = width / 2
  const shapes: THREE.Shape[] = []

  for (const p of PRONGS) {
    const tipHalf = p.r * PRONG_TIP_RATIO
    const spike = new THREE.Shape()
    spike.moveTo((p.baseX - PRONG_ROOT_HALF) * hw, PRONG_BASE_Y * height)
    spike.lineTo((p.x - tipHalf) * hw, p.y * height)
    spike.lineTo((p.x + tipHalf) * hw, p.y * height)
    spike.lineTo((p.baseX + PRONG_ROOT_HALF) * hw, PRONG_BASE_Y * height)
    spike.closePath()
    shapes.push(spike)

    const ball = new THREE.Shape()
    ball.absarc(p.x * hw, p.y * height, p.r * hw, 0, Math.PI * 2, false)
    shapes.push(ball)
  }

  const body = new THREE.Shape()
  body.moveTo(-BODY_TOP_HALF * hw, PRONG_BASE_Y * height)
  body.lineTo(BODY_TOP_HALF * hw, PRONG_BASE_Y * height)
  body.lineTo(BODY_BOTTOM_HALF * hw, BODY_BOTTOM_Y * height)
  body.lineTo(-BODY_BOTTOM_HALF * hw, BODY_BOTTOM_Y * height)
  body.closePath()
  shapes.push(body)

  // Base band, with its hollow centre as a real hole.
  const band = new THREE.Shape()
  band.absellipse(0, BASE.cy * height, BASE.rx * hw, BASE.ry * height, 0, Math.PI * 2, false, 0)
  const hollow = new THREE.Path()
  hollow.absellipse(
    0, BASE.cy * height, BASE.innerRx * hw, BASE.innerRy * height, 0, Math.PI * 2, true, 0,
  )
  band.holes.push(hollow)
  shapes.push(band)

  return shapes
}
