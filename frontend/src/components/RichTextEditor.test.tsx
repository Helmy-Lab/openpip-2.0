import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RichTextEditor } from './RichTextEditor'

// Stand-in for Quill: on mount it re-serialises the value, as the real editor
// does, and reports that as an "api" change.
vi.mock('react-quill-new', () => ({
  default: ({ value, onChange }: { value: string; onChange: (h: string, d: unknown, s: string) => void }) => {
    onChange(`<p>${value}</p>`, {}, 'api')
    return <button type="button" onClick={() => onChange('<p>typed</p>', {}, 'user')}>type</button>
  },
}))
vi.mock('react-quill-new/dist/quill.snow.css', () => ({}))

describe('RichTextEditor', () => {
  it("ignores the editor's own rewrite of the loaded value, and passes on typing", () => {
    const onChange = vi.fn()
    const { getByRole } = render(<RichTextEditor value="Hello&nbsp;there" onChange={onChange} />)
    expect(onChange).not.toHaveBeenCalled()

    getByRole('button', { name: 'type' }).click()
    expect(onChange).toHaveBeenCalledWith('<p>typed</p>')
  })
})
