import { useSearchStore } from '../searchStore'
import { useText } from '../../../text'
import { useCanvasBackground, useCanvasBackgroundStore } from '../network/canvasBackground'

type LayoutName = 'cola' | 'cose' | 'concentric' | 'circle' | 'grid'

/** Shared by the in-canvas controls so they line up as one row. */
export const CONTROL_HEIGHT = 30

/** Floating over the graph, so the surface lets a little of it through. */
export const CONTROL_BG = 'color-mix(in srgb, var(--surface) 80%, transparent)'

function LayoutIcon({ value }: { value: LayoutName }) {
  const s = { flexShrink: 0 as const }
  if (value === 'cola') return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={s} aria-hidden="true">
      <circle cx="9" cy="4" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="3" cy="13" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <line x1="9" y1="5.5" x2="9" y2="8.5" />
      <line x1="9" y1="11.5" x2="4.2" y2="12.3" />
      <line x1="9" y1="11.5" x2="13.8" y2="12.3" />
      <line x1="9" y1="5.5" x2="3.5" y2="11.8" />
    </svg>
  )
  if (value === 'cose') return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={s} aria-hidden="true">
      <circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="3" cy="4" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="4" cy="14" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="14" cy="14" r="1.5" fill="currentColor" stroke="none" />
      <line x1="9" y1="9" x2="3.8" y2="5.2" />
      <line x1="9" y1="9" x2="14.2" y2="6" />
      <line x1="9" y1="9" x2="4.8" y2="13" />
      <line x1="9" y1="9" x2="13.2" y2="13" />
      <line x1="3.8" y1="5.2" x2="14.2" y2="6" />
    </svg>
  )
  if (value === 'concentric') return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" style={s} aria-hidden="true">
      <circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="9" cy="9" r="4.5" />
      <circle cx="9" cy="9" r="7.5" />
      <circle cx="9" cy="4.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="9" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="9" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
  if (value === 'circle') return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" style={s} aria-hidden="true">
      <circle cx="9" cy="2" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15.2" cy="5.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15.2" cy="12.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="9" cy="16" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="2.8" cy="12.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="2.8" cy="5.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="9" cy="9" r="6.5" strokeDasharray="2 2" />
    </svg>
  )
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" style={s} aria-hidden="true">
      <circle cx="4" cy="4" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="9" cy="4" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="14" cy="4" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="4" cy="9" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="9" cy="9" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="14" cy="9" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="4" cy="14" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="9" cy="14" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="14" cy="14" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

const LAYOUT_OPTIONS: { value: LayoutName; textKey: string }[] = [
  { value: 'cola', textKey: 'search.layout.cola' },
  { value: 'cose', textKey: 'search.layout.cose' },
  { value: 'concentric', textKey: 'search.layout.concentric' },
  { value: 'circle', textKey: 'search.layout.circle' },
  { value: 'grid', textKey: 'search.layout.grid' },
]

/**
 * The viewer's own canvas colour, kept in this browser. Anyone can set it;
 * the admin colour in Settings → Search is only the default it starts from.
 */
export function CanvasBackgroundPicker() {
  const t = useText()
  const background = useCanvasBackground()
  const override = useCanvasBackgroundStore((s) => s.override)
  const setOverride = useCanvasBackgroundStore((s) => s.setOverride)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="color"
        aria-label={t('search.layout.background')}
        // With no color set the canvas follows the theme; show its --bg.
        value={background ?? (getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#ffffff')}
        onChange={(e) => setOverride(e.target.value)}
        style={{ width: 32, height: 24, padding: 0, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
      />
      <button
        type="button"
        className="op-btn"
        disabled={!override}
        onClick={() => setOverride(null)}
        style={{ fontSize: 12, height: 24, padding: '0 8px' }}
      >
        {t('search.layout.backgroundReset')}
      </button>
    </div>
  )
}

/** The layout choices, as radios; lives in the network settings panel. */
export function LayoutOptions() {
  const t = useText()
  const selectedLayout = useSearchStore((s) => s.selectedLayout)
  const setLayout = useSearchStore((s) => s.setLayout)
  return (
    <>
      {LAYOUT_OPTIONS.map(({ value, textKey }) => (
        <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer', marginBottom: 5 }}>
          <input
            type="radio"
            name="layoutOption"
            value={value}
            checked={selectedLayout === value}
            onChange={() => setLayout(value)}
            style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
          />
          <LayoutIcon value={value} />
          {t(textKey)}
        </label>
      ))}
    </>
  )
}
