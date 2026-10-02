import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminDataPage } from '../AdminDataPage'
import { useCounts } from '../../../api/counts'
import { useDatasets } from '../../../api/downloads'
import {
  useInteractionCategories,
  useDatasetDelete,
} from '../../../api/datasets'

vi.mock('../../../api/counts', () => ({ useCounts: vi.fn() }))
vi.mock('../../../api/downloads', () => ({ useDatasets: vi.fn() }))
vi.mock('../../../api/datasets', () => ({
  useInteractionCategories: vi.fn(),
  useDatasetDelete: vi.fn(),
  useDatasetUpdate: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false, isError: false })),
  useCitationLookup: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}))

const mockCounts = { proteins: 12345, interactions: 67890 }
const mockDatasets = [
  {
    id: 1,
    dataset_reference: '24153252',
    dataset_author: 'Rolland et al.(2014)',
    year: '2014',
    description: 'Human Reference Interactome',
    interaction_status: 'Published',
    name: 'HuRI',
  },
]
const mockCategories = [
  { id: 1, category_name: 'HI-Union', order: '3' },
  { id: 2, category_name: 'Published', order: '1' },
]

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AdminDataPage', () => {
  beforeEach(() => {
    ;(useCounts as ReturnType<typeof vi.fn>).mockReturnValue({ data: mockCounts })
    ;(useDatasets as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockDatasets,
      isLoading: false,
    })
    ;(useInteractionCategories as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockCategories,
      isLoading: false,
    })
    ;(useDatasetDelete as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    })
  })

  // ── Stats cards ──────────────────────────────────────────

  it('renders proteins count stat card', () => {
    render(<AdminDataPage />, { wrapper })
    expect(screen.getByText('12,345')).toBeInTheDocument()
    expect(screen.getByText('Proteins indexed')).toBeInTheDocument()
  })

  it('renders interactions count stat card', () => {
    render(<AdminDataPage />, { wrapper })
    expect(screen.getByText('67,890')).toBeInTheDocument()
    expect(screen.getByText('Interactions')).toBeInTheDocument()
  })

  it('renders datasets count stat card', () => {
    render(<AdminDataPage />, { wrapper })
    expect(screen.getByText('Datasets')).toBeInTheDocument()
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1)
  })

  // ── Step 1 ───────────────────────────────────────────────

  it('shows drag-drop zone on step 1', () => {
    render(<AdminDataPage />, { wrapper })
    expect(screen.getByRole('button', { name: /drop zone for interaction data file/i })).toBeInTheDocument()
  })

  it('Next button is disabled on step 1 when no file is chosen', () => {
    render(<AdminDataPage />, { wrapper })
    const nextBtn = screen.getByRole('button', { name: /next →/i })
    expect(nextBtn).toBeDisabled()
  })

  it('Next button is enabled after a file is selected', async () => {
    render(<AdminDataPage />, { wrapper })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['col1\tcol2'], 'test-dataset.tab', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /next →/i })).not.toBeDisabled(),
    )
  })

  it('shows filename after file is selected', async () => {
    render(<AdminDataPage />, { wrapper })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['col1\tcol2'], 'huri-2024.tab', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(screen.getByText('huri-2024.tab')).toBeInTheDocument())
  })

  // ── Step 2 ───────────────────────────────────────────────

  async function goToStep2() {
    render(<AdminDataPage />, { wrapper })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['col1\tcol2'], 'huri-2024.tab', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByRole('button', { name: /next →/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => expect(screen.getByText('Dataset name')).toBeInTheDocument())
    return new File(['col1\tcol2'], 'huri-2024.tab', { type: 'text/plain' })
  }

  it('shows metadata fields after file is selected and Next clicked', async () => {
    await goToStep2()
    expect(screen.getByText('Dataset name')).toBeInTheDocument()
    expect(screen.getByText('Interaction status')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
  })

  it('pre-fills dataset name from filename', async () => {
    await goToStep2()
    const nameInput = screen.getByPlaceholderText('e.g. HuRI-2024') as HTMLInputElement
    expect(nameInput.value).toBe('huri-2024')
  })

  it('shows category options from useInteractionCategories', async () => {
    await goToStep2()
    expect(screen.getByText('HI-Union')).toBeInTheDocument()
    expect(screen.getAllByText('Published').length).toBeGreaterThanOrEqual(1)
  })

  // ── Step 3 — batched preview via MSW ─────────────────────

  async function goToStep3() {
    render(<AdminDataPage />, { wrapper })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    // Two data rows so runBatchedPreview has something to parse
    const file = new File(['#header\nprotA\tprotB\nprotC\tprotD'], 'huri.tab', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByRole('button', { name: /next →/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => expect(screen.getByText('Dataset name')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /preview →/i }))
    await waitFor(() => expect(screen.getByText('Preview results')).toBeInTheDocument(), { timeout: 3000 })
  }

  it('shows preview results when preview data is available', async () => {
    await goToStep3()
    expect(screen.getByText('Proteins new')).toBeInTheDocument()
    expect(screen.getByText('Proteins existing')).toBeInTheDocument()
  })

  // ── Step 4 — batched import via MSW ──────────────────────

  it('shows success counts after upload completes', async () => {
    await goToStep3()
    fireEvent.click(screen.getByRole('button', { name: /import →/i }))

    await waitFor(
      () => expect(screen.getByText('Dataset imported successfully')).toBeInTheDocument(),
      { timeout: 3000 },
    )
    expect(screen.getByText('Proteins created')).toBeInTheDocument()
    expect(screen.getByText('Interactions created')).toBeInTheDocument()
  })

  it('shows "Upload another file" button after success', async () => {
    await goToStep3()
    fireEvent.click(screen.getByRole('button', { name: /import →/i }))

    await waitFor(
      () => expect(screen.getByRole('button', { name: /upload another file/i })).toBeInTheDocument(),
      { timeout: 3000 },
    )
  })

  it('shows error message when task status is FAILURE', async () => {
    // Override the status handler to return FAILURE
    const { server } = await import('../../../mocks/server')
    const { http, HttpResponse } = await import('msw')
    server.use(
      http.get('/api/datasets/import-async/:taskId', () =>
        HttpResponse.json({
          task_id: 'test-task-123',
          status: 'FAILURE',
          progress: 0,
          proteins_created: 0,
          interactions_created: 0,
          interactions_skipped: 0,
          errors: [],
        })
      )
    )

    await goToStep3()
    fireEvent.click(screen.getByRole('button', { name: /import →/i }))

    await waitFor(
      () => expect(screen.getAllByText(/import failed/i).length).toBeGreaterThan(0),
      { timeout: 3000 },
    )
  })

  it('stops polling when component unmounts', async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')

    await goToStep3()
    fireEvent.click(screen.getByRole('button', { name: /import →/i }))
    // Unmount immediately
    const { unmount } = render(<AdminDataPage />, { wrapper })
    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })

  // ── CSV file support ─────────────────────────────────────

  it('accepts a .csv file and advances to step 2', async () => {
    render(<AdminDataPage />, { wrapper })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(
      ['protein_a,protein_b,score\nuniprotkb:P12345,uniprotkb:P67890,0.82\n'],
      'test-dataset.csv',
      { type: 'text/csv' },
    )
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(screen.getByRole('button', { name: /next →/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))

    await waitFor(() => expect(screen.getByText('Dataset name')).toBeInTheDocument())
    const nameInput = screen.getByPlaceholderText('e.g. HuRI-2024') as HTMLInputElement
    expect(nameInput.value).toBe('test-dataset')
  })

  // ── Step 4 StageChecklist ─────────────────────────────────

  describe('Step4 StageChecklist', () => {
    async function goToStep4() {
      render(<AdminDataPage />, { wrapper })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(
        ['#header\nuniprotkb:P12345\tuniprotkb:P67890\n'],
        'test.tab',
        { type: 'text/tab-separated-values' },
      )
      fireEvent.change(input, { target: { files: [file] } })
      await waitFor(() => expect(screen.getByRole('button', { name: /next →/i })).not.toBeDisabled())
      fireEvent.click(screen.getByRole('button', { name: /next →/i }))
      await waitFor(() => expect(screen.getByText('Dataset name')).toBeInTheDocument())
      const nameInput = screen.getByPlaceholderText('e.g. HuRI-2024') as HTMLInputElement
      fireEvent.change(nameInput, { target: { value: 'TestDS' } })
      await waitFor(() => expect(screen.getByRole('button', { name: /preview →/i })).not.toBeDisabled())
      fireEvent.click(screen.getByRole('button', { name: /preview →/i }))
      await waitFor(() => expect(screen.getByRole('button', { name: /import →/i })).not.toBeDisabled())
      fireEvent.click(screen.getByRole('button', { name: /import →/i }))
    }

    it('renders all four stage rows during import', async () => {
      const { server } = await import('../../../mocks/server')
      const { http, HttpResponse } = await import('msw')
      server.use(
        http.get('/api/datasets/import-async/:taskId', () =>
          HttpResponse.json({
            task_id: 'test-task-123',
            status: 'PROGRESS',
            progress: 50,
            proteins_created: 0,
            interactions_created: 0,
            interactions_skipped: 0,
            errors: [],
            stage: 'parsing',
          })
        )
      )

      await goToStep4()

      await waitFor(() => {
        expect(screen.getByText('Parsing rows')).toBeInTheDocument()
        expect(screen.getByText('Fetching UniProt metadata')).toBeInTheDocument()
        expect(screen.getByText('Fetching Ensembl data')).toBeInTheDocument()
        expect(screen.getByText('Fetching organism names')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('shows checklist when import completes (stage=done)', async () => {
      await goToStep4()

      await waitFor(
        () => expect(screen.getByText('Parsing rows')).toBeInTheDocument(),
        { timeout: 3000 },
      )
    })
  })
})
