import { screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AboutPage } from '../AboutPage'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { seedSiteText, resetSiteText } from '../../../mocks/handlers/siteText'

vi.mock('../../../api/settings', () => ({
  useSettings: vi.fn(),
}))

import { useSettings } from '../../../api/settings'

const mockSettings = {
  data: {
    title: 'TestDB',
    homePage: '<p>About content</p>',
    version: '2.0',
    url: 'http://test.com',
  },
  isLoading: false,
}

describe('AboutPage', () => {
  beforeEach(() => {
    resetSiteText()
    vi.mocked(useSettings).mockReturnValue(
      mockSettings as unknown as ReturnType<typeof useSettings>
    )
  })

  it('renders the title with the database name', () => {
    renderWithProviders(<AboutPage />)
    expect(screen.getByText('About TestDB')).toBeInTheDocument()
  })

  it('links Documentation to the documentation site, not the old in-app page', () => {
    renderWithProviders(<AboutPage />)
    const link = screen.getByRole('link', { name: 'Documentation' })
    expect(link).toHaveAttribute('href', '/docs/')
  })

  it('renders static about content', () => {
    renderWithProviders(<AboutPage />)
    expect(screen.getByText('CCSB Proteome-scale efforts')).toBeInTheDocument()
  })

  it('renders the built-in reference tables', () => {
    renderWithProviders(<AboutPage />)
    expect(screen.getByRole('columnheader', { name: 'pDEST-AD-CHY2' })).toBeInTheDocument()
    expect(screen.getByText('MaV203')).toBeInTheDocument()
  })

  it('applies an admin override to a section heading', async () => {
    seedSiteText({ 'about.proteomeScale.heading': 'Our mapping projects' })
    renderWithProviders(<AboutPage />)
    await waitFor(() =>
      expect(screen.getByText('Our mapping projects')).toBeInTheDocument()
    )
    expect(screen.queryByText('CCSB Proteome-scale efforts')).not.toBeInTheDocument()
  })

  it('omits a section whose heading and body are both blanked', async () => {
    seedSiteText({ 'about.hi105.heading': '', 'about.hi105.body': '' })
    renderWithProviders(<AboutPage />)
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'HI-I-05' })).not.toBeInTheDocument()
    )
    // A sibling section is untouched.
    expect(screen.getByRole('heading', { name: 'HI-II-14' })).toBeInTheDocument()
  })

  it('replaces a built-in table when the admin supplies HTML', async () => {
    seedSiteText({
      'about.vectorTable.html': '<table><tbody><tr><td>Custom row</td></tr></tbody></table>',
    })
    renderWithProviders(<AboutPage />)
    await waitFor(() => expect(screen.getByText('Custom row')).toBeInTheDocument())
    // The built-in vector table is gone; the assay table (which shares some
    // vector names) is untouched, so scope the check to the replaced columns.
    expect(screen.queryByRole('columnheader', { name: 'pDEST-AD-CHY2' })).not.toBeInTheDocument()
  })
})
