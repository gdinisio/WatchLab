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

export interface ExplodeSpec {
  /** Unit direction the part travels when the assembly opens. */
  axis: readonly [number, number, number]
  distance: number
  /** Cascade position. Lower orders leave first. */
  order: number
  /** Full turns the part rotates about its own axis on the way out (screws unscrew). */
  spin?: number
  /** Local axis the spin is about. Defaults to the travel axis. */
  spinAxis?: readonly [number, number, number]
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
