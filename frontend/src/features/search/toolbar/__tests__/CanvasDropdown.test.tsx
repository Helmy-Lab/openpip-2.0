import { describe, it, expect } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderWithProviders'
import { CanvasDropdown } from '../CanvasDropdown'

describe('CanvasDropdown', () => {
  it('stays open when a click inside removes its own target', () => {
    renderWithProviders(
      <CanvasDropdown label="Query">
        <div data-panel>
          <span>pick me</span>
          <span>still here</span>
        </div>
      </CanvasDropdown>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Query' }))

    // Picking an autocomplete option unmounts it. In a real click React
    // re-renders in the microtask checkpoint between listeners, so by the time
    // the document's outside-click listener runs the target is detached.
    const panel = document.querySelector('[data-panel]')!
    panel.addEventListener('mousedown', (e) => (e.target as Element).remove())
    fireEvent.mouseDown(screen.getByText('pick me'))
    expect(screen.getByText('still here')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('still here')).not.toBeInTheDocument()
  })
})
