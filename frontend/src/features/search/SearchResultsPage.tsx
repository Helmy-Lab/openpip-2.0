import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useSearch } from '../../api/search'
import { useSettings } from '../../api/settings'
import { useSearchStore, type ViewState } from './searchStore'
import { filterProteinsAndInteractions } from './filterInteractions'
import { CytoscapeNetwork } from './network/CytoscapeNetwork'
import { ResultTablePanel } from './tables/ResultTablePanel'
import { OverlaySystem } from './modals/OverlaySystem'
import { SearchSidebar } from './SearchSidebar'
import { QueryPanel } from './QueryPanel'
import { NodeInfoPanel } from './NodeInfoPanel'
import { EdgeInfoPanel } from './EdgeInfoPanel'
import type { Protein, Interaction } from '../../types/api'
import type { SearchResult } from '../../types/search'
import { useText } from '../../text'
import { CONTROL_BG } from './toolbar/LayoutDropdown'

const ARROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  background: 'none',
  border: 'none',
  padding: '0 4px',
  cursor: 'pointer',
  color: 'var(--text-soft)',
}

const MIN_NETWORK_H = 150
const MAX_NETWORK_H = window.innerHeight - 56 - 120
const DEFAULT_NETWORK_H = 500
/** How far the handle may move before a mouse-up counts as a drag, not a click. */
const DRAG_SLOP = 4

const clampHeight = (h: number) => Math.min(MAX_NETWORK_H, Math.max(MIN_NETWORK_H, h))
const screenFraction = (f: number) => clampHeight(Math.round(window.innerHeight * f))

interface SearchResultsPageProps {
  /** Overrides the route parameter, for a network opened from a shared view. */
  term?: string
  /** Filters and layout to restore once the results land. */
  viewState?: Partial<ViewState>
  /** Rendered above the results — who shared this, and their note. */
  banner?: React.ReactNode
  /** Results already in hand — a saved snapshot — so no live search runs. */
  result?: SearchResult
}

export function SearchResultsPage({ term: termProp, viewState, banner, result }: SearchResultsPageProps = {}) {
  const { term: routeTerm = '' } = useParams<{ term: string }>()
  const term = termProp ?? routeTerm
  const t = useText()
  const [networkHeight, setNetworkHeight] = useState(DEFAULT_NETWORK_H)
  const networkRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedProtein, setSelectedProtein] = useState<Protein | null>(null)
  const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null)
  // Removed nodes are scoped to the current search term - automatically clears on new search
  const [removed, setRemoved] = useState<{ term: string; ids: number[] }>({ term: '', ids: [] })
  const removedProteinIds = removed.term === term ? removed.ids : []
  const handleNodeClick = useCallback((p: Protein) => {
    setSelectedProtein(p)
    setSelectedInteraction(null)
  }, [])
  const handleEdgeClick = useCallback((ix: Interaction) => {
    setSelectedInteraction(ix)
    setSelectedProtein(null)
  }, [])
  const handleRemoveNode = useCallback((id: number) => {
    setRemoved((prev) => ({ term, ids: [...(prev.term === term ? prev.ids : []), id] }))
    setSelectedProtein(null)
  }, [term])

  // The grip both drags and clicks: a mouse-up that never moved is a click, and
  // a click resets to the default height.
  function startDrag(e: React.MouseEvent) {
    e.preventDefault()
    const startY = e.clientY
    const startH = networkHeight
    let dragged = false

    const onMove = (ev: MouseEvent) => {
      if (Math.abs(ev.clientY - startY) > DRAG_SLOP) dragged = true
      setNetworkHeight(clampHeight(startH + ev.clientY - startY))
    }
    const onUp = () => {
      if (!dragged) setNetworkHeight(DEFAULT_NETWORK_H)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // Fullscreen is the browser's, so Esc and F11 stay in charge of leaving it —
  // the flag only follows what actually happened.
  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === networkRef.current)
      // Cytoscape sizes its canvas once; the new box has to be announced.
      useSearchStore.getState().networkCy?.resize()
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else networkRef.current?.requestFullscreen?.()
  }
  const { data: settings } = useSettings()
  // Sidebar down the left, or a ribbon under the navbar — the deployment's
  // choice, set in Admin → Settings → Search.
  const ribbon = settings?.horizontalFilterBar === true
  const search = useSearch(term, !result)
  const data = result ?? search.data
  const isLoading = !result && search.isLoading
  const isError = !result && search.isError

  const {
    setSearchData,
    allProteins,
    allInteractions,
    queryProteinIds,
    selectedLayout,
    scoreFilter,
    categoryFilter,
    annotationFilter,
    filterMode,
    tissueFilter,
    unfoundSummary,
    applyViewState,
    clearSearchData,
  } = useSearchStore()

  // Back on a bare /search, the last term's results must not linger in the
  // tables under the blank canvas.
  useEffect(() => {
    if (!term) clearSearchData()
  }, [term, clearSearchData])

  useEffect(() => {
    if (!data) return
    setSearchData(data)
    // After, not before: setSearchData rebuilds the category filter and clears
    // the highlight, which would undo a restored view.
    if (viewState) applyViewState(viewState)
  }, [data, setSearchData, viewState, applyViewState])

const { proteins: filteredProteins, interactions } = filterProteinsAndInteractions(
    allProteins,
    allInteractions,
    { scoreFilter, categoryFilter, annotationFilter, filterMode, tissueFilter },
    queryProteinIds
  )
  const proteins = removedProteinIds.length
    ? filteredProteins.filter((p) => !removedProteinIds.includes(p.protein_id))
    : filteredProteins

  const visibleInteractionIds = interactions.map((ix) => ix.interaction_id)

  const renderMain = () => {
    // Nothing searched yet: the canvas carries the query box itself rather
    // than pointing at one somewhere else on the page.
    const emptyPrompt = (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 400,
          gap: 18,
          padding: 48,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>
              Search for a protein to see its interaction network.
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              Enter a gene symbol or UniProt ID, or start from an example.
            </div>
          </div>
          <div style={{
            width: '100%',
            maxWidth: 340,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 18,
            boxShadow: 'var(--shadow-md)',
          }}>
            <QueryPanel term="" idPrefix="canvas-gene" />
          </div>
        </div>
    )
    if (term && isLoading) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 400,
          gap: 20,
        }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            border: '2px solid var(--border)',
            borderTopColor: 'var(--primary)',
            animation: 'spin .8s linear infinite',
          }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
              {term}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Querying interactome...
            </div>
          </div>
        </div>
      )
    }

    if (term && isError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 400,
          gap: 6,
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('search.error.unreachable')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{t('search.error.retry')}</div>
        </div>
      )
    }

    if (!isLoading && allProteins.length === 0 && term) {
      const names = unfoundSummary ? unfoundSummary.split('<br>').filter(Boolean) : [term]
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 400,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '14px 18px',
            borderRadius: 16,
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            maxWidth: 480,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" style={{ flexShrink: 0 }} aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
              <path d="M11 8v3M11 14h.01" />
            </svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#be123c', marginBottom: 4 }}>
                Not found: {names.join(', ')}
              </div>
              <div style={{ fontSize: 11, color: '#9f1239' }}>
                Check the spelling or try a UniProt ID.
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <>
        {/* Network - blank, with the query box in it, until something is searched */}
        <div ref={networkRef} style={{ position: 'relative', flexShrink: 0, background: 'var(--bg)' }}>
          {!term ? (
            <div style={{ height: networkHeight, overflowY: 'auto' }}>{emptyPrompt}</div>
          ) : (
          <>
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? t('search.fullscreenExit') : t('search.fullscreen')}
            aria-label={isFullscreen ? t('search.fullscreenExit') : t('search.fullscreen')}
            className="op-btn"
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              // Above the info panels, which share this corner.
              zIndex: 20,
              height: 30,
              padding: '0 7px',
              lineHeight: 0,
              background: CONTROL_BG,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {isFullscreen ? (
                <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
              ) : (
                <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
              )}
            </svg>
          </button>
          <CytoscapeNetwork
            proteins={proteins}
            interactions={interactions}
            queryProteinIds={queryProteinIds}
            layout={selectedLayout}
            height={isFullscreen ? window.innerHeight : networkHeight}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            showFilters={!ribbon}
          />
          {selectedProtein && (
            <NodeInfoPanel
              key={selectedProtein.protein_id}
              protein={selectedProtein}
              networkInteractions={interactions}
              searchTerm={term}
              onClose={() => setSelectedProtein(null)}
              onRemove={handleRemoveNode}
            />
          )}
          {selectedInteraction && (
            <EdgeInfoPanel
              key={selectedInteraction.interaction_id}
              interaction={selectedInteraction}
              onClose={() => setSelectedInteraction(null)}
            />
          )}
          </>
          )}
        </div>

        {/* Resize bar. The arrows point the way the divider travels: up shrinks
            the canvas to a fifth of the screen, down grows it to three quarters. */}
        <div
          style={{
            height: 14,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: 'var(--surface)',
            borderTop: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            userSelect: 'none',
          }}
        >
          <button
            type="button"
            onClick={() => setNetworkHeight(screenFraction(0.2))}
            title={t('search.resizeShort')}
            aria-label={t('search.resizeShort')}
            style={ARROW_STYLE}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
              <path d="m6 15 6-6 6 6" />
            </svg>
          </button>

          <div
            onMouseDown={startDrag}
            role="separator"
            aria-orientation="horizontal"
            title={t('search.resizeHint')}
            style={{ cursor: 'row-resize', display: 'flex', alignItems: 'center', padding: '0 4px' }}
          >
            <svg width="20" height="6" viewBox="0 0 20 6" fill="none" aria-hidden="true">
              <circle cx="4"  cy="3" r="1.5" fill="var(--text-soft)" />
              <circle cx="10" cy="3" r="1.5" fill="var(--text-soft)" />
              <circle cx="16" cy="3" r="1.5" fill="var(--text-soft)" />
            </svg>
          </div>

          <button
            type="button"
            onClick={() => setNetworkHeight(screenFraction(0.75))}
            title={t('search.resizeTall')}
            aria-label={t('search.resizeTall')}
            style={ARROW_STYLE}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>

        {/* Tables */}
        <ResultTablePanel selectedProtein={selectedProtein} />

        {/* Modals */}
        {term && <OverlaySystem />}
      </>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: ribbon ? 'column' : 'row',
      height: 'calc(100vh - 56px)',
    }}>
      {/* Controls - down the left, or in a row above the results */}
      <SearchSidebar
        key={term}
        term={term}
        visibleInteractionIds={visibleInteractionIds}
        variant={ribbon ? 'ribbon' : 'sidebar'}
      />

      {/* Main - scrolls vertically */}
      {/* Main is a fixed column: network on top at whatever height was set,
          results underneath with their own scrollbar. Nothing scrolls the
          canvas out of view because the page itself does not scroll. */}
      <main style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {banner}
        {renderMain()}
      </main>
    </div>
  )
}
