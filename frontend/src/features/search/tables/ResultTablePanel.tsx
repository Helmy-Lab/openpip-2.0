import { useState } from 'react'
import { useSearchStore } from '../searchStore'
import { filterProteinsAndInteractions } from '../filterInteractions'
import { InteractionsTable } from './InteractionsTable'
import { InteractorsTable } from './InteractorsTable'
import { ProteinSummaryPanel } from './ProteinSummaryPanel'
import { EnrichmentTable } from '../enrichment/EnrichmentTable'
import { SubcellularLocationTable } from '../enrichment/SubcellularLocationTable'
import { TissueExpressionTable } from '../enrichment/TissueExpressionTable'
import { useEnrichment, type EnrichmentSource } from '../../../api/enrichment'
import type { Protein } from '../../../types/api'
import { useSettings } from '../../../api/settings'
import { useText } from '../../../text'

type Tab = 'interactions' | 'interactors' | EnrichmentSource | 'subcellular' | 'tissue' | 'summary'

const TABS: { id: Tab; textKey: string }[] = [
  { id: 'interactions', textKey: 'search.tab.interactions' },
  { id: 'interactors', textKey: 'search.tab.interactors' },
  { id: 'GO:MF', textKey: 'search.tab.goMf' },
  { id: 'GO:BP', textKey: 'search.tab.goBp' },
  { id: 'GO:CC', textKey: 'search.tab.goCc' },
  { id: 'REAC', textKey: 'search.tab.reactome' },
  { id: 'CORUM', textKey: 'search.tab.corum' },
  { id: 'KEGG', textKey: 'search.tab.kegg' },
  { id: 'subcellular', textKey: 'search.tab.subcellular' },
  { id: 'tissue', textKey: 'search.tab.tissue' },
  { id: 'summary', textKey: 'search.tab.summary' },
]

/**
 * Tabs for annotations this deployment actually has.
 *
 * Tissue expression and subcellular location only mean something for a
 * multicellular organism. The paper records that hosting the yeast YeRI dataset
 * meant deleting these from the source; they are settings now, so a deployment
 * turns off what its data cannot support instead of forking the code.
 */
function visibleTabs(showTissue: boolean, showSubcellular: boolean) {
  return TABS.filter(
    (tab) =>
      (tab.id !== 'tissue' || showTissue) &&
      (tab.id !== 'subcellular' || showSubcellular)
  )
}

const TAB_BTN = (isActive: boolean): React.CSSProperties => ({
  padding: '10px 16px',
  fontSize: 12,
  backgroundColor: isActive ? 'var(--primary-soft)' : 'transparent',
  border: 'none',
  borderBottom: isActive ? '2px solid var(--primary-deep)' : '2px solid transparent',
  marginBottom: -1,
  color: isActive ? 'var(--primary-deep)' : 'var(--text)',
  cursor: 'pointer',
  fontWeight: isActive ? 600 : 400,
  whiteSpace: 'nowrap',
  outline: 'none',
  flexShrink: 0,
  transition: 'color .15s',
  display: 'flex',
  alignItems: 'center',
  gap: 7,
})

interface Props {
  selectedProtein?: Protein | null
}

export function ResultTablePanel({ selectedProtein }: Props) {
  const {
    allProteins,
    allInteractions,
    queryProteinIds,
    scoreFilter,
    categoryFilter,
    annotationFilter,
    filterMode,
    tissueFilter,
  } = useSearchStore()

  // In the store, not local state, so a saved or shared view restores the tab
  // it was saved on (captureViewState already records activeTableTab).
  const activeTab = useSearchStore((s) => s.activeTableTab) as Tab
  const setActiveTab = useSearchStore((s) => s.setTableTab)
  const { data: settings } = useSettings()
  const [prevProtein, setPrevProtein] = useState(selectedProtein)
  const t = useText()

  // Auto-switch to summary tab when the selected protein changes (React render-phase pattern)
  if (selectedProtein !== prevProtein) {
    setPrevProtein(selectedProtein)
    if (selectedProtein) setActiveTab('summary')
  }

  const { proteins, interactions } = filterProteinsAndInteractions(
    allProteins,
    allInteractions,
    { scoreFilter, categoryFilter, annotationFilter, filterMode, tissueFilter },
    queryProteinIds
  )

  const geneNames = proteins.map((p) => p.protein_gene_name)

  // Settings default to on where absent, so a deployment that has not saved
  // them keeps the tabs it has always had.
  const showTissue = settings?.showTissueExpression !== false
  const showSubcellular = settings?.showSubcellularLocation !== false
  const tabs = visibleTabs(showTissue, showSubcellular)

  // A hidden tab must not stay selected — switching it off while a visitor is
  // reading it would otherwise leave the panel showing a tab nobody can return
  // to and no way back.
  const currentTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : 'interactions'

  // Run enrichment in the background as soon as results are shown (this panel is
  // always mounted, regardless of the active tab) so the enrichment tabs are
  // already computed and cached by the time the user clicks one. A single
  // g:Profiler call covers every source; EnrichmentTable reuses the same query.
  useEnrichment(geneNames)

  const counts: Partial<Record<Tab, number>> = {
    interactions: interactions.length,
    interactors: proteins.length,
  }

  // Summary tab: show selectedProtein if set, else fall back to first query protein
  const queryProtein = allProteins.find((p) => queryProteinIds.includes(p.protein_id)) ?? null
  const summaryProtein = selectedProtein ?? queryProtein

  const summaryGene = summaryProtein?.protein_gene_name || summaryProtein?.protein_uniprot_id

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        flexShrink: 0,
        display: 'flex',
        flexWrap: 'wrap',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        paddingLeft: 8,
      }}>
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id
          const count = counts[tab.id]
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActiveTab(tab.id)}
              style={TAB_BTN(isActive)}
            >
              {t(tab.textKey)}
              {count !== undefined && (
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  backgroundColor: isActive ? 'var(--primary-soft)' : 'var(--surface-2)',
                  color: isActive ? 'var(--primary-deep)' : 'var(--text-muted)',
                  borderRadius: 10, padding: '1px 7px',
                }}>
                  {count}
                </span>
              )}
              {tab.id === 'summary' && summaryGene && (
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  backgroundColor: isActive ? 'var(--primary-soft)' : 'var(--surface-2)',
                  color: isActive ? 'var(--primary-deep)' : 'var(--text-muted)',
                  borderRadius: 10, padding: '1px 7px',
                  fontFamily: 'var(--mono)',
                }}>
                  {summaryGene}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* The one scrolling box on this page: the table headers stick to its
          top, and the network above it never moves. */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: 'var(--bg)' }}>
        {currentTab === 'interactions' ? (
          <InteractionsTable interactions={interactions} proteins={proteins} />
        ) : currentTab === 'interactors' ? (
          <InteractorsTable proteins={proteins} queryProteinIds={queryProteinIds} />
        ) : currentTab === 'subcellular' ? (
          <SubcellularLocationTable proteins={proteins} />
        ) : currentTab === 'tissue' ? (
          <TissueExpressionTable proteins={proteins} />
        ) : currentTab === 'summary' ? (
          summaryProtein ? (
            <ProteinSummaryPanel
              protein={summaryProtein}
              interactions={interactions}
              isQueryProtein={queryProteinIds.includes(summaryProtein.protein_id)}
            />
          ) : (
            <div style={{ padding: 32, fontSize: 13, color: 'var(--text-muted)' }}>
              Search for a protein to see its details here.
            </div>
          )
        ) : (
          <EnrichmentTable geneNames={geneNames} source={currentTab as EnrichmentSource} />
        )}
      </div>
    </div>
  )
}
