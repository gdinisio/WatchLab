import type * as THREE from 'three'
import type { MaterialKey } from '../materials/library'

export type PartGroup = 'case' | 'dial' | 'movement' | 'bracelet'

export interface PartSpec {
  material: string
  function: string
  count?: number
  dimension?: string
  finish?: string
}

/** One beat of a part's travel: `of` the distance, `over` that share of the time. */
export interface SeatLeg {
  of: number
  over: number
}

export interface ExplodeSpec {
  /** Unit direction the part travels when the assembly opens. */
  axis: readonly [number, number, number]
  distance: number
  /** Cascade position. Lower orders leave first. */
  order: number
  /**
   * Explicit slider interval this part moves over, overriding the order cascade.
   *
   * The cascade's windows overlap heavily on purpose — that is what makes eighty
   * parts read as one mechanism opening rather than a queue. But some choreography
   * is a SEQUENCE, not a cascade: a screw cannot back out of a joint that is coming
   * apart around it at the same moment. Where one thing genuinely has to finish
   * before the next starts, say so here rather than trying to express it as an
   * order, which cannot separate two parts by more than a fraction of a window.
   */
  span?: readonly [number, number]
  /** Full turns the part rotates about its own axis on the way out (screws unscrew). */
  spin?: number
  /** Local axis the spin is about. Defaults to the travel axis. */
  spinAxis?: readonly [number, number, number]
  /**
   * Spreads an instanced part's travel down its copies, as a fraction of the window.
   *
   * Without it every copy moves in lockstep, which is how nothing is ever assembled:
   * twelve screws do not go into a bracelet simultaneously, they go in one after
   * another. Each instance gets its own progress, so travel AND rotation are driven
   * per copy and the rank ripples instead of sliding as a slab.
   *
   * Only meaningful on an instanced part; the group then stays at rest and the
   * transform is carried entirely by the instance matrices.
   */
  stagger?: number
  /**
   * A point ON the part's own axis, in its local frame. Defaults to the origin.
   *
   * "About its own axis" is only free when the geometry is BUILT about that axis. A
   * part modelled off its origin — an instanced pin sitting at the joint rather than
   * the middle of its link — is otherwise swung around a circle the size of that
   * offset instead of turning in place, which reads as the whole rank flailing.
   *
   * Deliberately explicit rather than derived from the bounding box: the rotor's box
   * centre is 4.4mm off its bearing, because it is a half-moon, and it genuinely does
   * turn about the origin.
   */
  spinPivot?: readonly [number, number, number]
  /**
   * Fraction of the travel, measured from SEATED, over which the spin happens.
   *
   * 1 spreads the rotation across the whole journey, which is how nothing is
   * actually assembled. A screwed pin is pushed most of the way home with no
   * rotation at all and only turns over the last millimetre or two as the thread
   * takes; set this to that fraction and the part reads as being threaded in rather
   * than drifting in while spinning.
   */
  spinPhase?: number
  /**
   * Breaks the travel into named beats, for a part that enters something rather than
   * simply moving away from it.
   *
   * Each leg gives `of`, its share of `distance`, and `over`, its share of the
   * TIMELINE; both lists run from SEATED outward and each must sum to 1. Splitting
   * distance from time is the whole point — a screw covers the last few millimetres
   * of its travel over a third of its timeline, and no single easing curve says that.
   * Every leg is eased separately, so each handover lands at zero velocity and reads
   * as a distinct beat: fly in, stop at the mouth, push home, thread.
   */
  seat?: readonly SeatLeg[]
}

export interface InstanceSpec {
  count: number
  /** Local transform for instance i, applied on top of the part transform. */
  transform(i: number): THREE.Matrix4
}

export interface PartDef {
  id: string
  name: string
  group: PartGroup
  /** Lazy + cached. Also the seam where a GLB node could be swapped in per-part. */
  geometry: () => THREE.BufferGeometry
  /** Transmissive parts ignore this and use the sapphire transmission material. */
  material: Exclude<MaterialKey, 'sapphire'>
  /** Assembled rest transform, in millimetres. */
  position?: readonly [number, number, number]
  rotation?: readonly [number, number, number]
  instances?: InstanceSpec
  explode: ExplodeSpec
  spec: PartSpec
  /** Sapphire parts render with MeshTransmissionMaterial instead of a shared material. */
  transmissive?: boolean
  /**
   * Whether this sapphire carries anti-reflective coating.
   *
   * Rolex coats the crystal's underside. Leaving the Cyclops UNCOATED to keep it
   * obvious backfired: at full Fresnel reflectance a convex dome under a studio rig
   * is a mirror, so it showed a blown-out highlight instead of the date. It is
   * coated too — what makes it read is its bore, its rim and what it magnifies.
   */
  arCoated?: boolean
  /**
   * Optical path length through this sapphire, in mm.
   *
   * Defaults to the crystal's. A part that is much deeper — the Cyclops plug is over
   * 2mm against the pane's 1.25 — needs its own, or transmission bends light as if
   * it were thin and nothing magnifies.
   */
  glassThickness?: number
  /** Emissive lume geometry, driven by lume mode. */
  luminous?: boolean
  renderOrder?: number
  /** Where an annotation leader line should attach, relative to the part. */
  labelOffset?: readonly [number, number, number]
}
