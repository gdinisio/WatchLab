/**
 * The shared vertical stack, in millimetres, y up. Dial faces +Y.
 *
 * Every part builder reads from here so the assembly closes up exactly. Total case
 * height works out to ~11.8mm, matching a Datejust 36.
 */
/**
 * The stack is anchored so the case measures its REAL 11.8mm.
 *
 * Bezel top at 4.85 and the caseback's lowest point at -6.95 is exactly that. The
 * back sits 0.35mm deeper than it used to, which both makes the figure honest and
 * leaves the rotor a clearance it did not have: the movement's lowest point is the
 * rotor at about -5.2, against a caseback inner face that was at -5.3.
 */
export const Y = {
  casebackOuter: -6.95,
  casebackSeat: -5.8,
  casebackInner: -5.65,

  caseMiddleBottom: -6.15,
  caseMiddleTop: 2.9,

  casingRing: -5.3,
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

  /**
   * Crown of the bracelet's transverse arc, set against the LUG TIP.
   *
   * The tip spans -4.2 to -1.6, and the bracelet has to nest inside it: at -2.3 the
   * arched outer edges of the links land just within that span, while the polished
   * crown rides a little proud — which is what the real bracelet does, because the
   * lug's own top face falls away toward its inner edge. Sitting the bracelet lower
   * drops its edges clear of the lugs and opens a wedge of daylight between them.
   */
  braceletPlane: -2.3,
} as const

/** Radial position of the crown and date window: 3 o'clock is +X. */
export const THREE_OCLOCK = 0
/** 12 o'clock is -Z, so a dial angle of 0 points at 12 and increases clockwise. */
export function dialDirection(hour: number): [number, number] {
  const a = (hour / 12) * Math.PI * 2
  return [Math.sin(a), -Math.cos(a)]
}
