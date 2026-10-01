import { create } from 'zustand'
import type { Protein, Interaction } from '../../types/api'
import type { SearchResult } from '../../types/search'

type LayoutName = 'cola' | 'cose' | 'concentric' | 'circle' | 'grid'
type ModalName = 'download' | 'cyRest' | 'loading' | 'directDownload'

/**
 * What it takes to look at a network the way someone else was looking at it:
 * the filters and layout, not the data. A saved or shared view carries this
 * and re-runs the search, so it always shows current data.
 */
export interface ViewState {
  scoreFilter: number
  categoryFilter: Record<string, boolean>
  annotationFilter: Record<string, boolean>
  filterMode: 'None' | 'query_query' | 'query_interactor'
  tissueFilter: string[]
  selectedLayout: LayoutName
  highlight: { term: string; genes: string[] } | null
  activeTableTab: string
}

const VIEW_STATE_KEYS: (keyof ViewState)[] = [
  'scoreFilter',
  'categoryFilter',
  'annotationFilter',
  'filterMode',
  'tissueFilter',
  'selectedLayout',
  'highlight',
  'activeTableTab',
]

interface SearchState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  networkCy: any | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setNetworkCy: (cy: any) => void
  allProteins: Protein[]
  allInteractions: Interaction[]
  queryProteinIds: number[]
  searchTerm: string
  foundSummary: string
  unfoundSummary: string
  scoreFilter: number
  categoryFilter: Record<string, boolean>
  annotationFilter: Record<string, boolean>
  filterMode: 'None' | 'query_query' | 'query_interactor'
  /** Selected tissues, ANDed: a protein must be expressed in every one. */
  tissueFilter: string[]
  setTissueFilter: (tissue: string, on: boolean) => void
  clearTissueFilter: () => void
  /** Legacy "Show tissue expression" (node size) and "Reflect tissue specificity" (node color). */
  tissueNodeSize: boolean
  tissueNodeColor: boolean
  setTissueDisplay: (which: 'tissueNodeSize' | 'tissueNodeColor', on: boolean) => void
  selectedLayout: LayoutName
  /**
   * The enrichment term whose proteins are lit up in the network, with the
   * genes it covers. One selection across every enrichment table, as in legacy:
   * picking a term anywhere replaces whatever was picked before.
   */
  highlight: { term: string; genes: string[] } | null
  setHighlight: (h: { term: string; genes: string[] } | null) => void
  activeModal: ModalName | null
  activeTableTab: string
  setSearchData: (result: SearchResult) => void
  /** Drops the last search's results, keeping filters and layout. */
  clearSearchData: () => void
  setScoreFilter: (n: number) => void
  setCategoryFilter: (name: string, val: boolean) => void
  setAnnotationFilter: (name: string, val: boolean) => void
  setFilterMode: (mode: 'None' | 'query_query' | 'query_interactor') => void
  setLayout: (name: LayoutName) => void
  setModal: (name: ModalName | null) => void
  setTableTab: (name: string) => void
  applyViewState: (v: Partial<ViewState>) => void
  reset: () => void
}

const initialState = {
  networkCy: null as null,
  allProteins: [] as Protein[],
  allInteractions: [] as Interaction[],
  queryProteinIds: [] as number[],
  searchTerm: '',
  foundSummary: '',
  unfoundSummary: '',
  scoreFilter: 0,
  categoryFilter: {
    Published: true,
    Validated: true,
    Verified: true,
    Literature: true,
  } as Record<string, boolean>,
  annotationFilter: {} as Record<string, boolean>,
  filterMode: 'None' as const,
  tissueFilter: [] as string[],
  tissueNodeSize: false,
  tissueNodeColor: false,
  selectedLayout: 'cola' as LayoutName,
  highlight: null as { term: string; genes: string[] } | null,
  activeModal: null as ModalName | null,
  activeTableTab: 'interactions',
}

export const useSearchStore = create<SearchState>()((set) => ({
  ...initialState,
  setNetworkCy: (cy) => set({ networkCy: cy }),
  setSearchData: (result) =>
    set((s) => {
      const categoryFilter = { ...s.categoryFilter }
      for (const ix of result.all_interactions) {
        const cat = ix.interaction_category_array.highest_category_status
        if (cat && !(cat in categoryFilter)) categoryFilter[cat] = true
      }
      return {
        allProteins: result.all_proteins,
        allInteractions: result.all_interactions,
        queryProteinIds: result.query_protein_id_array,
        searchTerm: result.search_term,
        foundSummary: result.found_protein_summary,
        unfoundSummary: result.unfound_protein_summary,
        categoryFilter,
        // A term from the previous network means nothing in this one.
        highlight: null,
      }
    }),
  clearSearchData: () =>
    set({
      allProteins: [],
      allInteractions: [],
      queryProteinIds: [],
      searchTerm: '',
      foundSummary: '',
      unfoundSummary: '',
      highlight: null,
    }),
  setScoreFilter: (n) => set({ scoreFilter: n }),
  setCategoryFilter: (name, val) =>
    set((s) => ({ categoryFilter: { ...s.categoryFilter, [name]: val } })),
  setAnnotationFilter: (name, val) =>
    set((s) => ({ annotationFilter: { ...s.annotationFilter, [name]: val } })),
  setFilterMode: (mode) => set({ filterMode: mode }),
  // While either tissue display is on, tissues pick one at a time, as in legacy.
  setTissueFilter: (tissue, on) =>
    set((s) => ({
      tissueFilter: on
        ? s.tissueNodeSize || s.tissueNodeColor
          ? [tissue]
          : [...s.tissueFilter, tissue]
        : s.tissueFilter.filter((t) => t !== tissue),
    })),
  // Legacy clears a multi-tissue selection when a display is switched on.
  setTissueDisplay: (which, on) =>
    set((s) => ({
      [which]: on,
      ...(on && s.tissueFilter.length > 1 && { tissueFilter: [] }),
    })),
  clearTissueFilter: () => set({ tissueFilter: [] }),
  setLayout: (name) => set({ selectedLayout: name }),
  setHighlight: (h) => set({ highlight: h }),
  setModal: (name) => set({ activeModal: name }),
  setTableTab: (name) => set({ activeTableTab: name }),
  // Only the view-state keys, so a saved payload can never overwrite the
  // proteins and interactions the current search just loaded.
  applyViewState: (v) =>
    set(
      Object.fromEntries(
        VIEW_STATE_KEYS.filter((k) => v[k] !== undefined).map((k) => [k, v[k]]),
      ),
    ),
  reset: () => set(initialState),
}))

/** The current filters and layout, ready to save or share. */
export function captureViewState(): ViewState {
  const {
    scoreFilter,
    categoryFilter,
    annotationFilter,
    filterMode,
    tissueFilter,
    selectedLayout,
    highlight,
    activeTableTab,
  } = useSearchStore.getState()
  return {
    scoreFilter,
    categoryFilter,
    annotationFilter,
    filterMode,
    tissueFilter,
    selectedLayout,
    highlight,
    activeTableTab,
  }
}

// Static method for test resets - exposes initial state snapshot
;(useSearchStore as unknown as { getInitialState: () => typeof initialState }).getInitialState =
  () => ({ ...initialState })
