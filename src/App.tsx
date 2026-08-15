import { useEffect, useRef } from 'react'
import type { CameraControls } from '@react-three/drei'
import { useMaterials } from './materials/useMaterials'
import { Viewer } from './scene/Viewer'
import { Watch } from './scene/Watch'
import { MaterialBoard } from './dev/MaterialBoard'
import { Controls } from './ui/Controls'
import { Inspector } from './ui/Inspector'
import { useViewer } from './state/store'

/**
 * Dev/query switches:
 *   ?view=materials   material checkpoint board
 *   ?glass=simple     cheaper physical transmission instead of the multi-sample pass
 *   ?cam=x,y,z        camera placement
 *   ?explode=0..1     initial assembly state
 *   ?hud=off          hide the overlay UI (for clean reference renders)
 *   ?groups=case,dial isolate part groups (diagnostics)
 *   ?movement=0..1    initial calibre state
 *   ?fx=off / ?dpr=n  handled inside Viewer
 */
function query() {
  const q = new URLSearchParams(window.location.search)
  const cam = q.get('cam')?.split(',').map(Number)
  const num = (k: string) => {
    const v = Number(q.get(k))
    return q.get(k) !== null && Number.isFinite(v) ? v : undefined
  }
  return {
    view: q.get('view') ?? 'watch',
    simpleGlass: q.get('glass') === 'simple',
    cam: cam?.length === 3 && cam.every(Number.isFinite)
      ? (cam as [number, number, number])
      : undefined,
    explode: num('explode'),
    movement: num('movement'),
    hud: q.get('hud') !== 'off',
    groups: q.get('groups')?.split(',').filter(Boolean),
  }
}

function Loader({ label }: { label: string }) {
  return (
    <div className="loader">
      <h1>WatchLab</h1>
      <div className="bar"><i /></div>
      <p>{label}</p>
    </div>
  )
}

export function App() {
  const lib = useMaterials()
  const controls = useRef<CameraControls | null>(null)
  const { view, simpleGlass, cam, explode, movement, hud, groups } = query()
  const setExplodeT = useViewer((s) => s.setExplodeT)
  const setMovementT = useViewer((s) => s.setMovementT)

  useEffect(() => {
    if (explode !== undefined) setExplodeT(explode)
    if (movement !== undefined) setMovementT(movement)
    if (groups) {
      useViewer.setState({
        activeGroups: {
          case: groups.includes('case'),
          dial: groups.includes('dial'),
          movement: groups.includes('movement'),
          bracelet: groups.includes('bracelet'),
        },
      })
    }
  }, [explode, movement, groups, setExplodeT, setMovementT])

  if (!lib) return <Loader label="Generating procedural textures" />

  const materials = view === 'materials'

  return (
    <>
      <Viewer
        controlsRef={controls}
        cameraPosition={cam ?? (materials ? [0, 120, 175] : [34, 54, 82])}
        maxDistance={materials ? 600 : 420}
      >
        {materials ? <MaterialBoard lib={lib} /> : <Watch lib={lib} simpleGlass={simpleGlass} />}
      </Viewer>

      {hud && (
        <div className="brand">
          WatchLab
          <small>{materials ? 'Material checkpoint' : 'Datejust 36 · ref. 126234'}</small>
        </div>
      )}

      {!materials && hud && (
        <>
          <Controls />
          <Inspector />
        </>
      )}
    </>
  )
}
