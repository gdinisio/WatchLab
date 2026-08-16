import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BRACELET, CASE } from '../config/datejust36'
import { coronetShapes } from '../geometry/logoSvg'
import { archAcrossX, flatExtrude, roundedRect, sectionExtrude, taperAlongZ } from '../geometry/shapes'
import { cached, mergeAll, subdivide } from '../geometry/utils'
import { Y } from './layout'

/** Links are modelled at this nominal width and scaled per instance as the taper runs. */
const NOMINAL_WIDTH = 20
const HALF_WIDTH = NOMINAL_WIDTH / 2

/**
 * Drop from the crown of the bracelet's transverse arc down to `x`.
 *
 * Shared by every component so the section is continuous from the end link, through
 * eighteen links, to the clasp — a link that arcs differently from its neighbour
 * shows up instantly as a kink running down the bracelet.
 */
function archDrop(x: number): number {
  const t = Math.min(1, Math.abs(x) / HALF_WIDTH)
  return BRACELET.arch.rise * Math.pow(t, BRACELET.arch.exponent)
}

/**
 * The transverse SECTION of one piece of a three-piece link, spanning x0..x1.
 *
 * Drawn in the X-Y plane and extruded along the link's LENGTH. That is the whole
 * trick: the arch across the bracelet lives in the outline, where it is sampled as
 * finely as we like, and the extrusion's bevel lands on the link's END faces, which
 * is exactly where an articulating link wants its chamfer.
 */
function linkSection(x0: number, x1: number, thickness: number, yOffset: number): THREE.Shape {
  const r = BRACELET.link.edgeRadius
  const top = (x: number) => yOffset + thickness / 2 - archDrop(x)
  const bot = (x: number) => yOffset - thickness / 2 - archDrop(x)
  const SAMPLES = 18

  const s = new THREE.Shape()
  const run = (from: number, to: number, edge: (x: number) => number, first: boolean) => {
    for (let i = 0; i <= SAMPLES; i++) {
      const x = from + (to - from) * (i / SAMPLES)
      if (first && i === 0) s.moveTo(x, edge(x))
      else s.lineTo(x, edge(x))
    }
  }

  // Along the top, round the outer corner, back along the bottom, round home. Every
  // long edge carries a radius: on a real Oyster those broken edges are polished, and
  // they are what turn each seam into a bright V rather than a dark line.
  run(x0 + r, x1 - r, top, true)
  s.quadraticCurveTo(x1, top(x1), x1, top(x1) - r)
  s.lineTo(x1, bot(x1) + r)
  s.quadraticCurveTo(x1, bot(x1), x1 - r, bot(x1 - r))
  run(x1 - r, x0 + r, bot, false)
  s.quadraticCurveTo(x0, bot(x0), x0, bot(x0) + r)
  s.lineTo(x0, top(x0) - r)
  s.quadraticCurveTo(x0, top(x0), x0 + r, top(x0 + r))
  s.closePath()
  return s
}

/**
 * An Oyster link is a three-piece assembly: a broad POLISHED centre flanked by two
 * SATIN outer sections. That finish contrast running down the bracelet is the whole
 * visual identity of an Oyster — modelling the link as one uniform block throws it
 * away, so the centre and the flanks are separate meshes with separate materials.
 */
function linkPiece(
  widthFraction: number,
  offsetFraction: number,
  opts: { thickness?: number; yOffset?: number } = {},
): THREE.BufferGeometry {
  const { thickness = BRACELET.linkThickness, yOffset = 0 } = opts
  const half = (NOMINAL_WIDTH * widthFraction) / 2
  const cx = NOMINAL_WIDTH * offsetFraction
  const bevel = BRACELET.link.endChamfer
  // Links butt up against each other with a seam you can barely get a fingernail
  // into, but they cannot butt EXACTLY: where the drape curls tightest neighbouring
  // links pivot ~12 degrees against each other, and with no seam at all their inner
  // corners would drive straight through one another.
  const depth = BRACELET.linkLength - BRACELET.link.seam - bevel * 2

  return sectionExtrude(linkSection(cx - half, cx + half, thickness, yOffset), {
    depth,
    bevel,
    bevelSegments: 3,
    curveSegments: 6,
  })
}

/**
 * The polished centre link sits marginally PROUD of the satin flanks. That tiny step
 * is why the centre stripe catches its own separate highlight down the length of the
 * bracelet instead of dissolving into the flanks.
 */
export function buildLinkCentre(): THREE.BufferGeometry {
  return cached('brc/linkCentre', () => {
    const proud = BRACELET.link.centreProud
    return toCreasedNormals(
      linkPiece(BRACELET.link.centre, 0, {
        thickness: BRACELET.linkThickness + proud,
        yOffset: proud / 2,
      }),
      Math.PI / 5,
    )
  })
}

/**
 * ONE satin flank, left or right.
 *
 * Modelled separately rather than as a merged pair because of how the bracelet comes
 * apart: the three pieces of a link sit SIDE BY SIDE across the width, not stacked,
 * so they separate outward across that width. A single merged geometry can only
 * travel one way, which left the two flanks sliding off together in one direction —
 * a movement that says nothing about how the link is built.
 */
export function buildLinkFlank(hand: -1 | 1): THREE.BufferGeometry {
  return cached(`brc/linkFlank${hand}`, () => {
    const { flank, flankOffset } = BRACELET.link
    return toCreasedNormals(linkPiece(flank, hand * flankOffset), Math.PI / 5)
  })
}

/**
 * End link geometry.
 *
 * Where the Oyster links are constant in section and so can be swept, the end link
 * has a PLAN shape — its inner edge is cut to the case's circumference so the two
 * horns reach around the flank while the middle clears the caseback. So this one is
 * extruded flat, subdivided and then arched to match the links it feeds.
 */
const END_LINK = {
  /** Instance position along Z: tucked between the lug tips. */
  centreZ: CASE.lugToLug / 2 - 4.6,
  /** Where the first Oyster link begins — the end link's outer edge meets it. */
  outerZ: CASE.lugToLug / 2 - 1.4,
  /**
   * Radius the case-facing edge is cut to.
   *
   * The Oyster flank BULGES, so the case narrows as it drops: about 17.4mm at the
   * top of the end link and under 16mm at the bottom. A straight prism cannot follow
   * that, so the cut is set to the NARROWEST of those rather than the widest — the
   * end link then runs slightly inside the case up top, where the case hides it,
   * instead of standing off it lower down where a wedge of daylight would show.
   */
  caseRadius: 16.0,
}

function endLinkBand(widthFraction: number, offsetFraction: number): THREE.Shape {
  const half = (NOMINAL_WIDTH * widthFraction) / 2
  const cx = NOMINAL_WIDTH * offsetFraction
  const x0 = cx - half
  const x1 = cx + half
  // Shape +Y maps to world -Z, so larger y is FURTHER under the case.
  const outerY = END_LINK.centreZ - END_LINK.outerZ
  const caseY = (x: number) =>
    END_LINK.centreZ - Math.sqrt(Math.max(1, END_LINK.caseRadius ** 2 - x * x))

  const s = new THREE.Shape()
  s.moveTo(x0, outerY)
  s.lineTo(x1, outerY)
  const SAMPLES = 14
  for (let i = 0; i <= SAMPLES; i++) {
    const x = x1 + (x0 - x1) * (i / SAMPLES)
    s.lineTo(x, caseY(x))
  }
  s.closePath()
  return s
}

/**
 * Local Z limits of the end link, for the thickness taper.
 *
 * Shape +Y becomes world -Z, so the CASE side of the piece is at negative local z —
 * furthest back at the horns, where the case's circumference is nearest — and the
 * outer edge that meets the first Oyster link is at positive local z.
 */
const END_LINK_Z_AT_CASE =
  Math.sqrt(END_LINK.caseRadius ** 2 - HALF_WIDTH ** 2) - END_LINK.centreZ
const END_LINK_Z_AT_LINK = END_LINK.outerZ - END_LINK.centreZ

function endLinkPiece(
  widthFraction: number,
  offsetFraction: number,
  thickness: number,
  yOffset: number,
): THREE.BufferGeometry {
  const g = flatExtrude(endLinkBand(widthFraction, offsetFraction), {
    thickness,
    bevel: 0.14,
    bevelSegments: 3,
    curveSegments: 8,
  })

  // Deep where the case is deep, ordinary where the bracelet takes over. Applied
  // before the offset and the arch so neither gets scaled with it.
  const swollen = subdivide(g, 2)
  taperAlongZ(
    swollen,
    { z: END_LINK_Z_AT_CASE, scale: BRACELET.endLinkThicknessAtCase / thickness },
    { z: END_LINK_Z_AT_LINK, scale: 1 },
  )
  swollen.translate(0, yOffset, 0)

  // The arch fades in over the same run. Held flat where the lugs close around it,
  // full by the time the first Oyster link picks it up.
  const span = END_LINK_Z_AT_LINK - END_LINK_Z_AT_CASE
  return archAcrossX(
    swollen,
    HALF_WIDTH,
    BRACELET.arch.rise,
    BRACELET.arch.exponent,
    (z) => {
      const t = Math.min(1, Math.max(0, (z - END_LINK_Z_AT_CASE) / span))
      return 0.25 + 0.75 * (t * t * (3 - 2 * t))
    },
  )
}

/** World Z the end link instance sits at — must match the plan shape it is cut from. */
export const END_LINK_Z = END_LINK.centreZ

export function buildEndLinkCentre(): THREE.BufferGeometry {
  return cached('brc/endLinkCentre', () => {
    const proud = BRACELET.link.centreProud
    return toCreasedNormals(
      endLinkPiece(BRACELET.link.centre, 0, BRACELET.linkThickness + proud, proud / 2),
      Math.PI / 5,
    )
  })
}

export function buildEndLinkFlanks(): THREE.BufferGeometry {
  return cached('brc/endLinkFlanks', () => {
    const { flank, flankOffset } = BRACELET.link
    const t = BRACELET.linkThickness
    const merged = mergeAll(
      [endLinkPiece(flank, -flankOffset, t, 0), endLinkPiece(flank, flankOffset, t, 0)],
      'endLink',
    )
    return toCreasedNormals(merged, Math.PI / 5)
  })
}

function claspSlab(
  widthFraction: number,
  thickness: number,
  yOffset: number,
  lengthTrim: number,
): THREE.BufferGeometry {
  const { length, width, cornerRadius } = BRACELET.clasp
  const g = flatExtrude(
    roundedRect(width * widthFraction, length - lengthTrim, cornerRadius),
    { thickness, bevel: 0.11, bevelSegments: 3, curveSegments: 20 },
  )
  g.translate(0, yOffset, 0)
  // Normalised on the clasp's own half-width so its edges drop by the same amount as
  // the tapered link ahead of it, and the section runs on unbroken.
  return archAcrossX(subdivide(g, 2), width / 2, BRACELET.arch.rise, BRACELET.arch.exponent)
}

/**
 * The Oysterclasp cover — the satin body of it.
 *
 * Corner radius and bevel are both tightened from what they were. The clasp is the
 * largest flat surface on the watch, so a soft edge there reads as a pebble; the real
 * cover is a crisp plate with a fine polished break around it.
 */
export function buildClaspCover(): THREE.BufferGeometry {
  return cached('brc/claspCover', () =>
    toCreasedNormals(claspSlab(1, BRACELET.clasp.thickness, 0, 0), Math.PI / 5),
  )
}

/**
 * The polished centre band across the clasp cover.
 *
 * The Oyster's centre stripe does not stop at the last link — it runs over the clasp
 * to the buckle, which is what makes the bracelet read as one continuous band rather
 * than a chain with a lid on the end. Same width fraction and same proud step as the
 * link centres, so it lines up with the run feeding into it.
 */
export function buildClaspCentre(): THREE.BufferGeometry {
  return cached('brc/claspCentre', () => {
    const proud = BRACELET.link.centreProud
    return toCreasedNormals(
      claspSlab(BRACELET.link.centre / 0.985, BRACELET.clasp.thickness + proud, proud / 2, 1.6),
      Math.PI / 5,
    )
  })
}

export function buildClaspCoronet(): THREE.BufferGeometry {
  return cached('brc/claspCoronet', () => {
    const shapes = coronetShapes(5.2)
    const g = flatExtrude(shapes, { thickness: 0.3, bevel: 0.05, bevelSegments: 2, curveSegments: 14 })
    g.computeBoundingBox()
    const b = g.boundingBox!
    g.translate(0, 0, -(b.min.z + b.max.z) / 2)
    return toCreasedNormals(g, Math.PI / 4)
  })
}

/**
 * A screwed link pin: a shaft with a slotted head at each end.
 *
 * The SLOT is not decoration. A plain cylinder is rotationally symmetric about its
 * own axis, so unscrewing it as it leaves the assembly is completely invisible — the
 * part just slides. The slot gives the rotation something to read against. It is cut
 * as a hole through a short head disc rather than a blind recess; the shaft directly
 * behind it stops you seeing daylight through the gap.
 *
 * Length is bounded by the bracelet's ARCH: the pin is straight and the link it sits
 * in curves away, so a pin spanning the full 20mm would surface through the flanks.
 */
export function buildLinkPin(): THREE.BufferGeometry {
  return cached('brc/linkPin', () => {
    const length = NOMINAL_WIDTH * 0.72
    const shaftRadius = 0.42
    const headRadius = 0.58
    const headThickness = 0.4

    const shaft = new THREE.CylinderGeometry(shaftRadius, shaftRadius, length, 20)
    shaft.rotateZ(Math.PI / 2)

    const face = new THREE.Shape()
    face.absarc(0, 0, headRadius, 0, Math.PI * 2, false)
    face.holes.push(roundedRect(0.17, shaftRadius * 1.85, 0.05))

    const heads = [-1, 1].map((sx) => {
      const head = sectionExtrude(face, {
        depth: headThickness,
        bevel: 0.05,
        bevelSegments: 2,
        curveSegments: 24,
      })
      head.rotateY(Math.PI / 2)
      head.translate(sx * (length / 2 + headThickness / 2), 0, 0)
      return head
    })

    const g = mergeAll([shaft, ...heads], 'linkPin')
    // The pin lives at the JOINT, not in the middle of the link it is instanced with.
    g.translate(0, 0, -BRACELET.linkLength / 2)
    return toCreasedNormals(g, Math.PI / 5)
  })
}

export interface LinkPlacement {
  matrix: THREE.Matrix4
  /** 0 at the lug, 1 at the clasp. */
  t: number
}

/**
 * Walks the bracelet away from the case link by link, tapering the width from 20mm
 * at the lugs to 16mm at the clasp.
 *
 * The path is integrated rather than evaluated: each link is placed, the walk steps
 * half a pitch to the joint, TURNS, and steps the other half. That is how an
 * articulated bracelet actually behaves — the links are rigid and all the bend
 * happens at the pins — and it lets the curvature vary along the run, which a closed
 * form circular arc cannot. A constant radius is the giveaway of a CG bracelet: real
 * ones leave the case almost level and curl progressively harder as they fall.
 *
 * `side` is +1 for the 6 o'clock run (+Z) and -1 for the 12 o'clock run.
 */
export function braceletPlacements(side: 1 | -1): LinkPlacement[] {
  const out: LinkPlacement[] = []
  const n = BRACELET.linksPerSide
  const pitch = BRACELET.linkLength
  const { startRadius, endRadius, curl, startAngle } = BRACELET.drape

  let z = side * END_LINK.outerZ
  let y = Y.braceletPlane
  let a = startAngle

  // Positive `a` runs forward and DOWN, and a rotation of `side * a` about X tilts
  // the link to match on either run while keeping its arched face upward.
  const advance = (d: number) => {
    z += side * Math.cos(a) * d
    y -= Math.sin(a) * d
  }

  // Clear the end link, then land on the first link's centre.
  advance(pitch / 2 + BRACELET.link.seam / 2)

  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0
    const width = BRACELET.widthAtLug + (BRACELET.widthAtClasp - BRACELET.widthAtLug) * t

    out.push({
      matrix: new THREE.Matrix4().compose(
        new THREE.Vector3(0, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(side * a, 0, 0)),
        // Scaled in X only. The arch is baked at the nominal width, so a narrower
        // link ends up fractionally more curved — which is what the real taper does
        // as the bracelet closes toward the clasp.
        new THREE.Vector3(width / NOMINAL_WIDTH, 1, 1),
      ),
      t,
    })

    advance(pitch / 2)
    a += pitch / (startRadius + (endRadius - startRadius) * Math.pow(t, curl))
    advance(pitch / 2)
  }
  return out
}

export const ALL_PLACEMENTS: LinkPlacement[] = [
  ...braceletPlacements(1),
  ...braceletPlacements(-1),
]

/** Where the clasp sits: just past the last link of the 6 o'clock run. */
export function claspTransform(): THREE.Matrix4 {
  const last = braceletPlacements(1)[BRACELET.linksPerSide - 1]
  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  last.matrix.decompose(pos, quat, scale)
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quat)
  pos.addScaledVector(forward, BRACELET.clasp.length / 2 + BRACELET.linkLength * 0.6)
  return new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 1, 1))
}
