import { useParams, Link } from 'react-router-dom'
import { usePublicProfile } from '../../api/users'
import { useShares } from '../../api/sharing'
import { mediaUrl } from '../../api/client'

function Avatar({ src, label, size = 72 }: { src: string | null; label: string; size?: number }) {
  const common = { width: size, height: size, borderRadius: '50%', flexShrink: 0 } as const
  if (src) return <img src={mediaUrl(src)} alt="" style={{ ...common, objectFit: 'cover' }} />
  return (
    <div
      style={{
        ...common,
        background: 'var(--primary-soft)',
        color: 'var(--primary)',
        display: 'grid',
        placeItems: 'center',
        fontSize: size / 2.6,
        fontWeight: 600,
        fontFamily: 'var(--mono)',
      }}
    >
      {(label[0] ?? '?').toUpperCase()}
    </div>
  )
}

export function PublicProfilePage() {
  const { username = '' } = useParams<{ username: string }>()
  const { data: profile, isLoading, isError } = usePublicProfile(username)
  const { data: received = [] } = useShares('received')
  const { data: sent = [] } = useShares('sent')

  if (isLoading) {
    return <p style={{ padding: 24, color: 'var(--text-muted)' }}>Loading…</p>
  }
  if (isError || !profile) {
    return (
      <p style={{ padding: 24, color: 'var(--text)' }}>No openPIP user by that name.</p>
    )
  }

  // What the two of you have passed back and forth. Filtered from the lists the
  // profile page already loads rather than asked of the API again.
  const between = [
    ...received
      .filter((s) => s.sender.username === username)
      .map((s) => ({ ...s, direction: 'from them' })),
    ...sent
      .filter((s) => s.recipient.username === username)
      .map((s) => ({ ...s, direction: 'to them' })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at))

  const hasDetails = !!(profile.name || profile.position || profile.affiliation || profile.website || profile.bio)

  return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Avatar src={profile.avatar} label={profile.name || profile.username} />
        <div>
          <h1 style={{ fontSize: 22, margin: 0, color: 'var(--text)' }}>
            {profile.name || profile.username}
          </h1>
          <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 13 }}>
            @{profile.username}
          </p>
          {profile.position && (
            <p style={{ margin: '2px 0 0', color: 'var(--text-soft)' }}>{profile.position}</p>
          )}
          {profile.affiliation && (
            <p style={{ margin: '2px 0 0', color: 'var(--text-muted)' }}>
              {profile.affiliation}
            </p>
          )}
        </div>
      </div>

      {profile.website && (
        <p style={{ marginTop: 16 }}>
          <a href={profile.website} target="_blank" rel="noreferrer noopener">
            {profile.website}
          </a>
        </p>
      )}
      {profile.bio && (
        <p style={{ marginTop: 12, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
          {profile.bio}
        </p>
      )}

      <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
        On openPIP since {new Date(profile.joined).toLocaleDateString()}
      </p>

      {/* A profile nobody has filled in is otherwise a blank page, which reads
          as something failing to load. */}
      {!hasDetails && (
        <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
          This user has not added any profile details yet.
        </p>
      )}

      <h2 style={{ fontSize: 13, marginTop: 28, color: 'var(--text-soft)' }}>
        Networks between you
      </h2>
      {between.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Nothing shared between you yet.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {between.map((share) => (
            <li key={share.id} style={{ padding: '6px 0', fontSize: 13 }}>
              <Link to={`/shared/${share.id}`}>{share.saved_view.name}</Link>
              <span style={{ color: 'var(--text-muted)' }}>
                {' · '}
                {share.direction}
                {' · '}
                {new Date(share.created_at).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
