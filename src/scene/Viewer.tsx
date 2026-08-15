import { Suspense, type ReactNode } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, Bvh, CameraControls, PerformanceMonitor } from '@react-three/drei'
import { useState } from 'react'
import { FocusCamera } from './FocusCamera'
import { StudioEnvironment } from './StudioEnvironment'
import { Effects } from './Effects'
import { Shadows } from './Shadows'
import { useViewer } from '../state/store'

export interface ViewerProps {
  children: ReactNode
  controlsRef?: React.RefObject<CameraControls | null>
  cameraPosition?: [number, number, number]
  maxDistance?: number
}

/**
 * Dev overrides, used by the headless screenshot harness — software WebGL cannot
 * carry the full post stack at retina resolution.
 *   ?fx=off   disable post-processing
 *   ?dpr=1    pin device pixel ratio
 */
function devOverrides() {
  const q = new URLSearchParams(window.location.search)
  const dpr = Number(q.get('dpr'))
  return {
    fx: q.get('fx') !== 'off',
    dpr: Number.isFinite(dpr) && dpr > 0 ? ([dpr, dpr] as [number, number]) : ([1, 2] as [number, number]),
  }
}

/**
 * Renderer configuration.
 *
 * Tone mapping is NeutralToneMapping (Khronos PBR Neutral) rather than ACES: it is
 * designed for product accuracy and keeps the blue dial's hue honest, where ACES
 * desaturates saturated colours toward white as they brighten.
 *
 * `antialias` is off because the post stack does MSAA itself — leaving both on
 * costs a full extra resolve for nothing.
 */
export function Viewer({
  children,
  controlsRef,
  cameraPosition = [0, 52, 88],
  maxDistance = 420,
}: ViewerProps) {
  const [degraded, setDegraded] = useState(false)
  const [overrides] = useState(devOverrides)
  const envIntensity = useViewer((s) => s.envIntensity)
  const envRotation = useViewer((s) => s.envRotation)
  const setInteracting = useViewer((s) => s.setInteracting)

  return (
    <Canvas
      dpr={overrides.dpr}
      shadows="percentage"
      gl={{
        antialias: false,
        alpha: false,
        stencil: false,
        powerPreference: 'high-performance',
        toneMapping: THREE.NeutralToneMapping,
        toneMappingExposure: 0.92,
      }}
      camera={{ position: cameraPosition, fov: 30, near: 0.5, far: 3000 }}
      onPointerMissed={() => useViewer.getState().setSelected(null)}
    >
      <color attach="background" args={['#0b0d12']} />

      <PerformanceMonitor onDecline={() => setDegraded(true)} />
      <AdaptiveDpr pixelated={false} />

      <StudioEnvironment intensity={envIntensity} rotationY={envRotation} />

      <Suspense fallback={null}>
        <Bvh firstHitOnly>{children}</Bvh>
      </Suspense>

      <Shadows />

      <CameraControls
        ref={controlsRef}
        makeDefault
        minDistance={26}
        maxDistance={maxDistance}
        smoothTime={0.28}
        onStart={() => setInteracting(true)}
        onEnd={() => setInteracting(false)}
      />

      {controlsRef && <FocusCamera controls={controlsRef} />}

      {!degraded && overrides.fx && <Effects />}
    </Canvas>
  )
}
