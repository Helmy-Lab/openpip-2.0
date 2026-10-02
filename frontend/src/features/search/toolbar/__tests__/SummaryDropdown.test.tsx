import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SummaryDropdown } from '../SummaryDropdown'
import { useSearchStore } from '../../searchStore'

beforeEach(() => {
  useSearchStore.setState({
    foundSummary: 'TP53<br><img src=x onerror="alert(1)">',
    unfoundSummary: 'FOO<br>BAR',
    allProteins: [],
    allInteractions: [],
  })
})

describe('SummaryDropdown', () => {
  it('lists terms as text and never renders them as HTML', () => {
    const { container } = render(<SummaryDropdown />)
    fireEvent.click(screen.getByRole('button', { name: /summary/i }))

    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('TP53, <img src=x onerror="alert(1)">')).toBeInTheDocument()
    expect(screen.getByText('FOO, BAR')).toBeInTheDocument()
  })
})
