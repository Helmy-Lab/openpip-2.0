import { useLayoutEffect, useRef } from 'react'

/**
 * Grows a textarea to fit what is in it, up to `maxHeight`, then scrolls.
 * The cap is high on purpose — around twenty lines of genes — so a pasted list
 * stays fully visible and a scrollbar only turns up for a genuinely long one.
 *
 * Measured rather than counted: a gene list wraps, so the number of genes says
 * nothing about how many lines the box needs. `field-sizing: content` would do
 * this in CSS but Firefox has not shipped it.
 */
export function useAutoGrow(value: string, maxHeight = 400) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    // scrollHeight is 0 in jsdom; leave the height alone rather than collapse.
    if (!el.scrollHeight) return
    // Everything here is border-box, and scrollHeight excludes the border — set
    // height to scrollHeight alone and the box is a border short of its own
    // content, which is a scrollbar that never goes away.
    const border = el.offsetHeight - el.clientHeight
    el.style.height = `${Math.min(el.scrollHeight + border, maxHeight)}px`
  }, [value, maxHeight])

  return ref
}
