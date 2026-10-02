import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FilterDropdown } from '../FilterDropdown'
import { useSearchStore } from '../../searchStore'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  useSearchStore.setState({
    categoryFilter: {
      Published: true,
      Validated: true,
      Verified: true,
      Literature: true,
    },
    scoreFilter: 0,
    filterMode: 'None',
  })
})

describe('FilterDropdown', () => {
  it('renders the Filter button', () => {
    render(<FilterDropdown />, { wrapper: Wrapper })
    expect(screen.getByRole('button', { name: /filter/i })).toBeInTheDocument()
  })

  it('opens panel with category checkboxes when button is clicked', () => {
    render(<FilterDropdown />, { wrapper: Wrapper })
    fireEvent.click(screen.getByRole('button', { name: /filter/i }))
    expect(screen.getByRole('checkbox', { name: /published/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /validated/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /verified/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /literature/i })).toBeInTheDocument()
  })

  it('calls setCategoryFilter when a checkbox is toggled', () => {
    const setCategoryFilter = vi.fn()
    useSearchStore.setState({ setCategoryFilter })

    render(<FilterDropdown />, { wrapper: Wrapper })
    fireEvent.click(screen.getByRole('button', { name: /filter/i }))

    const publishedCheckbox = screen.getByRole('checkbox', { name: /published/i })
    fireEvent.click(publishedCheckbox)

    expect(setCategoryFilter).toHaveBeenCalledWith('Published', false)
  })

  it('renders the filter-mode radios when panel is open', () => {
    render(<FilterDropdown />, { wrapper: Wrapper })
    fireEvent.click(screen.getByRole('button', { name: /filter/i }))
    expect(screen.getByRole('radio', { name: /no filter/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /query-interactor/i })).toBeInTheDocument()
  })

  it('puts filter mode above sources', () => {
    render(<FilterDropdown />, { wrapper: Wrapper })
    fireEvent.click(screen.getByRole('button', { name: /filter/i }))
    const mode = screen.getByText(/filter mode/i)
    const sources = screen.getByText(/sources/i)
    expect(mode.compareDocumentPosition(sources) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
