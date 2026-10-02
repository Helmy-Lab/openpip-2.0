import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ProfileSharingSections } from '../ProfileSharingSections'
import { useAuthStore } from '../../../store/authStore'
import { resetSharingStore, seedSharing } from '../../../mocks/handlers/sharing'
import { resetNetworkStore, seedNetworks } from '../../../mocks/handlers/networks'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => navigate,
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const VIEW = {
  id: 7,
  name: 'MAPK cluster',
  query: 'MAPK1',
  state: {},
  created_at: '2026-08-27T00:00:00Z',
  updated_at: '2026-08-27T00:00:00Z',
}

const NETWORK = {
  id: 3,
  name: 'BAD neighbours',
  query: 'BAD',
  interaction_count: 12,
  created_at: '2026-08-20T00:00:00Z',
}

describe('ProfileSharingSections', () => {
  beforeEach(() => {
    navigate.mockClear()
    resetSharingStore()
    resetNetworkStore()
    seedSharing({ views: [VIEW] })
    seedNetworks([NETWORK])
    localStorage.setItem('openpip_access_token', 'mock-token')
    useAuthStore.setState({ isLoggedIn: true, isAdmin: false, token: 'mock-token' })
  })

  it('keeps both kinds of record in one list, saying which is which', async () => {
    render(<ProfileSharingSections />, { wrapper: Wrapper })

    expect(await screen.findByText('MAPK cluster')).toBeInTheDocument()
    expect(await screen.findByText('BAD neighbours')).toBeInTheDocument()
    expect(screen.getByText(/Live view/)).toBeInTheDocument()
    expect(screen.getByText(/Snapshot · 12 interactions/)).toBeInTheDocument()

    // Only the live view can be shared; a snapshot has nothing to re-run.
    expect(screen.getAllByRole('button', { name: 'Share' })).toHaveLength(1)
  })

  it('opens a view by its own route, so its filters come back', async () => {
    render(<ProfileSharingSections />, { wrapper: Wrapper })
    await screen.findByText('MAPK cluster')

    const [viewOpen, networkOpen] = screen.getAllByRole('button', { name: 'Open' })
    viewOpen.click()
    expect(navigate).toHaveBeenCalledWith('/views/7')

    // A snapshot has no filters to restore, so it just re-runs the search.
    networkOpen.click()
    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/networks\/\d+$/))
  })
})
