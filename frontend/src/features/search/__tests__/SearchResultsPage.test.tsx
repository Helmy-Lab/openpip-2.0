import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSearch } from '../../../api/search'
import { useSettings } from '../../../api/settings'
import { SearchResultsPage } from '../SearchResultsPage'
import { searchFixture } from '../../../mocks/fixtures/search'
import { useSearchStore } from '../searchStore'

vi.mock('../SearchSidebar', () => ({ SearchSidebar: () => <div>Sidebar</div> }))
vi.mock('../network/CytoscapeNetwork', () => ({
  CytoscapeNetwork: ({ height, showFilters = true }: { height: number; showFilters?: boolean }) => (
    <div data-testid="network" data-height={height}>
      Network{showFilters && <button type="button">Filter</button>}
    </div>
  ),
}))
vi.mock('../tables/ResultTablePanel', () => ({ ResultTablePanel: () => <div>Tables</div> }))
vi.mock('../enrichment/EnrichmentPanel', () => ({ EnrichmentPanel: () => <div>Enrichment</div> }))
vi.mock('../NodeInfoPanel', () => ({ NodeInfoPanel: () => null }))
vi.mock('../modals/OverlaySystem', () => ({ OverlaySystem: () => null }))
vi.mock('../../../api/search', () => ({ useSearch: vi.fn() }))
vi.mock('../../../api/settings', () => ({ useSettings: vi.fn() }))

// Mock cytoscape and react-cytoscapejs to avoid canvas/DOM issues in jsdom
vi.mock('react-cytoscapejs', () => ({ default: () => null }))
vi.mock('cytoscape', () => ({ default: { use: vi.fn() } }))
vi.mock('cytoscape-cola', () => ({ default: {} }))

function renderWithRoute(term?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const path = term ? '/search/:term' : '/search'
  const entry = term ? `/search/${term}` : '/search'
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path={path} element={<SearchResultsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SearchResultsPage', () => {
  beforeEach(() => {
    // Reset store between tests
    useSearchStore.getState().reset()
    vi.clearAllMocks()
    ;(useSettings as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined })
  })

  it.each([false, true])('with no term, the canvas is blank and holds the prompt (ribbon: %s)', (ribbon) => {
    ;(useSettings as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { horizontalFilterBar: ribbon, example1: 'BAD\nBCL2L1' },
    })
    ;(useSearch as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    })

    renderWithRoute() // no term

    // No example is run behind the prompt, and no network is drawn.
    expect(useSearch).toHaveBeenCalledWith('')
    expect(screen.queryByTestId('network')).not.toBeInTheDocument()
    expect(screen.getByText(/Search for a protein to see its interaction network/i)).toBeInTheDocument()
    // The page around the canvas stays put.
    expect(screen.getByText('Sidebar')).toBeInTheDocument()
    expect(screen.getByText('Tables')).toBeInTheDocument()
  })

  it('under the ribbon, drops the filter controls but keeps fullscreen', () => {
    ;(useSettings as ReturnType<typeof vi.fn>).mockReturnValue({ data: { horizontalFilterBar: true } })
    ;(useSearch as ReturnType<typeof vi.fn>).mockReturnValue({
      data: searchFixture,
      isLoading: false,
      isError: false,
    })

    renderWithRoute('BAD')

    expect(screen.queryByRole('button', { name: 'Filter' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /full ?screen/i })).toBeInTheDocument()
  })

  it('in the sidebar layout, keeps every canvas control', () => {
    ;(useSearch as ReturnType<typeof vi.fn>).mockReturnValue({
      data: searchFixture,
      isLoading: false,
      isError: false,
    })

    renderWithRoute('BAD')

    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /full ?screen/i })).toBeInTheDocument()
  })

  it('shows loading spinner when isLoading is true', () => {
    ;(useSearch as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    })

    renderWithRoute('BAD')

    expect(screen.getByText('Querying interactome...')).toBeInTheDocument()
  })

  it('shows error message when isError is true', () => {
    ;(useSearch as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    })

    renderWithRoute('BAD')

    expect(screen.getByText(/Could not reach the database/i)).toBeInTheDocument()
  })

  it('shows "Enter a search term" when term is empty (no route param)', () => {
    ;(useSearch as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    })

    renderWithRoute() // no term

    expect(screen.getByText(/Search for a protein to see its interaction network/i)).toBeInTheDocument()
  })

  it('drops the last search\'s results when back on a bare /search', () => {
    useSearchStore.getState().setSearchData(searchFixture)
    ;(useSearch as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    })

    renderWithRoute() // no term

    const state = useSearchStore.getState()
    expect(state.allProteins).toHaveLength(0)
    expect(state.allInteractions).toHaveLength(0)
    expect(state.searchTerm).toBe('')
  })

  it('calls setSearchData and renders all panels when data loads', async () => {
    ;(useSearch as ReturnType<typeof vi.fn>).mockReturnValue({
      data: searchFixture,
      isLoading: false,
      isError: false,
    })

    renderWithRoute('BAD,BCL2L1')

    // Panels should be in the document
    expect(screen.getByText('Sidebar')).toBeInTheDocument()
    expect(screen.getByText('Network')).toBeInTheDocument()
    // Enrichment lives inside ResultTablePanel's tabs, so 'Tables' covers it.
    expect(screen.getByText('Tables')).toBeInTheDocument()

    // Store should have been populated with fixture data
    const state = useSearchStore.getState()
    expect(state.allProteins).toHaveLength(searchFixture.all_proteins.length)
    expect(state.allInteractions).toHaveLength(searchFixture.all_interactions.length)
    expect(state.searchTerm).toBe(searchFixture.search_term)
  })

  it('resizes the network from the bar: taller, shorter, and back to default', () => {
    ;(useSearch as ReturnType<typeof vi.fn>).mockReturnValue({
      data: searchFixture,
      isLoading: false,
      isError: false,
    })
    renderWithRoute('BAD')

    const network = screen.getByTestId('network')
    const height = () => Number(network.getAttribute('data-height'))
    const cap = window.innerHeight - 56 - 120
    const start = height()

    // The up arrow is labelled "shorter": it moves the divider up.
    fireEvent.click(screen.getByRole('button', { name: /shorter network/i }))
    expect(height()).toBe(Math.max(150, Math.round(window.innerHeight * 0.2)))

    fireEvent.click(screen.getByRole('button', { name: /taller network/i }))
    expect(height()).toBe(Math.min(cap, Math.round(window.innerHeight * 0.75)))

    // A mouse-up that never moved is a click, and a click restores the default.
    fireEvent.mouseDown(screen.getByRole('separator'))
    fireEvent.mouseUp(document)
    expect(height()).toBe(start)
  })
})
