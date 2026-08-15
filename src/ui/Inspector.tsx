import { findPart } from '../parts/registry'
import { useViewer } from '../state/store'

const GROUP_LABEL: Record<string, string> = {
  case: 'Oyster Case',
  dial: 'Dial & Hands',
  movement: 'Calibre 3235',
  bracelet: 'Oyster Bracelet',
}

export function Inspector() {
  const selected = useViewer((s) => s.selected)
  const setSelected = useViewer((s) => s.setSelected)
  const part = findPart(selected)
  if (!part) return null

  const { spec } = part
  const rows: [string, string][] = [
    ['Material', spec.material],
    ...(spec.dimension ? ([['Dimension', spec.dimension]] as [string, string][]) : []),
    ...(spec.finish ? ([['Finish', spec.finish]] as [string, string][]) : []),
    ...(spec.count ? ([['Quantity', String(spec.count)]] as [string, string][]) : []),
  ]

  return (
    <div className="inspector panel">
      <button className="close" onClick={() => setSelected(null)} aria-label="Close">×</button>
      <div className="eyebrow">{GROUP_LABEL[part.group] ?? part.group}</div>
      <h3>{part.name}</h3>
      <p>{spec.function}</p>
      <dl>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
