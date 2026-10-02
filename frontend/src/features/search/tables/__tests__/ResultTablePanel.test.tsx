import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResultTablePanel } from '../ResultTablePanel'
import { useSearchStore } from '../../searchStore'
import { searchFixture } from '../../../../mocks/fixtures/search'
import { renderWithProviders } from '../../../../test/renderWithProviders'

const enrichmentSpy = vi.fn()
vi.mock('../../../../api/enrichment', () => ({
  useEnrichment: (genes: string[]) => {
    enrichmentSpy(genes)
    return { data: [], isLoading: false, isError: false }
  },
}))

describe('ResultTablePanel enrichment prefetch', () => {
  beforeEach(() => {
    enrichmentSpy.mockClear()
    useSearchStore.getState().setSearchData(searchFixture)
  })

  it('runs enrichment in the background while the default (Interactions) tab is active', () => {
    renderWithProviders(<ResultTablePanel />)
    // Enrichment fires even though EnrichmentTable is not mounted yet, so the
    // enrichment tabs are cached by the time the user clicks one.
    expect(enrichmentSpy).toHaveBeenCalled()
    const calls = enrichmentSpy.mock.calls
    const genes = calls[calls.length - 1][0]
    expect(genes.length).toBeGreaterThan(0)
  })
})

describe('ResultTablePanel tab', () => {
  it('opens on the tab a saved view recorded, and records the one picked', async () => {
    const { screen, fireEvent } = await import('@testing-library/react')
    useSearchStore.getState().setSearchData(searchFixture)
    useSearchStore.getState().applyViewState({ activeTableTab: 'interactors' })
    renderWithProviders(<ResultTablePanel />)

    expect(screen.getByRole('button', { name: /interactors/i, pressed: true })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^interactions/i }))
    expect(useSearchStore.getState().activeTableTab).toBe('interactions')
  })
})
