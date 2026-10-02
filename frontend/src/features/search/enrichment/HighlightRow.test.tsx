import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { HighlightRow } from './HighlightRow'
import { useSearchStore } from '../searchStore'

function row(term: string, genes: string[]) {
  return (
    <table>
      <tbody>
        <HighlightRow term={term} genes={genes}>
          <td>{term}</td>
        </HighlightRow>
      </tbody>
    </table>
  )
}

describe('HighlightRow', () => {
  beforeEach(() => useSearchStore.getState().setHighlight(null))

  it('selects a term, and a second click clears it', () => {
    render(row('liver', ['BAD', 'BCL2']))
    const cell = screen.getByText('liver')

    fireEvent.click(cell)
    expect(useSearchStore.getState().highlight).toEqual({
      term: 'liver',
      genes: ['BAD', 'BCL2'],
    })

    fireEvent.click(cell)
    expect(useSearchStore.getState().highlight).toBeNull()
  })

  it('ignores a click that ends a text selection', () => {
    const { getByRole } = render(row('liver', ['BAD']))
    vi.spyOn(window, 'getSelection').mockReturnValue({ isCollapsed: false } as Selection)

    fireEvent.click(getByRole('row'))
    expect(useSearchStore.getState().highlight).toBeNull()
  })

  it('marks only the selected row', () => {
    useSearchStore.getState().setHighlight({ term: 'spleen', genes: ['BAX'] })
    const { rerender } = render(row('liver', ['BAD']))
    expect(screen.getByRole('row')).toHaveAttribute('aria-pressed', 'false')

    rerender(row('spleen', ['BAX']))
    expect(screen.getByRole('row')).toHaveAttribute('aria-pressed', 'true')
  })
})
