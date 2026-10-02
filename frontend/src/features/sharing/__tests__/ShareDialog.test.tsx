import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ShareDialog } from '../ShareDialog'
import { useAuthStore } from '../../../store/authStore'
import { server } from '../../../mocks/server'
import { resetSharingStore, seedSharing } from '../../../mocks/handlers/sharing'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const VIEW = {
  id: 1,
  name: 'MAPK cluster',
  query: 'MAPK1',
  state: {},
  created_at: '2026-08-27T00:00:00Z',
  updated_at: '2026-08-27T00:00:00Z',
}

describe('ShareDialog', () => {
  beforeEach(() => {
    resetSharingStore()
    seedSharing({ views: [VIEW] })
    useAuthStore.setState({ isLoggedIn: true, isAdmin: false, token: 'mock-token' })
  })

  it('finds a colleague by lab name and shares with a note', async () => {
    let closed = false
    render(
      <ShareDialog savedViewId={1} savedViewName="MAPK cluster" onClose={() => (closed = true)} />,
      { wrapper: Wrapper },
    )

    fireEvent.change(screen.getByLabelText(/find someone on openpip/i), {
      target: { value: 'Helmy Lab' },
    })
    const match = await screen.findByRole('button', { name: /Helen Leung/ })
    fireEvent.click(match)

    fireEvent.change(screen.getByLabelText(/note/i), {
      target: { value: 'Look at the liver cluster' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))

    await waitFor(() => expect(closed).toBe(true))
  })

  it('says so when nobody matches', async () => {
    render(
      <ShareDialog savedViewId={1} savedViewName="MAPK cluster" onClose={() => {}} />,
      { wrapper: Wrapper },
    )
    fireEvent.change(screen.getByLabelText(/find someone on openpip/i), {
      target: { value: 'zzzz' },
    })
    expect(await screen.findByText(/nobody found/i)).toBeInTheDocument()
  })

  it('cannot share before a recipient is picked', () => {
    render(
      <ShareDialog savedViewId={1} savedViewName="MAPK cluster" onClose={() => {}} />,
      { wrapper: Wrapper },
    )
    expect(screen.getByRole('button', { name: 'Share' })).toBeDisabled()
  })

  it('shares with several colleagues, naming the one the mock rejects', async () => {
    // The real handler only ever finds hleung. To exercise the multi-pick
    // loop's partial-failure path, widen search just for this test with a
    // second card — /shares/ still 400s on it, same as any unknown user.
    server.use(
      http.get('/api/users/search', () =>
        HttpResponse.json([
          { username: 'hleung', name: 'Helen Leung', affiliation: 'Helmy Lab', avatar: null },
          { username: 'jdoe', name: 'Jamie Doe', affiliation: 'Other Lab', avatar: null },
        ]),
      ),
    )

    render(
      <ShareDialog savedViewId={1} savedViewName="MAPK cluster" onClose={() => {}} />,
      { wrapper: Wrapper },
    )

    fireEvent.change(screen.getByLabelText(/find someone on openpip/i), {
      target: { value: 'Lab' },
    })
    fireEvent.click(await screen.findByRole('button', { name: /Helen Leung/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Jamie Doe/ }))

    // Both picked people render as a removable list, and the search stayed
    // usable in between — that's the point of the multi-select.
    expect(screen.getByText('Helen Leung')).toBeInTheDocument()
    expect(screen.getByText('Jamie Doe')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove helen leung/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove jamie doe/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Share' }))

    // One saved view, sent to both — the mock accepts hleung and 400s jdoe,
    // so the error line should name Jamie Doe rather than claim total failure.
    expect(await screen.findByText(/did not reach jamie doe/i)).toBeInTheDocument()
  })
})

describe('ShareDialog hint', () => {
  it('says sharing is for openPIP users only and sends no email', () => {
    render(<ShareDialog savedViewId={1} savedViewName="MAPK cluster" onClose={() => {}} />, {
      wrapper: Wrapper,
    })
    expect(screen.getByText(/only with people who have an openPIP account/i)).toHaveTextContent(
      /no email is sent/i,
    )
  })
})
