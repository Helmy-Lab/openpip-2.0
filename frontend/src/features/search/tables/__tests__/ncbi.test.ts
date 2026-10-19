import { describe, it, expect } from 'vitest'
import { proteinLink } from '../ncbi'

const ids = { gene: 'BAD', uniprot: 'Q92934', entrez: '572', ensembl: 'ENSG00000002330' }

describe('proteinLink', () => {
  it('defaults to NCBI Gene', () => {
    expect(proteinLink(ids)).toEqual({ href: 'https://www.ncbi.nlm.nih.gov/gene/572', internal: false })
    expect(proteinLink({ gene: 'A B' }, { proteinLinkTarget: 'ncbi' }).href).toBe(
      'https://www.ncbi.nlm.nih.gov/gene/?term=A%20B%5Bsym%5D',
    )
  })

  it('links to our protein page by UniProt ID, falling back to the gene', () => {
    expect(proteinLink(ids, { proteinLinkTarget: 'protein_page' })).toEqual({ href: '/proteins/Q92934', internal: true })
    expect(proteinLink({ gene: 'BAD' }, { proteinLinkTarget: 'protein_page' }).href).toBe('/proteins/BAD')
  })

  it('fills a custom template with URL-encoded identifiers', () => {
    const settings = {
      proteinLinkTarget: 'custom' as const,
      proteinLinkTemplate: 'https://x.org/{gene}?u={uniprot}&e={entrez}&s={ensembl}&m={missing}',
    }
    expect(proteinLink(ids, settings)).toEqual({
      href: 'https://x.org/BAD?u=Q92934&e=572&s=ENSG00000002330&m={missing}',
      internal: false,
    })
    expect(proteinLink({ gene: 'a/b&c' }, { ...settings, proteinLinkTemplate: 'https://x.org/{gene}/{uniprot}' }).href).toBe(
      'https://x.org/a%2Fb%26c/',
    )
  })

  it('falls back to NCBI for a missing or non-http template', () => {
    expect(proteinLink(ids, { proteinLinkTarget: 'custom', proteinLinkTemplate: null }).href).toContain('ncbi')
    expect(proteinLink(ids, { proteinLinkTarget: 'custom', proteinLinkTemplate: 'javascript:alert({gene})' }).href).toContain('ncbi')
  })
})
