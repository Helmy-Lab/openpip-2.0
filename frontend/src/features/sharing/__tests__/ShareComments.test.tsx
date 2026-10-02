import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ShareComments } from '../ShareComments'
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

const MINE = {
  id: 1,
  author: { username: 'admin', name: 'Test User', affiliation: '', avatar: null },
  body: 'teh liver cluster',
  created_at: '2026-08-28T00:00:00Z',
  edited: false,
}

const THEIRS = {
  id: 2,
  author: { username: 'hleung', name: 'Helen Leung', affiliation: 'Helmy Lab', avatar: null },
  body: 'agreed',
  created_at: '2026-08-28T01:00:00Z',
  edited: false,
}

describe('ShareComments', () => {
  beforeEach(() => {
    resetSharingStore()
    seedSharing({ comments: [MINE, THEIRS] })
    // The request interceptor reads the token from localStorage, and /auth/me
    // — which tells the component which messages are mine — needs it.
    localStorage.setItem('openpip_access_token', 'mock-token')
    useAuthStore.setState({ isLoggedIn: true, isAdmin: false, token: 'mock-token' })
  })

  it('edits your own message and marks it edited', async () => {
    render(<ShareComments shareId={1} />, { wrapper: Wrapper })

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Edit comment'), {
      target: { value: 'the liver cluster' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('the liver cluster')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/edited/)).toBeInTheDocument())
  })

  it("offers no edit on someone else's message", async () => {
    render(<ShareComments shareId={1} />, { wrapper: Wrapper })

    expect(await screen.findByText('agreed')).toBeInTheDocument()
    // One Edit button, for the one message that is mine.
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1)
  })
})
