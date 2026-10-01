import { useSearchStore } from '../searchStore'
import { useText } from '../../../text'
import { CanvasDropdown } from './CanvasDropdown'

const FILTER_MODE_OPTIONS: { textKey: string; value: 'None' | 'query_query' | 'query_interactor' }[] = [
  { textKey: 'search.filterMode.none', value: 'None' },
  { textKey: 'search.filterMode.queryQuery', value: 'query_query' },
  { textKey: 'search.filterMode.queryInteractor', value: 'query_interactor' },
]

const SECTION: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-soft)',
  textTransform: 'uppercase',
  letterSpacing: '.07em',
  marginBottom: 8,
}

const ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  color: 'var(--text)',
  cursor: 'pointer',
  marginBottom: 5,
}

/**
 * Filter mode and sources over the canvas — the same two controls the sidebar
 * carries, reachable in fullscreen where the sidebar is not.
 */
export function FilterDropdown() {
  const t = useText()
  const categoryFilter = useSearchStore((s) => s.categoryFilter)
  const filterMode = useSearchStore((s) => s.filterMode)
  const setCategoryFilter = useSearchStore((s) => s.setCategoryFilter)
  const setFilterMode = useSearchStore((s) => s.setFilterMode)

  return (
    <CanvasDropdown label={t('search.filter')}>
      <div style={SECTION}>{t('search.sidebar.filterMode')}</div>
      {FILTER_MODE_OPTIONS.map(({ textKey, value }) => (
        <label key={value} style={ROW}>
          <input
            type="radio"
            name="canvasFilterMode"
            value={value}
            checked={filterMode === value}
            onChange={() => setFilterMode(value)}
            style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
          />
          {t(textKey)}
        </label>
      ))}
      {Object.keys(categoryFilter).length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={SECTION}>{t('search.sidebar.sources')}</div>
          {Object.entries(categoryFilter).map(([name, checked]) => (
            <label key={name} style={ROW}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setCategoryFilter(name, e.target.checked)}
                style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              {name}
            </label>
          ))}
        </div>
      )}
    </CanvasDropdown>
  )
}
