import { useSearchStore } from '../searchStore'

interface HighlightRowProps {
  /** Identifies this row across every enrichment table — only one stays lit. */
  term: string
  /** Gene names to light up in the network. */
  genes: string[]
  children: React.ReactNode
}

/**
 * A table row that lights its genes up in the network when clicked, and clears
 * the highlight when clicked again — legacy's setEnrichmentRowClickEvent, which
 * bound one handler to the enrichment, tissue and subcellular tables alike.
 *
 * The dimming itself lives in CytoscapeNetwork; this only records the choice,
 * so a row cannot leave the graph dimmed after its table unmounts.
 */
export function HighlightRow({ term, genes, children }: HighlightRowProps) {
  const highlight = useSearchStore((s) => s.highlight)
  const setHighlight = useSearchStore((s) => s.setHighlight)
  const selected = highlight?.term === term

  return (
    <tr
      onClick={() => {
        // A drag to copy the row's text ends in a click; don't treat it as one.
        if (!window.getSelection()?.isCollapsed) return
        setHighlight(selected ? null : { term, genes })
      }}
      aria-pressed={selected}
      title={genes.length ? `Highlight ${genes.length} proteins in the network` : undefined}
      style={{
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        background: selected ? 'var(--primary-soft)' : '',
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = 'var(--surface-2)'
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = ''
      }}
    >
      {children}
    </tr>
  )
}
