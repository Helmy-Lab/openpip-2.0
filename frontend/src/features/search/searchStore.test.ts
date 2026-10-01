import { describe, it, expect, beforeEach } from 'vitest'
import { useSearchStore, captureViewState } from './searchStore'

describe('view state', () => {
  beforeEach(() => useSearchStore.getState().reset())

  it('round-trips the filters and layout through capture and apply', () => {
    const store = useSearchStore.getState()
    store.setScoreFilter(0.7)
    store.setLayout('grid')
    store.setTissueFilter('liver', true)
    store.setFilterMode('query_query')
    store.setCategoryFilter('Published', false)
    store.setHighlight({ term: 'apoptosis', genes: ['TP53'] })
    store.setTableTab('interactors')

    const saved = captureViewState()
    useSearchStore.getState().reset()
    expect(useSearchStore.getState().scoreFilter).toBe(0)

    useSearchStore.getState().applyViewState(saved)
    const restored = useSearchStore.getState()
    expect(restored.scoreFilter).toBe(0.7)
    expect(restored.selectedLayout).toBe('grid')
    expect(restored.tissueFilter).toEqual(['liver'])
    expect(restored.filterMode).toBe('query_query')
    expect(restored.categoryFilter.Published).toBe(false)
    expect(restored.highlight).toEqual({ term: 'apoptosis', genes: ['TP53'] })
    expect(restored.activeTableTab).toBe('interactors')
  })

  it('leaves the loaded network alone', () => {
    useSearchStore.setState({
      allProteins: [{ id: 1 }] as never,
      searchTerm: 'TP53',
    })
    // A saved payload carrying stray keys must not replace search results.
    useSearchStore
      .getState()
      .applyViewState({ scoreFilter: 0.3, allProteins: [], searchTerm: 'other' } as never)

    const state = useSearchStore.getState()
    expect(state.scoreFilter).toBe(0.3)
    expect(state.allProteins).toHaveLength(1)
    expect(state.searchTerm).toBe('TP53')
  })

  it('ignores keys the saved view does not carry', () => {
    useSearchStore.getState().setLayout('circle')
    useSearchStore.getState().applyViewState({ scoreFilter: 0.5 })
    expect(useSearchStore.getState().selectedLayout).toBe('circle')
  })
})

describe('tissue display switches', () => {
  beforeEach(() => useSearchStore.getState().reset())

  it('clears a multi-tissue selection when one is switched on, then picks one tissue at a time', () => {
    const s = useSearchStore.getState()
    s.setTissueFilter('liver', true)
    s.setTissueFilter('lung', true)
    s.setTissueDisplay('tissueNodeColor', true)
    expect(useSearchStore.getState().tissueFilter).toEqual([])
    useSearchStore.getState().setTissueFilter('liver', true)
    useSearchStore.getState().setTissueFilter('lung', true)
    expect(useSearchStore.getState().tissueFilter).toEqual(['lung'])
  })

  it('still allows several tissues with both switches off', () => {
    useSearchStore.getState().setTissueFilter('liver', true)
    useSearchStore.getState().setTissueFilter('lung', true)
    expect(useSearchStore.getState().tissueFilter).toEqual(['liver', 'lung'])
  })
})
