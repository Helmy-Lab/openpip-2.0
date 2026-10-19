import { useState, useRef, useEffect } from 'react'
import { CONTROL_BG, CONTROL_HEIGHT } from './LayoutDropdown'
import { PANEL_LEFT, useKeepOnScreen } from './panelPosition'

// The one dropdown open right now, so opening another closes it.
let closeOpenDropdown: (() => void) | null = null

/**
 * The bare themed heading the ribbon uses instead of a button: no chrome, the
 * deployment's colour, underlined while it is hovered or open. Shared so a
 * ribbon control that opens something other than a panel — Share, which opens
 * a dialog — reads as part of the same row.
 */
export function RibbonHeading({ label, active = false, onClick, ...rest }: {
  label: string
  active?: boolean
  onClick: () => void
} & React.ComponentProps<'button'>) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--primary)',
        textTransform: 'uppercase',
        letterSpacing: '.08em',
        whiteSpace: 'nowrap',
        background: 'none',
        border: 'none',
        // The only cue left now that the chevron is gone.
        borderBottom: `2px solid ${active || hovered ? 'var(--primary)' : 'transparent'}`,
        padding: '4px 10px 3px',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
      {...rest}
    >
      {label}
    </button>
  )
}

/**
 * Shell for the controls floating over the network canvas: a button that
 * opens a panel upward, since the row sits at the bottom edge. Closes on a
 * click outside or Escape, so it behaves like the layout menu beside it.
 *
 * `up={false}` flips it for the ribbon under the navbar, where the button is
 * at the top edge and the panel has the whole page to drop into, and `plain`
 * drops the button chrome there for a bare themed heading — a row of bordered
 * grey buttons reads as a toolbar, which the ribbon is not. A plain heading
 * opens on hover but stays open after the mouse leaves, until a click
 * elsewhere, Escape, or another dropdown opening; the click stays for touch and
 * keyboard, which have no hover.
 */
export function CanvasDropdown({ label, width = 232, up = true, plain = false, children }: {
  label: string
  width?: number
  up?: boolean
  plain?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useKeepOnScreen(panelRef, open, up)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    if (closeOpenDropdown !== close) closeOpenDropdown?.()
    closeOpenDropdown = close
    return () => {
      if (closeOpenDropdown === close) closeOpenDropdown = null
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    // On the document, not the container: a panel opened by hover has no focus.
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  // A mouse hovering the heading opens it; leaving does not close it. Only a
  // real mouse counts — a tap fires a synthetic hover before its click, which
  // would open the panel only for the click to toggle it shut again.
  const hover = plain
    ? {
        onPointerEnter: (e: React.PointerEvent) => {
          if (e.pointerType === 'mouse') setOpen(true)
        },
      }
    : {}

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'inline-block' }}
      {...hover}
    >
      {plain ? (
        <RibbonHeading
          label={label}
          active={open}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="op-btn"
          aria-expanded={open}
          style={{
            height: CONTROL_HEIGHT,
            fontSize: 12,
            padding: '0 10px',
            background: CONTROL_BG,
          }}
        >
          {label}
        </button>
      )}

      {open && (
        <div ref={panelRef} style={{
          position: 'absolute',
          overflowY: 'auto',
          left: plain ? PANEL_LEFT.heading : PANEL_LEFT.button,
          ...(up
            ? { bottom: '100%', marginBottom: 4 }
            : plain
              // Flush under the heading: a gap here is a mouse-out.
              ? { top: '100%' }
              : { top: '100%', marginTop: 4 }),
          zIndex: 50,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          boxShadow: 'var(--shadow-md)',
          padding: 14,
          width,
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

