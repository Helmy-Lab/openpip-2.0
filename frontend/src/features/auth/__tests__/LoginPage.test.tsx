import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginPage } from '../LoginPage'

vi.mock('../../../api/auth', () => ({
  useLogin: vi.fn(),
}))

import { useLogin } from '../../../api/auth'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('LoginPage', () => {
  it('renders username and password fields', () => {
    vi.mocked(useLogin).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useLogin>)

    render(<LoginPage />, { wrapper })

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('renders submit button', () => {
    vi.mocked(useLogin).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useLogin>)

    render(<LoginPage />, { wrapper })

    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows error message when mutation returns error', () => {
    vi.mocked(useLogin).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: new Error('bad'),
    } as unknown as ReturnType<typeof useLogin>)

    render(<LoginPage />, { wrapper })

    expect(screen.getByText(/invalid username or password/i)).toBeInTheDocument()
  })
})

describe('LoginPage after signing in', () => {
  it('goes back to the page the visitor came from', async () => {
    const { fireEvent } = await import('@testing-library/react')
    const { Routes, Route } = await import('react-router-dom')
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query')
    vi.mocked(useLogin).mockReturnValue({
      mutate: (_vars: unknown, opts: { onSuccess: () => void }) => opts.onSuccess(),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useLogin>)

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter
          initialEntries={[{ pathname: '/login', state: { from: { pathname: '/search/TP53' } } }]}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/search/:term" element={<p>search page</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'ada' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(await screen.findByText('search page')).toBeInTheDocument()
  })
})
