import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Footer } from './Footer'

describe('Footer', () => {
  it('renders raw HTML from admin_settings.footer', () => {
    render(<Footer html="<p>Footer content</p>" />)
    expect(screen.getByText('Footer content')).toBeInTheDocument()
  })

  it('renders a footer element when html is empty', () => {
    const { container } = render(<Footer html="" />)
    expect(container.querySelector('footer')).toBeInTheDocument()
  })

  it('always shows the powered-by line, whatever the admin html says', () => {
    render(<Footer html="<p>Powered by something else</p>" />)
    const link = screen.getByRole('link', { name: 'openPIP 2.0' })
    expect(link).toHaveAttribute('href', 'https://openpip.usask.ca')
  })
})
