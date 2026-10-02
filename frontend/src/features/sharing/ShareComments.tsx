import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useShareComments, useAddComment, useEditComment } from '../../api/sharing'
import { useProfile } from '../../api/auth'
import { playChime } from '../../lib/chime'

const INPUT: React.CSSProperties = {
  flex: 1,
  padding: '6px 8px',
  background: 'var(--bg)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
}

/** Flat discussion between the two people a network is shared between. */
export function ShareComments({ shareId }: { shareId: number }) {
  const [body, setBody] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const { data: comments = [] } = useShareComments(shareId)
  const { data: me } = useProfile()
  const addComment = useAddComment(shareId)
  const editComment = useEditComment(shareId)

  // A reply arriving while the discussion is open. Your own post is not news,
  // and an edit does not change the count.
  const seenCount = useRef<number | null>(null)
  useEffect(() => {
    const newest = comments[comments.length - 1]
    if (
      seenCount.current !== null &&
      comments.length > seenCount.current &&
      newest &&
      newest.author.username !== me?.username
    ) {
      playChime()
    }
    seenCount.current = comments.length
  }, [comments, me?.username])

  function submit() {
    const trimmed = body.trim()
    if (!trimmed) return
    addComment.mutate(trimmed, { onSuccess: () => setBody('') })
  }

  function saveEdit(commentId: number) {
    const trimmed = draft.trim()
    if (!trimmed) return
    editComment.mutate(
      { commentId, body: trimmed },
      { onSuccess: () => setEditingId(null) },
    )
  }

  return (
    <div style={{ marginTop: 10 }}>
      {comments.map((c) => (
        <div key={c.id} style={{ marginBottom: 8 }}>
          <Link to={`/profile/${c.author.username}`} style={{ fontWeight: 600 }}>
            {c.author.name || c.author.username}
          </Link>
          <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 12 }}>
            {new Date(c.created_at).toLocaleString()}
            {c.edited && ' · edited'}
          </span>
          {c.author.username === me?.username && editingId !== c.id && (
            <button
              type="button"
              onClick={() => {
                setEditingId(c.id)
                setDraft(c.body)
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: 12,
                padding: '0 6px',
              }}
            >
              Edit
            </button>
          )}
          {editingId === c.id ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <label htmlFor={`edit-${c.id}`} style={{ display: 'none' }}>
                Edit comment
              </label>
              <input
                id={`edit-${c.id}`}
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit(c.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                style={INPUT}
              />
              <button
                type="button"
                className="op-btn"
                onClick={() => saveEdit(c.id)}
                disabled={!draft.trim() || editComment.isPending}
              >
                Save
              </button>
              <button type="button" className="op-btn" onClick={() => setEditingId(null)}>
                Cancel
              </button>
            </div>
          ) : (
            <p style={{ margin: '2px 0 0', whiteSpace: 'pre-wrap' }}>{c.body}</p>
          )}
        </div>
      ))}
      {comments.length === 0 && (
        <p style={{ color: 'var(--text-muted)', margin: '0 0 8px' }}>No comments yet.</p>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <label htmlFor={`comment-${shareId}`} className="sr-only" style={{ display: 'none' }}>
          Add a comment
        </label>
        <input
          id={`comment-${shareId}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Add a comment"
          style={INPUT}
        />
        <button
          type="button"
          className="op-btn"
          onClick={submit}
          disabled={!body.trim() || addComment.isPending}
        >
          Post
        </button>
      </div>
    </div>
  )
}
