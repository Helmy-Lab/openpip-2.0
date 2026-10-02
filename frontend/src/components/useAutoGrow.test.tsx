import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useAutoGrow } from './useAutoGrow'

function Box({ value }: { value: string }) {
  const ref = useAutoGrow(value, 100)
  return <textarea ref={ref} data-testid="box" value={value} readOnly />
}

describe('useAutoGrow', () => {
  it('grows to the content height and stops at the maximum', () => {
    const { getByTestId, rerender } = render(<Box value="a" />)
    const box = getByTestId('box')

    // jsdom never lays out, so the sizes a browser would report are stubbed:
    // a 2px border, which the height has to add back on top of scrollHeight.
    let contentHeight = 60
    Object.defineProperty(box, 'scrollHeight', {
      get: () => contentHeight,
      configurable: true,
    })
    Object.defineProperty(box, 'offsetHeight', { get: () => 32, configurable: true })
    Object.defineProperty(box, 'clientHeight', { get: () => 30, configurable: true })

    rerender(<Box value={'a\nb'} />)
    expect(box.style.height).toBe('62px')

    contentHeight = 500
    rerender(<Box value="many genes" />)
    expect(box.style.height).toBe('100px')
  })
})
