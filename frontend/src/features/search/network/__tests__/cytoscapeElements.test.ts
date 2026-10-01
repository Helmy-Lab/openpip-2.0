import { describe, it, expect } from 'vitest'
import { getEdgeColorByOrder, buildElements, expressionNodeSize, specificityColor } from '../cytoscapeElements'
import { buildStylesheet } from '../cytoscapeStyles'
import type { Protein, Interaction } from '../../../../types/api'

// Minimal Protein fixture
function makeProtein(overrides: Partial<Protein> & { protein_id: number; protein_gene_name: string }): Protein {
  return {
    protein_uniprot_id: 'Q00001',
    protein_ensembl_id: 'ENSP00000000001',
    protein_entrez_id: '1',
    protein_protein_name: 'Test Protein',
    protein_description: 'A test protein',
    protein_sequence: 'MSEQ',
    number_of_interactions_in_database: 0,
    annotation_array: {},
    tissue_expression_array: {},
    subcellular_location_expression_array: {},
    ...overrides,
  }
}

// Minimal Interaction fixture
function makeInteraction(
  overrides: {
    interaction_id: number
    aId: number
    bId: number
    categoryStatus: string
    highestOrder?: number
    score?: number | null
  }
): Interaction {
  return {
    interaction_id: overrides.interaction_id,
    interactor_A: {
      protein_id: overrides.aId,
      protein_uniprot_id: 'Q00001',
      protein_gene_name: 'GENE_A',
      protein_ensembl_id: 'ENSP00000000001',
    },
    interactor_B: {
      protein_id: overrides.bId,
      protein_uniprot_id: 'Q00002',
      protein_gene_name: 'GENE_B',
      protein_ensembl_id: 'ENSP00000000002',
    },
    score: overrides.score ?? 0.9,
    annotation_array: {},
    experiment_array: [],
    dataset_array: [],
    interaction_category_array: {
      highest_category_status: overrides.categoryStatus,
      highest_order: overrides.highestOrder ?? 1,
      interaction_category_array: [],
    },
  }
}

describe('getEdgeColorByOrder', () => {
  it('order 1 → published color', () => {
    expect(getEdgeColorByOrder(1)).toBe('#38761d')
  })

  it('order 2 → validated color', () => {
    expect(getEdgeColorByOrder(2)).toBe('#1155cc')
  })

  it('order 3 → verified color', () => {
    expect(getEdgeColorByOrder(3)).toBe('#cc0000')
  })

  it('order 4 → literature color', () => {
    expect(getEdgeColorByOrder(4)).toBe('#ff9900')
  })

  it('unknown order → fallback grey', () => {
    expect(getEdgeColorByOrder(99)).toBe('#cccccc')
  })

  it('respects a custom palette', () => {
    const palette = { queryNode: '#000', interactorNode: '#000', published: '#aaa', validated: '#bbb', verified: '#ccc', literature: '#ddd' }
    expect(getEdgeColorByOrder(1, palette)).toBe('#aaa')
    expect(getEdgeColorByOrder(4, palette)).toBe('#ddd')
  })
})

describe('buildElements — node structure', () => {
  const proteins = [
    makeProtein({ protein_id: 1, protein_gene_name: 'BRCA1' }),
    makeProtein({ protein_id: 2, protein_gene_name: 'TP53' }),
  ]
  const queryProteinIds = [1]
  const elements = buildElements(proteins, [], queryProteinIds)

  it('produces one node per protein', () => {
    const nodes = elements.filter((el) => !el.data.source)
    expect(nodes).toHaveLength(2)
  })

  it('node for protein 1 has correct id and label', () => {
    const node = elements.find((el) => el.data.id === 'p1')
    expect(node).toBeDefined()
    expect(node!.data.label).toBe('BRCA1')
  })

  it('query protein has isQuery=true', () => {
    const node = elements.find((el) => el.data.id === 'p1')
    expect(node!.data.isQuery).toBe(true)
  })

  it('non-query protein has isQuery=false', () => {
    const node = elements.find((el) => el.data.id === 'p2')
    expect(node!.data.isQuery).toBe(false)
  })
})

describe('buildElements — edge structure', () => {
  const proteins = [
    makeProtein({ protein_id: 1, protein_gene_name: 'BRCA1' }),
    makeProtein({ protein_id: 2, protein_gene_name: 'TP53' }),
  ]
  const interactions = [
    makeInteraction({ interaction_id: 42, aId: 1, bId: 2, categoryStatus: 'Literature', highestOrder: 4, score: 0.9 }),
  ]
  const elements = buildElements(proteins, interactions, [1])

  it('produces one edge for the interaction', () => {
    const edges = elements.filter((el) => el.data.source !== undefined)
    expect(edges).toHaveLength(1)
  })

  it('edge has correct id', () => {
    const edge = elements.find((el) => el.data.id === 'i42')
    expect(edge).toBeDefined()
  })

  it('edge has correct source and target', () => {
    const edge = elements.find((el) => el.data.id === 'i42')!
    expect(edge.data.source).toBe('p1')
    expect(edge.data.target).toBe('p2')
  })

  it('edge has correct color for Literature (order 4)', () => {
    const edge = elements.find((el) => el.data.id === 'i42')!
    expect(edge.data.color).toBe('#ff9900')
  })

  it('edge has correct score', () => {
    const edge = elements.find((el) => el.data.id === 'i42')!
    expect(edge.data.score).toBe(0.9)
  })

  it('edge has correct category', () => {
    const edge = elements.find((el) => el.data.id === 'i42')!
    expect(edge.data.category).toBe('Literature')
  })
})

describe('buildElements — unknown order fallback', () => {
  const proteins = [
    makeProtein({ protein_id: 1, protein_gene_name: 'A' }),
    makeProtein({ protein_id: 2, protein_gene_name: 'B' }),
  ]
  const interactions = [
    makeInteraction({ interaction_id: 1, aId: 1, bId: 2, categoryStatus: 'HI-Union', highestOrder: 99 }),
  ]

  it('unknown order gets fallback grey', () => {
    const elements = buildElements(proteins, interactions, [])
    const edge = elements.find((el) => el.data.id === 'i1')!
    expect(edge.data.color).toBe('#cccccc')
  })
})

describe('buildStylesheet', () => {
  const sheet = buildStylesheet()
  const selectors = sheet.map((block) => (block as { selector: string }).selector)

  it('has at least 4 selectors', () => {
    expect(sheet.length).toBeGreaterThanOrEqual(4)
  })

  it('includes a node selector', () => {
    expect(selectors).toContain('node')
  })

  it('includes an edge selector', () => {
    expect(selectors).toContain('edge')
  })

  it('node background-color reads from data(nodeColor)', () => {
    const nodeRule = sheet.find(
      (b) => (b as { selector: string }).selector === 'node'
    ) as { style: { 'background-color': string } }
    expect(nodeRule.style['background-color']).toBe('data(nodeColor)')
  })
})

describe('legacy tissue node styling', () => {
  const proteins = [
    makeProtein({ protein_id: 1, protein_gene_name: 'Q', tissue_expression_array: { liver: '10', lung: '20' }, tissue_specificity_array: { liver: '11' } }),
    makeProtein({ protein_id: 2, protein_gene_name: 'A', tissue_expression_array: { liver: '0' }, tissue_specificity_array: { liver: ' -9.5\n' } }),
    makeProtein({ protein_id: 3, protein_gene_name: 'NONE' }),
  ]

  it('sizes nodes at expression x 3, the highest selected tissue winning', () => {
    expect(expressionNodeSize(proteins[0], ['liver'])).toBe(30)
    expect(expressionNodeSize(proteins[0], ['liver', 'lung'])).toBe(60)
    // Zero or missing keeps the default size, as in legacy.
    expect(expressionNodeSize(proteins[1], ['liver'])).toBeNull()
    expect(expressionNodeSize(proteins[2], ['liver'])).toBeNull()
  })

  it('steps specificity into legacy blues, reds for query proteins', () => {
    expect(specificityColor(-11, false)).toBe('#b1c9ef')
    expect(specificityColor(0, false)).toBe('#3c78d8')
    expect(specificityColor(11, false)).toBe('#0f274d')
    expect(specificityColor(0, true)).toBe('#cc0000')
    expect(specificityColor(11, true)).toBe('#5c0000')
    // Legacy left exact thresholds uncolored; they fall into the step below.
    expect(specificityColor(2, false)).toBe('#3c78d8')
  })

  it('applies only the switched-on display and never touches edges', () => {
    const interactions = [makeInteraction({ interaction_id: 1, aId: 1, bId: 2, categoryStatus: 'Published' })]
    const els = buildElements(proteins, interactions, [1], undefined, { tissues: ['liver'], size: false, color: true })
    const byId = (id: string) => els.find((el) => el.data.id === id)!.data
    expect(byId('p1').nodeColor).toBe('#5c0000')
    expect(byId('p2').nodeColor).toBe('#8baee7')
    expect(byId('p3').nodeColor).toBe('#2563eb')
    expect(byId('p1').size).toBeUndefined()
    expect(Object.keys(byId('i1'))).not.toContain('expr')

    const sized = buildElements(proteins, [], [1], undefined, { tissues: ['liver'], size: true, color: false })
    expect(sized.find((el) => el.data.id === 'p1')!.data).toMatchObject({ size: 30, nodeColor: '#e11d48' })
  })

  it('leaves elements untouched with both switches off', () => {
    const els = buildElements(proteins, [], [1], undefined, { tissues: ['liver'], size: false, color: false })
    expect(els.every((el) => el.data.size === undefined)).toBe(true)
    expect(els.find((el) => el.data.id === 'p2')!.data.nodeColor).toBe('#2563eb')
  })
})
