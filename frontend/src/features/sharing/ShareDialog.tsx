import { useState } from 'react'
import { Modal } from '../search/modals/Modal'
import { useUserSearch, type UserCard } from '../../api/users'
import { useCreateShare, useCreateSavedView } from '../../api/sharing'
import type { ViewState } from '../search/searchStore'

interface ShareDialogProps {
  /** An existing saved view, shared from the profile. */
  savedViewId?: number
  /** The dialog's title, and the default name in capture mode. */
  savedViewName: string
  /**
   * The network on screen right now. Given this instead of an id, sharing
   * saves the view as it sends, so nothing has to be saved first.
   */
  capture?: { query: string; state: Partial<ViewState> }
  onClose: () => void
}

/** Hand one network to a whole lab at once, with a note about what to look at. */
export function ShareDialog({ savedViewId, savedViewName, capture, onClose }: ShareDialogProps) {
  const [term, setTerm] = useState('')
  const [picked, setPicked] = useState<UserCard[]>([])
  const [note, setNote] = useState('')
  const [name, setName] = useState(savedViewName)
  const { data: matches = [] } = useUserSearch(term)
  const share = useCreateShare()
  const createView = useCreateSavedView()
  // Names that failed, so the error line can say who — empty means no failure.
  const [failed, setFailed] = useState<string[]>([])

  const available = matches.filter((u) => !picked.some((p) => p.username === u.username))

  function addPicked(u: UserCard) {
    // Leave the search term as-is — the whole point is adding more people
    // without retyping, and `available` below drops anyone already picked.
    setPicked((prev) => [...prev, u])
  }

  function removePicked(username: string) {
    setPicked((prev) => prev.filter((p) => p.username !== username))
  }

  async function submit() {
    if (picked.length === 0) return
    setFailed([])
    try {
      const viewId =
        savedViewId ??
        (await createView.mutateAsync({
          name: name.trim() || savedViewName,
          query: capture!.query,
          state: capture!.state,
        })).id

      // ponytail: POST /shares/ takes one recipient, so this loops client-side
      // instead of adding a bulk endpoint. Fine for a lab-sized list; if
      // recipient lists grow long, the upgrade path is a real bulk endpoint.
      const results = await Promise.allSettled(
        picked.map((u) => share.mutateAsync({ saved_view: viewId, recipient: u.username, note })),
      )
      const failedNames = picked
        .filter((_, i) => results[i].status === 'rejected')
        .map((u) => u.name || u.username)

      if (failedNames.length === 0) {
        onClose()
      } else {
        setFailed(failedNames)
      }
    } catch {
      // The view itself never saved, so nobody got sent anything.
      setFailed(picked.map((u) => u.name || u.username))
    }
  }

  return (
    <Modal title={capture ? 'Share this network' : `Share "${savedViewName}"`} onClose={onClose}>
      {capture && (
        <>
          <label htmlFor="share-view-name" style={{ fontSize: 13, color: 'var(--text-soft)' }}>
            Name
          </label>
          <input
            id="share-view-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
        </>
      )}

      {picked.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: '0 0 12px',
            padding: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
          }}
        >
          {picked.map((u) => (
            <li
              key={u.username}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 999,
                fontSize: 13,
                color: 'var(--text)',
              }}
            >
              {u.name || u.username}
              <button
                type="button"
                onClick={() => removePicked(u.username)}
                aria-label={`Remove ${u.name || u.username}`}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text-muted)' }}>
        You can share only with people who have an openPIP account. They will find it
        under Shared With Me and in their notifications. No email is sent.
      </p>
      <label htmlFor="share-recipient" style={{ fontSize: 13, color: 'var(--text-soft)' }}>
        Find someone on openPIP
      </label>
      <input
        id="share-recipient"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        autoComplete="off"
        style={{
          width: '100%',
          marginTop: 4,
          marginBottom: 8,
          padding: '6px 8px',
          background: 'var(--bg)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 6,
        }}
      />
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 160, overflowY: 'auto' }}>
        {available.map((u) => (
          <li key={u.username}>
            <button
              type="button"
              onClick={() => addPicked(u)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 4px',
                color: 'var(--text)',
                fontSize: 13,
              }}
            >
              {u.name || u.username}
              {u.affiliation && (
                <span style={{ color: 'var(--text-muted)' }}> · {u.affiliation}</span>
              )}
            </button>
          </li>
        ))}
        {term.trim().length >= 2 && available.length === 0 && (
          <li style={{ fontSize: 13, color: 'var(--text-muted)', padding: '6px 4px' }}>
            Nobody found.
          </li>
        )}
      </ul>

      <label htmlFor="share-note" style={{ fontSize: 13, color: 'var(--text-soft)' }}>
        Note (optional)
      </label>
      <textarea
        id="share-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="What should they look at?"
        style={{
          width: '100%',
          marginTop: 4,
          padding: '6px 8px',
          background: 'var(--bg)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          resize: 'vertical',
        }}
      />

      {failed.length > 0 && (
        <p style={{ color: 'var(--danger, #c00)', fontSize: 13 }}>
          {failed.length === picked.length
            ? 'That share did not go through. Check the person and try again.'
            : `That share did not reach ${failed.join(', ')}. Check them and try again.`}
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button type="button" className="op-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="op-btn primary"
          onClick={submit}
          disabled={picked.length === 0 || share.isPending || createView.isPending}
        >
          Share
        </button>
      </div>
    </Modal>
  )
}
