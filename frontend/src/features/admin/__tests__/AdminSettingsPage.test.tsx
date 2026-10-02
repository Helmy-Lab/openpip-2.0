import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminSettingsPage } from '../AdminSettingsPage'
import { AdminLayout } from '../AdminLayout'
import { useAdminDirty } from '../../../store/adminDirty'
import { useSettings, useUpdateSettings, useUploadLogo, useDeleteLogo } from '../../../api/settings'
import { useAdminUsers, useSetAdminAccess } from '../../../api/adminUsers'
import { useProfile } from '../../../api/auth'
import { useInteractionCategories } from '../../../api/interactionCategories'
import { seedSiteText, resetSiteText } from '../../../mocks/handlers/siteText'

vi.mock('../../../api/settings', () => ({
  useSettings: vi.fn(),
  useUpdateSettings: vi.fn(),
  useUploadLogo: vi.fn(),
  useDeleteLogo: vi.fn(),
}))

vi.mock('react-quill-new', () => ({
  default: ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <textarea
      data-testid="rich-text-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}))

vi.mock('react-quill-new/dist/quill.snow.css', () => ({}))

vi.mock('../../../api/adminUsers', () => ({
  useAdminUsers: vi.fn(),
  useSetAdminAccess: vi.fn(),
}))

vi.mock('../../../api/auth', () => ({
  useProfile: vi.fn(),
}))

vi.mock('../../../api/interactionCategories', () => ({
  useInteractionCategories: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useCreateCategory: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useUpdateCategory: vi.fn().mockReturnValue({ mutate: vi.fn() }),
  useDeleteCategory: vi.fn().mockReturnValue({ mutate: vi.fn() }),
}))

const mockSettings = {
  title: 'openPIP — Protein Interaction Portal',
  shortTitle: 'openPIP',
  footer: '<p>© 2026 openPIP. All rights reserved.</p>',
  homePage: '',
  missionTitle: '<h4>Our Mission</h4>',
  missionText: '<p>openPIP provides a curated map of human protein–protein interactions.</p>',
  methodTitle: '<h4>Methods</h4>',
  methodText: '<p>Interactions are sourced from published experimental datasets.</p>',
  mainColorScheme: '#a51c30',
  headerColorScheme: '#ffffff',
  logoColorScheme: '#ffffff',
  buttonColorScheme: '#a51c30',
  queryNodeColor: '#cc0000',
  interactorNodeColor: '#3c78d8',
  publishedEdgeColor: '#38761d',
  validatedEdgeColor: '#1155cc',
  verifiedEdgeColor: '#cc0000',
  literatureEdgeColor: '#ff9900',
  url: 'http://localhost:5173/',
  version: '2.0',
  about: '<p>About openPIP.</p>',
  faq: '<p>FAQ content.</p>',
  contact: '<p>Contact intro.</p>',
  download: '<p>Download intro.</p>',
  showDownloads: true,
  showDownloadAll: true,
  example1: 'BAD\nBAK1',
  example2: 'BAD',
  example3: '',
  example1Type: 'query-query',
  example2Type: 'query-interactor',
  example3Type: 'None',
}

const mockUsers = [
  { id: 1, username: 'admin', email: 'admin@example.com', isAdmin: true, isSuperuser: true, dateJoined: '2026-01-04T09:00:00Z' },
  { id: 2, username: 'rlomax', email: 'r.lomax@example.edu', isAdmin: true, isSuperuser: false, dateJoined: '2026-02-11T14:20:00Z' },
  { id: 3, username: 'jchen', email: 'j.chen@example.edu', isAdmin: false, isSuperuser: false, dateJoined: '2026-03-02T08:45:00Z' },
]

/** A stand-in admin session, so 'admin' is not the signed-in account. */
const otherAdminProfile = { data: { username: 'someoneelse', is_admin: true } }

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

/**
 * Renders with settings loaded, inside the admin shell — the sidebar that
 * switches panels lives in the layout, so the page alone cannot be navigated.
 * Site text comes from the MSW handlers.
 */
function renderLoaded() {
  ;(useSettings as ReturnType<typeof vi.fn>).mockReturnValue({
    data: mockSettings,
    isLoading: false,
  })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin/settings']}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

/** Clicks a panel in the admin sidebar. */
function openPanel(name: RegExp) {
  fireEvent.click(screen.getByRole('link', { name }))
}

describe('AdminSettingsPage', () => {
  beforeEach(() => {
    resetSiteText()
    // The dirty-panel markers live in a module-level store shared by every test.
    useAdminDirty.setState({ tabs: [] })
    ;(useUpdateSettings as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      reset: vi.fn(),
    })
    ;(useUploadLogo as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    })
    ;(useDeleteLogo as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    })
    ;(useAdminUsers as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockUsers,
      isLoading: false,
    })
    ;(useSetAdminAccess as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      error: null,
      reset: vi.fn(),
    })
    // Signed in as the superuser 'admin', so its own row is self-revoke.
    ;(useProfile as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { username: 'admin', email: 'admin@example.com', is_admin: true },
    })
  })

  it('shows loading state when useSettings returns isLoading: true', () => {
    ;(useSettings as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    render(<AdminSettingsPage />, { wrapper })

    expect(screen.getByText('Loading settings...')).toBeInTheDocument()
  })

  it('renders "Site Title" field with the setting value when data loads', () => {
    renderLoaded()

    expect(screen.getByText('Site Title')).toBeInTheDocument()
    expect(screen.getByDisplayValue('openPIP — Protein Interaction Portal')).toBeInTheDocument()
  })

  it('renders "Primary color" color input', () => {
    renderLoaded()
    openPanel(/Appearance/)

    expect(screen.getByText('Primary color')).toBeInTheDocument()

    const colorInputs = document.querySelectorAll('input[type="color"]')
    expect(colorInputs.length).toBeGreaterThan(0)
    expect((colorInputs[0] as HTMLInputElement).value).toBe('#a51c30')
  })

  it('clicking Save calls the update mutate function', () => {
    const mockUpdate = vi.fn()
    ;(useUpdateSettings as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockUpdate,
      isPending: false,
      isSuccess: false,
      isError: false,
      reset: vi.fn(),
    })
    renderLoaded()

    // Save is gated on there being something to save.
    expect(screen.getByRole('button', { name: /save settings/i })).toBeDisabled()

    fireEvent.change(screen.getByDisplayValue('openPIP — Protein Interaction Portal'), {
      target: { value: 'Renamed portal' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save 1 change/i }))

    expect(mockUpdate).toHaveBeenCalledOnce()
  })

  it('opens the Site Identity panel by default', () => {
    renderLoaded()
    expect(screen.getByRole('heading', { level: 1, name: 'Site Identity' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Site Identity/ })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByText('Site Title')).toBeInTheDocument()
  })

  it('shows About editor when the About panel is opened', () => {
    renderLoaded()
    openPanel(/About/)
    expect(screen.getByRole('link', { name: /About/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { level: 1, name: 'About' })).toBeInTheDocument()
    expect(screen.getByText('About page content')).toBeInTheDocument()
  })

  it('shows Downloads toggles when the Downloads panel is opened', () => {
    renderLoaded()
    openPanel(/Downloads/)
    expect(screen.getByText('Show Dataset Downloads')).toBeInTheDocument()
    expect(screen.getByText('Show Supplementary Files')).toBeInTheDocument()
  })

  it('shows each category the edge colour its order really gives', () => {
    ;(useInteractionCategories as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      data: [
        { id: 1, categoryName: 'Published', order: '1', colorScheme: '#123456', description: '' },
        { id: 9, categoryName: 'Extra', order: '7', colorScheme: '#654321', description: '' },
      ],
      isLoading: false,
    })
    renderLoaded()
    openPanel(/^Search/)
    // From publishedEdgeColor, not the category's own colorScheme.
    expect(screen.getByLabelText('Edge colour #38761d')).toBeInTheDocument()
    // order 7, and the empty new-category row
    expect(screen.getAllByLabelText('Edge colour #cccccc')).toHaveLength(2)
    expect(screen.queryByLabelText('Edge colour #123456')).not.toBeInTheDocument()
  })

  it('reports unsaved changes and can discard them', () => {
    renderLoaded()
    expect(screen.getByText('No unsaved changes')).toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue('openPIP — Protein Interaction Portal'), {
      target: { value: 'Renamed portal' },
    })
    expect(screen.getByText(/1 unsaved change/)).toBeInTheDocument()

    // Per-field revert puts the saved value back without a confirm dialog.
    fireEvent.click(screen.getByRole('button', { name: 'revert' }))
    expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
  })

  it('rejects a malformed site URL instead of saving it', () => {
    renderLoaded()
    fireEvent.change(screen.getByPlaceholderText('https://…'), {
      target: { value: 'not-a-url' },
    })
    expect(screen.getByText(/full URL starting with/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save 1 change/i })).toBeDisabled()
  })

  // ── Page text, now edited inside each page's tab ──

  it('shows the shipped default as placeholder when nothing is overridden', async () => {
    renderLoaded()
    const input = (await screen.findByLabelText('Main navigation: Home link')) as HTMLInputElement
    expect(input.value).toBe('')
    expect(input.placeholder).toBe('Home')
  })

  it('pre-fills an existing override and marks it customized', async () => {
    seedSiteText({ 'nav.home': 'Start' })
    renderLoaded()
    const input = (await screen.findByLabelText('Main navigation: Home link')) as HTMLInputElement
    await waitFor(() => expect(input.value).toBe('Start'))
    expect(screen.getAllByText('customized').length).toBeGreaterThan(0)
  })

  it('counts a copy edit toward the same Save button as the settings', async () => {
    renderLoaded()
    fireEvent.change(await screen.findByLabelText('Main navigation: Home link'), { target: { value: 'Start' } })

    expect(await screen.findByRole('button', { name: /Save 1 change/ })).toBeEnabled()

    // A settings edit on top of it is counted together.
    fireEvent.change(screen.getByDisplayValue('openPIP — Protein Interaction Portal'), {
      target: { value: 'Renamed portal' },
    })
    expect(screen.getByText(/2 unsaved changes/)).toBeInTheDocument()
  })

  it('persists a copy override and clears the dirty state', async () => {
    renderLoaded()
    fireEvent.change(await screen.findByLabelText('Main navigation: Home link'), { target: { value: 'Start' } })
    fireEvent.click(await screen.findByRole('button', { name: /Save 1 change/ }))

    await waitFor(() => expect(screen.getByText('No unsaved changes')).toBeInTheDocument())
    expect(screen.getByText('✓ Settings saved')).toBeInTheDocument()
  })

  it('emptying a copy field clears the override rather than saving a blank', async () => {
    seedSiteText({ 'nav.home': 'Start' })
    renderLoaded()
    const input = (await screen.findByLabelText('Main navigation: Home link')) as HTMLInputElement
    await waitFor(() => expect(input.value).toBe('Start'))

    fireEvent.click(screen.getAllByRole('button', { name: 'Reset' })[0])
    fireEvent.click(await screen.findByRole('button', { name: /Save 1 change/ }))

    // The override is gone, so the default is offered as placeholder again.
    await waitFor(() => expect(screen.queryByText('customized')).not.toBeInTheDocument())
  })

  it('does not queue a change for an override that is already blank', async () => {
    seedSiteText({ 'nav.home': '' })
    renderLoaded()
    await waitFor(() => expect(screen.getAllByText('customized').length).toBeGreaterThan(0))
    expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
  })

  it('marks the sidebar panel an unsaved copy edit belongs to', async () => {
    renderLoaded()
    expect(screen.getByRole('link', { name: /Home/ })).not.toHaveTextContent('has unsaved changes')

    openPanel(/Home/)
    fireEvent.change(await screen.findByLabelText('Hero: Sub-headline'), {
      target: { value: 'A shorter promise.' },
    })

    // Navigating away keeps the marker visible on the Home panel.
    openPanel(/Appearance/)
    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: /Home/ }).querySelector('[aria-label="has unsaved changes"]')
      ).toBeInTheDocument()
    )
  })

  it('filters a long list of copy fields', async () => {
    renderLoaded()
    openPanel(/Documentation/)
    const filter = await screen.findByLabelText(/Filter Documentation page text fields/)

    fireEvent.change(filter, { target: { value: 'network' } })
    expect(screen.getByRole('heading', { name: 'Network visualization' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Filtering results' })).not.toBeInTheDocument()

    fireEvent.change(filter, { target: { value: 'zzzz-no-such-copy' } })
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument()
  })

  it('groups a page under the blocks a visitor sees', async () => {
    renderLoaded()
    openPanel(/Home/)

    for (const block of ['Hero', 'Our Mission', 'Methods', 'Cite openPIP']) {
      expect(await screen.findByRole('heading', { name: block })).toBeInTheDocument()
    }
  })

  it('keeps button and placeholder copy behind a toggle', async () => {
    renderLoaded()
    openPanel(/Home/)

    const toggle = await screen.findByRole('button', { name: /Labels & buttons/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('Search button')).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Search button')).toBeInTheDocument()
  })

  it('saves a real blank for a block that hides itself when empty', async () => {
    seedSiteText({ 'home.mission.body': '<p>Custom mission.</p>' })
    renderLoaded()
    openPanel(/Home/)

    const body = within(await screen.findByRole('group', { name: 'Our Mission: Body' })).getByRole(
      'textbox'
    )
    fireEvent.change(body, { target: { value: '' } })

    // Blank is the admin's way to drop the Mission block from the page, so it
    // has to be stored rather than falling back to the shipped default.
    fireEvent.click(await screen.findByRole('button', { name: /Save 1 change/ }))
    await waitFor(() => expect(screen.getByText('No unsaved changes')).toBeInTheDocument())
    // The chip is proof the blank was stored as an override: had it been
    // deleted, the field would have fallen back to the shipped default.
    expect(screen.getByText('customized')).toBeInTheDocument()
  })
  // ── Granting and revoking admin access ──

  it('offers Grant on plain accounts and Revoke on admins', async () => {
    ;(useProfile as ReturnType<typeof vi.fn>).mockReturnValue(otherAdminProfile)
    renderLoaded()
    openPanel(/Accounts/)

    const list = await screen.findByRole('group', { name: 'Accounts' })
    expect(within(list).getByText('jchen')).toBeInTheDocument()
    expect(within(list).getAllByRole('button', { name: 'Revoke admin' })).toHaveLength(2)
    expect(within(list).getAllByRole('button', { name: 'Grant admin' })).toHaveLength(1)
  })

  it('grants admin access to a plain account', async () => {
    const mutate = vi.fn()
    ;(useSetAdminAccess as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate,
      error: null,
      reset: vi.fn(),
    })
    renderLoaded()
    openPanel(/Accounts/)

    const list = await screen.findByRole('group', { name: 'Accounts' })
    fireEvent.click(within(list).getByRole('button', { name: 'Grant admin' }))

    expect(mutate).toHaveBeenCalledWith({ userId: 3, isAdmin: true }, expect.anything())
  })

  it('revokes admin access from another admin', async () => {
    const mutate = vi.fn()
    ;(useProfile as ReturnType<typeof vi.fn>).mockReturnValue(otherAdminProfile)
    ;(useSetAdminAccess as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate,
      error: null,
      reset: vi.fn(),
    })
    renderLoaded()
    openPanel(/Accounts/)

    const list = await screen.findByRole('group', { name: 'Accounts' })
    // rlomax is the non-superuser admin, so its revoke is the allowed one.
    const rlomaxRevoke = within(list)
      .getAllByRole('button', { name: 'Revoke admin' })
      .find((b) => !b.hasAttribute('disabled'))
    fireEvent.click(rlomaxRevoke!)

    expect(mutate).toHaveBeenCalledWith({ userId: 2, isAdmin: false }, expect.anything())
  })

  it('will not let an admin revoke their own access', async () => {
    renderLoaded()
    openPanel(/Accounts/)

    // Signed in as 'admin', so that row's revoke is disabled and explains why.
    const list = await screen.findByRole('group', { name: 'Accounts' })
    const ownRevoke = within(list).getAllByRole('button', { name: 'Revoke admin' })[0]
    expect(ownRevoke).toBeDisabled()
    expect(ownRevoke).toHaveAttribute('title', 'You cannot revoke your own admin access')
  })

  it('will not let a superuser be revoked', async () => {
    ;(useProfile as ReturnType<typeof vi.fn>).mockReturnValue(otherAdminProfile)
    renderLoaded()
    openPanel(/Accounts/)

    // 'admin' is the superuser; someone else is signed in, so the block is
    // the superuser rule rather than the self-revoke rule.
    const list = await screen.findByRole('group', { name: 'Accounts' })
    const superuserRevoke = within(list).getAllByRole('button', { name: 'Revoke admin' })[0]
    expect(superuserRevoke).toBeDisabled()
    expect(superuserRevoke).toHaveAttribute('title', 'Superusers keep admin access')
  })

  it('surfaces an API error', async () => {
    ;(useSetAdminAccess as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      error: { response: { data: { isAdmin: 'You cannot revoke your own admin access.' } } },
      reset: vi.fn(),
    })
    renderLoaded()
    openPanel(/Accounts/)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You cannot revoke your own admin access.'
    )
  })

  it('confirms a grant and a revoke in the wording of each', async () => {
    ;(useProfile as ReturnType<typeof vi.fn>).mockReturnValue(otherAdminProfile)
    ;(useSetAdminAccess as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: (
        vars: { userId: number; isAdmin: boolean },
        opts: { onSuccess: (u: unknown) => void; onSettled: () => void }
      ) => {
        opts.onSuccess({ id: vars.userId, username: 'rlomax', isAdmin: vars.isAdmin })
        opts.onSettled()
      },
      error: null,
      reset: vi.fn(),
    })
    renderLoaded()
    openPanel(/Accounts/)

    const list = await screen.findByRole('group', { name: 'Accounts' })
    fireEvent.click(within(list).getByRole('button', { name: 'Grant admin' }))
    expect(await screen.findByRole('status')).toHaveTextContent('now has admin access')

    const revoke = within(list)
      .getAllByRole('button', { name: 'Revoke admin' })
      .find((b) => !b.hasAttribute('disabled'))
    fireEvent.click(revoke!)
    expect(await screen.findByRole('status')).toHaveTextContent('Admin access removed')
  })
})

describe('search panel copy', () => {
  it('offers the phrase examples beside the gene examples', async () => {
    // TAB_CONFIG declaring a text group is not enough: rendering is a separate
    // pageText(tab) call in the panel's JSX, so a declared group with no call
    // compiles, type-checks, and simply never appears. That is exactly how the
    // phrase examples first shipped — configured onto this panel, invisible.
    renderLoaded()
    openPanel(/search/i)

    expect(await screen.findByLabelText(/Phrase example 1/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Phrase example 2/i)).toBeInTheDocument()
    // The gene examples they were moved to sit beside.
    expect(screen.getByText(/Example 1/)).toBeInTheDocument()
  })
})
