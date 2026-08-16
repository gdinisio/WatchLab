import type { PartGroup } from '../parts/types'
import { useViewer } from '../state/store'

const GROUPS: { id: PartGroup; label: string }[] = [
  { id: 'case', label: 'Case' },
  { id: 'dial', label: 'Dial' },
  { id: 'movement', label: 'Movement' },
  { id: 'bracelet', label: 'Bracelet' },
]

/**
 * Stops along the ONE teardown timeline, named for what has just come off.
 *
 * These are not round numbers picked by eye. A part finishes travelling at
 * `order / (maxOrder + 1) * (1 - WINDOW) + WINDOW`, so with eleven orders and a 0.55
 * window each value below is the point at which that stage of the strip-down has
 * completed and the next has barely started.
 */
const PRESETS: { label: string; hint: string; t: number }[] = [
  { label: 'Assembled', hint: 'The watch as worn', t: 0 },
  { label: 'Bezel & crystal', hint: 'Fluted bezel, sapphire and Cyclops lifted off', t: 0.3 },
  { label: 'Dial & hands', hint: 'Hands, applied markers and the dial away', t: 0.56 },
  { label: 'Calibre 3235', hint: 'Bridges, train and automatic module opened', t: 0.82 },
  { label: 'Every part', hint: 'The complete teardown', t: 1 },
]

export function Controls() {
  const {
    explodeT, activeGroups, lume, showAnnotations, envRotation,
    setExplodeT, toggleGroup, setLume, setShowAnnotations,
    setEnvRotation, setInteracting,
  } = useViewer()

  // Nearest stop, so a chip stays lit while the slider sits on it.
  const current = PRESETS.reduce((best, p) =>
    Math.abs(p.t - explodeT) < Math.abs(best.t - explodeT) ? p : best,
  )

  return (
    <div className="controls panel">
      <h2>Teardown</h2>

      <div className="field">
        <label>
          {Math.abs(current.t - explodeT) < 0.005 ? current.label : 'Disassembly'}
          <span>{Math.round(explodeT * 100)}%</span>
        </label>
        <input
          type="range" min={0} max={1} step={0.001} value={explodeT}
          onChange={(e) => setExplodeT(Number(e.target.value))}
          onPointerDown={() => setInteracting(true)}
          onPointerUp={() => setInteracting(false)}
        />
      </div>

      <div className="stops">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className="chip"
            title={p.hint}
            data-on={Math.abs(explodeT - p.t) < 0.005}
            onClick={() => setExplodeT(p.t)}
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
