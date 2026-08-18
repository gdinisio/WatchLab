import * as THREE from 'three'
import { AXIS, BRACELET, CASE } from '../config/datejust36'
import {
  END_LINK_Z, LINK_PIN_PIVOT, LINK_PIN_THREAD, LINK_PIN_TURNS, braceletPlacements, buildClaspCentre,
  buildClaspCoronet, buildClaspCover, buildEndLinkCentre, buildEndLinkFlanks, buildLinkCentre,
  buildLinkFlank, buildLinkPin, claspTransform,
} from './bracelet'
import { Y } from './layout'
import type { PartDef, PartGroup } from './types'

/**
 * The two bracelet runs explode along their OWN side (+Z at 6 o'clock, −Z at 12)
 * rather than straight down. Sending both down would drop 18 links straight through
 * the movement stack, which is where all the interesting parts are.
 */
const SIDES = [
  { key: '6', side: 1 as const, axis: AXIS.six, label: '6 o’clock run' },
  { key: '12', side: -1 as const, axis: AXIS.twelve, label: '12 o’clock run' },
]

const group: PartGroup = 'bracelet'

const runInstances = (side: 1 | -1) => {
  const placements = braceletPlacements(side)
  return { count: placements.length, transform: (i: number) => placements[i].matrix }
}

/**
 * The bracelet comes apart ACROSS ITS WIDTH, because that is how it goes together.
 *
 * A three-piece link is not a stack: the polished centre and the two satin flanks sit
 * SIDE BY SIDE across the band, threaded on a pin that runs the same way. So every
 * piece separates along X — flanks outward to their own side, pins on out past them
 * — and X is the one axis that stays constant along the whole drape, so the run opens
 * like a book instead of shearing sideways along itself.
 *
 * The centre is the odd one out: being the middle of the sandwich it has nowhere to
 * go across the width, so it lifts clear instead, and the polished run keeps showing
 * the drape's shape while everything else peels off it.
 */
const ACROSS = (hand: -1 | 1) => [hand, 0, 0] as const
const LIFT = [0, 1, 0] as const

/** Pins withdraw to the side the watch's own run leans toward, so the ranks do not stack. */
const pinHand = (side: 1 | -1): -1 | 1 => (side === 1 ? 1 : -1)

/**
 * The bracelet is taken apart as a SEQUENCE, not as part of the shared cascade.
 *
 * Read the slider backwards, the way it is actually assembled: the links close up
 * and settle first; then, with the bracelet completely still, the pins fly in, stop
 * at the mouths of their holes, push home and thread the last few millimetres. That
 * beat of stillness is the whole point — a screw going into a joint that is still
 * moving reads as debris drifting past, not as assembly.
 *
 * The cascade cannot say this. Its windows are 0.55 of the timeline and consecutive
 * orders are only 0.041 apart, so every bracelet part is always moving at once. The
 * gap at 0.24-0.28 is the pause; the small offsets between the three link parts keep
 * them flowing rather than snapping as a slab.
 */
const PIN_SPAN = [0, 0.42] as const
const FLANK_SPAN = [0.46, 0.72] as const
const CENTRE_SPAN = [0.49, 0.76] as const
const END_LINK_SPAN = [0.53, 0.82] as const

/** How far the pin travels, and how far of that its tail is still inside the link. */
const PIN_DISTANCE = 29
/** Tail at -9.6 to the flank's outer face at 9.94: the travel that clears the hole. */
const PIN_CLEAR = 19.54

/**
 * The pin's three beats, derived from the part rather than chosen.
 *
 * `of` is the share of the travel, `over` the share of the pin's timeline. Read
 * outward from seated — which is the order it comes apart, and read backwards, the
 * order it goes together:
 *
 *   thread   the exact length of thread cut on the pin, turning one pitch per turn
 *   push     the smooth shank running through the near flank and the centre link
 *   fly      clear of the hole and out to the parking position
 *
 * Splitting distance from time is what makes the threading legible: it is a sixth of
 * the journey but two fifths of the clock, so ten turns happen at a pace you can
 * follow while the rest of the trip runs briskly.
 */
const PIN_LEGS = [
  { of: LINK_PIN_THREAD.length / PIN_DISTANCE, over: 0.4 },
  { of: (PIN_CLEAR - LINK_PIN_THREAD.length) / PIN_DISTANCE, over: 0.36 },
  { of: (PIN_DISTANCE - PIN_CLEAR) / PIN_DISTANCE, over: 0.24 },
] as const

const endLinkInstance = (side: 1 | -1) => ({
  count: 1,
  transform: () =>
    new THREE.Matrix4().compose(
      new THREE.Vector3(0, Y.braceletPlane, side * END_LINK_Z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, side === 1 ? 0 : Math.PI, 0)),
      new THREE.Vector3(1, 1, 1),
    ),
})

const runParts: PartDef[] = SIDES.flatMap(({ key, side, axis, label }) => [
  {
    id: `end-link-centre-${key}`,
    name: `End Link Centre · ${label}`,
    group,
    // The polished stripe has to start AT THE CASE. Running a single brushed end link
    // between the case and the first Oyster link breaks the centre highlight exactly
    // where the eye follows it off the watch.
    material: 'steelPolished',
    geometry: buildEndLinkCentre,
    instances: endLinkInstance(side),
    explode: { axis, distance: 15, order: 3, span: END_LINK_SPAN },
    spec: {
      material: '904L Oystersteel',
      function: 'Polished centre of the solid end link, carrying the bracelet’s centre stripe out of the case.',
      dimension: `${CASE.lugWidth} mm across the lugs`,
      finish: 'Mirror-polished',
    },
    ...(key === '6' ? { labelOffset: [0, -4, 8] as const } : {}),
  },
  {
    id: `end-link-flanks-${key}`,
    name: `End Link Flanks · ${label}`,
    group,
    geometry: buildEndLinkFlanks,
    material: 'steelBrushed',
    instances: endLinkInstance(side),
    explode: { axis, distance: 21, order: 3, span: END_LINK_SPAN },
    spec: {
      material: '904L Oystersteel',
      function: 'Satin horns of the end link, cut to the case’s circumference so they close the gap between the lugs.',
      finish: 'Satin-brushed',
    },
  },
  {
    id: `link-centres-${key}`,
    name: `Link Centres · ${label}`,
    group,
    geometry: buildLinkCentre,
    // POLISHED centre between SATIN flanks. This is the Datejust Oyster signature
    // and it is the other way round from a Submariner — getting it backwards makes
    // the bracelet read as the wrong watch entirely.
    material: 'steelPolished',
    instances: runInstances(side),
    explode: { axis: LIFT, distance: 11, order: 2, span: CENTRE_SPAN },
    spec: {
      material: '904L Oystersteel',
      function: 'The broad polished centre section of each three-piece Oyster link.',
      count: BRACELET.linksPerSide,
      finish: 'Mirror-polished',
    },
    ...(key === '6' ? { labelOffset: [0, -5, 10] as const } : {}),
  },
  ...([-1, 1] as const).map((hand) => ({
    id: `link-flanks-${hand < 0 ? 'l' : 'r'}-${key}`,
    name: `Link Flanks · ${hand < 0 ? 'left' : 'right'} · ${label}`,
    group,
    geometry: () => buildLinkFlank(hand),
    material: 'steelBrushed' as const,
    instances: runInstances(side),
    explode: { axis: ACROSS(hand), distance: 15, order: 1, span: FLANK_SPAN },
    spec: {
      material: '904L Oystersteel',
      function: 'The satin outer section beside the centre link — the contrast that defines an Oyster bracelet.',
      count: BRACELET.linksPerSide,
      finish: 'Satin-brushed along the bracelet',
    },
  })),
  {
    id: `link-pins-${key}`,
    name: `Link Pins · ${label}`,
    group,
    geometry: () => buildLinkPin(pinHand(side)),
    material: 'steelPolished' as const,
    instances: runInstances(side),
    explode: {
      axis: ACROSS(pinHand(side)),
      // Out past the flank on that side, so the rods park clear of everything else.
      distance: PIN_DISTANCE,
      order: 0,
      span: PIN_SPAN,
      /**
       * Ten turns, because that is what the thread is: 4.5mm of it at a 0.45mm pitch.
       * Derived rather than chosen, so a screw cannot advance by anything other than
       * one pitch per revolution however either number is retuned.
       */
      spin: LINK_PIN_TURNS,
      /**
       * The screws go in ONE AFTER ANOTHER, from the clasp back toward the case.
       *
       * Twelve pins arriving in perfect unison is the one thing that gave the whole
       * sequence away as an animation: nobody assembles a bracelet that way. A third
       * of the window spread down the run turns the rank into a ripple, and each pin
       * still gets the full push-then-thread treatment in its own slice of it.
       */
      stagger: 0.34,
      spinAxis: ACROSS(pinHand(side)),
      /**
       * The line the pin turns about — its own, not its link's.
       *
       * Without this the rotation is taken about the instance origin, 2.58mm away,
       * and 2.5 turns swing each pin through a 5.2mm arc. That is the "one big
       * motion": the pins were orbiting, not screwing.
       */
      spinPivot: LINK_PIN_PIVOT,
      /**
       * Closing the bracelet, the pin flies in, settles at the mouth of its hole,
       * pushes home, and threads the last few millimetres.
       *
       * The turning is tied to the first leg rather than given its own number, so the
       * pin cannot turn for longer or shorter than its thread is engaged however the
       * beats are retimed later. Together with `spin` coming off the pitch, that means
       * the screw turns exactly while the thread is in the hole and advances exactly
       * one pitch each time it does.
       *
       * These are fractions of the RAW cascade parameter: parts carrying a `seat`
       * skip `easeOutBack`, which would otherwise squash the lot into the first few
       * percent of the slider.
       */
      seat: PIN_LEGS,
      spinPhase: PIN_LEGS[0].over,
    },
    spec: {
      material: 'Stainless steel',
      function: 'Screwed pins articulating each link against the next, concealed inside the link flanks.',
      count: BRACELET.linksPerSide,
      dimension: 'Ø0.84 × 14.4 mm',
      finish: 'Polished, slotted heads',
    },
  },
])

export const BRACELET_PARTS: PartDef[] = [
  ...runParts,
  {
    id: 'clasp',
    name: 'Oysterclasp',
    group,
    geometry: buildClaspCover,
    material: 'steelBrushed',
    instances: { count: 1, transform: () => claspTransform() },
    explode: { axis: AXIS.six, distance: 48, order: 0 },
    spec: {
      material: '904L Oystersteel',
      function: 'Folding clasp with a concealed Easylink 5 mm comfort extension.',
      dimension: `${BRACELET.clasp.width} × ${BRACELET.clasp.length} mm`,
      finish: 'Satin cover, polished bevels',
    },
    labelOffset: [0, -4, 8],
  },
  {
    id: 'clasp-centre',
    name: 'Clasp Centre',
    group,
    geometry: buildClaspCentre,
    material: 'steelPolished',
    instances: { count: 1, transform: () => claspTransform() },
    explode: { axis: LIFT, distance: 13, order: 1 },
    spec: {
      material: '904L Oystersteel',
      function: 'Carries the bracelet’s polished centre stripe across the clasp to the buckle.',
      finish: 'Mirror-polished',
    },
  },
  {
    id: 'clasp-coronet',
    name: 'Clasp Coronet',
    group,
    geometry: buildClaspCoronet,
    material: 'steelPolished',
    instances: {
      count: 1,
      transform: () =>
        claspTransform().multiply(
          new THREE.Matrix4().makeTranslation(0, BRACELET.clasp.thickness / 2 + 0.1, 0),
        ),
    },
    explode: { axis: AXIS.six, distance: 52, order: 0 },
    spec: {
      material: '904L Oystersteel',
      function: 'The coronet stamped into the clasp cover.',
      finish: 'Polished',
    },
  },
]
