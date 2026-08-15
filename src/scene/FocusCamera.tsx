import { useEffect } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import type { CameraControls } from '@react-three/drei'
import { useViewer } from '../state/store'

const _box = new THREE.Box3()
const _sphere = new THREE.Sphere()

/**
 * Flies the camera to frame whichever part is selected.
 *
 * The part's world bounds are read at click time, so this works identically whether
 * the assembly is closed up or blown apart.
 */
export function FocusCamera({ controls }: { controls: React.RefObject<CameraControls | null> }) {
  const selected = useViewer((s) => s.selected)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    if (!selected || !controls.current) return
    const target = scene.getObjectByName(`part:${selected}`)
    if (!target) return

    _box.setFromObject(target)
    if (_box.isEmpty()) return
    _box.getBoundingSphere(_sphere)
    // Pad so the part does not fill the entire frame.
    controls.current.fitToSphere(
      new THREE.Sphere(_sphere.center, Math.max(_sphere.radius * 2.6, 9)),
      true,
    )
  }, [selected, controls, scene])

  return null
}
