import type { Protein } from '../../../types/api'
import { HighlightRow } from './HighlightRow'
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
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '.07em',
  color: 'var(--text-muted)',
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

  return (
    <div style={{ background: 'var(--bg)' }}>
      <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: 13, background: 'var(--bg)' }}>
        <thead>
          <tr>
            <th style={TH}>Location</th>
            <th style={TH}>Proteins</th>
            <th style={TH}>Dataset</th>
            <th style={TH}>Reliability</th>
          </tr>
        </thead>
        <tbody style={{ background: 'var(--bg)' }}>
          {locations.map((location) => {
            const entries = [...byLocation[location]].sort(
              (a, b) => rank(a.level) - rank(b.level) || a.gene.localeCompare(b.gene)
            )
            return (
              <HighlightRow
                key={location}
                term={location}
                genes={entries.map((e) => e.gene)}
              >
                <td style={{ padding: '8px 16px', color: 'var(--text)', textTransform: 'capitalize' }}>
                  {location.replace(/_/g, ' ')}
                </td>
                <td style={{ padding: '8px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
                  {entries.map((e) => e.gene).join(' | ')}
                </td>
                <td style={{ padding: '8px 16px', color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                  HPA Cell Atlas
                </td>
                <td style={{ padding: '8px 16px', whiteSpace: 'nowrap' }}>
                  {entries.map((e) => (
                    <ReliabilityBadge key={e.gene} level={e.level} title={`${e.gene}: ${e.level}`} />
                  ))}
                </td>
              </HighlightRow>
            )
          })}
        </tbody>
      </table>
      <HpaSourceNote />
    </div>
  )
}
