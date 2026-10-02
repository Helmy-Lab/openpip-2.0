import { useSearchStore } from '../searchStore'
import { useText } from '../../../text'
import { CanvasDropdown } from './CanvasDropdown'

const SECTION: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-soft)',
  textTransform: 'uppercase',
  letterSpacing: '.07em',
  marginBottom: 8,
}

/** The sidebar's minimum-score slider, reachable over the canvas. */
export function ConfidenceDropdown() {
  const t = useText()
  const scoreFilter = useSearchStore((s) => s.scoreFilter)
  const setScoreFilter = useSearchStore((s) => s.setScoreFilter)

  return (
    <CanvasDropdown label={t('search.confidence')} width={216}>
      <div style={SECTION}>{t('search.sidebar.score')}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={scoreFilter}
          aria-label={t('search.sidebar.score')}
          onChange={(e) => setScoreFilter(parseFloat(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }}
        />
        <span className="op-num" style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>
          {scoreFilter.toFixed(2)}
        </span>
      </div>
    </CanvasDropdown>
  )
}
