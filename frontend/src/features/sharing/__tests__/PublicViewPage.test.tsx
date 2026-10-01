import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { PublicViewPage } from '../PublicViewPage'
import { useAuthStore } from '../../../store/authStore'
import { resetSharingStore, seedSharing } from '../../../mocks/handlers/sharing'

vi.mock('../../search/SearchResultsPage', () => ({
  SearchResultsPage: ({ term, viewState }: { term?: string; viewState?: object }) => (
    <div>
      <span>term:{term}</span>
      <span>state:{JSON.stringify(viewState)}</span>
    </div>
  ),
}))

function renderAt(token: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/public/${token}`]}>
        <Routes>
          <Route path="/public/:token" element={<PublicViewPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PublicViewPage', () => {
  beforeEach(() => {
    resetSharingStore()
    seedSharing({
      views: [
        {
          id: 7,
          name: 'MAPK cluster',
          query: 'MAPK1',
          state: { scoreFilter: 0.7 },
          public_token: 'abc',
          created_at: '2026-08-27T00:00:00Z',
          updated_at: '2026-08-27T00:00:00Z',
        },
      ],
    })
    // Nobody logged in: the link is for people without an account.
    localStorage.clear()
    useAuthStore.setState({ isLoggedIn: false, isAdmin: false, token: null })
  })

  it('re-runs the shared view without a login', async () => {
    renderAt('abc')
    expect(await screen.findByText('term:MAPK1')).toBeInTheDocument()
    expect(screen.getByText('state:{"scoreFilter":0.7}')).toBeInTheDocument()
  })

  it('says so when the link was turned off', async () => {
    renderAt('gone')
    expect(await screen.findByText(/no longer active/i)).toBeInTheDocument()
  })
})
