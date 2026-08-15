import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import type { MaterialLibrary } from '../materials/library'
import { useViewer } from '../state/store'

/** Peak emissive gain when fully charged. */
const PEAK = 3.6
/** Chromalight runs ~8 hours; compressed here to a ~40 second visible decay. */
const DECAY_SECONDS = 40

/**
 * Drives lume mode: the environment falls away to almost nothing while the
 * Chromalight compound ramps up, then decays on an exponential curve the way a real
 * luminous charge does.
 */
export function LumeDriver({ lib }: { lib: MaterialLibrary }) {
  useFrame((_, dt) => {
    const s = useViewer.getState()
    const target = s.lume ? 0.035 : 1
    const current = { v: s.envIntensity }
    easing.damp(current, 'v', target, 0.5, dt)
    if (Math.abs(current.v - s.envIntensity) > 1e-4) {
      useViewer.setState({ envIntensity: current.v })
    }

    if (s.lume && s.lumeCharge > 0) {
      // Exponential falloff, never quite reaching zero.
      const next = s.lumeCharge * Math.exp(-dt / DECAY_SECONDS)
      useViewer.setState({ lumeCharge: next })
    }

    const glow = s.lume ? PEAK * (0.12 + 0.88 * s.lumeCharge) : 0
    for (const m of lib.lumeMaterials) {
      easing.damp(m, 'emissiveIntensity', glow, 0.35, dt)
    }
  })
  return null
}
