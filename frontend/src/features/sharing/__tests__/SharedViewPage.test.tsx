import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { SharedViewPage } from '../SharedViewPage'
import { useAuthStore } from '../../../store/authStore'
import { resetSharingStore, seedSharing } from '../../../mocks/handlers/sharing'

// The full results page pulls in Cytoscape and friends; the banner is all
// this test cares about, so stub it down to just that prop.
vi.mock('../../search/SearchResultsPage', () => ({
  SearchResultsPage: ({ banner }: { banner?: React.ReactNode }) => <div>{banner}</div>,
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/shared/10']}>
        <Routes>
          <Route path="/shared/:id" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

// The mock "me" (see mocks/handlers/auth.ts) is 'admin'; the other colleague
// the sharing handlers know about is 'hleung'.
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

function login() {
  localStorage.setItem('openpip_access_token', 'mock-token')
  useAuthStore.setState({ isLoggedIn: true, isAdmin: false, token: 'mock-token' })
}

beforeEach(() => {
  resetSharingStore()
  login()
})

describe('SharedViewPage save-a-copy', () => {
  it('lets the recipient save their own copy of a shared view', async () => {
    seedSharing({
      shares: [
        {
          id: 10,
          saved_view: VIEW,
          sender: THEM,
          recipient: ME,
          note: '',
          created_at: '2026-08-27T00:00:00Z',
        },
      ],
    })

    render(<SharedViewPage />, { wrapper: Wrapper })

    const saveButton = await screen.findByRole('button', { name: 'Save a copy' })
    fireEvent.click(saveButton)

    const nameInput = await screen.findByLabelText('Name')
    expect(nameInput).toHaveValue('MAPK cluster')

    fireEvent.change(nameInput, { target: { value: 'MAPK cluster (mine)' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(screen.getByText(/Saved.*Saved Views/)).toBeInTheDocument(),
    )
  })

  it('does not offer a copy to the sender viewing their own share', async () => {
    seedSharing({
      shares: [
        {
          id: 10,
          saved_view: VIEW,
          sender: ME,
          recipient: THEM,
          note: '',
          created_at: '2026-08-27T00:00:00Z',
        },
      ],
    })

    render(<SharedViewPage />, { wrapper: Wrapper })

    await screen.findByText('MAPK cluster')
    // `me` (from /auth/me) resolves after the share does, so give the
    // sender check a tick to settle before asserting the button is gone.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Save a copy' })).toBeNull(),
    )
  })
})
