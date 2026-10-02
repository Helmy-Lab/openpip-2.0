import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { SearchResultsPage } from '../SearchResultsPage'
import { useSearch } from '../../../api/search'
import { useSettings } from '../../../api/settings'

const protein = (id: number) => ({ protein_id: id, protein_gene_name: `G${id}` })
const edge = (id: number, a: number, b: number) => ({
  interaction_id: id,
  interactor_A: { protein_id: a },
  interactor_B: { protein_id: b },
  score: null,
  dataset_array: [],
  annotation_array: {},
  experiment_array: [],
  interaction_category_array: { highest_category_status: '', highest_order: 0, interaction_category_array: [] },
})

vi.mock('../SearchSidebar', () => ({
  SearchSidebar: ({ visibleInteractionIds }: { visibleInteractionIds: number[] }) => (
    <div data-testid="visible">{visibleInteractionIds.join(',')}</div>
  ),
}))
vi.mock('../network/CytoscapeNetwork', () => ({
  CytoscapeNetwork: ({ onNodeClick }: { onNodeClick: (p: unknown) => void }) => (
    <button type="button" onClick={() => onNodeClick({ protein_id: 3, protein_gene_name: 'G3' })}>
      click G3
    </button>
  ),
}))
vi.mock('../NodeInfoPanel', () => ({
  NodeInfoPanel: ({ protein, onRemove }: { protein: { protein_id: number }; onRemove: (id: number) => void }) => (
    <button type="button" onClick={() => onRemove(protein.protein_id)}>
      remove
    </button>
  ),
}))
vi.mock('../tables/ResultTablePanel', () => ({ ResultTablePanel: () => null }))
vi.mock('../modals/OverlaySystem', () => ({ OverlaySystem: () => null }))
vi.mock('../../../api/search', () => ({ useSearch: vi.fn() }))
vi.mock('../../../api/settings', () => ({ useSettings: vi.fn() }))

describe('removing a protein from the network', () => {
  it('takes its interactions out of what counts as shown', () => {
    ;(useSettings as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined })
    ;(useSearch as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        all_proteins: [protein(1), protein(2), protein(3)],
        all_interactions: [edge(10, 1, 2), edge(11, 1, 3), edge(12, 2, 3)],
        query_protein_id_array: [1],
        search_term: 'G1',
        found_protein_summary: 'G1',
        unfound_protein_summary: '',
        domains: '',
        complexes: '',
      },
      isLoading: false,
      isError: false,
    })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/search/G1']}>
          <Routes>
            <Route path="/search/:term" element={<SearchResultsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(screen.getByTestId('visible')).toHaveTextContent('10,11,12')

    fireEvent.click(screen.getByRole('button', { name: 'click G3' }))
    fireEvent.click(screen.getByRole('button', { name: 'remove' }))

    expect(screen.getByTestId('visible')).toHaveTextContent(/^10$/)
  })
})
