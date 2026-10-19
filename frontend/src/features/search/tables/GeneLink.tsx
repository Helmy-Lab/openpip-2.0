import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useSettings } from '../../../api/settings'
import { proteinLink, type ProteinIds } from './ncbi'

/** A gene name in a result table, linked wherever the admin chose. */
export function GeneLink({ ids, style }: { ids: ProteinIds; style?: CSSProperties }) {
  const { data: settings } = useSettings()
  const { href, internal } = proteinLink(ids, settings)
  const linkStyle = { color: 'var(--accent)', textDecoration: 'underline', ...style }
  if (internal) {
    return <Link to={href} style={linkStyle}>{ids.gene}</Link>
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>
      {ids.gene}
    </a>
  )
}
