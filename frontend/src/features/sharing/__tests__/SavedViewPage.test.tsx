import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { SavedViewPage } from '../SavedViewPage'
import { useAuthStore } from '../../../store/authStore'
import { resetSharingStore, seedSharing } from '../../../mocks/handlers/sharing'

// The real results page pulls in Cytoscape; this test is about what it is
// handed, so it stands in for it.
vi.mock('../../search/SearchResultsPage', () => ({
  SearchResultsPage: ({ term, viewState }: { term?: string; viewState?: object }) => (
    <div>
      <span>term:{term}</span>
      <span>state:{JSON.stringify(viewState)}</span>
    </div>
  ),
}))

const VIEW = {
  id: 7,
  name: 'MAPK cluster',
  query: 'MAPK1',
  state: { scoreFilter: 0.7, selectedLayout: 'grid' as const },
  created_at: '2026-08-27T00:00:00Z',
  updated_at: '2026-08-27T00:00:00Z',
}

function renderAt(id: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/views/${id}`]}>
        <Routes>
          <Route path="/views/:id" element={<SavedViewPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SavedViewPage', () => {
  beforeEach(() => {
    resetSharingStore()
    seedSharing({ views: [VIEW] })
    localStorage.setItem('openpip_access_token', 'mock-token')
    useAuthStore.setState({ isLoggedIn: true, isAdmin: false, token: 'mock-token' })
  })

  it('re-runs the search with the filters that were saved', async () => {
    renderAt('7')
    expect(await screen.findByText('term:MAPK1')).toBeInTheDocument()
    expect(
      screen.getByText('state:{"scoreFilter":0.7,"selectedLayout":"grid"}'),
    ).toBeInTheDocument()
  })

  it('says so when the view is gone', async () => {
    renderAt('999')
    expect(await screen.findByText(/no such saved view/i)).toBeInTheDocument()
  })
})
