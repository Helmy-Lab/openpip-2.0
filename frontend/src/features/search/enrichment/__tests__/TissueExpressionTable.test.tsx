import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TissueExpressionTable } from '../TissueExpressionTable'
import type { Protein } from '../../../../types/api'

function makeProtein(overrides: Partial<Protein> = {}): Protein {
  return {
    protein_id: 1,
    protein_gene_name: 'BAD',
    protein_uniprot_id: 'Q92934',
    protein_ensembl_id: 'ENSG00000026103',
    protein_entrez_id: '572',
    protein_protein_name: 'BAD',
    protein_description: '',
    protein_sequence: '',
    number_of_interactions_in_database: 0,
    annotation_array: {},
    tissue_expression_array: {},
    subcellular_location_expression_array: {},
    ...overrides,
  }
}

describe('TissueExpressionTable', () => {
  it('shows empty message when no proteins have tissue data', () => {
    render(<TissueExpressionTable proteins={[makeProtein()]} />)
    expect(screen.getByText(/no tissue expression data/i)).toBeTruthy()
  })

  it('shows only tissues with expression >= 5.0 (legacy threshold)', () => {
    const proteins = [
      makeProtein({
        tissue_expression_array: {
          liver: '10.18',
          lung: '4.99',   // below threshold — should not appear
          whole_blood: '8.23',
        },
      }),
    ]
    render(<TissueExpressionTable proteins={proteins} />)
    expect(screen.getByText(/liver/i)).toBeTruthy()
    expect(screen.getByText(/whole blood/i)).toBeTruthy()
    expect(screen.queryByText(/\blung\b/i)).toBeNull()
  })

  it('strips trailing \\r from expression values', () => {
    const proteins = [
      makeProtein({
        tissue_expression_array: { liver: '10.18\r' },
      }),
    ]
    render(<TissueExpressionTable proteins={proteins} />)
    expect(screen.getByText(/liver/i)).toBeTruthy()
  })

  // The tab credited the Human Protein Atlas until 2026-08, but the tissue
  // vocabulary is GTEx throughout (adipose_visceral_omentum, artery_tibial,
  // heart_atrial_appendage) and legacy search_results.js says "based on GTEx
  // data". Guard against the miscitation coming back.
  it('credits GTEx, not the Human Protein Atlas', () => {
    const proteins = [makeProtein({ tissue_expression_array: { liver: '10.18' } })]
    render(<TissueExpressionTable proteins={proteins} />)
    // Named twice: once in the row's Dataset cell, once in the footer link.
    expect(screen.getAllByText('GTEx v6.0')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'GTEx v6.0' }).getAttribute('href')).toBe(
      'https://gtexportal.org'
    )
    expect(screen.queryByText(/Human Protein Atlas/)).toBeNull()
    expect(screen.queryByText(/Uhlén/)).toBeNull()
  })

  // The 36-tissue set is GTEx v6.0 put through YARN and inherited from HuRI,
  // not a raw GTEx download — see docs/project/DATA_PROVENANCE_QUESTIONS.md. Losing the
  // processing citation would leave the release alone on screen, implying the
  // values are raw GTEx units when they are qsmooth-normalized.
  it('cites the YARN processing step, not just the release', () => {
    const proteins = [makeProtein({ tissue_expression_array: { liver: '10.18' } })]
    render(<TissueExpressionTable proteins={proteins} />)
    expect(screen.getByText(/normalized with YARN/)).toBeTruthy()
    expect(screen.getByText(/Paulson et al\./)).toBeTruthy()
    expect(screen.getByText(/qsmooth-normalized expression level/)).toBeTruthy()
  })

  // qsmooth values do not convert to TPM. An earlier draft of this footer very
  // nearly shipped "5.0 is roughly TPM 31", inferred from the value
  // distribution alone. Keep TPM claims off this tab until the normalization
  // question in the provenance doc is answered.
  it('does not interpret the threshold in TPM', () => {
    const proteins = [makeProtein({ tissue_expression_array: { liver: '10.18' } })]
    render(<TissueExpressionTable proteins={proteins} />)
    expect(screen.queryByText(/TPM/)).toBeNull()
  })
})
