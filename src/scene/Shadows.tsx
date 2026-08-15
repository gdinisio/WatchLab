import { useEffect, useRef, useState } from 'react'
import { AccumulativeShadows, ContactShadows, RandomizedLight } from '@react-three/drei'
import { useViewer } from '../state/store'

/** Ground plane sits well below the bracelet drape so nothing intersects it. */
const GROUND_Y = -46

/**
 * Progressive soft shadows give a photographic ground contact, but AccumulativeShadows
 * needs a static scene — it would smear while the explode slider is being scrubbed.
 * So: cheap ContactShadows during motion, accumulative once things settle.
 */
export function Shadows() {
  const explodeT = useViewer((s) => s.explodeT)
  const movementT = useViewer((s) => s.movementT)
  const interacting = useViewer((s) => s.interacting)
  const lume = useViewer((s) => s.lume)

  const [settled, setSettled] = useState(true)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    setSettled(false)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setSettled(true), 600)
    return () => window.clearTimeout(timer.current)
  }, [explodeT, movementT, interacting])

  // Shadows read as wrong once the assembly is in mid-air, so fade them out.
  const fade = 1 - Math.min(1, Math.max(explodeT, movementT) * 1.4)
  if (lume || fade <= 0.02) return null

  return settled && !interacting ? (
    <AccumulativeShadows
      key={`acc-${explodeT.toFixed(2)}-${movementT.toFixed(2)}`}
      temporal
      frames={90}
      alphaTest={0.85}
      opacity={0.75 * fade}
      scale={220}
      position={[0, GROUND_Y, 0]}
      color="#0a0d14"
    >
      <RandomizedLight
        amount={8}
        radius={55}
        ambient={0.5}
        intensity={1.2}
        position={[40, 120, -30]}
        bias={0.001}
      />
    </AccumulativeShadows>
  ) : (
    <ContactShadows
      position={[0, GROUND_Y, 0]}
      scale={220}
      resolution={1024}
      blur={2.6}
      far={90}
      opacity={0.6 * fade}
      color="#0a0d14"
    />
  )
}
