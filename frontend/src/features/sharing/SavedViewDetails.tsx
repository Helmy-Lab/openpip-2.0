import { useState } from 'react'
import {
  publicViewUrl,
  usePublicLink,
  useUpdateSavedViewNote,
  type SavedView,
} from '../../api/sharing'
import { NoteEditor } from './NoteEditor'

const SMALL_BTN = { fontSize: 11, padding: '5px 10px' }


interface SavedViewDetailsProps {
  view: SavedView
}

/** The owner's notes on one saved view, and its no-login public link. */
export function SavedViewDetails({ view }: SavedViewDetailsProps) {
  const [copied, setCopied] = useState(false)
  const updateNote = useUpdateSavedViewNote()
  const publicLink = usePublicLink()
  const url = view.public_token ? publicViewUrl(view.public_token) : null

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
      <NoteEditor
        name={view.name}
        note={view.note ?? ''}
        onSave={(note) => updateNote.mutateAsync({ id: view.id, note })}
        isPending={updateNote.isPending}
        isError={updateNote.isError}
      />
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
