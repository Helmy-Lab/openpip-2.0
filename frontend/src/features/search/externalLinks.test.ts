import { describe, it, expect } from 'vitest'
import { buildLinks } from './externalLinks'
import type { Protein, Interaction } from '../../types/api'

const protein = (id: number, gene: string) =>
  ({ protein_id: id, protein_gene_name: gene, protein_entrez_id: `${id}` }) as Protein

const interaction = (a: string, b: string) =>
  ({
    interactor_A: { protein_gene_name: a },
    interactor_B: { protein_gene_name: b },
  }) as Interaction

describe('buildLinks', () => {
  const proteins = [protein(1, 'BAD'), protein(2, 'BCL2')]
  const interactions = [interaction('BAD', 'BCL2'), interaction('BAD', 'BAD')]
  const href = (id: string) =>
    buildLinks(proteins, [1], interactions).find((l) => l.id === id)?.href

  it('puts the gene list in the gene-list.com path', () => {
    expect(href('genelist')).toBe('https://www.gene-list.com/search/BAD,BCL2')
  })

  it('spells Genelist as one word', () => {
    expect(buildLinks(proteins, [1], interactions).find((l) => l.id === 'genelist')?.label).toBe('Genelist')
  })

  it('gives every tool a logo', () => {
    const missing = buildLinks(proteins, [1], interactions)
      .filter((l) => !l.icon)
      .map((l) => l.id)
    expect(missing).toEqual([])
  })

  it('sends nodes and space-joined edge pairs to Drugst.One', () => {
    expect(href('drugstone')).toBe(
      'https://drugst.one/standalone?nodes=BAD,BCL2' +
        '&edges=BAD%20BCL2,BAD%20BAD' +
        '&autofillEdges=false'
    )
  })
})
