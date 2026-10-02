import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { SearchSidebar } from '../SearchSidebar'
import { useAuthStore } from '../../../store/authStore'
import { resetSharingStore } from '../../../mocks/handlers/sharing'
import { useSearchStore } from '../searchStore'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => navigate,
}))

vi.mock('../../../api/proteins', () => ({
  useAutocomplete: (q: string) => ({ data: q.length >= 2 ? ['BAD', 'BAK1', 'BAX'] : [] }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SearchSidebar query autocomplete', () => {
  it('suggests genes and fills the query input on select', () => {
    render(<SearchSidebar term="" visibleInteractionIds={[]} />, { wrapper })
    const input = screen.getByPlaceholderText(/Gene symbol or UniProt ID/i)
    fireEvent.change(input, { target: { value: 'BA' } })
    fireEvent.mouseDown(screen.getByRole('option', { name: 'BAK1' }))
    expect(input).toHaveValue('BAK1')
  })
})

describe('SearchSidebar multi-line query box', () => {
  it('searches on Enter and keeps shift-enter for a newline', () => {
    navigate.mockClear()
    render(<SearchSidebar term="" visibleInteractionIds={[]} />, { wrapper })
    const box = screen.getByPlaceholderText(/Gene symbol or UniProt ID/i)

    fireEvent.change(box, { target: { value: 'BAD\nBCL2L1' } })
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
    expect(navigate).not.toHaveBeenCalled()

    fireEvent.keyDown(box, { key: 'Enter' })
    expect(navigate).toHaveBeenCalledWith(`/search/${encodeURIComponent('BAD\nBCL2L1')}`)
  })
})

describe('SearchSidebar ribbon variant', () => {
  it('hides each section behind a button until it is pressed', () => {
    render(<SearchSidebar term="BAD" visibleInteractionIds={[]} variant="ribbon" />, { wrapper })

    // The query box is in the ribbon, but only once its button is pressed.
    expect(screen.queryByPlaceholderText(/Gene symbol or UniProt ID/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Query$/i }))
    expect(screen.getByPlaceholderText(/Gene symbol or UniProt ID/i)).toBeInTheDocument()

    // Tools a search unlocks are here too, not only in the sidebar.
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument()
  })

  it('opens a section on hover, without a press', async () => {
    const user = userEvent.setup()
    render(<SearchSidebar term="BAD" visibleInteractionIds={[]} variant="ribbon" />, { wrapper })

    await user.hover(screen.getByRole('button', { name: /^Query$/i }))
    expect(screen.getByPlaceholderText(/Gene symbol or UniProt ID/i)).toBeInTheDocument()

    await user.unhover(screen.getByRole('button', { name: /^Query$/i }))
    expect(screen.queryByPlaceholderText(/Gene symbol or UniProt ID/i)).toBeNull()
  })

  it('keeps every filter behind the one Filters heading, filter mode first', async () => {
    // A ticked tissue is always offered, so the tissue column has something in it.
    useSearchStore.setState({ tissueFilter: ['liver'] })
    const user = userEvent.setup()
    render(<SearchSidebar term="BAD" visibleInteractionIds={[]} variant="ribbon" />, { wrapper })

    expect(screen.queryByLabelText(/min. confidence score/i)).toBeNull()
    await user.hover(screen.getByRole('button', { name: /^Filter$/i }))
    const mode = screen.getByText(/filter mode/i)
    const score = screen.getByText(/min. confidence score/i)
    expect(mode.compareDocumentPosition(score) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Tissue sits in a column of its own beside the rest.
    const tissue = screen.getByText(/^Tissue expression/i)
    expect(tissue.parentElement).not.toContainElement(score)
    expect(tissue.parentElement?.parentElement).toContainElement(score)
    useSearchStore.setState({ tissueFilter: [] })
  })

  it('drops the tissue column when no result has tissue data', async () => {
    const user = userEvent.setup()
    render(<SearchSidebar term="BAD" visibleInteractionIds={[]} variant="ribbon" />, { wrapper })

    await user.hover(screen.getByRole('button', { name: /^Filter$/i }))
    expect(screen.getByText(/filter mode/i)).toBeInTheDocument()
    expect(screen.queryByText(/^Tissue expression/i)).toBeNull()
  })

  it('has no toggle to hide the row', () => {
    render(<SearchSidebar term="BAD" visibleInteractionIds={[]} variant="ribbon" />, { wrapper })
    expect(screen.queryByRole('button', { name: /hide filters|show filters/i })).toBeNull()
    expect(screen.getByRole('button', { name: /^Query$/i })).toBeInTheDocument()
  })

  it('opens a panel with its left edge under the start of the heading', async () => {
    const user = userEvent.setup()
    render(<SearchSidebar term="BAD" visibleInteractionIds={[]} variant="ribbon" />, { wrapper })

    await user.hover(screen.getByRole('button', { name: /^Filter$/i }))
    const panel = screen.getByText(/filter mode/i).closest('div[style*="position: absolute"]') as HTMLElement
    expect(panel.style.left).toBe('10px')
  })

  it('leaves the sidebar showing its sections without a press', () => {
    render(<SearchSidebar term="BAD" visibleInteractionIds={[]} />, { wrapper })
    expect(screen.getByPlaceholderText(/Gene symbol or UniProt ID/i)).toBeInTheDocument()
  })
})

describe('SearchSidebar share option', () => {
  it('shares the network on screen without saving one first', async () => {
    resetSharingStore()
    localStorage.setItem('openpip_access_token', 'mock-token')
    useAuthStore.setState({ isLoggedIn: true, isAdmin: false, token: 'mock-token' })

    render(<SearchSidebar term="BAD" visibleInteractionIds={[1]} />, { wrapper })

    // Saving and sharing are separate options, side by side.
    expect(screen.getByRole('button', { name: 'Save Network' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Share Network' }))

    // The dialog names the view after the search, and shares straight from here.
    expect(screen.getByLabelText('Name')).toHaveValue('BAD')
    fireEvent.change(screen.getByLabelText(/find someone on openpip/i), {
      target: { value: 'Helmy Lab' },
    })
    fireEvent.click(await screen.findByRole('button', { name: /Helen Leung/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Share' })).toBeNull(),
    )
  })
})

describe('SearchSidebar ribbon share heading', () => {
  it('reads as one of the row headings, not a toolbar button', () => {
    localStorage.setItem('openpip_access_token', 'mock-token')
    useAuthStore.setState({ isLoggedIn: true, isAdmin: false, token: 'mock-token' })

    render(<SearchSidebar term="BAD" visibleInteractionIds={[1]} variant="ribbon" />, {
      wrapper,
    })

    const share = screen.getByRole('button', { name: 'Share Network' })
    const save = screen.getByRole('button', { name: 'Save Network' })
    expect(share).not.toHaveClass('op-btn')
    expect(share.style.color).toBe(save.style.color)
    expect(share.style.textTransform).toBe(save.style.textTransform)

    // Underlines on hover, the way the dropdown headings underline when open.
    fireEvent.mouseEnter(share)
    expect(share.style.borderBottom).toBe('2px solid var(--primary)')
  })
})

const download = vi.hoisted(() => ({
  downloadImageFile: vi.fn(),
  formatInteractionsCSV: vi.fn<(...args: unknown[]) => string>(() => ''),
}))
vi.mock('../../../lib/download', async () => ({
  ...(await vi.importActual<typeof import('../../../lib/download')>('../../../lib/download')),
  downloadImageFile: download.downloadImageFile,
  formatInteractionsCSV: download.formatInteractionsCSV,
  downloadFile: vi.fn(),
}))

describe('SearchSidebar downloads', () => {
  it('exports the network as an image, and marks query proteins in the CSV', () => {
    const cy = { fake: 'cytoscape' }
    useSearchStore.setState({ networkCy: cy, queryProteinIds: [7] })
    render(<SearchSidebar term="BAD" visibleInteractionIds={[]} />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: /^download/i }))

    fireEvent.click(screen.getByRole('button', { name: 'Network image (PNG)' }))
    expect(download.downloadImageFile).toHaveBeenCalledWith(cy, 'png', undefined)

    fireEvent.click(screen.getByRole('button', { name: /interactions csv/i }))
    expect(download.formatInteractionsCSV).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      new Set([7])
    )
  })
})

describe('SearchSidebar downloads follow the filters', () => {
  it('leaves filtered-out interactions and removed proteins out of the files', () => {
    const protein = (id: number) => ({ protein_id: id, protein_gene_name: `G${id}` })
    const edge = (id: number, a: number, b: number) => ({
      interaction_id: id,
      interactor_A: { protein_id: a },
      interactor_B: { protein_id: b },
      dataset_array: [],
    })
    useSearchStore.setState({
      allProteins: [protein(1), protein(2), protein(3)] as never,
      allInteractions: [edge(10, 1, 2), edge(11, 1, 3), edge(12, 2, 3)] as never,
      queryProteinIds: [1],
    })
    download.formatInteractionsCSV.mockClear()
    // 12 is filtered out; protein 3 was removed, which takes 11 with it.
    render(
      <SearchSidebar term="G1" visibleInteractionIds={[10, 11]} visibleProteinIds={[1, 2]} />,
      { wrapper }
    )
    fireEvent.click(screen.getByRole('button', { name: /^download/i }))
    fireEvent.click(screen.getByRole('button', { name: /interactions csv/i }))

    const [interactions, proteins] = download.formatInteractionsCSV.mock.calls[0] as [
      { interaction_id: number }[],
      { protein_id: number }[],
    ]
    expect(interactions.map((i) => i.interaction_id)).toEqual([10])
    expect(proteins.map((p) => p.protein_id)).toEqual([1, 2])
  })
})

describe('SearchSidebar summary', () => {
  it('counts the network as filtered, not every result', () => {
    const protein = (id: number) => ({ protein_id: id, protein_gene_name: `G${id}` })
    const edge = (id: number, a: number, b: number) => ({
      interaction_id: id,
      interactor_A: { protein_id: a },
      interactor_B: { protein_id: b },
      dataset_array: [],
    })
    useSearchStore.setState({
      allProteins: [protein(1), protein(2), protein(3)] as never,
      allInteractions: [edge(10, 1, 2), edge(11, 1, 3), edge(12, 2, 3)] as never,
      queryProteinIds: [1],
    })
    render(
      <SearchSidebar term="G1" visibleInteractionIds={[10]} visibleProteinIds={[1, 2]} />,
      { wrapper }
    )
    const summary = screen.getByText(/Avg\. node degree/i).closest('div')!.parentElement!
    expect(summary).toHaveTextContent(/Proteins:\s*2/)
    expect(summary).toHaveTextContent(/Interactions:\s*1/)
  })
})
