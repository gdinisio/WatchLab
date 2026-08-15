import * as THREE from 'three'
import { AXIS, BEZEL, CASE, CASEBACK, CROWN, CRYSTAL, DIAL, HANDS } from '../config/datejust36'
import {
  buildBezel, buildCaseback, buildCasingRing, buildCrown, buildCrownTube,
  buildCrystal, buildCyclops, buildGasket, buildMiddleCase, buildSpringBar,
  buildWindingStem,
} from './case'
import {
  buildCoronetApplique, buildDateDisc, buildDateFrame, buildDial, buildDialFoot,
  buildIndex, buildIndexLume,
} from './dial'
import { buildHandLume, buildHourHand, buildMinuteHand, buildSecondsHand } from './hands'
import { BRACELET_PARTS } from './braceletParts'
import { dialDirection, Y } from './layout'
import { MOVEMENT_PARTS } from './movementParts'
import type { PartDef } from './types'

/** Hour markers, minus 3 o'clock which the date aperture replaces and 12 which is doubled. */
const INDEX_HOURS = DIAL.indices.hours.filter((h) => h !== 12)

function indexTransform(i: number, radius: number, yOffset: number): THREE.Matrix4 {
  const hour = INDEX_HOURS[i]
  const [dx, dz] = dialDirection(hour)
  const angle = -(hour / 12) * Math.PI * 2
  return new THREE.Matrix4().compose(
    new THREE.Vector3(dx * radius, yOffset, dz * radius),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, 0)),
    new THREE.Vector3(1, 1, 1),
  )
}

const INDEX_RADIUS = DIAL.indices.outerRadius - DIAL.indices.length / 2

export const CASE_PARTS: PartDef[] = [
  {
    id: 'case-middle',
    name: 'Oyster Middle Case',
    group: 'case',
    geometry: buildMiddleCase,
    material: 'steelPolished',
    explode: { axis: AXIS.down, distance: 0, order: 0 },
    spec: {
      material: '904L Oystersteel',
      function: 'Monobloc middle case machined from a solid block; carries the lugs, the bezel seat and the movement bore.',
      dimension: 'Ø36.0 × 7.4 mm',
      finish: 'Mirror-polished flanks, satin lug tops',
    },
    labelOffset: [0, 0, -20],
  },
  {
    id: 'bezel',
    name: 'Fluted Bezel',
    group: 'case',
    geometry: buildBezel,
    material: 'whiteGold',
    position: [0, Y.bezelBottom, 0],
    explode: { axis: AXIS.up, distance: 25, order: 1, spin: 0.25 },
    spec: {
      material: '18k white gold',
      function: 'Screws onto the case to clamp the crystal. The flutes were originally a grip for sealing the case.',
      dimension: `Ø36.0 mm · ${BEZEL.fluteCount} flutes`,
      finish: 'Mirror-polished',
    },
    labelOffset: [0, 3, 0],
  },
  {
    id: 'crystal',
    name: 'Sapphire Crystal',
    group: 'case',
    geometry: buildCrystal,
    material: 'steelPolished',
    transmissive: true,
    arCoated: true,
    position: [0, Y.crystalBottom + CRYSTAL.thickness / 2, 0],
    explode: { axis: AXIS.up, distance: 31, order: 0 },
    renderOrder: 10,
    spec: {
      material: 'Synthetic sapphire (corundum)',
      function: 'Scratch-resistant window over the dial. Refractive index 1.77 — far higher than glass.',
      dimension: `Ø${CRYSTAL.radius * 2} × ${CRYSTAL.thickness} mm`,
      finish: 'Anti-reflective coated, laser-etched coronet at 6',
    },
    labelOffset: [0, 3, 0],
  },
  {
    id: 'cyclops',
    name: 'Cyclops Lens',
    group: 'case',
    geometry: buildCyclops,
    material: 'steelPolished',
    transmissive: true,
    // Uncoated: the Cyclops must read as a distinct raised lens with a bright rim.
    arCoated: false,
    position: [CRYSTAL.cyclops.distanceFromCentre, Y.crystalTop - 0.05, 0],
    explode: { axis: AXIS.up, distance: 35, order: 0 },
    renderOrder: 11,
    spec: {
      material: 'Synthetic sapphire',
      function: 'Plano-convex lens fused to the crystal, magnifying the date 2.5×.',
      dimension: `Ø${CRYSTAL.cyclops.radius * 2} mm`,
      finish: 'Polished, AR-coated',
    },
    labelOffset: [2, 2, 0],
  },
  {
    id: 'crystal-gasket',
    name: 'Crystal Gasket',
    group: 'case',
    geometry: () => buildGasket(CRYSTAL.radius + 0.12, 0.24),
    material: 'gasket',
    position: [0, Y.crystalBottom - 0.1, 0],
    explode: { axis: AXIS.up, distance: 21, order: 2 },
    spec: {
      material: 'Nitrile rubber',
      function: 'Seals the crystal against the case, forming part of the 100 m water resistance.',
      dimension: 'Ø29.7 mm cord 0.48 mm',
    },
  },
  {
    id: 'caseback',
    name: 'Screw-Down Caseback',
    group: 'case',
    geometry: buildCaseback,
    material: 'steelCircular',
    position: [0, Y.casebackOuter + CASEBACK.thickness / 2, 0],
    explode: { axis: AXIS.down, distance: 56, order: 10, spin: -1.25 },
    spec: {
      material: '904L Oystersteel',
      function: 'Screws into the case with a fluted rim that only the Rolex casing tool engages.',
      dimension: `Ø${CASEBACK.outerRadius * 2} mm`,
      finish: 'Circular-brushed',
    },
    labelOffset: [0, -3, 0],
  },
  {
    id: 'caseback-gasket',
    name: 'Caseback Gasket',
    group: 'case',
    geometry: () => buildGasket(CASEBACK.outerRadius - 0.5, 0.3),
    material: 'gasket',
    position: [0, Y.casebackSeat, 0],
    explode: { axis: AXIS.down, distance: 50, order: 9 },
    spec: {
      material: 'Nitrile rubber',
      function: 'Compressed as the caseback is torqued down; the primary seal against water ingress.',
      dimension: 'Ø30.8 mm cord 0.6 mm',
    },
  },
  {
    id: 'casing-ring',
    name: 'Casing Ring',
    group: 'case',
    geometry: buildCasingRing,
    material: 'gasket',
    position: [0, Y.casingRing, 0],
    explode: { axis: AXIS.down, distance: 13, order: 8 },
    spec: {
      material: 'Moulded polymer',
      function: 'Centres the movement in the case bore and isolates it from shock.',
      dimension: 'Ø30.0 mm',
    },
  },
  {
    id: 'crown',
    name: 'Twinlock Winding Crown',
    group: 'case',
    geometry: buildCrown,
    material: 'steelPolished',
    position: [CASE.middleRadius + CROWN.tubeLength - 1.2, -1.6, 0],
    // -PI/2 puts the coronet face outward at 3 o'clock; +PI/2 buries it in the case.
    rotation: [0, 0, -Math.PI / 2],
    explode: { axis: AXIS.crown, distance: 17, order: 5, spin: 2.5, spinAxis: AXIS.crown },
    spec: {
      material: '904L Oystersteel',
      function: 'Winds and sets the watch. Twinlock has two sealed zones — one in the tube, one in the crown.',
      dimension: 'Ø5.3 mm',
      finish: 'Polished, knurled grip',
    },
    labelOffset: [4, 0, 0],
  },
  {
    id: 'crown-tube',
    name: 'Crown Tube',
    group: 'case',
    geometry: buildCrownTube,
    material: 'steelPolished',
    position: [CASE.middleRadius - 0.9, -1.6, 0],
    rotation: [0, 0, Math.PI / 2],
    explode: { axis: AXIS.crown, distance: 10, order: 6 },
    spec: {
      material: '904L Oystersteel',
      function: 'Threaded tube brazed into the case that the crown screws down onto.',
      dimension: 'Ø3.0 mm',
    },
  },
  {
    id: 'crown-gaskets',
    name: 'Crown Gaskets',
    group: 'case',
    geometry: () => buildGasket(1.35, 0.2),
    material: 'gasket',
    position: [CASE.middleRadius + 0.4, -1.6, 0],
    rotation: [0, 0, Math.PI / 2],
    instances: {
      count: 2,
      transform: (i) =>
        new THREE.Matrix4().makeTranslation(0, i === 0 ? -0.9 : 0.9, 0),
    },
    explode: { axis: AXIS.crown, distance: 13, order: 6 },
    spec: {
      material: 'Nitrile rubber',
      function: 'The two sealing zones that give the Twinlock system its name.',
      count: 2,
    },
  },
  {
    id: 'winding-stem',
    name: 'Winding Stem',
    group: 'case',
    geometry: buildWindingStem,
    material: 'steelPolished',
    position: [3.2, -1.6, 0],
    rotation: [0, 0, -Math.PI / 2],
    explode: { axis: AXIS.crown, distance: 24, order: 4 },
    spec: {
      material: 'Hardened steel',
      function: 'Transmits winding and setting motion from the crown into the keyless works.',
      dimension: 'Ø1.5 × 12 mm',
    },
  },
  {
    id: 'spring-bars',
    name: 'Spring Bars',
    group: 'case',
    geometry: buildSpringBar,
    material: 'steelPolished',
    position: [0, Y.braceletPlane, 0],
    instances: {
      count: 2,
      // Just INSIDE the end link's outer edge. Sitting exactly on it put a polished
      // cylinder in the joint between the end link and the first Oyster link.
      transform: (i) => new THREE.Matrix4().makeTranslation(0, 0, i === 0 ? -19.8 : 19.8),
    },
    explode: { axis: AXIS.down, distance: 9, order: 3 },
    spec: {
      material: 'Stainless steel',
      function: 'Sprung bars retaining the bracelet end links between the lugs.',
      count: 2,
      dimension: `${CASE.lugWidth} mm`,
    },
  },
]

export const DIAL_PARTS: PartDef[] = [
  {
    id: 'dial',
    name: 'Dial',
    group: 'dial',
    geometry: buildDial,
    material: 'dial',
    position: [0, Y.dialBottom + DIAL.thickness / 2, 0],
    explode: { axis: AXIS.up, distance: 10, order: 5 },
    spec: {
      material: 'Brass, lacquered',
      function: 'Sunray-brushed and lacquered plate carrying the printing and applied markers.',
      dimension: `Ø${DIAL.radius * 2} mm`,
      finish: 'Blue sunburst under clear lacquer',
    },
    labelOffset: [0, 2, 0],
  },
  {
    id: 'hour-markers',
    name: 'Applied Hour Markers',
    group: 'dial',
    geometry: () => buildIndex(false),
    material: 'whiteGold',
    position: [0, Y.dialTop, 0],
    instances: {
      count: INDEX_HOURS.length,
      transform: (i) => indexTransform(i, INDEX_RADIUS, 0),
    },
    explode: { axis: AXIS.up, distance: 13, order: 4 },
    spec: {
      material: '18k white gold',
      function: 'Applied markers, each pinned through the dial and filled with luminous material.',
      count: INDEX_HOURS.length,
      finish: 'Polished',
    },
  },
  {
    id: 'hour-marker-lume',
    name: 'Marker Luminescence',
    group: 'dial',
    geometry: () => buildIndexLume(false),
    material: 'lume',
    luminous: true,
    position: [0, Y.dialTop, 0],
    instances: {
      count: INDEX_HOURS.length,
      transform: (i) => indexTransform(i, INDEX_RADIUS, 0),
    },
    explode: { axis: AXIS.up, distance: 13, order: 4 },
    spec: {
      material: 'Chromalight',
      function: 'Luminescent fill that glows blue for around eight hours in darkness.',
      count: INDEX_HOURS.length,
    },
  },
  {
    id: 'coronet',
    name: 'Applied Coronet',
    group: 'dial',
    geometry: buildCoronetApplique,
    material: 'whiteGold',
    // The coronet OCCUPIES the 12 o'clock marker position — on a Datejust there is
    // no baton there, the crown is the marker.
    position: [0, Y.dialTop + 0.06, -INDEX_RADIUS - 0.15],
    explode: { axis: AXIS.up, distance: 14, order: 4 },
    spec: {
      material: '18k white gold',
      function: 'The five-pointed coronet, applied at 12 in place of an hour marker.',
      dimension: `${DIAL.coronet.width} mm wide`,
      finish: 'Polished',
    },
    labelOffset: [0, 3, -2],
  },
  {
    id: 'date-frame',
    name: 'Date Aperture Frame',
    group: 'dial',
    geometry: buildDateFrame,
    material: 'whiteGold',
    position: [DIAL.date.distanceFromCentre, Y.dialTop + 0.02, 0],
    explode: { axis: AXIS.up, distance: 12, order: 4 },
    spec: {
      material: '18k white gold',
      function: 'Polished surround framing the date window.',
      dimension: `${DIAL.date.width} × ${DIAL.date.height} mm`,
    },
  },
  {
    id: 'date-disc',
    name: 'Date Disc',
    group: 'dial',
    geometry: buildDateDisc,
    material: 'dateDisc',
    position: [0, Y.dateDisc, 0],
    explode: { axis: AXIS.up, distance: 6, order: 6 },
    spec: {
      material: 'Printed aluminium',
      function: 'Carries 31 numerals and jumps instantaneously at midnight.',
      dimension: 'Ø12.8 mm',
    },
  },
  {
    id: 'dial-feet',
    name: 'Dial Feet',
    group: 'dial',
    geometry: buildDialFoot,
    material: 'steelPolished',
    position: [0, Y.dialBottom, 0],
    instances: {
      count: DIAL.feet.angles.length,
      transform: (i) => {
        const a = DIAL.feet.angles[i]
        return new THREE.Matrix4().makeTranslation(
          Math.cos(a) * DIAL.feet.radius, 0, Math.sin(a) * DIAL.feet.radius,
        )
      },
    },
    explode: { axis: AXIS.up, distance: 10, order: 5 },
    spec: {
      material: 'Brass',
      function: 'Locate the dial on the movement and are clamped by the dial screws.',
      count: 2,
    },
  },
]

/** Hands sit at their rest time of 10:10:30 — the classic display setting. */
const HOUR_ANGLE = -((10 + 10 / 60) / 12) * Math.PI * 2
const MINUTE_ANGLE = -(10 / 60) * Math.PI * 2
const SECONDS_ANGLE = -(30 / 60) * Math.PI * 2

export const HAND_PARTS: PartDef[] = [
  {
    id: 'hour-hand',
    name: 'Hour Hand',
    group: 'dial',
    geometry: buildHourHand,
    material: 'whiteGold',
    position: [0, Y.handHour, 0],
    rotation: [0, HOUR_ANGLE, 0],
    explode: { axis: AXIS.up, distance: 15, order: 3 },
    spec: {
      material: '18k white gold',
      function: 'Driven by the hour wheel; friction-fitted to the cannon pinion stack.',
      dimension: `${HANDS.hour.length} mm`,
      finish: 'Polished with chamfered edges',
    },
  },
  {
    id: 'hour-hand-lume',
    name: 'Hour Hand Lume',
    group: 'dial',
    geometry: () => buildHandLume('hour'),
    material: 'lume',
    luminous: true,
    position: [0, Y.handHour, 0],
    rotation: [0, HOUR_ANGLE, 0],
    explode: { axis: AXIS.up, distance: 15, order: 3 },
    spec: { material: 'Chromalight', function: 'Luminous insert recessed into the hand.' },
  },
  {
    id: 'minute-hand',
    name: 'Minute Hand',
    group: 'dial',
    geometry: buildMinuteHand,
    material: 'whiteGold',
    position: [0, Y.handMinute, 0],
    rotation: [0, MINUTE_ANGLE, 0],
    explode: { axis: AXIS.up, distance: 17, order: 3 },
    spec: {
      material: '18k white gold',
      function: 'Friction-fitted to the cannon pinion, which slips to allow time setting.',
      dimension: `${HANDS.minute.length} mm`,
      finish: 'Polished with chamfered edges',
    },
  },
  {
    id: 'minute-hand-lume',
    name: 'Minute Hand Lume',
    group: 'dial',
    geometry: () => buildHandLume('minute'),
    material: 'lume',
    luminous: true,
    position: [0, Y.handMinute, 0],
    rotation: [0, MINUTE_ANGLE, 0],
    explode: { axis: AXIS.up, distance: 17, order: 3 },
    spec: { material: 'Chromalight', function: 'Luminous insert recessed into the hand.' },
  },
  {
    id: 'seconds-hand',
    name: 'Seconds Hand',
    group: 'dial',
    geometry: buildSecondsHand,
    material: 'steelPolished',
    position: [0, Y.handSeconds, 0],
    rotation: [0, SECONDS_ANGLE, 0],
    explode: { axis: AXIS.up, distance: 19, order: 3 },
    spec: {
      material: 'Steel',
      function: 'Driven directly off the fourth wheel, sweeping at 8 beats per second.',
      dimension: `${HANDS.seconds.length} mm`,
    },
  },
]

/** The full catalogue. Everything — scene, explode, filter, inspector — reads this. */
export const ALL_PARTS: PartDef[] = [
  ...CASE_PARTS,
  ...DIAL_PARTS,
  ...HAND_PARTS,
  ...MOVEMENT_PARTS,
  ...BRACELET_PARTS,
]

export function findPart(id: string | null): PartDef | undefined {
  return id ? ALL_PARTS.find((p) => p.id === id) : undefined
}
