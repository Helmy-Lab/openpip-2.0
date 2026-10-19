import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderWithProviders'
import { InteractorsTable } from '../InteractorsTable'
import { searchFixture } from '../../../../mocks/fixtures/search'

const { all_proteins: proteins, query_protein_id_array: queryProteinIds } = searchFixture

describe('InteractorsTable', () => {
  it('renders protein gene names', () => {
    renderWithProviders(<InteractorsTable proteins={proteins} queryProteinIds={queryProteinIds} />)
    expect(screen.getByText('BAD')).toBeInTheDocument()
    expect(screen.getByText('BCL2L1')).toBeInTheDocument()
    expect(screen.getByText('BAK1')).toBeInTheDocument()
  })

  it('shows "Query" for proteins in queryProteinIds and "Interactor" for others', () => {
    renderWithProviders(<InteractorsTable proteins={proteins} queryProteinIds={queryProteinIds} />)
    // queryProteinIds = [1, 2] → BAD (id=1) and BCL2L1 (id=2) are Query
    // BAK1 (id=3) is Interactor
    const queryBadges = screen.getAllByText('Query')
    expect(queryBadges.length).toBe(2)
    const interactorBadges = screen.getAllByText('Interactor')
    expect(interactorBadges.length).toBe(1)
  })

  it('links gene names out to NCBI Gene via the Entrez ID', () => {
    renderWithProviders(<InteractorsTable proteins={proteins} queryProteinIds={queryProteinIds} />)
    // BAD → Entrez 572
    const badLink = screen.getByRole('link', { name: 'BAD' })
    expect(badLink).toHaveAttribute('href', 'https://www.ncbi.nlm.nih.gov/gene/572')
    expect(badLink).toHaveAttribute('target', '_blank')
    expect(badLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders UniProt links for each protein', () => {
    renderWithProviders(<InteractorsTable proteins={proteins} queryProteinIds={queryProteinIds} />)
    // BAD → Q92934
    const badLink = screen.getByRole('link', { name: 'Q92934' })
    expect(badLink).toHaveAttribute('href', 'https://www.uniprot.org/uniprot/Q92934')
    expect(badLink).toHaveAttribute('target', '_blank')
    // BCL2L1 → Q07817
    const bcl2l1Link = screen.getByRole('link', { name: 'Q07817' })
    expect(bcl2l1Link).toHaveAttribute('href', 'https://www.uniprot.org/uniprot/Q07817')
  })
})
