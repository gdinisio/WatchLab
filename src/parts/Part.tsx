import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { MeshTransmissionMaterial, Outlines } from '@react-three/drei'
import type { MaterialLibrary } from '../materials/library'
import { useViewer } from '../state/store'
import { partProgress } from './explode'
import type { PartDef } from './types'

const _axis = new THREE.Vector3()
const _spinAxis = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _base = new THREE.Quaternion()
const _euler = new THREE.Euler()

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

  useFrame(() => {
    const g = group.current
    if (!g) return
    const p = partProgress(def, maxOrder)
    const { axis, distance, spin, spinAxis } = def.explode

    _axis.set(axis[0], axis[1], axis[2])
    g.position.copy(basePos).addScaledVector(_axis, distance * p)

    if (spin) {
      const sa = spinAxis ?? axis
      _spinAxis.set(sa[0], sa[1], sa[2]).normalize()
      _q.setFromAxisAngle(_spinAxis, spin * Math.PI * 2 * p)
      _base.copy(baseQuat)
      g.quaternion.copy(_q).multiply(_base)
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
            // The AR-coating flash: the blue-violet sheen every real sapphire has
            // at grazing angles.
            iridescence={0.3}
            iridescenceIOR={1.35}
            iridescenceThicknessRange={[180, 320]}
            envMapIntensity={1.2}
            transparent
          />
        ) : (
          <MeshTransmissionMaterial {...lib.sapphire} />
        ))}
      {(hovered || selected) && (
        <Outlines thickness={selected ? 1.6 : 1} color={selected ? '#c8b273' : '#7fa8ff'} />
      )}
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
