import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { PublicProfilePage } from '../PublicProfilePage'
import { useAuthStore } from '../../../store/authStore'
import { resetSharingStore, seedSharing } from '../../../mocks/handlers/sharing'

const ME = { username: 'admin', name: 'Test User', affiliation: '', avatar: null }
const THEM = { username: 'hleung', name: 'Helen Leung', affiliation: 'Helmy Lab', avatar: null }

const SHARE = {
  id: 10,
  saved_view: {
    id: 1,
    name: 'MAPK cluster',
    query: 'MAPK1',
    state: {},
    created_at: '2026-08-27T00:00:00Z',
    updated_at: '2026-08-27T00:00:00Z',
  },
  sender: THEM,
  recipient: ME,
  note: '',
  created_at: '2026-08-27T00:00:00Z',
}

function renderAt(username: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/profile/${username}`]}>
        <Routes>
          <Route path="/profile/:username" element={<PublicProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PublicProfilePage', () => {
  beforeEach(() => {
    resetSharingStore()
    seedSharing({ shares: [SHARE] })
    localStorage.setItem('openpip_access_token', 'mock-token')
    useAuthStore.setState({ isLoggedIn: true, isAdmin: false, token: 'mock-token' })
  })

  it('shows the details behind a name, and what you have shared', async () => {
    renderAt('hleung')

    expect(await screen.findByRole('heading', { name: 'Helen Leung' })).toBeInTheDocument()
    expect(screen.getByText('@hleung')).toBeInTheDocument()
    expect(screen.getByText('Postdoc')).toBeInTheDocument()
    expect(screen.getByText('Helmy Lab')).toBeInTheDocument()
    expect(screen.getByText('Networks.')).toBeInTheDocument()
    expect(screen.getByText(/On openPIP since/)).toBeInTheDocument()

    // The network they sent you, reachable from their profile.
    expect(await screen.findByRole('link', { name: 'MAPK cluster' })).toHaveAttribute(
      'href',
      '/shared/10',
    )
    expect(screen.getByText(/from them/)).toBeInTheDocument()
  })

  it('says so rather than showing a blank page for an unknown name', async () => {
    renderAt('ghost')
    expect(await screen.findByText(/no openPIP user by that name/i)).toBeInTheDocument()
  })
})
