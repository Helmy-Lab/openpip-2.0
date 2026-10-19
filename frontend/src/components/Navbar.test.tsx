import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect } from 'vitest'
import { Navbar } from './Navbar'

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Navbar', () => {
  it('shows public links when logged out', () => {
    wrap(<Navbar isLoggedIn={false} />)
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /search/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /downloads/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /register/i })).toBeInTheDocument()
  })

  it('shows Profile and hides Login when logged in', () => {
    wrap(<Navbar isLoggedIn={true} />)
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /login/i })).not.toBeInTheDocument()
  })

  it('opens the small-screen menu from its button and closes it on navigation', () => {
    wrap(<Navbar isLoggedIn={false} />)
    const toggle = screen.getByRole('button', { name: 'Menu' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('op-nav-menu')).toHaveClass('open')

    fireEvent.click(screen.getByRole('link', { name: /about/i }))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('op-nav-menu')).not.toHaveClass('open')
  })
})
