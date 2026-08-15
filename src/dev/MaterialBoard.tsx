import { Html } from '@react-three/drei'
import { useMemo } from 'react'
import type { MaterialLibrary, MaterialKey } from '../materials/library'
import { buildLathe } from '../geometry/lathe'

const ORDER: Exclude<MaterialKey, 'sapphire'>[] = [
  'steelPolished', 'steelBrushed', 'steelCircular',
  'whiteGold', 'yellowGold', 'yellowGoldSatin',
  'rhodiumPerlage', 'rhodiumCotes', 'rhodiumBrushed',
  'bluedSteel', 'brassGilt', 'ruby',
  'dial', 'dateDisc', 'lume', 'gasket',
]

/**
 * Phase-1 checkpoint board. Every material is shown on a sphere AND on a chamfered
 * puck, because a sphere flatters anisotropy while a flat face with a chamfered edge
 * is what actually appears on a watch — if the chamfer does not read as a bright
 * specular line, the finish is wrong.
 */
export function MaterialBoard({ lib }: { lib: MaterialLibrary }) {
  const puck = useMemo(
    () =>
      buildLathe(
        [
          [0, 0], [4.6, 0], [5.4, 0.35], [5.4, 1.7], [4.6, 2.1], [0, 2.1],
        ],
        { segments: 128, creaseAngle: Math.PI / 5 },
      ),
    [],
  )
  const cols = 4
  const pitch = 30

  return (
    <group>
      {ORDER.map((key, i) => {
        const x = (i % cols) * pitch - ((cols - 1) * pitch) / 2
        const z = Math.floor(i / cols) * pitch - 45
        const material = lib.materials[key]
        return (
          <group key={key} position={[x, 0, z]}>
            <mesh material={material} position={[-6.5, 5.5, 0]} castShadow>
              <sphereGeometry args={[5, 96, 64]} />
            </mesh>
            <mesh material={material} geometry={puck} position={[6.5, 0, 0]} castShadow />
            <Html
              center
              position={[0, 0, 11]}
              style={{
                font: '500 9px ui-monospace, monospace',
                color: '#8b93a3',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              {key}
            </Html>
          </group>
        )
      })}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#0d1015" roughness={0.9} metalness={0} />
      </mesh>
    </group>
  )
}
