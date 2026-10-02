import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PhraseHelp } from '../PhraseHelp'
import { TISSUE_LABELS } from '../../../lib/tissues'
import { CONFIDENCE_WORDS, UNSUPPORTED_INTENTS } from '../../../lib/naturalQuery'

function open() {
  render(<PhraseHelp />)
  fireEvent.click(screen.getByRole('button', { name: /what can be written/i }))
}

describe('PhraseHelp', () => {
  it('stays closed until asked for', () => {
    render(<PhraseHelp />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens and closes', () => {
    open()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Close'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('documents each thing the parser can do', () => {
    open()
    expect(screen.getByText(/Gene names/)).toBeInTheDocument()
    expect(screen.getByText(/A tissue/)).toBeInTheDocument()
    expect(screen.getByText(/A confidence threshold/)).toBeInTheDocument()
  })

  it('counts the tissues from the real list rather than a written number', () => {
    // The count must follow the data: a deployment with different tissues would
    // otherwise be told a number that is wrong.
    open()
    const count = Object.keys(TISSUE_LABELS).length
    expect(screen.getByText(new RegExp(`${count} tissues`))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`Show all ${count}`))).toBeInTheDocument()
  })

  it('lists the actual tissue names', () => {
    open()
    fireEvent.click(screen.getByText(/Show all/))
    expect(screen.getByText(/Brain cerebellum/)).toBeInTheDocument()
  })

  it('lists the confidence words the parser accepts', () => {
    // Asserted as one string: several also appear in the example chips above,
    // and it is the note that must enumerate them.
    open()
    const words = Object.keys(CONFIDENCE_WORDS).join(', ')
    expect(screen.getByText(new RegExp(words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument()
  })

  it('warns about what cannot be filtered', () => {
    // An example demonstrating an unsupported filter would teach visitors a
    // phrasing that quietly does nothing.
    open()
    expect(screen.getByText(/Not available/)).toBeInTheDocument()
    for (const intent of new Set(Object.values(UNSUPPORTED_INTENTS))) {
      expect(screen.getByText(new RegExp(intent))).toBeInTheDocument()
    }
  })
})
