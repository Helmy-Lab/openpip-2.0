import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { StatsCounter } from './StatsCounter'
import { MiniNetworkGraph } from './MiniNetworkGraph'
import { useSettings } from '../../api/settings'
import {
  useGeneAutocomplete,
  useTokenAutocomplete,
} from '../../components/useGeneAutocomplete'
import { GeneSuggestionList } from '../../components/GeneSuggestionList'
import { useAutoGrow } from '../../components/useAutoGrow'
import { useSearchStore } from '../search/searchStore'
import { useText } from '../../text'
import { exampleTypeLabel, toFilterMode } from '../../lib/exampleType'
import { looksLikeGeneList, parseNaturalQuery } from '../../lib/naturalQuery'
import { searchTissues } from '../../lib/tissues'

interface HeroSectionProps {
  shortTitle: string
  proteins: number
  interactions: number
  datasets: number
}

export function HeroSection({ shortTitle, proteins, interactions, datasets }: HeroSectionProps) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { data: settings } = useSettings()
  const setFilterMode = useSearchStore((s) => s.setFilterMode)
  const setScoreFilter = useSearchStore((s) => s.setScoreFilter)
  const setTissueFilter = useSearchStore((s) => s.setTissueFilter)
  const clearTissueFilter = useSearchStore((s) => s.clearTissueFilter)
  const t = useText()

  // Only a gene list gets gene suggestions. Once the input becomes a phrase,
  // completing "liver" as though it were a gene is noise — the phrase needs
  // tissue names instead. Both hooks run unconditionally (hooks must), and only
  // the relevant list is rendered.
  const isGeneList = looksLikeGeneList(query)
  const parsed = isGeneList
    ? null
    : parseNaturalQuery(query, {
        tissuesEnabled: settings?.showTissueExpression !== false,
      })

  const geneAc = useGeneAutocomplete(query, setQuery, 'hero-gene')
  const lastWord = query.split(/\s+/).pop() ?? ''
  const tissueAc = useTokenAutocomplete(query, setQuery, 'hero-gene', {
    suggestions:
      isGeneList || settings?.showTissueExpression === false
        ? []
        : searchTissues(lastWord),
    separator: ' ',
    joiner: ' ',
  })
  const ac = isGeneList ? geneAc : tissueAc
  const boxRef = useAutoGrow(query)

  const searchExamples = [
    { proteins: settings?.example1, type: settings?.example1Type },
    { proteins: settings?.example2, type: settings?.example2Type },
    { proteins: settings?.example3, type: settings?.example3Type },
  ].filter((ex) => ex.proteins?.trim())

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const term = query.trim()
    if (!term) return

    if (!parsed) {
      navigate(`/search/${encodeURIComponent(term)}`)
      return
    }
    if (!parsed.term) return

    // Filters are applied to the store the sidebar reads, so the results page
    // shows exactly what was understood and the user can switch any of it off.
    clearTissueFilter()
    parsed.tissues.forEach((tissue) => setTissueFilter(tissue, true))
    setScoreFilter(parsed.minScore ?? 0)
    navigate(`/search/${encodeURIComponent(parsed.term)}`)
  }

  return (
    <section style={{ background: 'var(--bg)', padding: '64px 80px 48px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 1fr',
          gap: 64,
          alignItems: 'center',
          maxWidth: 1280,
          margin: '0 auto',
        }}
      >
        {/* Left: copy + search */}
        <div className="animate-fade-up">
          <div className="op-chip primary" style={{ marginBottom: 20 }}>
            ●&nbsp;<span>{shortTitle || 'openPIP'}</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(36px, 4vw, 56px)',
              lineHeight: 1.05,
              letterSpacing: '-.03em',
              margin: '0 0 20px',
              fontWeight: 600,
              color: 'var(--text)',
            }}
            dangerouslySetInnerHTML={{ __html: t('home.hero.headline') }}
          />

          <p
            style={{
              fontSize: 17,
              color: 'var(--text-muted)',
              lineHeight: 1.55,
              margin: '0 0 28px',
              maxWidth: 540,
            }}
          >
            {t('home.hero.subhead')}
          </p>

          <form onSubmit={handleSearch} style={{ display: 'flex', marginBottom: 36 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <textarea
                ref={boxRef}
                rows={1}
                value={query}
                {...ac.inputProps}
                onKeyDown={(e) => {
                  ac.inputProps.onKeyDown(e)
                  // Enter searches, as it did when this was one line; a newline
                  // still separates genes, so shift-enter keeps that available.
                  if (e.key === 'Enter' && !e.shiftKey && !e.defaultPrevented) handleSearch(e)
                }}
                placeholder={t('home.hero.searchPlaceholder')}
                className="op-input"
                style={{
                  borderRadius: '8px 0 0 8px',
                  borderRight: 'none',
                  width: '100%',
                  lineHeight: 1.5,
                  resize: 'none',
                  overflowY: 'auto',
                  display: 'block',
                }}
                aria-label={t('home.hero.searchLabel')}
              />
              {ac.showList && (
                <GeneSuggestionList
                  idPrefix="hero-gene"
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
              style={{
                borderRadius: '0 8px 8px 0',
                whiteSpace: 'nowrap',
                padding: '9px 22px',
                fontSize: 14,
              }}
            >
              {t('home.hero.searchButton')}
            </button>
          </form>

          {/* What the phrase was understood to mean, shown before the user
              commits to it rather than after. A wrong reading is visible here
              and again as sidebar filters on the results page. */}
          {parsed && parsed.term && (
            <div
              style={{
                marginTop: -22,
                marginBottom: 26,
                fontSize: 13,
                color: 'var(--text-muted)',
                lineHeight: 1.6,
              }}
              aria-live="polite"
            >
              <span>
                {t('home.hero.willSearch')}{' '}
                <strong style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>
                  {parsed.term}
                </strong>
              </span>
              {parsed.applied.map((what) => (
                <span key={what}> · {what}</span>
              ))}
              {parsed.ignored.length > 0 && (
                <div style={{ color: 'var(--warning, var(--text-soft))', marginTop: 4 }}>
                  {t('home.hero.cannotFilter')} {parsed.ignored.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Phrase examples sit beside the admin-configured gene examples so the
              capability is discoverable by clicking, not by guessing. Clicking
              fills the box rather than searching, so the preview above explains
              what will happen before anything is committed. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
              {t('searchExamples.label')}
            </span>
            {[t('searchExamples.phrase1'), t('searchExamples.phrase2'), t('searchExamples.phrase3')]
              .filter(Boolean)
              .map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => setQuery(phrase)}
                  style={{
                    cursor: 'pointer',
                    fontSize: 13,
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: '1px dashed var(--border-strong)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                  }}
                >
                  {phrase}
                </button>
              ))}
          </div>

          {searchExamples.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', letterSpacing: '.04em', textTransform: 'uppercase' }}>{t('home.hero.examplesLabel')}</span>
              {searchExamples.map((ex, i) => {
                const genes = (ex.proteins ?? '').split('\n').map((g) => g.trim()).filter(Boolean)
                const preview = genes.slice(0, 2).join(', ') + (genes.length > 2 ? '…' : '')
                const query = genes.join(',')
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setFilterMode(toFilterMode(ex.type))
                      navigate(`/search/${encodeURIComponent(query)}`)
                    }}
                    style={{
                      cursor: 'pointer',
                      fontFamily: 'var(--mono)',
                      fontSize: 13,
                      fontWeight: 500,
                      padding: '6px 14px',
                      borderRadius: 8,
                      border: '1.5px solid var(--border-strong)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      transition: 'border-color .15s, background .15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)'
                      e.currentTarget.style.background = 'var(--primary-soft)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-strong)'
                      e.currentTarget.style.background = 'var(--surface)'
                    }}
                  >
                    {preview}
                    <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font)' }}>
                      {/* Legacy rows spell the unfiltered case as "all" or
                          leave it null; the filter is called none everywhere
                          else in the UI, so the chip says none too. */}
                      {exampleTypeLabel(ex.type)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <StatsCounter proteins={proteins} interactions={interactions} datasets={datasets} />
        </div>

        {/* Right: example network */}
        <div>
          <div
            className="op-card"
            style={{ padding: 20, boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}
          >
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <MiniNetworkGraph />
          </div>
        </div>
      </div>
    </section>
  )
}
