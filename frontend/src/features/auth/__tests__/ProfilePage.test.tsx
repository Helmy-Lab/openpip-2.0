import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProfilePage } from '../ProfilePage'
import { useAuthStore } from '../../../store/authStore'

vi.mock('../../../api/auth', () => ({
  useProfile: vi.fn(),
  useLogout: vi.fn(),
  useUpdateProfile: vi.fn(),
}))

import { useProfile, useLogout, useUpdateProfile } from '../../../api/auth'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.mocked(useUpdateProfile).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateProfile>)
  vi.mocked(useLogout).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useLogout>)
})

describe('ProfilePage', () => {
  it('shows loading state while profile is fetching', () => {
    useAuthStore.setState({ isLoggedIn: true, isAdmin: false, token: 'mock-token' })

    vi.mocked(useProfile).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useProfile>)

    render(<ProfilePage />, { wrapper })

    expect(screen.getByText(/loading profile/i)).toBeInTheDocument()
  })

  it('shows username when profile loads', () => {
    useAuthStore.setState({ isLoggedIn: true, isAdmin: false, token: 'mock-token' })

    vi.mocked(useProfile).mockReturnValue({
      data: { username: 'testuser', email: 'a@b.com', is_admin: false },
      isLoading: false,
    } as unknown as ReturnType<typeof useProfile>)

    render(<ProfilePage />, { wrapper })

    expect(screen.getByText('testuser')).toBeInTheDocument()
  })

  it('shows the optional details, and edits them', () => {
    useAuthStore.setState({ isLoggedIn: true, isAdmin: false, token: 'mock-token' })
    const mutate = vi.fn()
    vi.mocked(useUpdateProfile).mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateProfile>)
    vi.mocked(useProfile).mockReturnValue({
      data: {
        username: 'testuser',
        email: 'a@b.com',
        is_admin: false,
        name: 'Ada Lovelace',
        affiliation: 'UofT',
        position: '',
        website: 'https://example.org',
        bio: 'Networks.',
        avatar: null,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useProfile>)

    render(<ProfilePage />, { wrapper })

    // The name takes over from the username, and set details are listed.
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('UofT')).toBeInTheDocument()
    expect(screen.getByText('Networks.')).toBeInTheDocument()
    // An empty detail stays off the card.
    expect(screen.queryByText('Position')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }))
    fireEvent.change(screen.getByLabelText('Affiliation'), { target: { value: 'VIDO' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ada Lovelace', affiliation: 'VIDO' }),
      expect.anything(),
    )
  })
})
