import { useParams, Link } from 'react-router-dom'
import { SearchResultsPage } from '../search/SearchResultsPage'
import { usePublicView } from '../../api/sharing'

/**
 * A saved view opened by its public link — no login. The search re-runs like
 * any other view, so the visitor sees today's data, and nothing about the
 * owner comes with it.
 */
export function PublicViewPage() {
  const { token = '' } = useParams<{ token: string }>()
  const { data: view, isLoading, isError } = usePublicView(token)

  if (isLoading) {
    return <p style={{ padding: 24, color: 'var(--text-muted)' }}>Loading…</p>
  }
  if (isError || !view) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 18, color: 'var(--text)' }}>This link is no longer active.</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Whoever shared it may have turned it off. You can still <Link to="/">search openPIP</Link>{' '}
          yourself.
        </p>
      </div>
    )
  }

  return (
    <SearchResultsPage
      term={view.query}
      viewState={view.state}
      banner={
        <div
          style={{
            padding: '10px 16px',
            background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
            borderBottom: '1px solid var(--border)',
            fontSize: 13,
            color: 'var(--text)',
          }}
        >
          <strong>{view.name}</strong>{' '}
          <span style={{ color: 'var(--text-muted)' }}>· shared by public link</span>
        </div>
      }
    />
  )
}
