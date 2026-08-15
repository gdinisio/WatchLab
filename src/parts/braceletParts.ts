import * as THREE from 'three'
import { AXIS, BRACELET, CASE } from '../config/datejust36'
import {
  braceletPlacements, buildClaspCoronet, buildClaspCover, buildEndLink, buildLinkCentre,
  buildLinkFlanks, buildLinkPin, claspTransform,
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

const endLinkInstance = (side: 1 | -1) => ({
  count: 1,
  transform: () =>
    new THREE.Matrix4().compose(
      new THREE.Vector3(0, Y.braceletPlane, side * (CASE.lugToLug / 2 - 4.6)),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, side === 1 ? 0 : Math.PI, 0)),
      new THREE.Vector3(1, 1, 1),
    ),
})

const runParts: PartDef[] = SIDES.flatMap(({ key, side, axis, label }) => [
  {
    id: `end-link-${key}`,
    name: `End Link · ${label}`,
    group,
    geometry: buildEndLink,
    material: 'steelBrushed',
    instances: endLinkInstance(side),
    explode: { axis, distance: 16, order: 2 },
    spec: {
      material: '904L Oystersteel',
      function: 'Solid end link filling the gap between the lugs, curved to sit flush against the case.',
      dimension: `${CASE.lugWidth} mm`,
      finish: 'Satin-brushed',
    },
    ...(key === '6' ? { labelOffset: [0, -4, 8] as const } : {}),
  },
  {
    id: `link-centres-${key}`,
    name: `Link Centres · ${label}`,
    group,
    geometry: buildLinkCentre,
    material: 'steelBrushed',
    instances: runInstances(side),
    explode: { axis, distance: 30, order: 1 },
    spec: {
      material: '904L Oystersteel',
      function: 'The broad satin centre section of each three-piece Oyster link.',
      count: BRACELET.linksPerSide,
      finish: 'Satin-brushed along the bracelet',
    },
    ...(key === '6' ? { labelOffset: [0, -5, 10] as const } : {}),
  },
  {
    id: `link-flanks-${key}`,
    name: `Link Flanks · ${label}`,
    group,
    geometry: buildLinkFlanks,
    material: 'steelPolished',
    instances: runInstances(side),
    explode: { axis, distance: 36, order: 1 },
    spec: {
      material: '904L Oystersteel',
      function: 'The polished outer sections either side of the centre link — the contrast that defines an Oyster bracelet.',
      count: BRACELET.linksPerSide * 2,
      finish: 'Mirror-polished',
    },
  },
  {
    id: `link-pins-${key}`,
    name: `Link Pins · ${label}`,
    group,
    geometry: buildLinkPin,
    material: 'steelPolished',
    instances: runInstances(side),
    explode: { axis, distance: 42, order: 0 },
    spec: {
      material: 'Stainless steel',
      function: 'Screwed pins articulating each link against the next.',
      count: BRACELET.linksPerSide,
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
