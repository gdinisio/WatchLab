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
const _instanceQuat = new THREE.Quaternion()
const _instanceMatrix = new THREE.Matrix4()
const TAU = Math.PI * 2

/**
 * Maps cascade progress to distance travelled, in two eased legs.
 *
 * Without a `seat` this is the identity — the part just slides. With one, the travel
 * is split at the mouth of whatever it enters: a long free approach, then a short
 * slow push. Easing each leg separately means both END at zero velocity, so the part
 * visibly settles at the mouth, lines up, and only then goes in.
 */
function seatedTravel(p: number, seat?: { depth: number; phase: number }): number {
  if (!seat || p <= 0 || p >= 1) return p
  const { depth, phase } = seat
  const ease = (t: number) => t * t * (3 - 2 * t)
  return p < phase
    ? ease(p / phase) * depth
    : depth + ease((p - phase) / (1 - phase)) * (1 - depth)
}

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

  /**
   * Instance transforms, decomposed once.
   *
   * An instanced part's group sits at the origin and every copy is offset by its own
   * matrix, so rotating the GROUP swings all of them around the world origin. For
   * the bracelet pins — spread down 35mm of drape — a couple of turns threw them
   * through arcs the width of the screen. A screw unscrews about ITSELF, so the spin
   * has to be applied per instance, which means keeping the rest pose to rebuild
   * from each frame.
   */
  const instanceRest = useMemo(() => {
    if (!def.instances) return null
    return Array.from({ length: def.instances.count }, (_, i) => {
      const position = new THREE.Vector3()
      const quaternion = new THREE.Quaternion()
      const scale = new THREE.Vector3()
      def.instances!.transform(i).decompose(position, quaternion, scale)
      return { position, quaternion, scale }
    })
  }, [def])

  const instanced = useRef<THREE.InstancedMesh>(null)
  const lastSpin = useRef(Number.NaN)
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
  const inspect = useRef({ t: 0, angle: 0 })

  useFrame((_state, dt) => {
    const g = group.current
    if (!g) return
    const p = partProgress(def, maxOrder)
    const { axis, distance, spin, spinAxis, spinPhase = 1, seat } = def.explode

    _axis.set(axis[0], axis[1], axis[2])
    _explodePos.copy(basePos).addScaledVector(_axis, distance * seatedTravel(p, seat))

    easing.damp(inspect.current, 't', selected ? 1 : 0, 0.42, dt)
    if (!selected && inspect.current.t < 0.0005) inspect.current.t = 0
    const k = smoothstep(inspect.current.t)

    if (k === 0) g.position.copy(_explodePos)
    else g.position.lerpVectors(_explodePos, INSPECT_POSITION, k)

    /**
     * The inspection turn is an ACCUMULATED angle that unwinds, not a function of
     * elapsed time.
     *
     * Driving it from the clock left a part sitting at whatever angle the clock
     * happened to be at when the damping crossed the cutoff, so deselecting a part
     * dropped it back into the assembly rotated — and for an INSTANCED part like the
     * hour markers, that rotation is about the dial's axis, so the whole ring of
     * markers came back visibly askew.
     */
    if (selected) {
      inspect.current.angle += dt * INSPECT_SPIN_SPEED
    } else if (inspect.current.angle !== 0) {
      // Unwind the SHORT way round: fold into (-pi, pi] first, or a part left
      // turning for a minute spins back through several revolutions on release.
      const a = inspect.current.angle
      inspect.current.angle = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI
      easing.damp(inspect.current, 'angle', 0, 0.4, dt)
      if (Math.abs(inspect.current.angle) < 1e-4) inspect.current.angle = 0
    }

    // Always written, never conditionally skipped: leaving the last frame's value in
    // place is exactly how the residual rotation got stranded in the first place.
    _base.copy(baseQuat)
    // Rotation is complete once the part is `spinPhase` of the way out, and frozen
    // beyond that — so on the way back in it travels unturned and threads home over
    // the last stretch.
    const spinAngle = spin ? spin * TAU * Math.min(1, p / spinPhase) : 0
    if (spin) {
      const sa = spinAxis ?? axis
      _spinAxis.set(sa[0], sa[1], sa[2]).normalize()
      if (instanceRest) {
        if (instanced.current && spinAngle !== lastSpin.current) {
          _q.setFromAxisAngle(_spinAxis, spinAngle)
          for (let i = 0; i < instanceRest.length; i++) {
            const rest = instanceRest[i]
            _instanceQuat.copy(_q).multiply(rest.quaternion)
            _instanceMatrix.compose(rest.position, _instanceQuat, rest.scale)
            instanced.current.setMatrixAt(i, _instanceMatrix)
          }
          instanced.current.instanceMatrix.needsUpdate = true
          lastSpin.current = spinAngle
        }
      } else {
        _q.setFromAxisAngle(_spinAxis, spinAngle)
        _base.premultiply(_q)
      }
    }
    if (inspect.current.angle !== 0) {
      _q.setFromAxisAngle(_up, inspect.current.angle)
      _base.premultiply(_q)
    }
    g.quaternion.copy(_base)
  })

  const material = def.transmissive ? undefined : lib.materials[def.material]

  const mesh = def.instances ? (
    <instancedMesh
      args={[geometry, material, def.instances.count]}
      castShadow
      receiveShadow
      ref={(node) => {
        instanced.current = node
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
            thickness={def.glassThickness ?? lib.sapphire.thickness}
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
            thickness={def.glassThickness ?? lib.sapphire.thickness}
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
