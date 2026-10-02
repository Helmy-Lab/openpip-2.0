import { useState, type CSSProperties } from 'react'
import { buildLinks, LINK_ICON_STYLE } from './externalLinks'
import { CanvasDropdown, RibbonHeading } from './toolbar/CanvasDropdown'
import { QueryPanel } from './QueryPanel'
import { useSearchStore, captureViewState } from './searchStore'
import { ShareDialog } from '../sharing/ShareDialog'
import { useAuthStore } from '../../store/authStore'
import { useSettings } from '../../api/settings'
import { useSaveNetwork } from '../../api/networks'
import { useText } from '../../text'
import { tissueLabel, tissuesThatFit } from '../../lib/tissues'
import { tissuesWithData } from './filterInteractions'
import {
  formatSIF,
  formatInteractionsCSV,
  formatInteractorsCSV,
  formatFASTA,
  formatPSIMI,
  buildFilename,
  downloadFile,
  downloadImageFile,
} from '../../lib/download'
import { useCanvasBackground } from './network/canvasBackground'

// The saved network's name column (interaction_network.name) is 100 chars.
const NAME_MAX = 100


const CATEGORY_COLORS: Record<string, string> = {
  Published: 'var(--hi-union)',
  Validated: 'var(--huri-lit)',
  Verified: 'var(--color-edge-verified)',
  Literature: 'var(--literature)',
}

const FILTER_MODE_OPTIONS: { textKey: string; value: 'None' | 'query_query' | 'query_interactor' }[] = [
  { textKey: 'search.filterMode.none', value: 'None' },
  { textKey: 'search.filterMode.queryQuery', value: 'query_query' },
  { textKey: 'search.filterMode.queryInteractor', value: 'query_interactor' },
]

type Variant = 'sidebar' | 'ribbon'

interface SearchSidebarProps {
  term: string
  visibleInteractionIds: number[]
  /** Proteins left after filters and removals; omitted means all of them. */
  visibleProteinIds?: number[]
  /**
   * Where the controls live. 'sidebar' stacks them down the left; 'ribbon'
   * puts each behind a button in a row under the navbar. Same controls either
   * way — the deployment picks the shape in Admin → Settings → Search.
   */
  variant?: Variant
}

// Section headings carry the deployment's theme colour, so the sidebar reads
// as one thing rather than a stack of grey labels.
const sectionLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--primary)',
  textTransform: 'uppercase',
  letterSpacing: '.08em',
  display: 'block',
  marginBottom: 8,
}

function SidebarAccordion({ label, children, defaultOpen = true }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          ...sectionLabelStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          marginBottom: 0,
          background: 'none',
          border: 'none',
          padding: '4px 0',
          cursor: 'pointer',
        }}
      >
        <span>{label}</span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div style={{ paddingTop: 6, paddingBottom: 4 }}>
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * One labelled group of controls, drawn the way this deployment asks for:
 * stacked under a heading (or an accordion) in the sidebar, or behind a
 * dropdown button in the ribbon.
 */
function Section({ variant, label, collapsible = false, defaultOpen = true, width, children }: {
  variant: Variant
  label: string
  collapsible?: boolean
  defaultOpen?: boolean
  width?: number
  children: React.ReactNode
}) {
  if (variant === 'ribbon') {
    return (
      <CanvasDropdown label={label} up={false} plain width={width}>
        {children}
      </CanvasDropdown>
    )
  }
  if (collapsible) {
    return (
      <SidebarAccordion label={label} defaultOpen={defaultOpen}>
        {children}
      </SidebarAccordion>
    )
  }
  return (
    <div>
      <label style={sectionLabelStyle}>{label}</label>
      {children}
    </div>
  )
}

export function SearchSidebar({
  term,
  visibleInteractionIds,
  visibleProteinIds,
  variant = 'sidebar',
}: SearchSidebarProps) {
  const t = useText()

  const scoreFilter = useSearchStore((s) => s.scoreFilter)
  const categoryFilter = useSearchStore((s) => s.categoryFilter)
  const filterMode = useSearchStore((s) => s.filterMode)
  const allProteins = useSearchStore((s) => s.allProteins)
  const queryProteinIds = useSearchStore((s) => s.queryProteinIds)
  const networkCy = useSearchStore((s) => s.networkCy)
  // The canvas's own colour when one is set; white when it follows the theme.
  const canvasBackground = useCanvasBackground() ?? undefined
  const allInteractions = useSearchStore((s) => s.allInteractions)
  const foundSummary = useSearchStore((s) => s.foundSummary)
  const unfoundSummary = useSearchStore((s) => s.unfoundSummary)
  const setScoreFilter = useSearchStore((s) => s.setScoreFilter)
  const setCategoryFilter = useSearchStore((s) => s.setCategoryFilter)
  const tissueFilter = useSearchStore((s) => s.tissueFilter)
  const setFilterMode = useSearchStore((s) => s.setFilterMode)
  const setTissueFilter = useSearchStore((s) => s.setTissueFilter)
  const clearTissueFilter = useSearchStore((s) => s.clearTissueFilter)
  const tissueNodeSize = useSearchStore((s) => s.tissueNodeSize)
  const tissueNodeColor = useSearchStore((s) => s.tissueNodeColor)
  const setTissueDisplay = useSearchStore((s) => s.setTissueDisplay)
  const setModal = useSearchStore((s) => s.setModal)

  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const { data: settings } = useSettings()

  const { mutateAsync: saveNetwork, isPending: isSaving } = useSaveNetwork()
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState(term.slice(0, NAME_MAX))
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  // Sharing is its own action: it never touches the saved networks above, and
  // it keeps the filters and layout rather than the interaction list.
  const [shareOpen, setShareOpen] = useState(false)

  async function handleSaveNetwork() {
    setSaveError('')
    if (!saveName.trim()) {
      setSaveError(t('search.save.nameRequired'))
      return
    }
    try {
      const activeCategories = Object.entries(categoryFilter)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(',')
      await saveNetwork({
        name: saveName.trim(),
        query: term,
        score_parameter: scoreFilter.toFixed(2),
        category_array: activeCategories,
        // Legacy's 100-character column. Only the filter shown on reopening is
        // affected if tissues are dropped to fit: the saved interactions are
        // stored exactly either way.
        tissue_expression_array: tissuesThatFit(tissueFilter),
        interaction_ids: visibleInteractionIds,
      })
      setSaveSuccess(true)
      setTimeout(() => {
        setSaveOpen(false)
        setSaveName(term.slice(0, NAME_MAX))
        setSaveSuccess(false)
      }, 1500)
    } catch {
      setSaveError(t('search.save.failed'))
    }
  }

  function handleDownload(content: string, format: string, ext: string) {
    downloadFile(buildFilename(format, ext), content)
  }

  const hasCategories = Object.keys(categoryFilter).length > 0

  // Offer only tissues these results can actually be filtered by. Anything
  // already ticked stays listed even when a new search has nothing for it, so
  // the list never disagrees with the filter that is still applied.
  // Hidden when the deployment says its organism has no tissues — offering a
  // filter for data whose tab is switched off would be a dead control.
  const showTissue = settings?.showTissueExpression !== false
  const tissueOptions = [
    ...new Set([...tissuesWithData(allProteins), ...tissueFilter]),
  ].sort((a, b) => tissueLabel(a).localeCompare(tissueLabel(b)))

  // Downloads hold what is on screen, as legacy's did: its export endpoint
  // applied the category, filter-mode and score settings. An interaction is
  // kept only while both its proteins are, so removed nodes take their edges.
  const shownProteinIds = new Set(visibleProteinIds ?? allProteins.map((p) => p.protein_id))
  const shownInteractionIds = new Set(visibleInteractionIds)
  const shownProteins = allProteins.filter((p) => shownProteinIds.has(p.protein_id))
  const shownInteractions = allInteractions.filter(
    (i) =>
      shownInteractionIds.has(i.interaction_id) &&
      shownProteinIds.has(i.interactor_A.protein_id) &&
      shownProteinIds.has(i.interactor_B.protein_id)
  )

  const downloadActions: { label: string; onClick: () => void }[] = [
    { label: t('search.download.sif'), onClick: () => handleDownload(formatSIF(shownInteractions, shownProteins), 'SIF', 'sif') },
    // Query ids tell each row which side was searched for; without them every
    // interaction was labelled non_query.
    { label: t('search.download.interactionsCsv'), onClick: () => handleDownload(formatInteractionsCSV(shownInteractions, shownProteins, new Set(queryProteinIds)), 'Interactions', 'csv') },
    { label: t('search.download.interactorsCsv'), onClick: () => handleDownload(formatInteractorsCSV(shownProteins), 'Interactors', 'csv') },
    { label: t('search.download.fasta'), onClick: () => handleDownload(formatFASTA(shownProteins), 'FASTA', 'fasta') },
    { label: t('search.download.psimi'), onClick: () => handleDownload(formatPSIMI(shownInteractions, shownProteins), 'PSIMI', 'tsv') },
    { label: t('search.download.png'), onClick: () => networkCy && downloadImageFile(networkCy, 'png', canvasBackground) },
    { label: t('search.download.jpg'), onClick: () => networkCy && downloadImageFile(networkCy, 'jpg', canvasBackground) },
    { label: t('search.download.direct'), onClick: () => setModal('directDownload') },
  ]

  const querySection = (
    <Section variant={variant} label={t('search.sidebar.query')} width={288}>
      <QueryPanel term={term} />
    </Section>
  )

  const scoreBody = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={scoreFilter}
            onChange={(e) => setScoreFilter(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }}
          />
          <span className="op-num" style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>
            {scoreFilter.toFixed(2)}
          </span>
        </div>
  )

  const scoreSection = (
    <Section variant={variant} label={t('search.sidebar.score')} width={216}>
      {scoreBody}
    </Section>
  )

  /* Found / not found */
  const foundBlock = (foundSummary || unfoundSummary) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {foundSummary && (
            <div style={{ fontSize: 12, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 600, color: '#16a34a' }}>{t('search.sidebar.found')} </span>
              <span style={{ color: '#16a34a' }}>{foundSummary.split('<br>').join(', ')}</span>
            </div>
          )}
          {unfoundSummary && (
            <div style={{ fontSize: 12, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 600, color: '#e11d48' }}>{t('search.sidebar.notFound')} </span>
              <span style={{ color: '#e11d48' }}>{unfoundSummary.split('<br>').join(', ')}</span>
            </div>
          )}
        </div>
  )

  /* Network summary — next to the found/not-found lines it answers the
     same question: what did this search actually return? */
  const summarySection = term && (
    <Section variant={variant} label={t('search.sidebar.summary')} collapsible>
      {/* The ribbon has no column to list the found/not-found lines down, so
          they ride with the counts: same question, same panel. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            {variant === 'ribbon' && foundBlock}
            <div>
              <span style={{ fontWeight: 500, color: 'var(--text)' }}>{t('search.summary.proteins')} </span>
              <span style={{ color: 'var(--text-muted)' }}>{shownProteins.length}</span>
            </div>
            <div>
              <span style={{ fontWeight: 500, color: 'var(--text)' }}>{t('search.summary.interactions')} </span>
              <span style={{ color: 'var(--text-muted)' }}>{shownInteractions.length}</span>
            </div>
            <div>
              <span style={{ fontWeight: 500, color: 'var(--text)' }}>{t('search.summary.avgDegree')} </span>
              <span style={{ color: 'var(--text-muted)' }}>
                {shownProteins.length > 0
                  ? ((2 * shownInteractions.length) / shownProteins.length).toFixed(2)
                  : '-'}
              </span>
            </div>
          </div>
    </Section>
  )

  const sourcesBody = (
    <>
          {Object.entries(categoryFilter).map(([name, checked]) => (
            <label
              key={name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '6px 0',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text)',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setCategoryFilter(name, e.target.checked)}
                style={{ accentColor: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }}
              />
              <span style={{
                width: 12,
                height: 3,
                borderRadius: 2,
                background: CATEGORY_COLORS[name] ?? 'var(--text-muted)',
                flexShrink: 0,
              }} />
              {name}
            </label>
          ))}
    </>
  )

  const sourcesSection = hasCategories && (
    <Section variant={variant} label={t('search.sidebar.sources')}>
      {sourcesBody}
    </Section>
  )

  /* Tool sections - only shown once a search has been performed */
  const filterModeBody = (
    <>
            {FILTER_MODE_OPTIONS.map(({ textKey, value }) => (
              <label
                key={value}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13, cursor: 'pointer', color: 'var(--text)' }}
              >
                <input
                  type="radio"
                  name="sidebarFilterMode"
                  value={value}
                  checked={filterMode === value}
                  onChange={() => setFilterMode(value)}
                  style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                {t(textKey)}
              </label>
            ))}
    </>
  )

  const filterModeSection = term && (
    <Section variant={variant} label={t('search.sidebar.filterMode')} collapsible>
      {filterModeBody}
    </Section>
  )

  /* Tissue expression — several may be selected, and they AND together.
     Collapsed like the other tool sections; the count in the label keeps a
     live filter visible while the list is shut. */
  const tissueLabelText =
    tissueFilter.length > 0
      ? `${t('search.sidebar.tissue')} (${tissueFilter.length})`
      : t('search.sidebar.tissue')

  const tissueBody = (
            <div role="group" aria-label={t('search.sidebar.tissue')}>
            {tissueOptions.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-soft)', margin: '4px 0 0' }}>
                {t('search.sidebar.noTissueData')}
              </p>
            ) : (
              <>
                {/* Legacy's two node-styling switches; either one makes the
                    tissue list pick one tissue at a time. */}
                {([
                  ['tissueNodeSize', 'search.sidebar.tissueNodeSize'],
                  ['tissueNodeColor', 'search.sidebar.tissueNodeColor'],
                ] as const).map(([which, textKey]) => (
                  <label
                    key={which}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '3px 0', cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}
                  >
                    <input
                      type="checkbox"
                      checked={which === 'tissueNodeSize' ? tissueNodeSize : tissueNodeColor}
                      onChange={(e) => setTissueDisplay(which, e.target.checked)}
                      style={{ accentColor: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }}
                    />
                    {t(textKey)}
                  </label>
                ))}
                <div style={{ maxHeight: 168, overflowY: 'auto', paddingRight: 4, marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 4 }}>
                  {tissueOptions.map((key) => (
                    <label
                      key={key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        padding: '5px 0',
                        cursor: 'pointer',
                        fontSize: 13,
                        color: 'var(--text)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={tissueFilter.includes(key)}
                        onChange={(e) => setTissueFilter(key, e.target.checked)}
                        style={{ accentColor: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }}
                      />
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tissueLabel(key)}
                      </span>
                    </label>
                  ))}
                </div>
                {tissueFilter.length > 0 && (
                  <button
                    type="button"
                    onClick={clearTissueFilter}
                    className="op-btn"
                    style={{ marginTop: 8, fontSize: 12, padding: '4px 10px' }}
                  >
                    {t('search.sidebar.allTissues')}
                  </button>
                )}
              </>
            )}
            </div>
  )

  const tissueSection = term && showTissue && (
    <Section variant={variant} collapsible defaultOpen={false} label={tissueLabelText}>
      {tissueBody}
    </Section>
  )

  const downloadSection = term && (
    <Section variant={variant} label={t('search.sidebar.download')} collapsible defaultOpen={false}>
            {downloadActions.map(({ label, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  padding: '6px 4px',
                  fontSize: 13,
                  color: 'var(--text)',
                  cursor: 'pointer',
                  borderRadius: 4,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                {label}
              </button>
            ))}
    </Section>
  )

  const linksSection = term && (
    <Section variant={variant} label={t('search.sidebar.externalLinks')} collapsible defaultOpen={false}>
            {allProteins.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('search.sidebar.noProteins')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {buildLinks(allProteins, queryProteinIds, allInteractions).map((link) =>
                  link.href ? (
                    <a
                      key={link.id}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <img src={link.icon} alt="" style={LINK_ICON_STYLE} />
                      {link.label}
                    </a>
                  ) : (
                    <button
                      key={link.id}
                      type="button"
                      onClick={() => link.onClick?.()}
                      style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <img src={link.icon} alt="" style={LINK_ICON_STYLE} />
                      {link.label}
                    </button>
                  )
                )}
              </div>
            )}
    </Section>
  )

  // The name field and its buttons. In the sidebar they unfold under the Save
  // button; in the ribbon they sit straight inside the Save dropdown, which is
  // already a panel that opens and shuts on its own.
  const saveForm = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input
        className="op-input"
        value={saveName}
        maxLength={NAME_MAX}
        onChange={(e) => setSaveName(e.target.value)}
        placeholder={t('search.save.placeholder')}
        style={{ fontSize: 12 }}
        autoFocus
      />
      {saveError && (
        <div style={{ fontSize: 11, color: 'var(--warn)' }}>{saveError}</div>
      )}
      {saveSuccess && (
        <div style={{ fontSize: 11, color: 'var(--success, #22c55e)' }}>{t('search.save.success')}</div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        {variant === 'sidebar' && (
          <button
            type="button"
            onClick={() => { setSaveOpen(false); setSaveError(''); setSaveSuccess(false) }}
            className="op-btn"
            style={{ flex: 1, justifyContent: 'center', fontSize: 11, padding: '6px' }}
          >
            {t('search.save.cancel')}
          </button>
        )}
        <button
          type="button"
          onClick={handleSaveNetwork}
          disabled={isSaving || visibleInteractionIds.length === 0}
          className="op-btn primary"
          style={{ flex: 1, justifyContent: 'center', fontSize: 11, padding: '6px' }}
        >
          {isSaving ? '…' : t('search.save.confirm')}
        </button>
      </div>
    </div>
  )

  const saveSection = term && isLoggedIn && (
    variant === 'ribbon' ? (
      <Section variant={variant} label={t('search.save.button')} width={260}>
        {saveForm}
      </Section>
    ) : (
      <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 4 }}>
        {!saveOpen ? (
          <button
            type="button"
            onClick={() => { setSaveOpen(true); setSaveName(term.slice(0, NAME_MAX)) }}
            className="op-btn"
            style={{ width: '100%', justifyContent: 'center', fontSize: 12, padding: '7px' }}
          >
            {t('search.save.button')}
          </button>
        ) : saveForm}
      </div>
    )
  )

  // In the ribbon it is a heading like the rest of the row, underlining on
  // hover the way the dropdowns do — it just opens a dialog rather than a
  // panel. In the sidebar it is a button under Save, like Save.
  const shareSection = term && isLoggedIn && (
    variant === 'ribbon' ? (
      <RibbonHeading label={t('search.share.button')} onClick={() => setShareOpen(true)} />
    ) : (
      <div style={{ paddingTop: 6 }}>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="op-btn"
          style={{ width: '100%', justifyContent: 'center', fontSize: 12, padding: '7px' }}
        >
          {t('search.share.button')}
        </button>
      </div>
    )
  )

  /* Ribbon: one heading for every filter, rather than four side by side.
     Sub-headings inside keep the groups apart. */
  const subLabel: CSSProperties = { ...sectionLabelStyle, fontSize: 11, marginBottom: 6 }
  // Tissue gets its own column, and only when there is something to tick.
  const ribbonTissue = term && showTissue && tissueOptions.length > 0
  const filtersSection = (
    <Section variant={variant} label={t('search.filter')} width={ribbonTissue ? 520 : 300}>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {term && (
            <div>
              <span style={subLabel}>{t('search.sidebar.filterMode')}</span>
              {filterModeBody}
            </div>
          )}
          <div>
            <span style={subLabel}>{t('search.sidebar.score')}</span>
            {scoreBody}
          </div>
          {hasCategories && (
            <div>
              <span style={subLabel}>{t('search.sidebar.sources')}</span>
              {sourcesBody}
            </div>
          )}
        </div>
        {ribbonTissue && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={subLabel}>{tissueLabelText}</span>
            {tissueBody}
          </div>
        )}
      </div>
    </Section>
  )

  const shareDialog = shareOpen && (
    <ShareDialog
      savedViewName={term}
      capture={{ query: term, state: captureViewState() }}
      onClose={() => setShareOpen(false)}
    />
  )

  // A ribbon under the navbar: the same sections, centred in a row, each
  // opening its panel over the network when pressed.
  if (variant === 'ribbon') {
    return (
      <div style={{
        flexShrink: 0,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        // The panels drop over the network below, not behind it.
        position: 'relative',
        zIndex: 30,
      }}>
        <div
          role="group"
          aria-label={t('search.sidebar.tools')}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            gap: 10,
            padding: '6px 12px',
          }}
        >
          {querySection}
          {summarySection}
          {filtersSection}
          {downloadSection}
          {linksSection}
          {saveSection}
          {shareSection}
        </div>
        {shareDialog}
      </div>
    )
  }

  return (
    <aside style={{
      width: 272,
      flexShrink: 0,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      padding: '20px 16px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
    }}>
      {querySection}
      {scoreSection}
      {foundBlock}
      {summarySection}
      {sourcesSection}

      {term && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={sectionLabelStyle}>{t('search.sidebar.tools')}</span>
          {filterModeSection}
          {tissueSection}
          {downloadSection}
          {linksSection}
          {saveSection}
          {shareSection}
        </div>
      )}
      {shareDialog}
    </aside>
  )
}
