import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderWithProviders'
import { InteractionsTable } from '../InteractionsTable'
import { searchFixture } from '../../../../mocks/fixtures/search'

const { all_proteins: proteins, all_interactions: interactions } = searchFixture

describe('InteractionsTable', () => {
  it('renders column headers', () => {
    renderWithProviders(<InteractionsTable interactions={interactions} proteins={proteins} />)
    expect(screen.getByText('Interactor A')).toBeInTheDocument()
    expect(screen.getByText('Interactor B')).toBeInTheDocument()
    expect(screen.getByText('Score')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Datasets')).toBeInTheDocument()
  })

  it('renders rows with gene names from all three interactions', () => {
    renderWithProviders(<InteractionsTable interactions={interactions} proteins={proteins} />)
    // BAD appears as interactor A in interactions 1 and 3
    const badCells = screen.getAllByText('BAD')
    expect(badCells.length).toBeGreaterThanOrEqual(1)
    // BCL2L1 appears in interactions 1 and 2
    const bcl2l1Cells = screen.getAllByText('BCL2L1')
    expect(bcl2l1Cells.length).toBeGreaterThanOrEqual(1)
    // BAK1 appears in interactions 2 and 3
    const bak1Cells = screen.getAllByText('BAK1')
    expect(bak1Cells.length).toBeGreaterThanOrEqual(1)
  })

  it('renders category badge with correct text', () => {
    renderWithProviders(<InteractionsTable interactions={interactions} proteins={proteins} />)
    expect(screen.getByText('Published')).toBeInTheDocument()
    expect(screen.getByText('Validated')).toBeInTheDocument()
    expect(screen.getByText('Literature')).toBeInTheDocument()
  })

  it('formats score to 2 decimal places', () => {
    renderWithProviders(<InteractionsTable interactions={interactions} proteins={proteins} />)
    // interaction 1 has score 0.82
    expect(screen.getByText('0.82')).toBeInTheDocument()
    // interaction 2 has score 0.65
    expect(screen.getByText('0.65')).toBeInTheDocument()
    // interaction 3 has score 0.45
    expect(screen.getByText('0.45')).toBeInTheDocument()
  })
})
