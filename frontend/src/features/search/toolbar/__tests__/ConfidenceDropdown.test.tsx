import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfidenceDropdown } from '../ConfidenceDropdown'
import { useSearchStore } from '../../searchStore'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  useSearchStore.setState({ scoreFilter: 0.5 })
})

describe('ConfidenceDropdown', () => {
  it('shows the current score and reports a change', () => {
    const setScoreFilter = vi.fn()
    useSearchStore.setState({ setScoreFilter })

    render(<ConfidenceDropdown />, { wrapper: Wrapper })
    fireEvent.click(screen.getByRole('button', { name: /confidence/i }))

    expect(screen.getByText('0.50')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0.75' } })
    expect(setScoreFilter).toHaveBeenCalledWith(0.75)
  })

  it('closes on Escape', () => {
    render(<ConfidenceDropdown />, { wrapper: Wrapper })
    const button = screen.getByRole('button', { name: /confidence/i })
    fireEvent.click(button)
    fireEvent.keyDown(button, { key: 'Escape' })
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  })
})
