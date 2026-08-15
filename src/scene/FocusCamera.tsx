import { useEffect } from 'react'
import * as THREE from 'three'
import type { CameraControls } from '@react-three/drei'
import { findPart } from '../parts/registry'
import {
  INSPECT_FRAMING,
  INSPECT_MIN_RADIUS,
  INSPECT_POSITION,
  partRadius,
} from '../parts/inspect'
import { useViewer } from '../state/store'

/** Framing for the whole assembly when nothing is selected. */
const HOME_RADIUS = 34

/**
 * Drives the camera for inspection mode.
 *
 * Selecting a part sends it sliding out to the staging position; the camera reframes
 * on that FIXED point rather than on the part's current bounds. Chasing live bounds
 * would aim at empty space for the whole of the slide, since mid-flight the part is
 * somewhere between the assembly and the staging area.
 *
 * The radius comes from the part's own geometry, so a bridge and a 0.4mm jewel are
 * each framed at a sensible size, with a floor so the smallest components do not end
 * up filling the screen.
 */
export function FocusCamera({ controls }: { controls: React.RefObject<CameraControls | null> }) {
  const selected = useViewer((s) => s.selected)

  useEffect(() => {
    const ctrl = controls.current
    if (!ctrl) return

    if (!selected) {
      // Ease back to the whole watch.
      ctrl.fitToSphere(new THREE.Sphere(new THREE.Vector3(0, 0, 0), HOME_RADIUS), true)
      return
    }

    const part = findPart(selected)
    if (!part) return

    const r = Math.max(partRadius(part.id, part.geometry()) * INSPECT_FRAMING, INSPECT_MIN_RADIUS)
    ctrl.fitToSphere(new THREE.Sphere(INSPECT_POSITION.clone(), r), true)
  }, [selected, controls])

  return null
}
