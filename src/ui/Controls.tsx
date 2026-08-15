import type { PartGroup } from '../parts/types'
import { useViewer } from '../state/store'

const GROUPS: { id: PartGroup; label: string }[] = [
  { id: 'case', label: 'Case' },
  { id: 'dial', label: 'Dial' },
  { id: 'movement', label: 'Movement' },
  { id: 'bracelet', label: 'Bracelet' },
]

const PRESETS: { label: string; explode: number; movement: number }[] = [
  { label: 'Assembled', explode: 0, movement: 0 },
  { label: 'Case', explode: 0.45, movement: 0 },
  { label: 'Calibre', explode: 0.2, movement: 1 },
  { label: 'Full', explode: 1, movement: 1 },
]

export function Controls() {
  const {
    explodeT, movementT, activeGroups, lume, showAnnotations, envRotation,
    setExplodeT, setMovementT, toggleGroup, setLume, setShowAnnotations,
    setEnvRotation, setInteracting,
  } = useViewer()

  return (
    <div className="controls panel">
      <h2>Exploded View</h2>

      <div className="field">
        <label>Assembly <span>{Math.round(explodeT * 100)}%</span></label>
        <input
          type="range" min={0} max={1} step={0.001} value={explodeT}
          onChange={(e) => setExplodeT(Number(e.target.value))}
          onPointerDown={() => setInteracting(true)}
          onPointerUp={() => setInteracting(false)}
        />
      </div>

      <div className="field">
        <label>Calibre 3235 <span>{Math.round(movementT * 100)}%</span></label>
        <input
          type="range" min={0} max={1} step={0.001} value={movementT}
          onChange={(e) => setMovementT(Number(e.target.value))}
          onPointerDown={() => setInteracting(true)}
          onPointerUp={() => setInteracting(false)}
        />
      </div>

      <div className="row">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className="chip"
            data-on={explodeT === p.explode && movementT === p.movement}
            onClick={() => { setExplodeT(p.explode); setMovementT(p.movement) }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <h2>Groups</h2>
      <div className="row">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            className="chip"
            data-on={activeGroups[g.id]}
            onClick={() => toggleGroup(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="field">
        <label>Light rotation <span>{Math.round((envRotation * 180) / Math.PI)}°</span></label>
        <input
          type="range" min={0} max={Math.PI * 2} step={0.01} value={envRotation}
          onChange={(e) => setEnvRotation(Number(e.target.value))}
        />
      </div>

      <div className="row">
        <button className="chip" data-on={lume} onClick={() => setLume(!lume)}>
          Lume
        </button>
        <button
          className="chip"
          data-on={showAnnotations}
          onClick={() => setShowAnnotations(!showAnnotations)}
        >
          Labels
        </button>
      </div>
    </div>
  )
}
