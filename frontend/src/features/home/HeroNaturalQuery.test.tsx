import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HeroSection } from './HeroSection'
import { useSearchStore } from '../search/searchStore'

vi.mock('./MiniNetworkGraph', () => ({
  MiniNetworkGraph: () => <div data-testid="mini-network-graph" />,
}))
vi.mock('../../api/settings', () => ({ useSettings: () => ({ data: undefined }) }))
vi.mock('../../api/proteins', () => ({ useAutocomplete: () => ({ data: [] }) }))

const navigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => navigate,
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

function typeQuery(value: string) {
  render(
    <HeroSection shortTitle="openPIP" proteins={0} interactions={0} datasets={0} />,
    { wrapper }
  )
  const input = screen.getByLabelText(/search/i)
  fireEvent.change(input, { target: { value } })
  return input
}

describe('hero natural-language search', () => {
  beforeEach(() => {
    navigate.mockClear()
    useSearchStore.setState({ tissueFilter: [], scoreFilter: 0 })
  })

  it('searches a plain gene unchanged', () => {
    const input = typeQuery('TP53')
    fireEvent.submit(input.closest('form')!)
    expect(navigate).toHaveBeenCalledWith('/search/TP53')
  })

  it('leaves a comma-separated list alone', () => {
    const input = typeQuery('TP53, MDM2')
    fireEvent.submit(input.closest('form')!)
    expect(navigate).toHaveBeenCalledWith(`/search/${encodeURIComponent('TP53, MDM2')}`)
  })

  it('extracts the gene from a phrase and applies the tissue filter', () => {
    const input = typeQuery('BCL2 in liver')
    fireEvent.submit(input.closest('form')!)
    expect(navigate).toHaveBeenCalledWith('/search/BCL2')
    expect(useSearchStore.getState().tissueFilter).toEqual(['liver'])
  })

  it('applies a described confidence as a score filter', () => {
    const input = typeQuery('BCL2 with high confidence')
    fireEvent.submit(input.closest('form')!)
    expect(useSearchStore.getState().scoreFilter).toBe(0.5)
  })

  it('shows what it understood before the user submits', () => {
    typeQuery('BCL2 in liver')
    expect(screen.getByText(/will search/i)).toBeInTheDocument()
    expect(screen.getByText(/expressed in Liver/i)).toBeInTheDocument()
  })

  it('says plainly when it cannot honour part of the request', () => {
    // The failure to avoid is showing unfiltered results as though the
    // requested filter had been applied.
    typeQuery('two-hybrid interactions of BCL2')
    expect(screen.getByText(/cannot filter by/i)).toBeInTheDocument()
  })

  it('clears a stale tissue filter from an earlier query', () => {
    useSearchStore.setState({ tissueFilter: ['spleen'] })
    const input = typeQuery('BCL2 in liver')
    fireEvent.submit(input.closest('form')!)
    expect(useSearchStore.getState().tissueFilter).toEqual(['liver'])
  })

  it('suggests tissue names while a phrase is being typed', () => {
    // The point of the dropdown: "in liver" only works if you already know
    // liver is a tissue openPIP holds. Offering it makes that discoverable.
    const input = typeQuery('BCL2 in liv')
    fireEvent.focus(input)
    expect(screen.getByText('Liver')).toBeInTheDocument()
  })

  it('completes the phrase when a tissue is chosen', () => {
    const input = typeQuery('BCL2 in liv')
    fireEvent.focus(input)
    fireEvent.mouseDown(screen.getByText('Liver'))
    expect((input as HTMLInputElement).value).toBe('BCL2 in Liver')
  })

  it('does not offer tissues for an ordinary gene search', () => {
    const input = typeQuery('BCL2')
    fireEvent.focus(input)
    expect(screen.queryByText('Liver')).not.toBeInTheDocument()
  })
})
