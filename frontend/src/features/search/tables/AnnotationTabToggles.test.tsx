import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { ResultTablePanel } from './ResultTablePanel'
import { useSearchStore } from '../searchStore'

const settings = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('../../../api/settings', () => ({ useSettings: () => ({ data: settings.value }) }))
vi.mock('../enrichment/useEnrichment', () => ({ useEnrichment: () => ({}) }))

function renderPanel(overrides: Record<string, unknown>) {
  settings.value = overrides
  useSearchStore.setState({ allProteins: [], allInteractions: [], queryProteinIds: [] })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ResultTablePanel selectedProtein={null} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('annotation tabs a deployment cannot support', () => {
  it('shows both by default', () => {
    renderPanel({})
    expect(screen.getByRole('button', { name: /tissue/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /subcellular/i })).toBeInTheDocument()
  })

  it('hides tissue expression when the organism has no tissues', () => {
    // The paper's yeast case: hosting YeRI meant deleting this from the source.
    renderPanel({ showTissueExpression: false })
    expect(screen.queryByRole('button', { name: /tissue/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /subcellular/i })).toBeInTheDocument()
  })

  it('hides subcellular location independently', () => {
    renderPanel({ showSubcellularLocation: false })
    expect(screen.getByRole('button', { name: /tissue/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /subcellular/i })).not.toBeInTheDocument()
  })

  it('keeps the interaction tabs whatever is switched off', () => {
    renderPanel({ showTissueExpression: false, showSubcellularLocation: false })
    expect(screen.getByRole('button', { name: /interactions/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Molecular Function/i })).toBeInTheDocument()
  })
})
