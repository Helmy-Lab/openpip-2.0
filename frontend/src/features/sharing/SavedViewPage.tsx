import { useParams, Link } from 'react-router-dom'
import { SearchResultsPage } from '../search/SearchResultsPage'
import { useSavedViews } from '../../api/sharing'

/**
 * One of your own saved views, opened with the filters and layout it was
 * saved with. Read from the list the profile already loads rather than a
 * per-view endpoint — a person has a handful of these, not a page of them.
 */
export function SavedViewPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { data: views = [], isLoading } = useSavedViews()
  const view = views.find((v) => String(v.id) === id)

  if (isLoading) {
    return <p style={{ padding: 24, color: 'var(--text-muted)' }}>Loading…</p>
  }
  if (!view) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 18, color: 'var(--text)' }}>No such saved view.</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          <Link to="/profile">Your profile</Link> lists the ones you still have.
        </p>
      </div>
    )
  }

  return <SearchResultsPage term={view.query} viewState={view.state} />
}
