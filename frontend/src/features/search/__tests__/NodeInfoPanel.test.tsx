import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { Protein, Interaction } from '../../../types/api'

vi.mock('../network/useStructureAvailability', () => ({
  useStructureAvailability: vi.fn(() => ({ pdbId: null, loading: false, error: false })),
}))
vi.mock('../network/StructureViewer', () => ({
  StructureViewer: () => <div data-testid="structure-viewer" />,
}))

import { NodeInfoPanel } from '../NodeInfoPanel'
import { useStructureAvailability } from '../network/useStructureAvailability'

const baseProtein: Protein = {
  protein_id: 1,
  protein_uniprot_id: 'Q92934',
  protein_ensembl_id: 'ENSG00000002330',
  protein_entrez_id: '572',
  protein_gene_name: 'BAD',
  protein_protein_name: 'Bcl2-associated agonist of cell death',
  protein_description: 'Promotes cell death.',
  protein_sequence: 'MSEQ',
  number_of_interactions_in_database: 42,
  annotation_array: {},
  tissue_expression_array: {},
  subcellular_location_expression_array: {},
}

const noUniprotProtein: Protein = { ...baseProtein, protein_uniprot_id: '' }

const interactions: Interaction[] = []

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(
    MemoryRouter,
    {},
    createElement(QueryClientProvider, { client: qc }, children)
  )
}

describe('NodeInfoPanel — 3D Structure section', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useStructureAvailability).mockReturnValue({ pdbId: null, loading: false, error: false })
  })

  it('renders the "3D Structure" toggle button when protein has a uniprot_id', () => {
    render(
      <NodeInfoPanel
        protein={baseProtein}
        networkInteractions={interactions}
        onClose={vi.fn()}
        onRemove={vi.fn()}
      />,
      { wrapper }
    )
    expect(screen.getByRole('button', { name: /3D Structure/i })).toBeInTheDocument()
  })

  it('does not render the "3D Structure" button when protein has no uniprot_id', () => {
    render(
      <NodeInfoPanel
        protein={noUniprotProtein}
        networkInteractions={interactions}
        onClose={vi.fn()}
        onRemove={vi.fn()}
      />,
      { wrapper }
    )
    expect(screen.queryByRole('button', { name: /3D Structure/i })).toBeNull()
  })

  it('viewer section is hidden by default', () => {
    render(
      <NodeInfoPanel
        protein={baseProtein}
        networkInteractions={interactions}
        onClose={vi.fn()}
        onRemove={vi.fn()}
      />,
      { wrapper }
    )
    expect(screen.queryByTestId('structure-viewer')).toBeNull()
  })

  it('expands the viewer section when toggle is clicked', () => {
    render(
      <NodeInfoPanel
        protein={baseProtein}
        networkInteractions={interactions}
        onClose={vi.fn()}
        onRemove={vi.fn()}
      />,
      { wrapper }
    )
    fireEvent.click(screen.getByRole('button', { name: /3D Structure/i }))
    expect(screen.getByTestId('structure-viewer')).toBeInTheDocument()
  })

  it('collapses the viewer when toggle is clicked a second time', () => {
    render(
      <NodeInfoPanel
        protein={baseProtein}
        networkInteractions={interactions}
        onClose={vi.fn()}
        onRemove={vi.fn()}
      />,
      { wrapper }
    )
    const toggle = screen.getByRole('button', { name: /3D Structure/i })
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(screen.queryByTestId('structure-viewer')).toBeNull()
  })

  it('PDB tab is disabled when pdbId is null', () => {
    vi.mocked(useStructureAvailability).mockReturnValue({ pdbId: null, loading: false, error: false })
    render(
      <NodeInfoPanel
        protein={baseProtein}
        networkInteractions={interactions}
        onClose={vi.fn()}
        onRemove={vi.fn()}
      />,
      { wrapper }
    )
    fireEvent.click(screen.getByRole('button', { name: /3D Structure/i }))
    expect(screen.getByRole('button', { name: /^PDB$/i })).toBeDisabled()
  })

  it('PDB tab is enabled when pdbId is available', () => {
    vi.mocked(useStructureAvailability).mockReturnValue({ pdbId: '2BID', loading: false, error: false })
    render(
      <NodeInfoPanel
        protein={baseProtein}
        networkInteractions={interactions}
        onClose={vi.fn()}
        onRemove={vi.fn()}
      />,
      { wrapper }
    )
    fireEvent.click(screen.getByRole('button', { name: /3D Structure/i }))
    expect(screen.getByRole('button', { name: /^PDB$/i })).not.toBeDisabled()
  })
})
