import { describe, it, expect } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderWithProviders'
import { SettingsDropdown } from '../SettingsDropdown'
import { useAuthStore } from '../../../../store/authStore'
import { useSearchStore } from '../../searchStore'
import { useCanvasBackgroundStore, useCanvasStyleStore } from '../../network/canvasBackground'

describe('SettingsDropdown', () => {
  it('holds the layout and the canvas colours behind one gear', () => {
    useAuthStore.setState({ isLoggedIn: false, isAdmin: false, token: null })
    renderWithProviders(<SettingsDropdown />)
    fireEvent.click(screen.getByRole('button', { name: 'Network settings' }))

    fireEvent.click(screen.getByRole('radio', { name: /grid/i }))
    expect(useSearchStore.getState().selectedLayout).toBe('grid')

    fireEvent.change(screen.getByLabelText('Background'), { target: { value: '#123456' } })
    expect(useCanvasBackgroundStore.getState().override).toBe('#123456')
    expect(localStorage.getItem('openpip_canvas_background')).toBe('#123456')

    fireEvent.change(screen.getByLabelText('Interactor'), { target: { value: '#00ff00' } })
    expect(useCanvasStyleStore.getState().style).toEqual({ interactorNode: '#00ff00' })

    // Reset clears every choice, the background included.
    fireEvent.click(screen.getByRole('button', { name: 'Reset all' }))
    expect(useCanvasStyleStore.getState().style).toEqual({})
    expect(useCanvasBackgroundStore.getState().override).toBeNull()
  })
})
