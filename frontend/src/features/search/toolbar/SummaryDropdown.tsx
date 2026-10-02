import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { useSearchStore } from '../searchStore'

// The API joins terms with "<br>" (legacy's format). Never render it as HTML:
// for a saved network the found list is the stored query, written by whoever
// saved it and opened by anyone with the link.
const asList = (summary: string) => summary.split('<br>').filter(Boolean).join(', ')

export function SummaryDropdown() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const foundSummary = useSearchStore((s) => s.foundSummary)
  const unfoundSummary = useSearchStore((s) => s.unfoundSummary)
  const allProteins = useSearchStore((s) => s.allProteins)
  const allInteractions = useSearchStore((s) => s.allInteractions)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') setOpen(false)
  }

  const row: React.CSSProperties = { fontSize: 13, color: 'var(--text)', marginBottom: 6 }
  const label: React.CSSProperties = { fontWeight: 600 }

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }} onKeyDown={handleKeyDown}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="op-btn" style={{ fontSize: 13 }}>
        Summary
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          zIndex: 50,
          marginTop: 4,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          boxShadow: 'var(--shadow-md)',
          padding: 14,
          width: 272,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
            Summary
          </div>

          <div style={row}>
            <span style={label}>Found: </span>
            {asList(foundSummary) || '—'}
          </div>
          <div style={row}>
            <span style={label}>Not found: </span>
            {asList(unfoundSummary) || '—'}
          </div>
          <div style={row}>
            <span style={label}>Total proteins: </span>
            {allProteins.length}
          </div>
          <div style={{ ...row, marginBottom: 0 }}>
            <span style={label}>Total interactions: </span>
            {allInteractions.length}
          </div>
        </div>
      )}
    </div>
  )
}
