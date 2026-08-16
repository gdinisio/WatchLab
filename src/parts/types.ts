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
   * Whether this sapphire carries anti-reflective coating. Rolex coats the crystal's
   * underside, but the Cyclops is a raised lens that stays bright and obvious — mute
   * its reflections the same way and the magnifier vanishes entirely.
   */
  arCoated?: boolean
  /** Emissive lume geometry, driven by lume mode. */
  luminous?: boolean
  renderOrder?: number
  /** Where an annotation leader line should attach, relative to the part. */
  labelOffset?: readonly [number, number, number]
}
