import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminAnnouncementPage } from '../AdminAnnouncementPage'
import {
  useAdminAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
} from '../../../api/announcements'

vi.mock('../../../api/announcements', () => ({
  useAdminAnnouncements: vi.fn(),
  useCreateAnnouncement: vi.fn(),
  useUpdateAnnouncement: vi.fn(),
  useDeleteAnnouncement: vi.fn(),
}))

// react-quill-new renders a controlled editor; stub it to a plain textarea for tests
vi.mock('react-quill-new', () => ({
  default: ({ value, onChange, placeholder }: { value: string; onChange: (v: string, d: unknown, s: string) => void; placeholder?: string }) => (
    <textarea
      data-testid="quill-editor"
      value={value}
      onChange={(e) => onChange(e.target.value, {}, 'user')}
      placeholder={placeholder}
    />
  ),
}))

const activeAnn = {
  id: 1,
  title: 'Active Announcement',
  text: '<p>Active content</p>',
  date: '2026-05-01T10:00:00Z',
  show: true,
  showOnHomePage: true,
}

const hiddenAnn = {
  id: 2,
  title: 'Hidden Announcement',
  text: '<p>Hidden content</p>',
  date: '2026-03-10T08:00:00Z',
  show: false,
  showOnHomePage: false,
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AdminAnnouncementPage', () => {
  const mockCreate = vi.fn()
  const mockUpdate = vi.fn()
  const mockDelete = vi.fn()

  beforeEach(() => {
    ;(useCreateAnnouncement as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockCreate,
      isPending: false,
    })
    ;(useUpdateAnnouncement as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockUpdate,
      isPending: false,
    })
    ;(useDeleteAnnouncement as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockDelete,
      isPending: false,
    })
    mockCreate.mockReset()
    mockUpdate.mockReset()
    mockDelete.mockReset()
  })

  it('shows loading state', () => {
    ;(useAdminAnnouncements as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: true,
    })
    render(<AdminAnnouncementPage />, { wrapper })
    expect(screen.getByText('Loading announcements…')).toBeInTheDocument()
  })

  it('renders page header', () => {
    ;(useAdminAnnouncements as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
    })
    render(<AdminAnnouncementPage />, { wrapper })
    expect(screen.getByRole('heading', { name: /announcements/i, level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new announcement/i })).toBeInTheDocument()
  })

  it('shows "No active announcements" when list is empty', () => {
    ;(useAdminAnnouncements as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
    })
    render(<AdminAnnouncementPage />, { wrapper })
    expect(screen.getByText('No active announcements.')).toBeInTheDocument()
  })

  it('renders active announcements with Edit and Hide buttons', () => {
    ;(useAdminAnnouncements as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [activeAnn],
      isLoading: false,
    })
    render(<AdminAnnouncementPage />, { wrapper })
    expect(screen.getByText('Active Announcement')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^hide$/i })).toBeInTheDocument()
  })

  it('renders history section with Restore and Delete buttons', () => {
    ;(useAdminAnnouncements as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [hiddenAnn],
      isLoading: false,
    })
    render(<AdminAnnouncementPage />, { wrapper })
    expect(screen.getByText('Hidden Announcement')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^restore$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
  })

  it('shows "Home" chip for announcements shown on home page', () => {
    ;(useAdminAnnouncements as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [activeAnn],
      isLoading: false,
    })
    render(<AdminAnnouncementPage />, { wrapper })
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('toggling "New announcement" button shows/hides create form', async () => {
    ;(useAdminAnnouncements as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
    })
    render(<AdminAnnouncementPage />, { wrapper })
    const btn = screen.getByRole('button', { name: /new announcement/i })

    fireEvent.click(btn)
    expect(screen.getByPlaceholderText('Announcement title')).toBeInTheDocument()

    fireEvent.click(btn)
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Announcement title')).not.toBeInTheDocument(),
    )
  })

  it('clicking Hide calls updateAnnouncement with show: false', () => {
    ;(useAdminAnnouncements as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [activeAnn],
      isLoading: false,
    })
    render(<AdminAnnouncementPage />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: /^hide$/i }))
    expect(mockUpdate).toHaveBeenCalledWith({ id: 1, data: { show: false } })
  })

  it('clicking Restore calls updateAnnouncement with show: true', () => {
    ;(useAdminAnnouncements as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [hiddenAnn],
      isLoading: false,
    })
    render(<AdminAnnouncementPage />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: /^restore$/i }))
    expect(mockUpdate).toHaveBeenCalledWith({ id: 2, data: { show: true } })
  })

  it('clicking Delete opens confirm dialog and calls deleteAnnouncement on confirm', () => {
    ;(useAdminAnnouncements as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [hiddenAnn],
      isLoading: false,
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AdminAnnouncementPage />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(mockDelete).toHaveBeenCalledWith(2)
  })

  it('clicking Delete does nothing when confirm is cancelled', () => {
    ;(useAdminAnnouncements as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [hiddenAnn],
      isLoading: false,
    })
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<AdminAnnouncementPage />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('clicking Edit switches card to edit form', () => {
    ;(useAdminAnnouncements as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [activeAnn],
      isLoading: false,
    })
    render(<AdminAnnouncementPage />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(screen.getByDisplayValue('Active Announcement')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('cancel edit returns card to view mode', async () => {
    ;(useAdminAnnouncements as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [activeAnn],
      isLoading: false,
    })
    render(<AdminAnnouncementPage />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
  })

  it('renders both Active and History sections when both have items', () => {
    ;(useAdminAnnouncements as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [activeAnn, hiddenAnn],
      isLoading: false,
    })
    render(<AdminAnnouncementPage />, { wrapper })
    expect(screen.getByText('Active Announcement')).toBeInTheDocument()
    expect(screen.getByText('Hidden Announcement')).toBeInTheDocument()
  })
})
