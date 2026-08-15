import * as THREE from 'three'
import { Environment, Lightformer } from '@react-three/drei'
import { useMemo } from 'react'

/**
 * The studio light tent.
 *
 * Polished metal is a mirror: it does not show light, it shows the ROOM. A uniformly
 * bright environment therefore renders as flat grey plastic no matter how good the
 * material parameters are. The rig below is deliberately high-contrast — bright bars
 * separated by near-black gaps — because those alternating bands are what become the
 * crisp specular streaks running down a polished case flank.
 *
 * The empty black between formers is not an oversight. It is the most important part
 * of the rig.
 *
 * Scene units are millimetres, so formers sit tens-to-hundreds of units out.
 */
function GradientBackdrop() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          top: { value: new THREE.Color('#6f7889') },
          bottom: { value: new THREE.Color('#0d1015') },
          horizon: { value: new THREE.Color('#333a47') },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 top; uniform vec3 bottom; uniform vec3 horizon;
          varying vec3 vDir;
          void main() {
            float h = vDir.y;
            vec3 c = h > 0.0
              ? mix(horizon, top, pow(h, 0.65))
              : mix(horizon, bottom, pow(-h, 0.5));
            gl_FragColor = vec4(c, 1.0);
          }
        `,
      }),
    [],
  )
  return (
    <mesh material={material} scale={600}>
      <sphereGeometry args={[1, 32, 24]} />
    </mesh>
  )
}

export interface StudioEnvironmentProps {
  /** Scene-wide IBL gain. Lume mode drives this toward ~0.03. */
  intensity?: number
  /** Rotating the rig is the fastest way to make any given part look its best. */
  rotationY?: number
}

export function StudioEnvironment({ intensity = 1, rotationY = 0 }: StudioEnvironmentProps) {
  return (
    <Environment
      resolution={1024}
      frames={1}
      environmentIntensity={intensity}
      environmentRotation={[0, rotationY, 0]}
    >
      <GradientBackdrop />

      {/* --- Tent walls -------------------------------------------------
          Large, moderately bright panels that carry the BASE brightness of every
          polished surface. Without these the metals reflect mostly black and read
          as gunmetal instead of steel. The gaps between them are the dark bands. */}
      <Lightformer form="rect" intensity={2.4} color="#eef2fb"
        position={[0, 170, 0]} scale={[230, 230, 1]} rotation-x={Math.PI / 2} />
      <Lightformer form="rect" intensity={1.7} color="#e6ecf8"
        position={[-190, 40, 60]} scale={[150, 150, 1]} target />
      <Lightformer form="rect" intensity={1.5} color="#f6efe6"
        position={[190, 40, -40]} scale={[150, 150, 1]} target />
      <Lightformer form="rect" intensity={1.3} color="#e8eefb"
        position={[0, 50, 200]} scale={[190, 150, 1]} target />

      {/* --- Key ---------------------------------------------------------
          Broad overhead softbox sitting inside the ceiling panel. */}
      <Lightformer form="rect" intensity={7} color="#ffffff"
        position={[0, 130, 35]} scale={[130, 60, 1]} target />

      {/* --- Rim strips --------------------------------------------------
          Narrow and hot, with darkness either side. These are what become the
          vertical specular streaks down a polished case flank — the signature of
          a well-lit Rolex. */}
      <Lightformer form="rect" intensity={16} color="#ffffff"
        position={[-125, 30, 45]} scale={[13, 175, 1]} target />
      <Lightformer form="rect" intensity={13} color="#fff4e8"
        position={[130, 35, -15]} scale={[10, 175, 1]} target />
      <Lightformer form="rect" intensity={9} color="#eaf1ff"
        position={[-55, 95, -110]} scale={[9, 120, 1]} target />

      {/* --- Kicker ------------------------------------------------------
          Small and very hot, for bright edge separation behind the subject. */}
      <Lightformer form="rect" intensity={14} color="#ffffff"
        position={[40, 55, -165]} scale={[40, 35, 1]} target />

      {/* --- Case-band strips ---------------------------------------------
          A vertical polished flank mirrors whatever sits at ITS horizon, which is
          otherwise the dark floor — so the case band goes black no matter how bright
          the ceiling is. These low, wide strips are the bright band you see running
          around the case of every watch photograph. */}
      <Lightformer form="rect" intensity={4.5} color="#ffffff"
        position={[0, -2, 155]} scale={[120, 26, 1]} target />
      <Lightformer form="rect" intensity={3} color="#eaf0ff"
        position={[-150, -6, -70]} scale={[110, 22, 1]} target />
      <Lightformer form="rect" intensity={2.4} color="#fff3e6"
        position={[120, -8, -120]} scale={[100, 20, 1]} target />

      {/* --- Lower fill cards ---------------------------------------------
          A vertical case band reflects DOWNWARD from a camera looking down at it, so
          it mirrors the floor, not the ceiling. Without something bright below the
          horizon the band stays black however bright the rest of the rig is. This is
          the white card every watch photographer puts under the subject. */}
      <Lightformer form="rect" intensity={3.2} color="#f2f5ff"
        position={[0, -78, 118]} scale={[170, 95, 1]} target />
      <Lightformer form="rect" intensity={2.2} color="#f6f1ea"
        position={[-110, -70, -60]} scale={[130, 80, 1]} target />

      {/* --- Floor bounce ------------------------------------------------
          Stops casebacks and undersides going pure black. */}
      <Lightformer form="rect" intensity={1.8} color="#9fb0cc"
        position={[0, -150, 0]} scale={[240, 240, 1]} rotation-x={-Math.PI / 2} />

    </Environment>
  )
}
