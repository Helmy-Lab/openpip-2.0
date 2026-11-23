import { useEnrichment, type EnrichmentSource } from '../../../api/enrichment'
import { EnrichmentSourceNote } from './SourceNote'
import { enrichmentDatasetName } from './sources'
import { useState } from 'react'
import { HighlightRow } from './HighlightRow'
import { TableSearch } from '../tables/TableSearch'
import { matchRows, suggestionsFrom } from '../tables/tableFilter'

interface EnrichmentTableProps {
  geneNames: string[]
  source: EnrichmentSource
}

const TH: React.CSSProperties = {
  // Frozen while the results scroll under it.
  position: 'sticky',
  top: 0,
  zIndex: 1,
  padding: '8px 12px',
  textAlign: 'center',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.07em',
  color: 'var(--text)',
  background: 'var(--surface-2)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

function termUrl(term_id: string, source: EnrichmentSource): string {
  if (source.startsWith('GO:')) return `https://amigo.geneontology.org/amigo/term/${term_id}`
  if (source === 'REAC') return `https://reactome.org/content/detail/${term_id}`
  if (source === 'CORUM') {
    const id = term_id.replace(/^CORUM:/, '')
    return `http://mips.helmholtz-muenchen.de/corum/?id=${id}`
  }
  if (source === 'KEGG') {
    const id = term_id.replace(/^KEGG:/, '')
    return `https://www.genome.jp/kegg-bin/show_pathway?map=${id}`
  }
  return '#'
}

export function EnrichmentTable({ geneNames, source }: EnrichmentTableProps) {
  const { data, isLoading, isError } = useEnrichment(geneNames)
  const [query, setQuery] = useState('')

  if (isLoading) {
    return (
      <p style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
        Running enrichment analysis...
      </p>
    )
  }

  if (isError) {
    return (
      <p style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--danger)' }}>
        Failed to fetch enrichment results. External service may be unavailable.
      </p>
    )
  }

  const rows = (data ?? [])
    .filter((t) => t.source === source)
    .sort((a, b) => a.p_value - b.p_value)
    .slice(0, 50)

  if (rows.length === 0) {
    return (
      <div>
        <p style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          No significant terms found (p &lt; 0.05)
        </p>
        <EnrichmentSourceNote source={source} />
      </div>
    )
  }

  const shown = matchRows(rows, query, (r) => [r.term_id, r.name, ...r.genes])

  return (
    <div>
      <TableSearch
        value={query}
        onChange={setQuery}
        suggestions={suggestionsFrom(rows.flatMap((r) => [r.name, ...r.genes]))}
        fields={['Term ID', 'Name', 'Protein']}
      >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: 'var(--bg)' }}>
        <thead>
          <tr>
            <th style={TH}>Term ID</th>
            <th style={TH}>Name</th>
            <th style={TH}>Dataset</th>
            <th style={TH}>p-value (FDR)</th>
          </tr>
        </thead>
        <tbody style={{ background: 'var(--bg)' }}>
          {shown.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No rows match.
              </td>
            </tr>
          )}
          {shown.map((term) => (
            <HighlightRow key={term.term_id} term={term.term_id} genes={term.genes}>
              <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                <a
                  href={termUrl(term.term_id, source)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--table-link)' }}
                >
                  {term.term_id}
                </a>
              </td>
              <td style={{ padding: '6px 12px', textAlign: 'center', color: 'var(--text)' }}>{term.name}</td>
              <td style={{ padding: '6px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                {enrichmentDatasetName(source)}
              </td>
              <td style={{ padding: '6px 12px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                {term.p_value.toExponential(2)}
              </td>
            </HighlightRow>
          ))}
        </tbody>
      </table>
      </TableSearch>
      <EnrichmentSourceNote source={source} />
    </div>
  )
}
