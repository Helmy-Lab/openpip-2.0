import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { RegisterPage } from '../RegisterPage'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('RegisterPage', () => {
  it('renders all form fields', () => {
    render(<RegisterPage />, { wrapper })
    expect(screen.getByText('Username')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Password')).toBeInTheDocument()
    expect(screen.getByText('Confirm password')).toBeInTheDocument()
    expect(screen.getByText('Security question 1')).toBeInTheDocument()
    expect(screen.getByText('Security question 3')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/^Answer \d$/)).toHaveLength(3)
  })

  it('shows the benefits panel', () => {
    render(<RegisterPage />, { wrapper })
    expect(screen.getByText('Saved views')).toBeInTheDocument()
    expect(screen.getByText('Public links')).toBeInTheDocument()
    // No personal API key exists, so the panel must not offer one.
    expect(screen.queryByText('API access')).not.toBeInTheDocument()
  })

  it('shows error when passwords do not match', async () => {
    render(<RegisterPage />, { wrapper })
    // fill username
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'alice' } })
    // fill email
    fireEvent.change(screen.getByPlaceholderText('you@university.edu'), {
      target: { value: 'alice@example.com' },
    })
    // fill password fields (type=password, not role=textbox)
    // all three security answers are required
    for (let i = 1; i <= 3; i++) {
      fireEvent.change(screen.getByLabelText(`Answer ${i}`), { target: { value: 'Rex' } })
    }
    const pwInputs = document.querySelectorAll('input[type="password"]')
    fireEvent.change(pwInputs[0], { target: { value: 'Secret1!' } })
    fireEvent.change(pwInputs[1], { target: { value: 'Different1!' } })

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() =>
      expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
    )
  })

  it('shows success state after successful registration', async () => {
    render(<RegisterPage />, { wrapper })
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'alice' } })
    fireEvent.change(screen.getByPlaceholderText('you@university.edu'), {
      target: { value: 'alice@example.com' },
    })
    // all three security answers are required
    for (let i = 1; i <= 3; i++) {
      fireEvent.change(screen.getByLabelText(`Answer ${i}`), { target: { value: 'Rex' } })
    }
    const pwInputs = document.querySelectorAll('input[type="password"]')
    fireEvent.change(pwInputs[0], { target: { value: 'Secret1!' } })
    fireEvent.change(pwInputs[1], { target: { value: 'Secret1!' } })

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() =>
      expect(screen.getByText('Account created')).toBeInTheDocument()
    )
    expect(screen.getByRole('link', { name: /sign in now/i })).toBeInTheDocument()
  })

  it('has a link to the login page', () => {
    render(<RegisterPage />, { wrapper })
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
  })
})
