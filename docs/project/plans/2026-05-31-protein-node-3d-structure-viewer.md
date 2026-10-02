# Protein Node 3D Structure Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive 3D protein structure viewer (Mol*) to the node popup that appears when clicking a protein node in the network graph — AlphaFold by default, with a PDB toggle if an experimental structure is available.

**Architecture:** A new `StructureViewer` component wraps Mol* with a dynamic import to keep the ~15 MB bundle out of the initial load. A new `useStructureAvailability` hook queries RCSB on popup open (eager) so the PDB tab state is ready before the user expands the section. `NodeInfoPanel` is extracted from `SearchResultsPage.tsx` into its own file so it can be tested independently.

**Tech Stack:** Mol* (`molstar`), TanStack Query, Vitest + React Testing Library, MSW v2, React 18+

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Install | `frontend/package.json` | add `molstar` dependency |
| Create | `frontend/src/mocks/handlers/rcsb.ts` | MSW handler for RCSB search API |
| Modify | `frontend/src/mocks/handlers/index.ts` | register `rcsbHandlers` |
| Create | `frontend/src/features/search/network/useStructureAvailability.ts` | TanStack Query hook: UniProt ID → best PDB ID |
| Create | `frontend/src/features/search/network/__tests__/useStructureAvailability.test.ts` | hook tests |
| Create | `frontend/src/features/search/network/StructureViewer.tsx` | Mol* wrapper component |
| Create | `frontend/src/features/search/network/__tests__/StructureViewer.test.tsx` | component tests |
| Create | `frontend/src/features/search/NodeInfoPanel.tsx` | extracted + enhanced node popup |
| Create | `frontend/src/features/search/__tests__/NodeInfoPanel.test.tsx` | popup 3D section tests |
| Modify | `frontend/src/features/search/SearchResultsPage.tsx` | remove inline NodeInfoPanel, import from new file |

---

## Task 1: Install Mol*

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install the package**

```bash
cd /home/sez876/openpip-2.0/frontend && npm install molstar
```

Expected output: `added N packages` — no errors.

- [ ] **Step 2: Verify the dependency is in package.json**

```bash
grep '"molstar"' /home/sez876/openpip-2.0/frontend/package.json
```

Expected: `"molstar": "^X.Y.Z"`

- [ ] **Step 3: Commit**

```bash
cd /home/sez876/openpip-2.0 && git add frontend/package.json frontend/package-lock.json && git commit -m "chore: install molstar for 3D protein structure viewer"
```

---

## Task 2: RCSB MSW Handler

Add an MSW handler that intercepts the RCSB search API so tests for `useStructureAvailability` can run offline.

**Files:**
- Create: `frontend/src/mocks/handlers/rcsb.ts`
- Modify: `frontend/src/mocks/handlers/index.ts`

- [ ] **Step 1: Create the handler file**

Create `frontend/src/mocks/handlers/rcsb.ts`:

```ts
import { http, HttpResponse } from 'msw'

interface RcsbQueryBody {
  query?: { parameters?: { value?: string[] } }
}

// Fixture: Q92934 (BAD) → PDB 2BID; anything else → no results
export const rcsbHandlers = [
  http.post('https://search.rcsb.org/rcsbsearch/v2/query', async ({ request }) => {
    const body = (await request.json()) as RcsbQueryBody
    const uniprotId = body?.query?.parameters?.value?.[0]

    if (uniprotId === 'Q92934') {
      return HttpResponse.json({
        total_count: 1,
        result_set: [{ identifier: '2BID', score: 1 }],
      })
    }

    return HttpResponse.json({ total_count: 0, result_set: [] })
  }),
]
```

- [ ] **Step 2: Register the handler in the index**

Open `frontend/src/mocks/handlers/index.ts`. Add the import and spread:

```ts
import { settingsHandlers } from './settings'
import { announcementsHandlers } from './announcements'
import { countsHandlers } from './counts'
import { authHandlers } from './auth'
import { searchHandlers } from './search'
import { downloadHandlers } from './downloads'
import { contactHandlers } from './contact'
import { datasetHandlers } from './datasets'
import { proteinHandlers } from './proteins'
import { networksHandlers } from './networks'
import { filesHandlers } from './files'
import { rcsbHandlers } from './rcsb'

export const handlers = [
  ...settingsHandlers,
  ...announcementsHandlers,
  ...countsHandlers,
  ...authHandlers,
  ...searchHandlers,
  ...downloadHandlers,
  ...contactHandlers,
  ...datasetHandlers,
  ...proteinHandlers,
  ...networksHandlers,
  ...filesHandlers,
  ...rcsbHandlers,
]
```

- [ ] **Step 3: Run tests to confirm nothing is broken**

```bash
cd /home/sez876/openpip-2.0/frontend && npm run test -- --run 2>&1 | tail -20
```

Expected: all existing tests still pass.

- [ ] **Step 4: Commit**

```bash
cd /home/sez876/openpip-2.0 && git add frontend/src/mocks/handlers/rcsb.ts frontend/src/mocks/handlers/index.ts && git commit -m "test: add RCSB search MSW handler for structure availability tests"
```

---

## Task 3: `useStructureAvailability` Hook

**Files:**
- Create: `frontend/src/features/search/network/useStructureAvailability.ts`
- Create: `frontend/src/features/search/network/__tests__/useStructureAvailability.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/search/network/__tests__/useStructureAvailability.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { useStructureAvailability } from '../useStructureAvailability'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe('useStructureAvailability', () => {
  it('returns the best PDB ID when RCSB has results for Q92934', async () => {
    const { result } = renderHook(() => useStructureAvailability('Q92934'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.pdbId).toBe('2BID')
    expect(result.current.error).toBe(false)
  })

  it('returns null pdbId when no PDB structure exists', async () => {
    const { result } = renderHook(() => useStructureAvailability('P00000'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.pdbId).toBeNull()
    expect(result.current.error).toBe(false)
  })

  it('is in loading state initially', () => {
    const { result } = renderHook(() => useStructureAvailability('Q92934'), { wrapper })
    expect(result.current.loading).toBe(true)
  })

  it('is idle (not loading) when uniprotId is empty', () => {
    const { result } = renderHook(() => useStructureAvailability(''), { wrapper })
    expect(result.current.loading).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd /home/sez876/openpip-2.0/frontend && npm run test -- --run src/features/search/network/__tests__/useStructureAvailability.test.ts 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module '../useStructureAvailability'`

- [ ] **Step 3: Implement the hook**

Create `frontend/src/features/search/network/useStructureAvailability.ts`:

```ts
import { useQuery } from '@tanstack/react-query'

interface RcsbSearchResponse {
  total_count: number
  result_set: Array<{ identifier: string; score: number }>
}

async function fetchBestPdbId(uniprotId: string): Promise<string | null> {
  const res = await fetch('https://search.rcsb.org/rcsbsearch/v2/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: {
        type: 'terminal',
        service: 'text',
        parameters: {
          attribute: 'rcsb_polymer_entity_container_identifiers.uniprot_ids',
          operator: 'in',
          negation: false,
          value: [uniprotId],
        },
      },
      return_type: 'entry',
      request_options: {
        paginate: { start: 0, rows: 1 },
        sort: [{ sort_by: 'rcsb_entry_info.resolution_combined', direction: 'asc' }],
        results_content_type: ['experimental'],
      },
    }),
  })

  if (!res.ok) throw new Error(`RCSB search failed: ${res.status}`)

  const data: RcsbSearchResponse = await res.json()
  return data.result_set?.[0]?.identifier ?? null
}

export function useStructureAvailability(uniprotId: string): {
  pdbId: string | null
  loading: boolean
  error: boolean
} {
  const { data, isLoading, isError } = useQuery<string | null>({
    queryKey: ['rcsb-pdb', uniprotId],
    queryFn: () => fetchBestPdbId(uniprotId),
    staleTime: 86_400_000,
    retry: 1,
    enabled: !!uniprotId,
  })

  return {
    pdbId: data ?? null,
    loading: isLoading,
    error: isError,
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd /home/sez876/openpip-2.0/frontend && npm run test -- --run src/features/search/network/__tests__/useStructureAvailability.test.ts 2>&1 | tail -20
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/sez876/openpip-2.0 && git add frontend/src/features/search/network/useStructureAvailability.ts frontend/src/features/search/network/__tests__/useStructureAvailability.test.ts && git commit -m "feat: add useStructureAvailability hook — queries RCSB for best PDB entry by UniProt ID"
```

---

## Task 4: `StructureViewer` Component

**Files:**
- Create: `frontend/src/features/search/network/StructureViewer.tsx`
- Create: `frontend/src/features/search/network/__tests__/StructureViewer.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/search/network/__tests__/StructureViewer.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// ------------------------------------------------------------------
// Mock all Mol* dynamic imports — WebGL does not exist in jsdom
// ------------------------------------------------------------------
const mockPlugin = {
  clear: vi.fn().mockResolvedValue(undefined),
  dispose: vi.fn(),
  builders: {
    data: { download: vi.fn().mockResolvedValue({}) },
    structure: {
      parseTrajectory: vi.fn().mockResolvedValue({}),
      hierarchy: { applyPreset: vi.fn().mockResolvedValue(undefined) },
    },
  },
}

vi.mock('molstar/lib/mol-plugin-ui', () => ({
  createPluginUI: vi.fn().mockResolvedValue(mockPlugin),
}))
vi.mock('molstar/lib/mol-plugin-ui/react18', () => ({
  renderReact18: vi.fn(),
}))
vi.mock('molstar/lib/mol-plugin-ui/spec', () => ({
  DefaultPluginUISpec: vi.fn().mockReturnValue({ layout: {} }),
}))
vi.mock('molstar/lib/mol-plugin-ui/skin/light.css', () => ({}))

// Import AFTER mocks are registered
import { StructureViewer } from '../StructureViewer'

describe('StructureViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPlugin.clear.mockResolvedValue(undefined)
    mockPlugin.dispose.mockReset()
    mockPlugin.builders.data.download.mockResolvedValue({})
    mockPlugin.builders.structure.parseTrajectory.mockResolvedValue({})
    mockPlugin.builders.structure.hierarchy.applyPreset.mockResolvedValue(undefined)
  })

  it('shows loading message initially', () => {
    render(<StructureViewer uniprotId="Q92934" source="alphafold" pdbId={null} />)
    expect(screen.getByText('Loading structure…')).toBeInTheDocument()
  })

  it('shows AlphaFold external link after init succeeds', async () => {
    render(<StructureViewer uniprotId="Q92934" source="alphafold" pdbId={null} />)
    await waitFor(() => expect(screen.getByText('↗ View on AlphaFold')).toBeInTheDocument())
  })

  it('downloads AlphaFold CIF with the correct URL', async () => {
    render(<StructureViewer uniprotId="Q92934" source="alphafold" pdbId={null} />)
    await waitFor(() =>
      expect(mockPlugin.builders.data.download).toHaveBeenCalledWith(
        { url: 'https://alphafold.ebi.ac.uk/files/AF-Q92934-F1-model_v4.cif' },
        expect.anything()
      )
    )
  })

  it('shows RCSB PDB external link when source is pdb', async () => {
    render(<StructureViewer uniprotId="Q92934" source="pdb" pdbId="2BID" />)
    await waitFor(() => expect(screen.getByText('↗ View on RCSB PDB')).toBeInTheDocument())
  })

  it('downloads PDB CIF with the correct URL', async () => {
    render(<StructureViewer uniprotId="Q92934" source="pdb" pdbId="2BID" />)
    await waitFor(() =>
      expect(mockPlugin.builders.data.download).toHaveBeenCalledWith(
        { url: 'https://files.rcsb.org/download/2BID.cif' },
        expect.anything()
      )
    )
  })

  it('shows "Could not load viewer" when Mol* import rejects', async () => {
    const { createPluginUI } = await import('molstar/lib/mol-plugin-ui')
    vi.mocked(createPluginUI).mockRejectedValueOnce(new Error('import failed'))
    render(<StructureViewer uniprotId="Q92934" source="alphafold" pdbId={null} />)
    await waitFor(() => expect(screen.getByText('Could not load viewer')).toBeInTheDocument())
  })

  it('shows "Structure not available" when structure download fails', async () => {
    mockPlugin.builders.data.download.mockRejectedValueOnce(new Error('404'))
    render(<StructureViewer uniprotId="Q92934" source="alphafold" pdbId={null} />)
    await waitFor(() => expect(screen.getByText('Structure not available')).toBeInTheDocument())
  })

  it('calls plugin.dispose() on unmount', async () => {
    const { unmount } = render(
      <StructureViewer uniprotId="Q92934" source="alphafold" pdbId={null} />
    )
    await waitFor(() => expect(screen.getByText('↗ View on AlphaFold')).toBeInTheDocument())
    unmount()
    expect(mockPlugin.dispose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /home/sez876/openpip-2.0/frontend && npm run test -- --run src/features/search/network/__tests__/StructureViewer.test.tsx 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module '../StructureViewer'`

- [ ] **Step 3: Implement StructureViewer**

Create `frontend/src/features/search/network/StructureViewer.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'

export interface StructureViewerProps {
  uniprotId: string
  source: 'alphafold' | 'pdb'
  pdbId: string | null
}

type Status = 'loading' | 'ready' | 'error-import' | 'error-structure'

function alphafoldCifUrl(uniprotId: string) {
  return `https://alphafold.ebi.ac.uk/files/AF-${uniprotId}-F1-model_v4.cif`
}

function pdbCifUrl(pdbId: string) {
  return `https://files.rcsb.org/download/${pdbId}.cif`
}

function externalHref(source: 'alphafold' | 'pdb', uniprotId: string, pdbId: string | null) {
  if (source === 'alphafold') return `https://alphafold.ebi.ac.uk/entry/${uniprotId}`
  return pdbId ? `https://www.rcsb.org/structure/${pdbId}` : null
}

export function StructureViewer({ uniprotId, source, pdbId }: StructureViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pluginRef = useRef<any>(null)
  const [status, setStatus] = useState<Status>('loading')

  // Initialise Mol* once on mount; dynamic import keeps it out of initial bundle
  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    async function init() {
      try {
        const [{ createPluginUI }, { renderReact18 }, { DefaultPluginUISpec }] =
          await Promise.all([
            import('molstar/lib/mol-plugin-ui'),
            import('molstar/lib/mol-plugin-ui/react18'),
            import('molstar/lib/mol-plugin-ui/spec'),
          ])
        await import('molstar/lib/mol-plugin-ui/skin/light.css')

        if (cancelled || !containerRef.current) return

        const plugin = await createPluginUI({
          target: containerRef.current,
          render: renderReact18,
          spec: {
            ...DefaultPluginUISpec(),
            layout: {
              initial: {
                isExpanded: false,
                showControls: false,
                regionState: {
                  bottom: 'hidden',
                  left: 'hidden',
                  right: 'hidden',
                  top: 'hidden',
                },
              },
            },
          },
        })

        if (cancelled) {
          plugin.dispose()
          return
        }
        pluginRef.current = plugin
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error-import')
      }
    }

    init()
    return () => {
      cancelled = true
      pluginRef.current?.dispose()
      pluginRef.current = null
    }
  }, [])

  // Load / swap structure whenever plugin is ready or source/ids change
  useEffect(() => {
    if (status !== 'ready' || !pluginRef.current) return
    const plugin = pluginRef.current
    const url =
      source === 'alphafold'
        ? alphafoldCifUrl(uniprotId)
        : pdbId
          ? pdbCifUrl(pdbId)
          : null
    if (!url) return

    async function load() {
      try {
        await plugin.clear()
        const data = await plugin.builders.data.download(
          { url },
          { state: { isGhost: true } }
        )
        const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif')
        await plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default')
      } catch {
        setStatus('error-structure')
      }
    }

    load()
  }, [status, source, uniprotId, pdbId])

  const href = externalHref(source, uniprotId, pdbId)
  const linkLabel = source === 'alphafold' ? '↗ View on AlphaFold' : '↗ View on RCSB PDB'

  return (
    <div>
      <div
        ref={containerRef}
        style={{ height: 180, position: 'relative', background: '#0d0d1e', borderRadius: 4 }}
      >
        {status === 'loading' && (
          <div style={overlay}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading structure…</span>
          </div>
        )}
        {status === 'error-import' && (
          <div style={overlay}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Could not load viewer</span>
            {href && (
              <a href={href} target="_blank" rel="noreferrer" style={extLinkStyle}>
                {linkLabel}
              </a>
            )}
          </div>
        )}
        {status === 'error-structure' && (
          <div style={overlay}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Structure not available</span>
            {href && (
              <a href={href} target="_blank" rel="noreferrer" style={extLinkStyle}>
                {linkLabel}
              </a>
            )}
          </div>
        )}
      </div>
      {status === 'ready' && href && (
        <div style={{ marginTop: 4 }}>
          <a href={href} target="_blank" rel="noreferrer" style={extLinkStyle}>
            {linkLabel}
          </a>
        </div>
      )}
    </div>
  )
}

const overlay: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
}

const extLinkStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--accent)',
  textDecoration: 'none',
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
cd /home/sez876/openpip-2.0/frontend && npm run test -- --run src/features/search/network/__tests__/StructureViewer.test.tsx 2>&1 | tail -20
```

Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/sez876/openpip-2.0 && git add frontend/src/features/search/network/StructureViewer.tsx frontend/src/features/search/network/__tests__/StructureViewer.test.tsx && git commit -m "feat: add StructureViewer component — Mol* wrapper with AlphaFold/PDB support"
```

---

## Task 5: Extract and Enhance `NodeInfoPanel`

**Files:**
- Create: `frontend/src/features/search/NodeInfoPanel.tsx`
- Create: `frontend/src/features/search/__tests__/NodeInfoPanel.test.tsx`
- Modify: `frontend/src/features/search/SearchResultsPage.tsx`

NodeInfoPanel is currently defined inline in SearchResultsPage.tsx. Extracting it to its own file lets it be tested directly without bootstrapping the full page.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/search/__tests__/NodeInfoPanel.test.tsx`:

```tsx
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
        searchTerm="BAD"
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
        searchTerm="BAD"
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
        searchTerm="BAD"
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
        searchTerm="BAD"
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
        searchTerm="BAD"
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
        searchTerm="BAD"
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
        searchTerm="BAD"
        onClose={vi.fn()}
        onRemove={vi.fn()}
      />,
      { wrapper }
    )
    fireEvent.click(screen.getByRole('button', { name: /3D Structure/i }))
    expect(screen.getByRole('button', { name: /^PDB$/i })).not.toBeDisabled()
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /home/sez876/openpip-2.0/frontend && npm run test -- --run src/features/search/__tests__/NodeInfoPanel.test.tsx 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module '../NodeInfoPanel'`

- [ ] **Step 3: Create NodeInfoPanel.tsx**

Create `frontend/src/features/search/NodeInfoPanel.tsx`. Copy the entire `NodeInfoPanel` function from `SearchResultsPage.tsx` (lines 18–134, including the `SECTION` and `EXT_LINK` constants), then add the 3D structure section:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStructureAvailability } from './network/useStructureAvailability'
import { StructureViewer } from './network/StructureViewer'
import type { Protein, Interaction } from '../../types/api'

const SECTION = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase' as const,
  letterSpacing: '.07em',
  marginBottom: 6,
  marginTop: 14,
}

const EXT_LINK = { fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }

export interface NodeInfoPanelProps {
  protein: Protein
  networkInteractions: Interaction[]
  searchTerm: string
  onClose: () => void
  onRemove: (id: number) => void
}

export function NodeInfoPanel({
  protein,
  networkInteractions,
  searchTerm,
  onClose,
  onRemove,
}: NodeInfoPanelProps) {
  const navigate = useNavigate()
  const gene = protein.protein_gene_name || protein.protein_uniprot_id || '—'

  const [viewerOpen, setViewerOpen] = useState(false)
  const [structureSource, setStructureSource] = useState<'alphafold' | 'pdb'>('alphafold')

  const { pdbId, loading: pdbLoading, error: pdbError } = useStructureAvailability(
    protein.protein_uniprot_id
  )

  // Pre-kick Mol* dynamic import so it's in-flight before the user expands.
  // .catch() swallows any rejection so tests don't see an unhandled promise.
  useEffect(() => {
    if (protein.protein_uniprot_id) {
      import('molstar/lib/mol-plugin-ui').catch(() => {})
    }
  }, [protein.protein_uniprot_id])

  const interactionsInNetwork = networkInteractions.filter(
    (ix) =>
      ix.interactor_A.protein_id === protein.protein_id ||
      ix.interactor_B.protein_id === protein.protein_id
  ).length

  const ncbiId = protein.protein_entrez_id
  const ensemblId = protein.protein_ensembl_id
  const uniprotId = protein.protein_uniprot_id

  const pdbDisabled = pdbId === null
  const pdbTitle = pdbError
    ? 'Could not check PDB availability'
    : pdbLoading
      ? 'Checking PDB availability…'
      : 'No PDB structure available for this protein'

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 20,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '16px 18px',
        width: 272,
        boxShadow: '0 6px 24px rgba(0,0,0,.14)',
        maxHeight: 'calc(100% - 24px)',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
            {gene}
          </div>
          {protein.protein_protein_name && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              {protein.protein_protein_name}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: 18,
            lineHeight: 1,
            padding: '0 0 0 8px',
          }}
        >
          ×
        </button>
      </div>

      {/* 3D Structure — only when UniProt ID is known */}
      {uniprotId && (
        <div style={{ marginTop: 12 }}>
          <button
            aria-label="3D Structure"
            onClick={() => setViewerOpen((v) => !v)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              background: 'var(--surface-alt, #2a3060)',
              border: '1px solid var(--border)',
              borderRadius: viewerOpen ? '6px 6px 0 0' : 6,
              color: 'var(--accent)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span>⬡</span>
            <span>3D Structure</span>
            <span style={{ marginLeft: 'auto', fontSize: 10 }}>{viewerOpen ? '▲' : '▼'}</span>
          </button>

          {viewerOpen && (
            <div
              style={{
                border: '1px solid var(--border)',
                borderTop: 'none',
                borderRadius: '0 0 6px 6px',
                overflow: 'hidden',
              }}
            >
              {/* AlphaFold / PDB tab strip */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                <button
                  onClick={() => setStructureSource('alphafold')}
                  style={{
                    flex: 1,
                    padding: '4px 0',
                    border: 'none',
                    borderRight: '1px solid var(--border)',
                    background: structureSource === 'alphafold' ? 'var(--accent)' : 'transparent',
                    color: structureSource === 'alphafold' ? '#fff' : 'var(--text-muted)',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  AlphaFold
                </button>
                <button
                  onClick={() => { if (!pdbDisabled) setStructureSource('pdb') }}
                  disabled={pdbDisabled}
                  title={pdbDisabled ? pdbTitle : undefined}
                  style={{
                    flex: 1,
                    padding: '4px 0',
                    border: 'none',
                    background: structureSource === 'pdb' ? 'var(--accent)' : 'transparent',
                    color: structureSource === 'pdb' ? '#fff' : 'var(--text-muted)',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: pdbDisabled ? 'not-allowed' : 'pointer',
                    opacity: pdbDisabled ? 0.4 : 1,
                  }}
                >
                  PDB
                </button>
              </div>

              <StructureViewer
                uniprotId={uniprotId}
                source={structureSource}
                pdbId={pdbId}
              />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={SECTION}>Actions</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <button
          className="op-btn"
          style={{ fontSize: 12, padding: '6px 12px', textAlign: 'left' }}
          onClick={() => {
            onClose()
            navigate(`/search/${encodeURIComponent(gene)}`)
          }}
        >
          Search {searchTerm || 'openPIP'} for {gene}
        </button>
        <button
          className="op-btn"
          style={{ fontSize: 12, padding: '6px 12px', textAlign: 'left', color: 'var(--warn)' }}
          onClick={() => {
            onRemove(protein.protein_id)
            onClose()
          }}
        >
          Remove {gene} From Network
        </button>
      </div>

      {/* Links */}
      <div style={SECTION}>Links</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
        {ncbiId && (
          <a
            href={`https://www.ncbi.nlm.nih.gov/gene/${ncbiId}`}
            target="_blank"
            rel="noreferrer"
            style={{ ...EXT_LINK, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <img
              src="https://www.ncbi.nlm.nih.gov/favicon.ico"
              width={14}
              height={14}
              alt=""
              style={{ borderRadius: 2, flexShrink: 0 }}
            />
            NCBI Gene
          </a>
        )}
        {uniprotId && (
          <a
            href={`https://www.proteinatlas.org/${uniprotId}`}
            target="_blank"
            rel="noreferrer"
            style={{ ...EXT_LINK, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <img
              src="https://www.proteinatlas.org/favicon.ico"
              width={14}
              height={14}
              alt=""
              style={{ borderRadius: 2, flexShrink: 0 }}
            />
            Human Protein Atlas
          </a>
        )}
        {ensemblId && (
          <a
            href={`https://www.ensembl.org/id/${ensemblId}`}
            target="_blank"
            rel="noreferrer"
            style={{ ...EXT_LINK, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <img
              src="https://www.ensembl.org/favicon.ico"
              width={14}
              height={14}
              alt=""
              style={{ borderRadius: 2, flexShrink: 0 }}
            />
            Ensembl
          </a>
        )}
        {gene !== '—' && (
          <a
            href={`https://www.genecards.org/cgi-bin/carddisp.pl?gene=${gene}`}
            target="_blank"
            rel="noreferrer"
            style={{ ...EXT_LINK, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <img
              src="https://www.genecards.org/favicon.ico"
              width={14}
              height={14}
              alt=""
              style={{ borderRadius: 2, flexShrink: 0 }}
            />
            GeneCards
          </a>
        )}
        {uniprotId && (
          <a
            href={`https://www.uniprot.org/uniprot/${uniprotId}`}
            target="_blank"
            rel="noreferrer"
            style={{ ...EXT_LINK, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <img
              src="https://www.uniprot.org/favicon.ico"
              width={14}
              height={14}
              alt=""
              style={{ borderRadius: 2, flexShrink: 0 }}
            />
            UniProt
          </a>
        )}
      </div>

      {/* Interaction counts */}
      <div style={SECTION}>Number of Interactions</div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div>
          Interactions in Network: <strong>{interactionsInNetwork}</strong>
        </div>
        <div>
          Interactions in Database: <strong>{protein.number_of_interactions_in_database}</strong>
        </div>
      </div>

      {/* Description */}
      {protein.protein_description && (
        <>
          <div style={SECTION}>Description</div>
          <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>
            {protein.protein_description}
          </p>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the NodeInfoPanel tests to confirm they pass**

```bash
cd /home/sez876/openpip-2.0/frontend && npm run test -- --run src/features/search/__tests__/NodeInfoPanel.test.tsx 2>&1 | tail -20
```

Expected: 7 tests PASS.

- [ ] **Step 5: Update SearchResultsPage.tsx to use the extracted component**

Open `frontend/src/features/search/SearchResultsPage.tsx`. Replace the inline `SECTION`, `EXT_LINK` constants and the entire `NodeInfoPanel` function (lines 18–134) with a single import, and update the existing import block:

```tsx
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useSearch } from '../../api/search'
import { useSearchStore } from './searchStore'
import { filterProteinsAndInteractions } from './filterInteractions'
import { CytoscapeNetwork } from './network/CytoscapeNetwork'
import { ResultTablePanel } from './tables/ResultTablePanel'
import { EnrichmentPanel } from './enrichment/EnrichmentPanel'
import { OverlaySystem } from './modals/OverlaySystem'
import { SearchSidebar } from './SearchSidebar'
import { NodeInfoPanel } from './NodeInfoPanel'
import type { Protein, Interaction } from '../../types/api'
```

The rest of `SearchResultsPage.tsx` (the `SearchResultsPage` function itself, the drag-resize logic, JSX) remains unchanged. Delete only the inline constants and `NodeInfoPanel` function.

- [ ] **Step 6: Run the full SearchResultsPage tests to confirm nothing broke**

```bash
cd /home/sez876/openpip-2.0/frontend && npm run test -- --run src/features/search/__tests__/SearchResultsPage.test.tsx 2>&1 | tail -20
```

Expected: all existing SearchResultsPage tests PASS.

- [ ] **Step 7: Add NodeInfoPanel mock to SearchResultsPage.test.tsx**

Since NodeInfoPanel is now imported from its own module, add a mock at the top of `SearchResultsPage.test.tsx` (alongside the existing `vi.mock` calls) so the SearchResultsPage suite doesn't need a QueryClient:

```ts
vi.mock('../NodeInfoPanel', () => ({ NodeInfoPanel: () => null }))
```

Re-run to confirm still passing:

```bash
cd /home/sez876/openpip-2.0/frontend && npm run test -- --run src/features/search/__tests__/SearchResultsPage.test.tsx 2>&1 | tail -20
```

- [ ] **Step 8: Commit**

```bash
cd /home/sez876/openpip-2.0 && git add frontend/src/features/search/NodeInfoPanel.tsx frontend/src/features/search/__tests__/NodeInfoPanel.test.tsx frontend/src/features/search/SearchResultsPage.tsx frontend/src/features/search/__tests__/SearchResultsPage.test.tsx && git commit -m "feat: add 3D structure viewer to node popup — AlphaFold default, PDB toggle"
```

---

## Task 6: Verify Everything

- [ ] **Step 1: Run the full test suite**

```bash
cd /home/sez876/openpip-2.0/frontend && npm run test -- --run 2>&1 | tail -30
```

Expected: all tests pass, no failures.

- [ ] **Step 2: Run the linter**

```bash
cd /home/sez876/openpip-2.0/frontend && npm run lint 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Run a production build**

```bash
cd /home/sez876/openpip-2.0/frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds. Note: the molstar chunk will appear as a separate large chunk (expected — it's loaded dynamically).

- [ ] **Step 4: Final commit if any lint fixes were needed**

If steps 2–3 required any fixes, commit them:

```bash
cd /home/sez876/openpip-2.0 && git add -p && git commit -m "fix: lint and build fixes for 3D structure viewer"
```

---

## Summary of Files Changed

| File | Change |
|---|---|
| `frontend/package.json` | + `molstar` dependency |
| `frontend/src/mocks/handlers/rcsb.ts` | New — RCSB search MSW handler |
| `frontend/src/mocks/handlers/index.ts` | + `rcsbHandlers` |
| `frontend/src/features/search/network/useStructureAvailability.ts` | New — RCSB availability hook |
| `frontend/src/features/search/network/__tests__/useStructureAvailability.test.ts` | New — hook tests |
| `frontend/src/features/search/network/StructureViewer.tsx` | New — Mol* wrapper component |
| `frontend/src/features/search/network/__tests__/StructureViewer.test.tsx` | New — component tests |
| `frontend/src/features/search/NodeInfoPanel.tsx` | New — extracted + enhanced popup |
| `frontend/src/features/search/__tests__/NodeInfoPanel.test.tsx` | New — popup 3D section tests |
| `frontend/src/features/search/SearchResultsPage.tsx` | Remove inline NodeInfoPanel, add import |
| `frontend/src/features/search/__tests__/SearchResultsPage.test.tsx` | + NodeInfoPanel mock |
