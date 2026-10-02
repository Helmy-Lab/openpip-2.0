import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { SearchResultsPage } from '../search/SearchResultsPage'
import { useShare, useCreateSavedView } from '../../api/sharing'
import { useProfile } from '../../api/auth'
import { ShareComments } from './ShareComments'
import { Modal } from '../search/modals/Modal'
import { captureViewState } from '../search/searchStore'

/**
 * A network someone shared, opened with their filters and layout. The search
 * is re-run rather than restored from a snapshot, so both people are looking
 * at today's data.
 */
export function SharedViewPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { data: share, isLoading, isError } = useShare(id)

  if (isLoading) {
    return <p style={{ padding: 24, color: 'var(--text-muted)' }}>Loading…</p>
  }
  if (isError || !share) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 18, color: 'var(--text)' }}>
          This network is no longer shared with you.
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Whoever sent it may have withdrawn it. <Link to="/profile">Your profile</Link>{' '}
          lists the networks you still have.
        </p>
      </div>
    )
  }

  return (
    <SearchResultsPage
      term={share.saved_view.query}
      viewState={share.saved_view.state}
      banner={<ShareBanner shareId={share.id} share={share} />}
    />
  )
}

function ShareBanner({ shareId, share }: { shareId: number; share: ReturnType<typeof useShare>['data'] }) {
  const [showComments, setShowComments] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [copyName, setCopyName] = useState('')
  const [saved, setSaved] = useState(false)
  const [failed, setFailed] = useState(false)
  const createView = useCreateSavedView()
  const { data: me } = useProfile()
  if (!share) return null
  // The same page serves both people, so it names the other one.
  const iSent = me?.username === share.sender.username
  const other = iSent ? share.recipient : share.sender

  async function saveCopy() {
    setFailed(false)
    try {
      // Copy the live filters/layout, not what was shared — the recipient
      // has likely been adjusting them since opening this view.
      await createView.mutateAsync({
        name: copyName.trim() || share!.saved_view.name,
        query: share!.saved_view.query,
        state: captureViewState(),
      })
      setShowSaveModal(false)
      setSaved(true)
    } catch {
      setFailed(true)
    }
  }

  return (
    <div
      style={{
        padding: '10px 16px',
        background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
        borderBottom: '1px solid var(--border)',
        fontSize: 13,
        color: 'var(--text)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <strong>{share.saved_view.name}</strong>
        <span style={{ color: 'var(--text-muted)' }}>
          {iSent ? 'shared with' : 'shared by'}{' '}
          <Link to={`/profile/${other.username}`}>{other.name || other.username}</Link>
          {' · '}
          {new Date(share.created_at).toLocaleDateString()}
        </span>
        <button
          type="button"
          className="op-btn"
          onClick={() => setShowComments((v) => !v)}
          style={{ marginLeft: 'auto', fontSize: 12 }}
        >
          {showComments ? 'Hide discussion' : 'Discussion'}
        </button>
        {!iSent && (
          <button
            type="button"
            className="op-btn"
            onClick={() => {
              setCopyName(share.saved_view.name)
              setSaved(false)
              setFailed(false)
              setShowSaveModal(true)
            }}
            style={{ fontSize: 12 }}
          >
            Save a copy
          </button>
        )}
        {saved && (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            Saved — find it on your profile under My Views.
          </span>
        )}
      </div>
      {share.note && <p style={{ margin: '6px 0 0' }}>{share.note}</p>}
      {showComments && <ShareComments shareId={shareId} />}
      {showSaveModal && (
        <Modal title="Save a copy" onClose={() => setShowSaveModal(false)}>
          <label htmlFor="copy-view-name" style={{ fontSize: 13, color: 'var(--text-soft)' }}>
            Name
          </label>
          <input
            id="copy-view-name"
            value={copyName}
            onChange={(e) => setCopyName(e.target.value)}
            style={{
              width: '100%',
              marginTop: 4,
              marginBottom: 12,
              padding: '6px 8px',
              background: 'var(--bg)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 6,
            }}
          />
          {failed && (
            <p style={{ color: 'var(--danger, #c00)', fontSize: 13 }}>
              That did not save. Try again.
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" className="op-btn" onClick={() => setShowSaveModal(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="op-btn primary"
              onClick={saveCopy}
              disabled={createView.isPending}
            >
              Save
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
