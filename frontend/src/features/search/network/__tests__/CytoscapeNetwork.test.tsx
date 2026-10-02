import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import type { Protein, Interaction } from '../../../../types/api'

// ------------------------------------------------------------------
// Mock useSettings so CytoscapeNetwork doesn't need a QueryClient
// ------------------------------------------------------------------
vi.mock('../../../../api/settings', () => ({
  useSettings: () => ({ data: undefined }),
}))

// ------------------------------------------------------------------
// Mock cytoscape-cola — no real DOM canvas needed
// ------------------------------------------------------------------
vi.mock('cytoscape-cola', () => ({ default: {} }))

// ------------------------------------------------------------------
// The in-canvas layout picker reads editable site text; stub it so this
// test needs no QueryClient
// ------------------------------------------------------------------
vi.mock('../../../../text', () => ({
  useText: () => (key: string) => key,
}))

// ------------------------------------------------------------------
// Mock cytoscape itself so .use() doesn't blow up in jsdom
// ------------------------------------------------------------------
vi.mock('cytoscape', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cytoscapeMock: any = vi.fn(() => ({}))
  cytoscapeMock.use = vi.fn()
  return { default: cytoscapeMock }
})

// ------------------------------------------------------------------
// Build a mockCy that stores event handlers and lets tests fire them
// ------------------------------------------------------------------
type HandlerFn = (e: unknown) => void

const handlers: Record<string, HandlerFn[]> = {}

// Collections record the opacity they were given, so a test can read back what
// the highlight did without a real Cytoscape instance.
type MockNode = { data: (k: string) => string; opacity?: number }
const mockNodes: MockNode[] = [
  { data: (k: string) => (k === 'label' ? 'BAD' : 'n1') },
  { data: (k: string) => (k === 'label' ? 'BCL2L1' : 'n2') },
]
const styled: { target: string; opacity: number }[] = []

function collection(target: string, nodes: MockNode[] = []) {
  return {
    style: vi.fn(({ opacity }: { opacity: number }) => styled.push({ target, opacity })),
    filter: (fn: (n: MockNode) => boolean) => collection('lit', nodes.filter(fn)),
    edgesWith: () => collection('litEdges'),
    length: nodes.length,
    nodes,
  }
}

const mockCy = {
  on: vi.fn((event: string, selector: string, cb: HandlerFn) => {
    const key = `${event}:${selector}`
    handlers[key] = handlers[key] ?? []
    handlers[key].push(cb)
  }),
  removeAllListeners: vi.fn(),
  layout: vi.fn(() => ({ run: vi.fn() })),
  elements: vi.fn(() => collection('all')),
  nodes: vi.fn(() => collection('nodes', mockNodes)),
}

// ------------------------------------------------------------------
// Mock react-cytoscapejs — render a placeholder and call cy callback
// ------------------------------------------------------------------
vi.mock('react-cytoscapejs', () => ({
  default: ({ cy }: { cy?: (c: unknown) => void }) => {
    if (cy) cy(mockCy)
    return <div data-testid="cytoscape-mock" />
  },
}))

// ------------------------------------------------------------------
// Import component AFTER mocks are set up
// ------------------------------------------------------------------
import { CytoscapeNetwork } from '../CytoscapeNetwork'
import { useSearchStore } from '../../searchStore'

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------
function makeProtein(id: number, gene: string): Protein {
  return {
    protein_id: id,
    protein_uniprot_id: `Q0000${id}`,
    protein_ensembl_id: `ENSP0000000000${id}`,
    protein_entrez_id: String(id),
    protein_gene_name: gene,
    protein_protein_name: 'Test Protein',
    protein_description: 'desc',
    protein_sequence: 'MSEQ',
    number_of_interactions_in_database: 0,
    annotation_array: {},
    tissue_expression_array: {},
    subcellular_location_expression_array: {},
  }
}

function makeInteraction(id: number, aId: number, bId: number): Interaction {
  return {
    interaction_id: id,
    interactor_A: {
      protein_id: aId,
      protein_uniprot_id: 'Q00001',
      protein_gene_name: 'GENE_A',
      protein_ensembl_id: 'ENSP00000000001',
    },
    interactor_B: {
      protein_id: bId,
      protein_uniprot_id: 'Q00002',
      protein_gene_name: 'GENE_B',
      protein_ensembl_id: 'ENSP00000000002',
    },
    score: 0.9,
    annotation_array: {},
    experiment_array: [],
    dataset_array: [],
    interaction_category_array: {
      highest_category_status: 'Literature',
      highest_order: 1,
      interaction_category_array: [],
    },
  }
}

const proteins = [makeProtein(1, 'BRCA1'), makeProtein(2, 'TP53')]
const interactions = [makeInteraction(42, 1, 2)]

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------
describe('CytoscapeNetwork', () => {
  beforeEach(() => {
    // Clear handler registry and mock call counts between tests
    for (const key of Object.keys(handlers)) {
      delete handlers[key]
    }
    mockCy.on.mockClear()
    mockCy.removeAllListeners.mockClear()
    mockCy.layout.mockClear()
  })

  it('renders the cytoscape container placeholder', () => {
    render(
      <CytoscapeNetwork
        proteins={proteins}
        interactions={interactions}
        queryProteinIds={[1]}
        layout="cola"
      />
    )
    expect(screen.getByTestId('cytoscape-mock')).toBeInTheDocument()
  })

  it('does not crash with empty proteins and interactions', () => {
    render(
      <CytoscapeNetwork
        proteins={[]}
        interactions={[]}
        queryProteinIds={[]}
        layout="cose"
      />
    )
    expect(screen.getByTestId('cytoscape-mock')).toBeInTheDocument()
  })

  it('shows tooltip div when mouseover handler fires on a node', async () => {
    render(
      <CytoscapeNetwork
        proteins={proteins}
        interactions={interactions}
        queryProteinIds={[1]}
        layout="cola"
      />
    )

    // Tooltip should not be present initially
    expect(screen.queryByText('BAD')).toBeNull()

    // Simulate the mouseover event being fired by cytoscape
    await act(async () => {
      const mouseoverHandlers = handlers['mouseover:node']
      expect(mouseoverHandlers).toBeDefined()
      mouseoverHandlers?.[0]?.({
        target: {
          data: (k: string) => (k === 'label' ? 'BAD' : ''),
        },
        originalEvent: { clientX: 100, clientY: 200 },
      })
    })

    expect(screen.getByText('BAD')).toBeInTheDocument()
  })

  it('hides tooltip after mouseout fires', async () => {
    render(
      <CytoscapeNetwork
        proteins={proteins}
        interactions={interactions}
        queryProteinIds={[1]}
        layout="cola"
      />
    )

    // First show the tooltip
    await act(async () => {
      handlers['mouseover:node']?.[0]?.({
        target: { data: (k: string) => (k === 'label' ? 'GENE_A' : '') },
        originalEvent: { clientX: 50, clientY: 80 },
      })
    })

    expect(screen.getByText('GENE_A')).toBeInTheDocument()

    // Then hide it via mouseout
    await act(async () => {
      handlers['mouseout:node']?.[0]?.({})
    })

    expect(screen.queryByText('GENE_A')).toBeNull()
  })

  it('calls onNodeClick with the matching protein when a node is tapped', async () => {
    const onNodeClick = vi.fn()
    render(
      <CytoscapeNetwork
        proteins={proteins}
        interactions={interactions}
        queryProteinIds={[1]}
        layout="cola"
        onNodeClick={onNodeClick}
      />
    )

    await act(async () => {
      handlers['tap:node']?.[0]?.({
        target: { data: (k: string) => (k === 'id' ? 'p1' : '') },
      })
    })

    expect(onNodeClick).toHaveBeenCalledWith(proteins[0])
  })

  it('calls onEdgeClick with the matching interaction when an edge is tapped', async () => {
    const onEdgeClick = vi.fn()
    render(
      <CytoscapeNetwork
        proteins={proteins}
        interactions={interactions}
        queryProteinIds={[1]}
        layout="cola"
        onEdgeClick={onEdgeClick}
      />
    )

    await act(async () => {
      handlers['tap:edge']?.[0]?.({
        target: { data: (k: string) => (k === 'id' ? 'i42' : '') },
      })
    })

    expect(onEdgeClick).toHaveBeenCalledWith(interactions[0])
  })


  it('hands the network to Cytoscape and names the button on hover', () => {
    render(
      <CytoscapeNetwork
        proteins={proteins}
        interactions={interactions}
        queryProteinIds={[1]}
        layout="cola"
      />
    )
    const button = screen.getByRole('button', { name: 'search.download.cytoscape' })
    expect(button).toHaveAttribute('title', 'search.download.cytoscape')

    fireEvent.click(button)
    expect(useSearchStore.getState().activeModal).toBe('cyRest')
  })

  it('dims the network and lights the highlighted term', async () => {
    render(
      <CytoscapeNetwork
        proteins={proteins}
        interactions={interactions}
        queryProteinIds={[1]}
        layout="cola"
      />
    )

    styled.length = 0
    await act(async () => {
      useSearchStore.getState().setHighlight({ term: 'GO:0006915', genes: ['BAD'] })
    })
    expect(styled).toEqual([
      { target: 'all', opacity: 0.2 },
      { target: 'lit', opacity: 1 },
      { target: 'litEdges', opacity: 1 },
    ])

    styled.length = 0
    await act(async () => {
      useSearchStore.getState().setHighlight(null)
    })
    expect(styled).toEqual([{ target: 'all', opacity: 1 }])
  })
})
