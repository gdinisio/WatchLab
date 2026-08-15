import * as THREE from 'three'
import { AXIS, MOVEMENT } from '../config/datejust36'
import {
  buildAutoBridge, buildBalanceBridge, buildBalanceWheel, buildBarrel, buildBarrelBridge,
  buildCannonPinion, buildChronergyEscapeWheel, buildCrownWheel, buildDateJumper,
  buildHairspring, buildHourWheel, buildKeylessLever, buildMainPlate, buildMainspring,
  buildMovementJewel, buildMovementScrew, buildPalletCock, buildPalletFork,
  buildRatchetWheel, buildRotor, buildRotorBearing, buildShockSetting, buildTrainBridge,
  buildTrainWheel, buildWheelPinion, buildYoke,
} from './movement'
import type { PartDef } from './types'

/**
 * Vertical layout inside the calibre, dial side up.
 * The main plate is the datum; the train and automatic module hang below it toward
 * the caseback, the motion and keyless works sit above it under the dial.
 */
const M = {
  dateJumper: -0.15,
  keyless: -0.42,
  motionWork: -0.6,
  mainPlate: -1.3,
  train: -2.0,
  escapement: -2.05,
  balance: -2.35,
  bridges: -2.75,
  balanceBridge: -3.25,
  autoBridge: -3.75,
  bearing: -4.2,
  rotor: -4.7,
} as const

/** Train pivot positions, matching the holes pierced in the main plate. */
const PIVOT = {
  barrel: [-5.0, -3.4],
  centre: [4.6, -2.1],
  third: [6.4, 1.6],
  fourth: [3.1, 5.2],
  escape: [3.4, 6.4],
  balance: [-5.4, 9.6],
} as const

const at = (xz: readonly [number, number], y: number): [number, number, number] => [xz[0], y, xz[1]]

const mvt = (p: Omit<PartDef, 'group' | 'submovement'>): PartDef => ({
  ...p,
  group: 'movement',
  submovement: true,
})

/** Jewels are scattered across the plate and bridges at the train pivots. */
const JEWEL_SITES: [number, number, number][] = [
  ...Object.values(PIVOT).map((p) => at(p, M.bridges + 0.5)),
  ...Object.values(PIVOT).map((p) => at(p, M.mainPlate + 0.55)),
  [0, M.mainPlate + 0.55, 0],
  [-2.4, M.autoBridge + 0.45, -2.2],
  [3.8, M.autoBridge + 0.45, -0.4],
  [-9.4, M.mainPlate + 0.55, 4.2],
  [1.2, M.bridges + 0.5, -8.4],
  [-7.8, M.bridges + 0.5, 2.6],
]

const SCREW_SITES: [number, number, number][] = [
  [-12.0, M.bridges + 0.45, -1.0], [7.9, M.bridges + 0.45, -7.2],
  [-11.4, M.balanceBridge + 0.5, 6.0], [-2.2, M.balanceBridge + 0.5, 9.6],
  [9.2, M.bridges + 0.45, 3.4], [-10.4, M.autoBridge + 0.45, -4.6],
  [7.4, M.autoBridge + 0.45, 1.0], [4.6, M.bridges + 0.45, 6.0],
  [-5.0, M.bridges + 0.45, -3.4], [5.0, M.keyless + 0.2, 6.6],
]

const instancesAt = (sites: [number, number, number][]) => ({
  count: sites.length,
  transform: (i: number) => new THREE.Matrix4().makeTranslation(...sites[i]),
})

export const MOVEMENT_PARTS: PartDef[] = [
  mvt({
    id: 'main-plate',
    name: 'Main Plate',
    geometry: buildMainPlate,
    material: 'rhodiumPerlage',
    position: [0, M.mainPlate, 0],
    explode: { axis: AXIS.down, distance: 18, order: 7 },
    spec: {
      material: 'Rhodium-plated brass',
      function: 'The datum every other component is located from; carries the train pivots and the barrel seat.',
      dimension: `Ø${MOVEMENT.radius * 2} mm`,
      finish: 'Perlage (circular graining)',
    },
    labelOffset: [0, -2, 0],
  }),
  mvt({
    id: 'barrel',
    name: 'Barrel',
    geometry: buildBarrel,
    material: 'brassGilt',
    position: at(PIVOT.barrel, M.train),
    explode: { axis: AXIS.down, distance: 24, order: 8, spin: 0.5 },
    spec: {
      material: 'Gilt brass',
      function: 'Houses the mainspring and drives the train. Rolex specifies a 70-hour reserve from a single barrel.',
      dimension: `Ø${MOVEMENT.barrel.radius * 2} mm`,
    },
  }),
  mvt({
    id: 'mainspring',
    name: 'Mainspring',
    geometry: buildMainspring,
    material: 'bluedSteel',
    position: at(PIVOT.barrel, M.train),
    explode: { axis: AXIS.down, distance: 22, order: 8 },
    spec: {
      material: 'Nivaflex alloy',
      function: 'The power source. Coiled inside the barrel, it delivers roughly 70 hours of running.',
      dimension: '~40 cm uncoiled',
    },
  }),
  mvt({
    id: 'barrel-bridge',
    name: 'Barrel Bridge',
    geometry: buildBarrelBridge,
    material: 'rhodiumCotes',
    position: [0, M.bridges, 0],
    explode: { axis: AXIS.down, distance: 31, order: 6 },
    spec: {
      material: 'Rhodium-plated brass',
      function: 'Retains the barrel arbor and the upper pivots of the winding train.',
      finish: 'Striped, with polished bevels',
    },
  }),
  mvt({
    id: 'centre-wheel',
    name: 'Centre Wheel',
    geometry: () => buildTrainWheel('centre', 64, 3.5),
    material: 'brassGilt',
    position: at(PIVOT.centre, M.train),
    explode: { axis: AXIS.down, distance: 24.6, order: 8, spin: 1 },
    spec: { material: 'Gilt brass', function: 'First wheel of the going train, driven directly by the barrel.', count: 1 },
  }),
  mvt({
    id: 'third-wheel',
    name: 'Third Wheel',
    geometry: () => buildTrainWheel('third', 60, 3.0),
    material: 'brassGilt',
    position: at(PIVOT.third, M.train),
    explode: { axis: AXIS.down, distance: 25.2, order: 8, spin: 1.2 },
    spec: { material: 'Gilt brass', function: 'Steps the train up toward the escapement.', count: 1 },
  }),
  mvt({
    id: 'fourth-wheel',
    name: 'Fourth Wheel',
    geometry: () => buildTrainWheel('fourth', 54, 2.7),
    material: 'brassGilt',
    position: at(PIVOT.fourth, M.train),
    explode: { axis: AXIS.down, distance: 25.8, order: 8, spin: 1.4 },
    spec: { material: 'Gilt brass', function: 'Turns once a minute and drives the seconds hand directly.', count: 1 },
  }),
  mvt({
    id: 'train-pinions',
    name: 'Train Pinions',
    geometry: () => buildWheelPinion(0.42, 0.72),
    material: 'steelPolished',
    instances: instancesAt([
      at(PIVOT.centre, M.train), at(PIVOT.third, M.train),
      at(PIVOT.fourth, M.train), at(PIVOT.escape, M.escapement),
    ]),
    explode: { axis: AXIS.down, distance: 23.4, order: 8 },
    spec: {
      material: 'Hardened steel',
      function: 'The small high-precision drivers each wheel is riveted to; polished to reduce friction.',
      count: 4,
    },
  }),
  mvt({
    id: 'escape-wheel',
    name: 'Chronergy Escape Wheel',
    geometry: buildChronergyEscapeWheel,
    material: 'yellowGold',
    position: at(PIVOT.escape, M.escapement),
    explode: { axis: AXIS.down, distance: 26.4, order: 8, spin: 2 },
    spec: {
      material: 'Nickel-phosphorus, LIGA-formed',
      function: 'The skeletonised Chronergy wheel — lighter and offset for about 15% more escapement efficiency.',
      dimension: `${MOVEMENT.escapeWheel.teeth} teeth`,
    },
    labelOffset: [2, 0, 0],
  }),
  mvt({
    id: 'pallet-fork',
    name: 'Pallet Fork',
    geometry: buildPalletFork,
    material: 'steelPolished',
    position: [1.2, M.escapement, -8.4],
    rotation: [0, Math.PI * 0.18, 0],
    explode: { axis: AXIS.down, distance: 27, order: 8 },
    spec: {
      material: 'Steel with synthetic ruby pallets',
      function: 'Locks and releases the escape wheel, converting its torque into impulses for the balance.',
    },
  }),
  mvt({
    id: 'pallet-cock',
    name: 'Pallet Cock',
    geometry: buildPalletCock,
    material: 'rhodiumBrushed',
    position: [0, M.bridges, 0],
    explode: { axis: AXIS.down, distance: 31.6, order: 6 },
    spec: { material: 'Rhodium-plated brass', function: 'Carries the upper pivot of the pallet fork.', finish: 'Polished bevels' },
  }),
  mvt({
    id: 'balance-wheel',
    name: 'Balance Wheel',
    geometry: buildBalanceWheel,
    material: 'brassGilt',
    position: at(PIVOT.balance, M.balance),
    explode: { axis: AXIS.down, distance: 27.6, order: 8, spin: 0.75 },
    spec: {
      material: 'Beryllium-copper alloy',
      function: 'The regulating organ, oscillating at 28,800 beats/hour. Microstella nuts on the inner rim set the rate.',
      dimension: `Ø${MOVEMENT.balance.radius * 2} mm · 4 Hz`,
    },
    labelOffset: [-2, 0, 2],
  }),
  mvt({
    id: 'hairspring',
    name: 'Parachrom Hairspring',
    geometry: buildHairspring,
    material: 'bluedSteel',
    position: at(PIVOT.balance, M.balance + 0.5),
    explode: { axis: AXIS.down, distance: 28.2, order: 8 },
    spec: {
      material: 'Parachrom bleu (niobium-zirconium)',
      function: 'Returns the balance on every swing. The blue alloy is paramagnetic and far more shock-stable than steel.',
      dimension: `${MOVEMENT.balance.hairspringTurns} coils`,
    },
  }),
  mvt({
    id: 'balance-bridge',
    name: 'Balance Bridge',
    geometry: buildBalanceBridge,
    material: 'rhodiumCotes',
    position: [0, M.balanceBridge, 0],
    explode: { axis: AXIS.down, distance: 33, order: 5 },
    spec: {
      material: 'Rhodium-plated brass',
      function: 'A full traversing bridge, supported at both ends — far more rigid than the usual cantilevered cock.',
      finish: 'Striped, with polished bevels',
    },
  }),
  mvt({
    id: 'shock-settings',
    name: 'Paraflex Shock Absorbers',
    geometry: buildShockSetting,
    material: 'steelPolished',
    instances: instancesAt([
      at(PIVOT.balance, M.balanceBridge + 0.55),
      at(PIVOT.balance, M.mainPlate + 0.55),
    ]),
    explode: { axis: AXIS.down, distance: 29.4, order: 6 },
    spec: {
      material: 'Steel spring, ruby jewel',
      function: 'Sprung jewel settings that let the balance staff deflect under shock instead of snapping.',
      count: 2,
    },
  }),
  mvt({
    id: 'train-bridge',
    name: 'Train Wheel Bridge',
    geometry: buildTrainBridge,
    material: 'rhodiumCotes',
    position: [0, M.bridges, 0],
    explode: { axis: AXIS.down, distance: 31, order: 6 },
    spec: {
      material: 'Rhodium-plated brass',
      function: 'Retains the upper pivots of the centre, third and fourth wheels.',
      finish: 'Striped, with polished bevels',
    },
  }),
  mvt({
    id: 'ratchet-wheel',
    name: 'Ratchet Wheel',
    geometry: buildRatchetWheel,
    material: 'rhodiumBrushed',
    position: at(PIVOT.barrel, M.bridges + 0.55),
    explode: { axis: AXIS.down, distance: 34, order: 5, spin: 1 },
    spec: { material: 'Steel', function: 'Sits on the barrel arbor and winds the mainspring; the click stops it running back.' },
  }),
  mvt({
    id: 'crown-wheel',
    name: 'Crown Wheel',
    geometry: buildCrownWheel,
    material: 'rhodiumBrushed',
    position: [-11.2, M.bridges + 0.5, -3.0],
    explode: { axis: AXIS.down, distance: 34.6, order: 5, spin: 1 },
    spec: { material: 'Steel', function: 'Transfers winding motion from the winding pinion to the ratchet wheel.' },
  }),
  mvt({
    id: 'auto-bridge',
    name: 'Automatic Device Bridge',
    geometry: buildAutoBridge,
    material: 'rhodiumCotes',
    position: [0, M.autoBridge, 0],
    explode: { axis: AXIS.down, distance: 37, order: 4 },
    spec: {
      material: 'Rhodium-plated brass',
      function: 'Carries the reversing wheels that turn rotor motion in either direction into one-way winding.',
      finish: 'Striped, with polished bevels',
    },
  }),
  mvt({
    id: 'reversing-wheels',
    name: 'Reversing Wheels',
    geometry: () => buildTrainWheel('reverser', 44, 2.1),
    material: 'rhodiumBrushed',
    instances: instancesAt([
      [-2.4, M.autoBridge + 0.5, -2.2],
      [3.8, M.autoBridge + 0.5, -0.4],
    ]),
    explode: { axis: AXIS.down, distance: 38, order: 4, spin: 1.5 },
    spec: {
      material: 'Steel',
      function: 'Rectify the rotor’s oscillation so the barrel winds whichever way the wrist moves.',
      count: 2,
    },
  }),
  mvt({
    id: 'rotor-bearing',
    name: 'Rotor Ball Bearing',
    geometry: buildRotorBearing,
    material: 'steelPolished',
    position: [0, M.bearing, 0],
    explode: { axis: AXIS.down, distance: 40, order: 3 },
    spec: { material: 'Hardened steel', function: 'The bearing the perpetual rotor turns on. Rolex runs it dry, without lubricant.' },
  }),
  mvt({
    id: 'rotor',
    name: 'Perpetual Rotor',
    geometry: buildRotor,
    material: 'yellowGoldSatin',
    position: [0, M.rotor, 0],
    explode: { axis: AXIS.down, distance: 43, order: 2, spin: 0.6 },
    spec: {
      material: '18k yellow gold segment',
      function: 'The oscillating weight. Rolex patented the free-rotating perpetual rotor in 1931.',
      dimension: `Ø${MOVEMENT.rotor.radius * 2} mm`,
      finish: 'Satin-brushed',
    },
    labelOffset: [0, -3, 0],
  }),
  mvt({
    id: 'cannon-pinion',
    name: 'Cannon Pinion',
    geometry: buildCannonPinion,
    material: 'steelPolished',
    position: [0, M.motionWork, 0],
    explode: { axis: AXIS.up, distance: 4, order: 9 },
    spec: {
      material: 'Steel',
      function: 'Drives the minute hand and deliberately slips on its arbor so the hands can be set.',
    },
  }),
  mvt({
    id: 'hour-wheel',
    name: 'Hour Wheel',
    geometry: buildHourWheel,
    material: 'brassGilt',
    position: [0, M.motionWork + 0.3, 0],
    explode: { axis: AXIS.up, distance: 5.5, order: 9, spin: 0.5 },
    spec: { material: 'Gilt brass', function: 'Geared 12:1 from the cannon pinion; carries the hour hand.' },
  }),
  mvt({
    id: 'keyless-lever',
    name: 'Setting Lever',
    geometry: buildKeylessLever,
    material: 'steelPolished',
    position: [6.6, M.keyless, 2.4],
    rotation: [0, -Math.PI * 0.15, 0],
    explode: { axis: AXIS.up, distance: 7, order: 9 },
    spec: {
      material: 'Hardened steel',
      function: 'Senses the crown position and switches the movement between winding and hand-setting.',
    },
  }),
  mvt({
    id: 'yoke',
    name: 'Yoke',
    geometry: buildYoke,
    material: 'steelPolished',
    position: [8.4, M.keyless, 0.4],
    rotation: [0, Math.PI * 0.1, 0],
    explode: { axis: AXIS.up, distance: 8.5, order: 9 },
    spec: { material: 'Hardened steel', function: 'Slides the clutch along the stem between the winding and setting positions.' },
  }),
  mvt({
    id: 'date-jumper',
    name: 'Date Jumper',
    geometry: buildDateJumper,
    material: 'steelPolished',
    position: [5.4, M.dateJumper, 6.2],
    rotation: [0, Math.PI * 0.62, 0],
    explode: { axis: AXIS.up, distance: 6.5, order: 9 },
    spec: {
      material: 'Hardened steel',
      function: 'Indexes the date disc and snaps it over instantaneously at midnight.',
    },
  }),
  mvt({
    id: 'jewels',
    name: 'Ruby Jewels',
    geometry: buildMovementJewel,
    material: 'ruby',
    instances: instancesAt(JEWEL_SITES),
    explode: { axis: AXIS.down, distance: 29, order: 7 },
    spec: {
      material: 'Synthetic ruby (corundum)',
      function: 'Low-friction bearings at every pivot. The calibre 3235 runs 31 of them.',
      count: MOVEMENT.jewelCount,
    },
  }),
  mvt({
    id: 'movement-screws',
    name: 'Movement Screws',
    geometry: buildMovementScrew,
    material: 'bluedSteel',
    instances: instancesAt(SCREW_SITES),
    explode: { axis: AXIS.down, distance: 46, order: 3, spin: 3 },
    spec: {
      material: 'Blued steel',
      function: 'Clamp every bridge and cock to the main plate.',
      count: SCREW_SITES.length,
      finish: 'Polished heads, slotted',
    },
  }),
]
