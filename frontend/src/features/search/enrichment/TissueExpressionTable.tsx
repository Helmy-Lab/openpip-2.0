import type { Protein } from '../../../types/api'
import { GtexSourceNote } from './SourceNote'
import { tissueLabel } from '../../../lib/tissues'
import { useState } from 'react'
import { HighlightRow } from './HighlightRow'
import { TableSearch } from '../tables/TableSearch'
import { matchRows, suggestionsFrom } from '../tables/tableFilter'

interface TissueExpressionTableProps {
  proteins: Protein[]
}

const THRESHOLD = 5.0

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

export function TissueExpressionTable({ proteins }: TissueExpressionTableProps) {
  const [query, setQuery] = useState('')
  // Group proteins by tissue; apply legacy threshold >= 5.0; strip \r from stored values
  const byTissue: Record<string, string[]> = {}
  for (const p of proteins) {
    const tissue = p.tissue_expression_array as Record<string, string>
    for (const [name, rawLevel] of Object.entries(tissue)) {
      const level = parseFloat(rawLevel?.replace?.('\r', '') ?? '')
      if (!isNaN(level) && level >= THRESHOLD) {
        byTissue[name] ??= []
        byTissue[name].push(p.protein_gene_name)
      }
    }
  }

  const tissues = Object.keys(byTissue).sort()

  if (tissues.length === 0) {
    return (
      <p style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
        No tissue expression data available for these proteins.
      </p>
    )
  }

  const shown = matchRows(tissues, query, (tissue) => [tissueLabel(tissue), ...byTissue[tissue]])

  return (
    <div style={{ background: 'var(--bg)' }}>
      <TableSearch
        value={query}
        onChange={setQuery}
        suggestions={suggestionsFrom(tissues.flatMap((tissue) => [tissueLabel(tissue), ...byTissue[tissue]]))}
        fields={['Tissue', 'Proteins']}
      >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: 'var(--bg)' }}>
        <thead>
          <tr>
            <th style={TH}>Tissue</th>
            <th style={TH}>Proteins</th>
            <th style={TH}>Dataset</th>
          </tr>
        </thead>
        <tbody style={{ background: 'var(--bg)' }}>
          {shown.length === 0 && (
            <tr>
              <td colSpan={3} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No rows match.
              </td>
            </tr>
          )}
          {shown.map((tissue) => (
            <HighlightRow key={tissue} term={tissue} genes={byTissue[tissue]}>
              <td style={{ padding: '6px 12px', textAlign: 'center', color: 'var(--text)' }}>
                {tissueLabel(tissue)}
              </td>
              <td style={{ padding: '6px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                {byTissue[tissue].join(' | ')}
              </td>
              <td style={{ padding: '6px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                GTEx v6.0
              </td>
            </HighlightRow>
          ))}
        </tbody>
      </table>
      </TableSearch>
      <GtexSourceNote />
    </div>
  )
}
