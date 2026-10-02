import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGeneAutocomplete } from '../../components/useGeneAutocomplete'
import { useAutoGrow } from '../../components/useAutoGrow'
import { GeneSuggestionList } from '../../components/GeneSuggestionList'
import { useSearchStore } from './searchStore'
import { useSettings } from '../../api/settings'
import { useText } from '../../text'
import { exampleTypeLabel, toFilterMode } from '../../lib/exampleType'

interface QueryPanelProps {
  term: string
  /**
   * Namespaces the autocomplete's option ids. Two panels can be on screen at
   * once — the sidebar's and the one the empty canvas offers — and duplicate
   * ids would point aria-activedescendant at the wrong list.
   */
  idPrefix?: string
}

/**
 * The query box and this deployment's worked examples. Lives in the sidebar,
 * behind the ribbon's Query button, and in the middle of an empty results
 * page, which is the one place a visitor has nothing else to act on.
 */
export function QueryPanel({ term, idPrefix = 'sidebar-gene' }: QueryPanelProps) {
  const navigate = useNavigate()
  const t = useText()
  const [localQuery, setLocalQuery] = useState(term)
  const ac = useGeneAutocomplete(localQuery, setLocalQuery, idPrefix)
  const boxRef = useAutoGrow(localQuery)
  const setFilterMode = useSearchStore((s) => s.setFilterMode)

  const { data: settings } = useSettings()
  const searchExamples = [
    { proteins: settings?.example1, type: settings?.example1Type },
    { proteins: settings?.example2, type: settings?.example2Type },
    { proteins: settings?.example3, type: settings?.example3Type },
  ].filter((ex) => ex.proteins?.trim())

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = localQuery.trim()
    if (q) navigate(`/search/${encodeURIComponent(q)}`)
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div style={{ position: 'relative' }}>
          <textarea
            ref={boxRef}
            className="op-input"
            rows={2}
            value={localQuery}
            {...ac.inputProps}
            onKeyDown={(e) => {
              ac.inputProps.onKeyDown(e)
              // Enter searches, as it did when this was one line; a newline
              // still separates genes, so shift-enter keeps that available.
              if (e.key === 'Enter' && !e.shiftKey && !e.defaultPrevented) handleSubmit(e)
            }}
            placeholder={t('search.sidebar.queryPlaceholder')}
            style={{
              paddingLeft: 32,
              fontFamily: 'var(--mono)',
              fontSize: 13,
              lineHeight: 1.5,
              resize: 'none',
              overflowY: 'auto',
              display: 'block',
            }}
          />
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-muted)" strokeWidth="2"
            style={{ position: 'absolute', left: 11, top: 13, pointerEvents: 'none' }}
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          {ac.showList && (
            <GeneSuggestionList
              idPrefix={idPrefix}
              suggestions={ac.suggestions}
              activeIndex={ac.activeIndex}
              setActiveIndex={ac.setActiveIndex}
              onSelect={ac.selectSuggestion}
            />
          )}
        </div>
        <button
          type="submit"
          className="op-btn primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: 8, fontSize: 13, padding: '8px' }}
        >
          {t('search.sidebar.searchButton')}
        </button>
      </form>

      {searchExamples.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)', opacity: 0.55, textTransform: 'uppercase', paddingBottom: 2 }}>
            {t('search.sidebar.examples')}
          </span>
          {searchExamples.map((ex, i) => {
            const genes = (ex.proteins ?? '').split('\n').map((g) => g.trim()).filter(Boolean)
            const preview = genes.slice(0, 2).join(', ') + (genes.length > 2 ? '…' : '')
            const query = genes.join(',')
            const typeLabel = exampleTypeLabel(ex.type)
            return (
              <button
                key={i}
                onClick={() => {
                  setFilterMode(toFilterMode(ex.type))
                  navigate(`/search/${encodeURIComponent(query)}`)
                }}
                className="op-chip"
                style={{
                  cursor: 'pointer',
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={genes.join(', ')}
              >
                {preview} · {typeLabel}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
