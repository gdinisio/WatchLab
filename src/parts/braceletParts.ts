import * as THREE from 'three'
import { AXIS, BRACELET, CASE } from '../config/datejust36'
import {
  END_LINK_Z, braceletPlacements, buildClaspCoronet, buildClaspCover, buildEndLinkCentre,
  buildEndLinkFlanks, buildLinkCentre, buildLinkFlanks, buildLinkPin, claspTransform,
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
 * Pins leave along their OWN axis, sideways out of the bracelet — not along the run.
 *
 * Sending them down the run meant they travelled THROUGH every link ahead of them on
 * the way out, which is exactly what a pin does not do. Pulling them out sideways is
 * how the bracelet is actually taken apart, and it leaves a rank of rods parked clear
 * of the links so you can see what was holding them together. The two runs go to
 * opposite sides so their ranks do not stack on top of each other.
 */
const pinAxis = (side: 1 | -1) => [side, 0, 0] as const

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
    explode: { axis, distance: 16, order: 2 },
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
    explode: { axis, distance: 22, order: 2 },
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
    explode: { axis, distance: 30, order: 1 },
    spec: {
      material: '904L Oystersteel',
      function: 'The broad polished centre section of each three-piece Oyster link.',
      count: BRACELET.linksPerSide,
      finish: 'Mirror-polished',
    },
    ...(key === '6' ? { labelOffset: [0, -5, 10] as const } : {}),
  },
  {
    id: `link-flanks-${key}`,
    name: `Link Flanks · ${label}`,
    group,
    geometry: buildLinkFlanks,
    material: 'steelBrushed',
    instances: runInstances(side),
    explode: { axis, distance: 36, order: 1 },
    spec: {
      material: '904L Oystersteel',
      function: 'The satin outer sections either side of the centre link — the contrast that defines an Oyster bracelet.',
      count: BRACELET.linksPerSide * 2,
      finish: 'Satin-brushed along the bracelet',
    },
  },
  {
    id: `link-pins-${key}`,
    name: `Link Pins · ${label}`,
    group,
    geometry: buildLinkPin,
    material: 'steelPolished',
    instances: runInstances(side),
    explode: {
      axis: pinAxis(side),
      distance: 30,
      order: 0,
      // Unscrewing on the way out. Visible only because the head is slotted.
      spin: 2.5,
      spinAxis: pinAxis(side),
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
      finish: 'Satin top, polished sides',
    },
    labelOffset: [0, -4, 8],
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
