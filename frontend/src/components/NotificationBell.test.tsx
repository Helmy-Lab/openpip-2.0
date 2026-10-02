import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { NotificationBell } from './NotificationBell'
import { useAuthStore } from '../store/authStore'
import { resetSharingStore, seedSharing } from '../mocks/handlers/sharing'

vi.mock('../lib/chime', async () => ({
  ...(await vi.importActual<typeof import('../lib/chime')>('../lib/chime')),
  playChime: vi.fn(),
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('NotificationBell', () => {
  beforeEach(() => {
    resetSharingStore()
    useAuthStore.setState({ isLoggedIn: true, isAdmin: false, token: 'mock-token' })
  })

  it('counts the unread ones and lists them', async () => {
    seedSharing({
      notifications: [
        { id: 1, text: 'Helen shared "MAPK cluster" with you', link: '/shared/3', read: false, created_at: '2026-08-27T00:00:00Z' },
        { id: 2, text: 'Helen commented on "MAPK cluster"', link: '/shared/3', read: true, created_at: '2026-08-26T00:00:00Z' },
      ],
    })
    render(<NotificationBell />, { wrapper: Wrapper })

    const bell = await screen.findByRole('button', { name: /1 unread/i })
    fireEvent.click(bell)
    expect(await screen.findByText(/shared "MAPK cluster" with you/)).toBeInTheDocument()
  })

  it('shows nothing to a signed-out visitor', () => {
    useAuthStore.setState({ isLoggedIn: false, isAdmin: false, token: null })
    const { container } = render(<NotificationBell />, { wrapper: Wrapper })
    expect(container).toBeEmptyDOMElement()
  })

  it('says when there is nothing waiting', async () => {
    seedSharing({ notifications: [] })
    render(<NotificationBell />, { wrapper: Wrapper })
    fireEvent.click(await screen.findByRole('button', { name: /notifications/i }))
    expect(await screen.findByText(/nothing yet/i)).toBeInTheDocument()
  })

  it('empties the bell from the panel, and remembers the sound setting', async () => {
    seedSharing({
      notifications: [
        { id: 1, text: 'Helen shared "MAPK cluster" with you', link: '/shared/3', read: false, created_at: '2026-08-27T00:00:00Z' },
      ],
    })
    render(<NotificationBell />, { wrapper: Wrapper })

    fireEvent.click(await screen.findByRole('button', { name: /1 unread/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Sound on' }))
    expect(screen.getByRole('button', { name: 'Sound off' })).toBeInTheDocument()
    expect(localStorage.getItem('openpip_notify_sound')).toBe('off')

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(await screen.findByText(/nothing yet/i)).toBeInTheDocument()
    // Cleared for good, not just hidden: nothing comes back on the next poll.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull(),
    )
  })

  it('marks all read from the panel without deleting anything', async () => {
    seedSharing({
      notifications: [
        { id: 1, text: 'Helen shared "MAPK cluster" with you', link: '/shared/3', read: false, created_at: '2026-08-27T00:00:00Z' },
      ],
    })
    render(<NotificationBell />, { wrapper: Wrapper })

    fireEvent.click(await screen.findByRole('button', { name: /1 unread/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }))

    // Quieted, not deleted: the row stays, just no longer counted as unread.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument(),
    )
    expect(screen.getByText(/shared "MAPK cluster" with you/)).toBeInTheDocument()
  })

  it('shows a relative time under each notification', async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    seedSharing({
      notifications: [
        { id: 1, text: 'Helen shared "MAPK cluster" with you', link: '/shared/3', read: false, created_at: oneHourAgo },
      ],
    })
    render(<NotificationBell />, { wrapper: Wrapper })

    fireEvent.click(await screen.findByRole('button', { name: /1 unread/i }))
    expect(await screen.findByText(/hour ago/i)).toBeInTheDocument()
  })
})
