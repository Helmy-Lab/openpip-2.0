import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ShareList } from '../ShareList'
import { useAuthStore } from '../../../store/authStore'
import { resetSharingStore, seedSharing } from '../../../mocks/handlers/sharing'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const ME = { username: 'admin', name: 'Test User', affiliation: '', avatar: null }
const THEM = { username: 'hleung', name: 'Helen Leung', affiliation: 'Helmy Lab', avatar: null }

const VIEW = {
  id: 1,
  name: 'MAPK cluster',
  query: 'MAPK1',
  state: {},
  created_at: '2026-08-27T00:00:00Z',
  updated_at: '2026-08-27T00:00:00Z',
}

const RECEIVED = {
  id: 10,
  saved_view: VIEW,
  sender: THEM,
  recipient: ME,
  note: 'Look at the liver cluster',
  created_at: '2026-08-27T00:00:00Z',
}

const SENT = {
  id: 11,
  saved_view: { ...VIEW, id: 2, name: 'TP53 neighbours', query: 'TP53' },
  sender: ME,
  recipient: THEM,
  note: '',
  created_at: '2026-08-27T00:00:00Z',
}

describe('ShareList', () => {
  beforeEach(() => {
    resetSharingStore()
    seedSharing({ shares: [RECEIVED, SENT] })
    localStorage.setItem('openpip_access_token', 'mock-token')
    useAuthStore.setState({ isLoggedIn: true, isAdmin: false, token: 'mock-token' })
  })

  it('lists what colleagues sent you, and opens the details', async () => {
    render(<ShareList direction="received" />, { wrapper: Wrapper })

    expect(screen.getByText('Shared With Me')).toBeInTheDocument()
    expect(await screen.findByText('MAPK cluster')).toBeInTheDocument()
    expect(screen.getByText(/from/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Helen Leung' })).toBeInTheDocument()
    expect(screen.queryByText('TP53 neighbours')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(screen.getByText('MAPK1')).toBeInTheDocument()
    expect(screen.getByText('Look at the liver cluster')).toBeInTheDocument()
    expect(await screen.findByPlaceholderText('Add a comment')).toBeInTheDocument()
  })

  it('lists what you sent, addressed to the recipient', async () => {
    render(<ShareList direction="sent" />, { wrapper: Wrapper })

    expect(screen.getByText('Shared By Me')).toBeInTheDocument()
    expect(await screen.findByText('TP53 neighbours')).toBeInTheDocument()
    expect(screen.getByText(/to/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revoke TP53 neighbours' })).toBeInTheDocument()
    expect(screen.queryByText('MAPK cluster')).toBeNull()
  })
})
