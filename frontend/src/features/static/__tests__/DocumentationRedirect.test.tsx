import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DocumentationRedirect } from '../DocumentationRedirect'

describe('DocumentationRedirect', () => {
  it('sends old /documentation links to the documentation site', () => {
    const replace = vi.fn()
    vi.stubGlobal('location', { ...window.location, replace })
    render(<DocumentationRedirect />)
    expect(replace).toHaveBeenCalledWith('/docs/')
    expect(screen.getByRole('link', { name: '/docs/' })).toHaveAttribute('href', '/docs/')
    vi.unstubAllGlobals()
  })
})
