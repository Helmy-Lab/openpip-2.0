import { useSettings } from '../../../api/settings'
import type { AdminSettings } from '../../../types/api'
import { useText } from '../../../text'
import { useCanvasStyleStore, type CanvasColor } from '../network/canvasBackground'
import { CanvasDropdown } from './CanvasDropdown'
import { CanvasBackgroundPicker, LayoutOptions } from './LayoutDropdown'

const HEADING: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-soft)',
  margin: '12px 0 6px',
}

const ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  fontSize: 13,
  color: 'var(--text)',
  marginBottom: 5,
}

const COLORS: { key: CanvasColor; textKey: string; setting: keyof AdminSettings; fallback: string }[] = [
  { key: 'queryNode', textKey: 'search.style.queryNode', setting: 'queryNodeColor', fallback: '#e11d48' },
  { key: 'interactorNode', textKey: 'search.style.interactorNode', setting: 'interactorNodeColor', fallback: '#2563eb' },
  { key: 'published', textKey: 'search.style.published', setting: 'publishedEdgeColor', fallback: '#38761d' },
  { key: 'validated', textKey: 'search.style.validated', setting: 'validatedEdgeColor', fallback: '#1155cc' },
  { key: 'verified', textKey: 'search.style.verified', setting: 'verifiedEdgeColor', fallback: '#cc0000' },
  { key: 'literature', textKey: 'search.style.literature', setting: 'literatureEdgeColor', fallback: '#0ea5e9' },
]

/**
 * The network colours a viewer can change for themselves: background, node
 * and edge colours. Kept in this browser; the
 * admin's colours in Settings → Search are where each one starts.
 */
function CanvasStylePanel() {
  const t = useText()
  const { data: settings } = useSettings()
  const style = useCanvasStyleStore((s) => s.style)
  const setStyle = useCanvasStyleStore((s) => s.setStyle)

  const colorRow = ({ key, textKey, setting, fallback }: (typeof COLORS)[number]) => (
    <label key={key} style={ROW}>
      {t(textKey)}
      <input
        type="color"
        value={style[key] ?? (settings?.[setting] as string | undefined) ?? fallback}
        onChange={(e) => setStyle({ [key]: e.target.value })}
        style={{ width: 32, height: 22, padding: 0, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
      />
    </label>
  )

  return (
    <div>
      <div style={{ ...HEADING, marginTop: 0 }}>{t('search.layout.background')}</div>
      <CanvasBackgroundPicker />

      <div style={HEADING}>{t('search.style.nodes')}</div>
      {COLORS.slice(0, 2).map(colorRow)}

      <div style={HEADING}>{t('search.style.edges')}</div>
      {COLORS.slice(2).map(colorRow)}

      <button
        type="button"
        className="op-btn"
        onClick={() => setStyle(null)}
        style={{ fontSize: 12, height: 24, padding: '0 8px', marginTop: 8 }}
      >
        {t('search.style.reset')}
      </button>
    </div>
  )
}

function GearIcon() {
  return (
    <svg className="op-gear" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

/** Layout and style behind one gear over the canvas, beside Cytoscape. */
export function SettingsDropdown() {
  const t = useText()
  return (
    <CanvasDropdown label={t('search.networkSettings')} icon={<GearIcon />} width={460}>
      {/* Side by side, split by a rule, so the panel stays short over the canvas. */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...HEADING, marginTop: 0 }}>{t('search.sidebar.layout')}</div>
          <LayoutOptions />
        </div>
        <div style={{ borderLeft: '1px solid var(--border)' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <CanvasStylePanel />
        </div>
      </div>
    </CanvasDropdown>
  )
}
