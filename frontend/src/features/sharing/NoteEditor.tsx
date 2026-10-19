import { useState } from 'react'
import { NOTE_MAX } from '../../api/sharing'

const SMALL_BTN = { fontSize: 11, padding: '5px 10px' }

interface NoteEditorProps {
  /** What the notes are on, for the textarea's label. */
  name: string
  note: string
  onSave: (note: string) => Promise<unknown>
  isPending: boolean
  isError: boolean
}

/** The owner's private notes on something they kept: shown as text, edited in place. */
export function NoteEditor({ name, note, onSave, isPending, isError }: NoteEditorProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  async function save() {
    await onSave(draft.trim())
    setEditing(false)
  }

  return (
    <>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
        Notes (only you see these)
      </div>
      {editing ? (
        <>
          <textarea
            aria-label={`Notes on ${name}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={NOTE_MAX}
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
          {isError && (
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
              className="op-btn primary"
              style={SMALL_BTN}
              onClick={save}
              disabled={isPending}
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
    </>
  )
}
