/**
 * The shared vertical stack, in millimetres, y up. Dial faces +Y.
 *
 * Every part builder reads from here so the assembly closes up exactly. Total case
 * height works out to ~11.8mm, matching a Datejust 36.
 */
export const Y = {
  casebackOuter: -6.6,
  casebackSeat: -5.45,
  casebackInner: -5.3,

  caseMiddleBottom: -5.8,
  caseMiddleTop: 2.9,

  casingRing: -4.95,
  rotorPlane: -4.5,
  autoBridge: -3.6,
  trainBridge: -2.7,
  mainPlate: -1.3,
  keylessWorks: -0.35,
  dateDisc: 0.1,

  dialBottom: 0.5,
  dialTop: 0.92,

  handHour: 1.5,
  handMinute: 1.95,
  handSeconds: 2.4,

  bezelBottom: 2.5,
  bezelTop: 4.85,
  crystalBottom: 3.05,
  crystalTop: 4.3,

  braceletPlane: -1.2,
} as const

/** Radial position of the crown and date window: 3 o'clock is +X. */
export const THREE_OCLOCK = 0
/** 12 o'clock is -Z, so a dial angle of 0 points at 12 and increases clockwise. */
export function dialDirection(hour: number): [number, number] {
  const a = (hour / 12) * Math.PI * 2
  return [Math.sin(a), -Math.cos(a)]
}
