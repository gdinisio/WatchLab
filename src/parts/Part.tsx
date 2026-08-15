import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { MeshTransmissionMaterial, Outlines } from '@react-three/drei'
import { easing } from 'maath'
import type { MaterialLibrary } from '../materials/library'
import { useViewer } from '../state/store'
import { partProgress } from './explode'
import { INSPECT_POSITION, INSPECT_SPIN_SPEED, smoothstep } from './inspect'
import type { PartDef } from './types'

const _axis = new THREE.Vector3()
const _spinAxis = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _base = new THREE.Quaternion()
const _euler = new THREE.Euler()
const _explodePos = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

export interface PartProps {
  def: PartDef
  lib: MaterialLibrary
  maxOrder: number
  /** Low-spec path: physical transmission instead of the multi-sample transmission pass. */
  simpleGlass?: boolean
}

/**
 * Renders one catalogue entry: geometry + shared material + the explode transform.
 *
 * Parts travel along their own axis and may spin as they go — screws unscrewing on
 * the way out is a small thing that makes the whole teardown feel mechanical.
 */
export function Part({ def, lib, maxOrder, simpleGlass = false }: PartProps) {
  const group = useRef<THREE.Group>(null)
  const geometry = useMemo(() => def.geometry(), [def])

  const hovered = useViewer((s) => s.hovered === def.id)
  const selected = useViewer((s) => s.selected === def.id)
  const visible = useViewer((s) => s.activeGroups[def.group])

  const basePos = useMemo(
    () => new THREE.Vector3(...(def.position ?? [0, 0, 0])),
    [def],
  )
  const baseQuat = useMemo(() => {
    _euler.set(...((def.rotation ?? [0, 0, 0]) as [number, number, number]))
    return new THREE.Quaternion().setFromEuler(_euler)
  }, [def])

  /**
   * How far this part has travelled into inspection, 0..1.
   *
   * Held in a ref and damped per-part rather than driven off the shared explode
   * scalar, because only one part moves at a time and it has to ease back out again
   * on deselect. Keeping it separate also leaves the explode cascade untouched — that
   * is deliberately NOT damped per part, so the assembly opens as one mechanism.
   */
  const inspect = useRef({ t: 0 })

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    const p = partProgress(def, maxOrder)
    const { axis, distance, spin, spinAxis } = def.explode

    _axis.set(axis[0], axis[1], axis[2])
    _explodePos.copy(basePos).addScaledVector(_axis, distance * p)

    easing.damp(inspect.current, 't', selected ? 1 : 0, 0.42, dt)
    const k = smoothstep(inspect.current.t)

    if (k < 0.0005) {
      g.position.copy(_explodePos)
    } else {
      g.position.lerpVectors(_explodePos, INSPECT_POSITION, k)
    }

    if (spin || k > 0.0005) {
      _base.copy(baseQuat)
      if (spin) {
        const sa = spinAxis ?? axis
        _spinAxis.set(sa[0], sa[1], sa[2]).normalize()
        _q.setFromAxisAngle(_spinAxis, spin * Math.PI * 2 * p)
        _base.premultiply(_q)
      }
      if (k > 0.0005) {
        // Slow turn about world Y so the part can be read from every side. Scaled by
        // k so it eases in with the slide instead of snapping into motion.
        _q.setFromAxisAngle(_up, state.clock.elapsedTime * INSPECT_SPIN_SPEED * k)
        _base.premultiply(_q)
      }
      g.quaternion.copy(_base)
    }
  })

  const material = def.transmissive ? undefined : lib.materials[def.material]

  const mesh = def.instances ? (
    <instancedMesh
      args={[geometry, material, def.instances.count]}
      castShadow
      receiveShadow
      ref={(node) => {
        if (!node) return
        for (let i = 0; i < def.instances!.count; i++) {
          node.setMatrixAt(i, def.instances!.transform(i))
        }
        node.instanceMatrix.needsUpdate = true
        node.computeBoundingSphere()
      }}
    />
  ) : (
    <mesh geometry={geometry} material={material} castShadow receiveShadow renderOrder={def.renderOrder}>
      {def.transmissive &&
        (simpleGlass ? (
          <meshPhysicalMaterial
            transmission={1}
            ior={lib.sapphire.ior}
            thickness={lib.sapphire.thickness}
            roughness={0}
            metalness={0}
            // AR coating: cuts surface reflectance to well under 1%, so the crystal
            // all but disappears instead of mirroring a softbox over the dial.
            specularIntensity={def.arCoated === false ? 0.85 : lib.sapphire.specularIntensity}
            // Only a whisper of the blue-violet coating flash at grazing angles.
            // Pushed higher it turns into a milky film across the whole dial.
            iridescence={0.08}
            iridescenceIOR={1.3}
            iridescenceThicknessRange={[200, 340]}
            envMapIntensity={def.arCoated === false ? 1.3 : lib.sapphire.envMapIntensity}
          />
        ) : (
          <MeshTransmissionMaterial
            {...lib.sapphire}
            specularIntensity={def.arCoated === false ? 0.85 : lib.sapphire.specularIntensity}
            envMapIntensity={def.arCoated === false ? 1.3 : lib.sapphire.envMapIntensity}
          />
        ))}
      {/* Hover only. A selection outline is redundant once the part has been pulled
          out and framed on its own, and on a TRANSMISSIVE part the inverted-hull
          shell shows straight through the glass — the crystal rendered as a solid
          gold disc. */}
      {hovered && !selected && <Outlines thickness={1} color="#7fa8ff" />}
    </mesh>
  )

  return (
    <group
      ref={group}
      name={`part:${def.id}`}
      position={basePos}
      quaternion={baseQuat}
      visible={visible}
      onPointerOver={(e) => {
        e.stopPropagation()
        useViewer.getState().setHovered(def.id)
      }}
      onPointerOut={() => useViewer.getState().setHovered(null)}
      onClick={(e) => {
        e.stopPropagation()
        useViewer.getState().setSelected(def.id)
      }}
    >
      {mesh}
    </group>
  )
}
