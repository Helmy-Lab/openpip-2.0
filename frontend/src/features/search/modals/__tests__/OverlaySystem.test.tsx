import { screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useSearchStore } from '../../searchStore'
import { OverlaySystem } from '../OverlaySystem'
import { renderWithProviders } from '../../../../test/renderWithProviders'

function wrap() {
  return renderWithProviders(<OverlaySystem />)
}

describe('OverlaySystem', () => {
  beforeEach(() => {
    useSearchStore.setState({ activeModal: null })
  })

  afterEach(() => {
    useSearchStore.setState({ activeModal: null })
  })

  it('returns null when no modal is active', () => {
    const { container } = wrap()
    expect(container.firstChild).toBeNull()
  })

  it('renders CyRestModal when activeModal is "cyRest"', () => {
    useSearchStore.setState({ activeModal: 'cyRest' })
    wrap()
    expect(screen.getByText('Open in Cytoscape')).toBeInTheDocument()
  })
})
