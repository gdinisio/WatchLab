import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import { maxOrderOf, partProgress } from '../parts/explode'
import { ALL_PARTS } from '../parts/registry'
import { useViewer } from '../state/store'
import type { PartDef } from '../parts/types'

const _axis = new THREE.Vector3()

/** One label, tracking its part through the explode cascade. */
function Annotation({ def, maxOrder }: { def: PartDef; maxOrder: number }) {
  const group = useRef<THREE.Group>(null)
  const hovered = useViewer((s) => s.hovered === def.id)
  const selected = useViewer((s) => s.selected === def.id)
  const visible = useViewer((s) => s.activeGroups[def.group])

  const base = useMemo(
    () => new THREE.Vector3(...(def.position ?? [0, 0, 0])),
    [def],
  )
  const offset = useMemo(
    () => new THREE.Vector3(...(def.labelOffset ?? [0, 2, 0])),
    [def],
  )
  const leader = useMemo<[number, number, number][]>(
    () => [[0, 0, 0], [offset.x, offset.y, offset.z]],
    [offset],
  )

  useFrame(() => {
    const g = group.current
    if (!g) return
    const p = partProgress(def, maxOrder)
    _axis.set(...(def.explode.axis as [number, number, number]))
    g.position.copy(base).addScaledVector(_axis, def.explode.distance * p)
  })

  if (!visible) return null
  const active = hovered || selected

  return (
    <group ref={group}>
      <Line
        points={leader}
        color={active ? '#c8b273' : '#5c6675'}
        lineWidth={active ? 1.4 : 1}
        transparent
        opacity={active ? 1 : 0.65}
      />
      <Html position={offset} center={false} zIndexRange={[20, 0]}>
        <div className="annotation" data-active={active}>{def.name}</div>
      </Html>
    </group>
  )
}

/** Labels are only drawn for parts that declare a leader offset. */
export function Annotations() {
  const show = useViewer((s) => s.showAnnotations)
  const explodeT = useViewer((s) => s.explodeT)
  const inspecting = useViewer((s) => s.selected !== null)
  const maxOrder = useMemo(() => maxOrderOf(ALL_PARTS), [])
  const labelled = useMemo(() => ALL_PARTS.filter((p) => p.labelOffset), [])

  // Labels only make sense once things have started to come apart.
  // Labels track their parts, and the inspected one has left the assembly, so during
  // inspection they only add noise.
  if (!show || inspecting || explodeT < 0.08) return null

  return (
    <group>
      {labelled.map((def) => (
        <Annotation key={def.id} def={def} maxOrder={maxOrder} />
      ))}
    </group>
  )
}
