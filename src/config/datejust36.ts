/**
 * Reference specification — Rolex Datejust 36, ref. 126234 configuration.
 *
 * HARD RULE FOR THE WHOLE PROJECT: 1 world unit === 1 millimetre.
 * Every number below is a real physical dimension. Keeping the scene in mm makes
 * `thickness`, `attenuationDistance` and `aoRadius` physically meaningful and avoids
 * the classic "transmission looks like frosted plastic" bug.
 *
 * Dimensions are targets tuned against reference imagery, not manufacturer CAD.
 */

export const CASE = {
  /** Nominal case diameter across the bezel. */
  diameter: 36,
  radius: 18,
  /** Overall height, caseback dome to crystal dome. */
  thickness: 11.8,
  lugWidth: 20,
  lugToLug: 44,
  /** Middle-case (Oyster monobloc) outer radius at its widest, below the bezel. */
  middleRadius: 17.85,
  /** Radius of the machined step the bezel snaps onto. */
  bezelSeatRadius: 15.4,
  /** Inner bore that the movement + casing ring drop into. */
  boreRadius: 15.0,
  /** Height of the middle case alone (no bezel, no caseback dome). */
  middleHeight: 7.4,
} as const

export const BEZEL = {
  outerRadius: 18,
  innerRadius: 15.25,
  height: 1.82,
  /**
   * Flute count for the 18k white gold fluted bezel.
   *
   * Measured off the isolated-bezel reference: each flute reads roughly as WIDE as
   * the bezel band is deep. The band here is 2.75mm, and at mid-radius (16.6mm) the
   * circumference is 104mm, so 56 flutes gives a 1.86mm pitch. 60 was too fine to
   * separate at all; 44 read too wide against the reference. This sits between.
   */
  fluteCount: 56,
  /**
   * Peak-to-valley depth AT THE MID-RADIUS; it scales with radius from there, so the
   * facet angle is identical along the whole length of every flute.
   *
   * Deeper than it was. At 0.46 the facets sat close enough to flat that neighbouring
   * flutes ran into one another and the ring read as a texture rather than as cut
   * metal; at 0.58 each face turns far enough to take its own reflection, which is
   * what makes the flutes individually legible.
   */
  fluteDepth: 0.58,
  /** 0 = pure cosine, higher = sharper crests / broader polished valleys. */
  fluteSharpness: 1.0,
} as const

export const CRYSTAL = {
  radius: 15.25,
  /** Centre thickness of the sapphire. */
  thickness: 1.25,
  /** Sagitta of the very slight dome (Datejust crystals are near-flat). */
  domeRise: 0.16,
  /** Height of the crystal underside above the dial plane. */
  seatHeight: 3.05,
  cyclops: {
    radius: 2.55,
    /** Plano-convex lens height above the crystal surface. */
    rise: 0.95,
    /** Radius of curvature of the convex face — drives the 2.5x magnification. */
    curvature: 4.2,
    /** Sits over the date aperture at 3 o'clock. */
    distanceFromCentre: 10.4,
  },
} as const

export const CASEBACK = {
  outerRadius: 14.8,
  /** Radius of the fluted gripping rim the Rolex tool engages. */
  rimRadius: 14.8,
  /**
   * Fine gripping notches for the Rolex casing tool.
   *
   * On the real caseback these read as a dense radial sawtooth ring around a plain
   * satin centre — far finer than a knurl. At mid-radius the pitch works out around
   * 0.65mm, which is what makes the ring shimmer rather than resolve into teeth.
   */
  rimNotches: 112,
  /** Where the notch ring starts. Inside this is the plain satin centre. */
  notchInnerRadius: 8.6,
  notchDepth: 0.3,
  thickness: 1.15,
  domeRise: 0.16,
} as const

export const CROWN = {
  /** Twinlock winding crown, 5.3mm. */
  radius: 2.65,
  length: 3.4,
  /**
   * Vertical grip flutes around the crown.
   *
   * FEWER and DEEPER than the last pass. Counting the reference head-on gives about
   * a dozen teeth across the visible half, so somewhere near two dozen in total —
   * chunky things you could grip through a glove, not the fine ripple thirty shallow
   * ones produce. At 24 x 0.40mm the facets sit near 49 degrees off the tangent and
   * each throws its own shadow.
   */
  fluteCount: 24,
  fluteDepth: 0.4,
  tubeRadius: 1.5,
  tubeLength: 3.2,
  /** Crown sits at 3 o'clock on the +X axis. */
  angle: 0,
} as const

export const DIAL = {
  radius: 14.7,
  thickness: 0.42,
  /** Deep blue sunburst. */
  colour: '#0655bd',
  /** Minute track sits just inside the rehaut. */
  minuteTrackRadius: 13.85,
  indices: {
    /** Applied white gold baton indices. 3 o'clock is replaced by the date aperture. */
    hours: [12, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11],
    /** Reference batons are long and chunky — roughly a quarter of the dial radius. */
    length: 3.7,
    width: 0.84,
    height: 0.46,
    /** Wall thickness of the polished white gold frame around the luminous fill. */
    frameWall: 0.16,
    /** Radial position of the OUTER end of each baton. */
    outerRadius: 12.95,
  },
  date: {
    /** Aperture centre, 3 o'clock. */
    distanceFromCentre: 10.4,
    width: 3.25,
    height: 2.55,
  },
  coronet: {
    /** Applied coronet sits above the ROLEX wordmark at 12. */
    distanceFromCentre: 9.4,
    /**
     * Measured off the reference dial: the coronet is almost exactly as WIDE as an
     * applied baton is LONG. Since the batons are already matched to reference at
     * 3.7mm, that pins this without guesswork. Height follows the artwork's own
     * aspect. Sized at 2.2 it read as a small emblem rather than the hour marker.
     */
    width: 3.6,
  },
  text: {
    brand: 'ROLEX',
    line1: 'OYSTER PERPETUAL',
    line2: 'DATEJUST',
    certLine1: 'SUPERLATIVE CHRONOMETER',
    certLine2: 'OFFICIALLY CERTIFIED',
    swiss: 'SWISS MADE',
  },
  feet: { radius: 11.2, angles: [Math.PI * 0.25, Math.PI * 1.25] },
} as const

export const HANDS = {
  // Reference batons are slimmer than they look at a glance, and the hour hand is
  // markedly shorter — it should stop well inside the applied markers.
  hour:    { length: 7.7,  width: 0.9,  thickness: 0.3,  lumeInset: 0.2 },
  minute:  { length: 12.0, width: 0.8,  thickness: 0.28, lumeInset: 0.18 },
  seconds: { length: 13.3, width: 0.22, thickness: 0.16, tailLength: 3.5 },
  /** Stacked heights above the dial surface. */
  stack: { hour: 0.55, minute: 1.0, seconds: 1.45 },
} as const

/** Calibre 3235 — 28.5mm diameter, 6.05mm thick, 31 jewels, 4Hz, 70h reserve. */
export const MOVEMENT = {
  radius: 14.25,
  thickness: 6.05,
  jewelCount: 31,
  /** Vertical stack positions relative to the main plate top face (dial side = +Y). */
  layers: {
    mainPlate: 0,
    dialSide: 0.9,
    trainSide: -1.5,
    bridges: -2.6,
    automatic: -4.1,
    rotor: -5.2,
  },
  balance: {
    radius: 4.75,
    rimThickness: 0.55,
    /** Parachrom bleu hairspring. */
    hairspringTurns: 13,
    hairspringOuterRadius: 2.65,
    hairspringInnerRadius: 0.75,
  },
  barrel: { radius: 5.2, height: 2.05, teeth: 76 },
  escapeWheel: { radius: 2.35, teeth: 20 },
  rotor: { radius: 13.4, thickness: 1.35 },
} as const

export const BRACELET = {
  /** Oyster three-piece link bracelet, tapering 20mm -> 16mm. */
  widthAtLug: 20,
  widthAtClasp: 16,
  linkLength: 5.1,
  /**
   * Plate thickness of one link.
   *
   * Sized against the LUG TIP, which spans 2.6mm vertically. Together with the arch
   * below, the link's outer edges have to nest inside that span so the bracelet
   * meets the case flush rather than hanging under it.
   */
  linkThickness: 2.35,
  /**
   * Links per side, excluding the end link.
   *
   * MORE of them, because the silhouette is a polyline. Each link is a rigid block
   * and all the bend happens at the pins, so every joint puts a corner in the
   * outline; twelve shorter turns of 7.9 degrees read as a curve where nine of 12
   * read as a staircase. It is also simply closer to the count on the real bracelet.
   */
  linksPerSide: 12,
  /**
   * The bracelet is CURVED ACROSS ITS WIDTH, not a stack of flat plates.
   *
   * Every link is a shallow arc that wraps toward the wrist: the polished centre
   * rides the crown of the arc and the satin flanks fall away and roll under. This
   * is what gives an Oyster its rolling centre highlight with the flanks reading
   * darker either side — model the links flat and the whole bracelet goes dead, no
   * matter how good the materials are.
   *
   * `rise` is the drop from the crown to the outer edge at the nominal 20mm width;
   * the exponent above 2 keeps the centre nearly flat and puts the fall-off out at
   * the edges, which is how the real section is machined.
   *
   * Rise is bounded by the LUGS, not by taste: the bracelet's outer edges have to
   * nest inside the 2.6mm span of the lug tip. Arch it harder and the edges drop out
   * of that span, opening a wedge of daylight between lug and end link.
   */
  arch: { rise: 0.85, exponent: 2.4 },
  /**
   * Three-piece link proportions, as fractions of the bracelet width.
   *
   * Measured off the reference: the polished centre is a little under half the
   * bracelet, and the two satin flanks take almost all of the rest, leaving only a
   * hairline seam. `seam` is the millimetre gap between one link and the next along
   * the run — small enough to read as a joint, wide enough that neighbouring links
   * do not foul each other where the drape curls tightest.
   */
  link: {
    centre: 0.40,
    flank: 0.285,
    flankOffset: 0.348,
    seam: 0.18,
    /** How far the centre section stands above the flanks. */
    centreProud: 0.18,
    /**
     * Radius broken onto every long edge of a link section, and the chamfer rolled
     * onto its ends.
     *
     * Both are deliberately small. Together with the seam they set how wide the joint
     * between links reads, and at 0.3/0.13 the bracelet came out looking like a row
     * of separate rounded tiles rather than one tightly-jointed band.
     *
     * Smaller again at 0.13: the real bracelet is CLEAR CUT, its faces meeting at
     * definite edges with only a hairline break polished onto them. A generous radius
     * rounds each face into the next and the whole band goes soft, which is the
     * opposite of how an Oyster reads.
     */
    edgeRadius: 0.13,
    /**
     * Larger than the long-edge radius, deliberately.
     *
     * This break is at the JOINT, where softening helps one link flow into the next;
     * the long edges are the ones that have to stay clear cut. Pulling the two apart
     * lets the silhouette read continuous without the faces going soft.
     */
    endChamfer: 0.13,
  },
  /**
   * The end link is DEEPER than the links it feeds.
   *
   * Where it tucks under the case the lug beside it stands 5.25mm tall, against an
   * ordinary link's 2.61mm envelope — so a constant-thickness end link left a 2.5mm
   * ledge at exactly the junction the eye follows off the watch. It now tapers from
   * nearly the lug's own depth at the case down to link thickness at its outer edge,
   * so the case runs into the bracelet instead of dropping onto it.
   */
  endLinkThicknessAtCase: 4.55,
  /**
   * The drape TIGHTENS as it falls.
   *
   * A constant-radius arc is the giveaway of a CG bracelet: real ones leave the case
   * almost level — the end link and the first couple of links sit flat under the
   * lugs — and then curl progressively harder under their own weight. Radius runs
   * from `startRadius` at the case to `endRadius` at the clasp, biased by `curl` so
   * most of the bend happens in the last third.
   */
  drape: { startRadius: 62, endRadius: 34, curl: 1.15, startAngle: 0.06 },
  /**
   * Oysterclasp. The cover carries the bracelet's own three-piece section across it,
   * so the polished centre stripe runs unbroken from the case to the buckle.
   */
  clasp: { length: 22, width: 16, thickness: 3.1, cornerRadius: 0.7 },
} as const

/** Named parts explode along these axes. Watch lies dial-up: +Y is the stack axis. */
export const AXIS = {
  up: [0, 1, 0] as const,
  down: [0, -1, 0] as const,
  crown: [1, 0, 0] as const,
  twelve: [0, 0, -1] as const,
  six: [0, 0, 1] as const,
}
