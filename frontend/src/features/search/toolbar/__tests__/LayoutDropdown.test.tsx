import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LayoutDropdown } from '../LayoutDropdown'
import { useSearchStore } from '../../searchStore'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('LayoutDropdown', () => {
  it('picks a layout for the network', () => {
    render(<LayoutDropdown />, { wrapper: Wrapper })
    fireEvent.click(screen.getByRole('button', { name: /layout/i }))
    fireEvent.click(screen.getByRole('radio', { name: /grid/i }))

    expect(useSearchStore.getState().selectedLayout).toBe('grid')
    // Choosing closes the list, so the graph is not left behind a panel.
    expect(screen.queryByRole('radio', { name: /grid/i })).not.toBeInTheDocument()
  })
})
