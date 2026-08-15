import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { BlendFunction, KernelSize, ToneMappingMode } from 'postprocessing'
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  N8AO,
  Noise,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing'
import { useViewer } from '../state/store'

/**
 * Post stack.
 *
 * ORDER IS THE WHOLE POINT HERE. Bloom has to see HDR values, so the composer runs
 * on a half-float buffer, the renderer's own tone mapping is switched OFF while this
 * is mounted, and tone mapping happens as an effect partway down the chain instead.
 * Bloom applied AFTER tone mapping sees a polished case as a solid field of ~1.0 and
 * haloes the entire watch — which is exactly what it did before this was fixed.
 *
 * Anti-aliasing is MSAA via `multisampling` rather than a post-process AA pass: the
 * watch is full of sub-pixel geometry — hand tips, flute crests, hairspring coils —
 * where MSAA is visibly crisper than SMAA.
 *
 * Chromatic aberration, vignette and grain are all near the threshold of perception.
 * Together they are what separate "CG render" from "photograph", but only when they
 * stay subtle enough that you would not name them if asked what you were looking at.
 */
export function Effects() {
  const lume = useViewer((s) => s.lume)
  const gl = useThree((s) => s.gl)
  const offset = useMemo(() => new THREE.Vector2(0.00045, 0.00045), [])

  useEffect(() => {
    const previous = gl.toneMapping
    gl.toneMapping = THREE.NoToneMapping
    return () => {
      gl.toneMapping = previous
    }
  }, [gl])

  return (
    <EffectComposer
      multisampling={4}
      enableNormalPass={false}
      frameBufferType={THREE.HalfFloatType}
    >
      {/* Contact darkening in the crevices between parts. Radius is in world units,
          and the scene is in millimetres, so 2 means 2mm. */}
      <N8AO
        aoRadius={2}
        distanceFalloff={0.75}
        intensity={1.6}
        quality="medium"
        halfRes
        denoiseSamples={8}
        color="#05070c"
      />
      {/* HDR bloom: only genuinely over-range highlights spill. */}
      <Bloom
        luminanceThreshold={lume ? 0.35 : 1.05}
        luminanceSmoothing={0.2}
        intensity={lume ? 1.1 : 0.42}
        radius={0.55}
        kernelSize={KernelSize.MEDIUM}
        mipmapBlur
      />
      {/* Khronos PBR Neutral: designed for product accuracy, and it keeps the blue
          dial's hue honest where ACES desaturates saturated colours toward white. */}
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <ChromaticAberration offset={offset} />
      <Vignette darkness={0.4} offset={0.35} />
      <Noise opacity={0.014} blendFunction={BlendFunction.OVERLAY} />
    </EffectComposer>
  )
}
