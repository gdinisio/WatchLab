import * as THREE from 'three'
import { AXIS, BRACELET, CASE } from '../config/datejust36'
import {
  END_LINK_Z, braceletPlacements, buildClaspCentre, buildClaspCoronet, buildClaspCover, buildEndLinkCentre,
  buildEndLinkFlanks, buildLinkCentre, buildLinkFlank, buildLinkPin, claspTransform,
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
    explode: { axis, distance: 15, order: 3 },
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
    explode: { axis, distance: 21, order: 3 },
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
    explode: { axis: LIFT, distance: 11, order: 2 },
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
    explode: { axis: ACROSS(hand), distance: 15, order: 1 },
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
      distance: 29,
      order: 0,
      // Applied per instance, so each pin turns about ITSELF rather than orbiting the
      // assembly.
      spin: 1.5,
      spinAxis: ACROSS(pinHand(side)),
      /**
       * Closing the bracelet, the pin runs in, settles at the mouth of its hole,
       * pushes home over the second half of the timeline, and threads over the last
       * 16%.
       *
       * The numbers are matched to the part, not picked: at the phase boundary the
       * pin has travelled 14.5mm against its own 14.4mm length, so it settles exactly
       * clear of the hole; and the threading covers 2.40mm against a 2.3mm thread, so
       * it turns for precisely as long as the thread is engaged.
       */
      seat: { depth: 0.5, phase: 0.62 },
      spinPhase: 0.16,
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
