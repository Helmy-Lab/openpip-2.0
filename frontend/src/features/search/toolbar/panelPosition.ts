import { useLayoutEffect, type RefObject } from 'react'

/**
 * Where a panel's left edge sits inside its dropdown: in line with the first
 * letter of the title above it. The ribbon heading pads its label by 10px; a
 * bordered button adds its 1px border to that.
 */
export const PANEL_LEFT = { heading: 10, button: 11 }

/**
 * A panel lines up with its title, so one near the window's right edge would
 * hang off it: slide it back inside, and let it scroll rather than run past
 * the top or bottom of the screen.
 */
export function useKeepOnScreen(ref: RefObject<HTMLDivElement | null>, open: boolean, up: boolean) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!open || !el) return
    const r = el.getBoundingClientRect()
    const shift = Math.max(8 - r.left, 0) - Math.max(r.right - (window.innerWidth - 8), 0)
    el.style.transform = `translateX(${shift}px)`
    el.style.maxHeight = `${up ? r.bottom - 8 : window.innerHeight - r.top - 8}px`
  }, [ref, open, up])
}
