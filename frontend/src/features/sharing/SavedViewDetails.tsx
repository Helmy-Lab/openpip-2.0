import { useState } from 'react'
import {
  publicViewUrl,
  usePublicLink,
  useUpdateSavedViewNote,
  type SavedView,
} from '../../api/sharing'

const SMALL_BTN = { fontSize: 11, padding: '5px 10px' }

interface SavedViewDetailsProps {
  view: SavedView
}

/** The owner's notes on one saved view, and its no-login public link. */
export function SavedViewDetails({ view }: SavedViewDetailsProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const updateNote = useUpdateSavedViewNote()
  const publicLink = usePublicLink()
  const note = view.note ?? ''
  const url = view.public_token ? publicViewUrl(view.public_token) : null

  async function saveNote() {
    await updateNote.mutateAsync({ id: view.id, note: draft.trim() })
    setEditing(false)
  }

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // No clipboard access (http, old browser): the link is on screen to copy by hand.
    }
  }

  return (
    <div
      style={{
        marginTop: 10,
        borderTop: '1px solid var(--border)',
        paddingTop: 10,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
        Notes (only you see these)
      </div>
      {editing ? (
        <>
          <textarea
            aria-label={`Notes on ${view.name}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              padding: '6px 8px',
              background: 'var(--bg)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              resize: 'vertical',
            }}
          />
          {updateNote.isError && (
            <p
              style={{
                color: 'var(--danger, #c00)',
                fontSize: 12,
                margin: '4px 0 0',
              }}
            >
              That did not save. Try again.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button
              className="op-btn op-btn-primary"
              style={SMALL_BTN}
              onClick={saveNote}
              disabled={updateNote.isPending}
            >
              Save note
            </button>
            <button className="op-btn" style={SMALL_BTN} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <p
            style={{
              flex: 1,
              margin: 0,
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              color: note ? 'var(--text)' : 'var(--text-muted)',
            }}
          >
            {note || 'No notes yet.'}
          </p>
          <button
            className="op-btn"
            style={SMALL_BTN}
            onClick={() => {
              setDraft(note)
              setEditing(true)
            }}
          >
            {note ? 'Edit note' : 'Add note'}
          </button>
        </div>
      )}

      <div
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          margin: '12px 0 4px',
        }}
      >
        Public link — anyone with it can open this view without logging in. Your notes stay private.
      </div>
      {url ? (
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <input
            readOnly
            aria-label="Public link"
            value={url}
            onFocus={(e) => e.target.select()}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '5px 8px',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              background: 'var(--bg)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 6,
            }}
          />
          <button className="op-btn" style={SMALL_BTN} onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            className="op-btn"
            style={SMALL_BTN}
            onClick={() => {
              setCopied(false)
              publicLink.mutate({ id: view.id, on: false })
            }}
            disabled={publicLink.isPending}
          >
            Turn off link
          </button>
        </div>
      ) : (
        <button
          className="op-btn"
          style={SMALL_BTN}
          onClick={() => publicLink.mutate({ id: view.id, on: true })}
          disabled={publicLink.isPending}
        >
          Create public link
        </button>
      )}
    </div>
  )
}
