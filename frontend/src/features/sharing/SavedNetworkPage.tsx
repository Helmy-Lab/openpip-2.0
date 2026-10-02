import { useParams, Link } from 'react-router-dom'
import { SearchResultsPage } from '../search/SearchResultsPage'
import { useSavedNetwork } from '../../api/networks'
import { snapshotViewState } from './snapshotViewState'

/**
 * A saved network opened as the snapshot it is: the interactions stored when it
 * was saved, not a fresh search for its query (legacy reloaded them the same
 * way). A saved view, by contrast, re-runs its search.
 */
export function SavedNetworkPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { data: network, isLoading, isError } = useSavedNetwork(id)

  if (isLoading) {
    return <p style={{ padding: 24, color: 'var(--text-muted)' }}>Loading…</p>
  }
  if (isError || !network) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 18, color: 'var(--text)' }}>No such saved network.</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          <Link to="/profile">Your profile</Link> lists the ones you still have.
        </p>
      </div>
    )
  }

  return (
    <SearchResultsPage
      term={network.query}
      result={network}
      viewState={snapshotViewState(network)}
      banner={
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '8px 16px' }}>
          Snapshot <strong style={{ color: 'var(--text)' }}>{network.name}</strong>: the{' '}
          {network.all_interactions.length} interactions as they were saved.
        </p>
      }
    />
  )
}
