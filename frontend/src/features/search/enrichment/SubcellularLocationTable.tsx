import type { Protein } from '../../../types/api'
import { useState } from 'react'
import { HighlightRow } from './HighlightRow'
import { TableSearch } from '../tables/TableSearch'
import { matchRows, suggestionsFrom } from '../tables/tableFilter'
import { HpaSourceNote } from './SourceNote'
import { ReliabilityBadge } from './ReliabilityBadge'

interface SubcellularLocationTableProps {
  proteins: Protein[]
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

/** HPA reliability, strongest first — used to order the badges in a row. */
const RELIABILITY_RANK: Record<string, number> = {
  validated: 0,
  supported: 1,
  approved: 2,
}

function rank(level: string) {
  return RELIABILITY_RANK[level.toLowerCase()] ?? 99
}

export function SubcellularLocationTable({ proteins }: SubcellularLocationTableProps) {
  const [query, setQuery] = useState('')
  // Group proteins by location. The stored value is not a flag — it is the HPA
  // reliability score for that protein/compartment call (approved | supported |
  // validated). Empty string means "not localised here", so it still gates the row.
  const byLocation: Record<string, { gene: string; level: string }[]> = {}
  for (const p of proteins) {
    const loc = p.subcellular_location_expression_array as Record<string, string>
    for (const [location, rawLevel] of Object.entries(loc)) {
      const level = rawLevel?.replace?.('\r', '').trim() ?? ''
      if (level) {
        byLocation[location] ??= []
        byLocation[location].push({ gene: p.protein_gene_name, level })
      }
    }
  }

  const locations = Object.keys(byLocation).sort()

  if (locations.length === 0) {
    return (
      <p style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
        No subcellular location data available for these proteins.
      </p>
    )
  }

  const label = (location: string) => location.replace(/_/g, ' ')
  const genesAt = (location: string) => byLocation[location].map((e) => e.gene)
  const shown = matchRows(locations, query, (l) => [label(l), ...genesAt(l)])

  return (
    <div style={{ background: 'var(--bg)' }}>
      <TableSearch
        value={query}
        onChange={setQuery}
        suggestions={suggestionsFrom(locations.flatMap((l) => [label(l), ...genesAt(l)]))}
        fields={['Location', 'Proteins']}
      >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: 'var(--bg)' }}>
        <thead>
          <tr>
            <th style={TH}>Location</th>
            <th style={TH}>Proteins</th>
            <th style={TH}>Dataset</th>
            <th style={TH}>Reliability</th>
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
          {shown.map((location) => {
            const entries = [...byLocation[location]].sort(
              (a, b) => rank(a.level) - rank(b.level) || a.gene.localeCompare(b.gene)
            )
            return (
              <HighlightRow
                key={location}
                term={location}
                genes={entries.map((e) => e.gene)}
              >
                <td style={{ padding: '6px 12px', textAlign: 'center', color: 'var(--text)', textTransform: 'capitalize' }}>
                  {location.replace(/_/g, ' ')}
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  {entries.map((e) => e.gene).join(' | ')}
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                  HPA Cell Atlas
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {entries.map((e) => (
                    <ReliabilityBadge key={e.gene} level={e.level} title={`${e.gene}: ${e.level}`} />
                  ))}
                </td>
              </HighlightRow>
            )
          })}
        </tbody>
      </table>
      </TableSearch>
      <HpaSourceNote />
    </div>
  )
}
