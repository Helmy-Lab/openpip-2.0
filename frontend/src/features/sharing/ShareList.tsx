import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useShares, useDeleteShare } from '../../api/sharing'
import { ShareComments } from './ShareComments'

const CARD_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '.08em',
  marginBottom: 16,
}

const ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
}

const SMALL_BTN: React.CSSProperties = { fontSize: 11, padding: '5px 10px' }

const COPY = {
  received: {
    title: 'Shared With Me',
    empty: 'Nothing yet. Colleagues can send you a network from their own saved views.',
    preposition: 'from',
    removeLabel: 'Dismiss',
  },
  sent: {
    title: 'Shared By Me',
    empty: 'Networks you send to a colleague are listed here.',
    preposition: 'to',
    removeLabel: 'Revoke',
  },
}

/**
 * One side of the sharing ledger. Both sides carry the same row — a view, the
 * other person, and the discussion — so they are the same component; only the
 * wording and which end of the share is "the other person" differ.
 */
export function ShareList({ direction }: { direction: 'received' | 'sent' }) {
  const navigate = useNavigate()
  const { data: shares = [] } = useShares(direction)
  const deleteShare = useDeleteShare()
  const [openId, setOpenId] = useState<number | null>(null)
  const copy = COPY[direction]

  return (
    <div className="op-card" style={{ padding: 28, marginBottom: 20 }}>
      <div style={CARD_LABEL}>{copy.title}</div>
      {shares.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{copy.empty}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shares.map((share) => {
            const other = direction === 'received' ? share.sender : share.recipient
            const expanded = openId === share.id
            return (
              <div key={share.id} style={{ ...ROW, flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                      {share.saved_view.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {copy.preposition}{' '}
                      <Link to={`/profile/${other.username}`}>
                        {other.name || other.username}
                      </Link>
                      {' · '}
                      {new Date(share.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    className="op-btn"
                    style={SMALL_BTN}
                    aria-expanded={expanded}
                    onClick={() => setOpenId(expanded ? null : share.id)}
                  >
                    {expanded ? 'Hide details' : 'Details'}
                  </button>
                  <button
                    className="op-btn"
                    style={SMALL_BTN}
                    onClick={() => navigate(`/shared/${share.id}`)}
                  >
                    Open
                  </button>
                  <button
                    onClick={() => deleteShare.mutate(share.id)}
                    aria-label={`${copy.removeLabel} ${share.saved_view.name}`}
                    title={copy.removeLabel}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      fontSize: 18,
                      lineHeight: 1,
                      padding: 4,
                    }}
                  >
                    ×
                  </button>
                </div>

                {expanded && (
                  <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Search{' '}
                      <span className="op-chip" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                        {share.saved_view.query}
                      </span>
                    </div>
                    {share.note && (
                      <p style={{ margin: '0 0 6px', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                        {share.note}
                      </p>
                    )}
                    <ShareComments shareId={share.id} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
