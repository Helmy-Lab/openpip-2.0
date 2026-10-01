import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ProfileSharingSections } from '../ProfileSharingSections'
import { useAuthStore } from '../../../store/authStore'
import { resetSharingStore, seedSharing } from '../../../mocks/handlers/sharing'
import { resetNetworkStore } from '../../../mocks/handlers/networks'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SavedViewDetails', () => {
  beforeEach(() => {
    resetSharingStore()
    resetNetworkStore()
    seedSharing({
      views: [
        {
          id: 7,
          name: 'MAPK cluster',
          query: 'MAPK1',
          state: {},
          note: '',
          public_token: null,
          created_at: '2026-08-27T00:00:00Z',
          updated_at: '2026-08-27T00:00:00Z',
        },
      ],
    })
    localStorage.setItem('openpip_access_token', 'mock-token')
    useAuthStore.setState({ isLoggedIn: true, isAdmin: false, token: 'mock-token' })
  })

  async function openDetails() {
    render(<ProfileSharingSections />, { wrapper: Wrapper })
    fireEvent.click(await screen.findByRole('button', { name: 'Details' }))
  }

  it('adds and edits a note on a saved view', async () => {
    await openDetails()
    expect(screen.getByText('No notes yet.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add note' }))
    fireEvent.change(screen.getByLabelText('Notes on MAPK cluster'), {
      target: { value: 'Liver cluster looks off' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }))

    // Wait for the editor to close first — the textarea holds the same text.
    expect(await screen.findByRole('button', { name: 'Edit note' })).toBeInTheDocument()
    expect(screen.getByText('Liver cluster looks off')).toBeInTheDocument()
  })

  it('creates a public link and turns it off again', async () => {
    await openDetails()
    fireEvent.click(screen.getByRole('button', { name: 'Create public link' }))

    const link = (await screen.findByLabelText('Public link')) as HTMLInputElement
    expect(link.value).toMatch(/\/public\/tok7$/)

    fireEvent.click(screen.getByRole('button', { name: 'Turn off link' }))
    expect(await screen.findByRole('button', { name: 'Create public link' })).toBeInTheDocument()
  })
})
