import { useState } from 'react'
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom'
import { useLogin } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import { useText } from '../../text'
import { returnPath } from '../../lib/returnTo'

/* Static network preview for the gradient panel */
const LOGIN_NODES = [
  { id: 'BAD',    x: 0,   y: 0,   query: true  },
  { id: 'BCL2',   x: 120, y: -60, query: false },
  { id: 'AKT1',   x: 20,  y: 130, query: false },
  { id: 'YWHAZ',  x: -90, y: -40, query: false },
  { id: 'SFN',    x: -40, y: 90,  query: false },
  { id: 'RAF1',   x: 70,  y: -40, query: false },
  { id: 'EWSR1',  x: -120, y: 20, query: false },
  { id: 'BCL2L1', x: 140,  y: 40, query: false },
]
const LOGIN_EDGES: [string, string][] = [
  ['BAD','BCL2'], ['BAD','AKT1'], ['BAD','YWHAZ'],
  ['BAD','SFN'], ['BAD','RAF1'], ['BAD','EWSR1'],
  ['BAD','BCL2L1'], ['RAF1','YWHAZ'], ['BCL2','BCL2L1'],
]

function LoginNetworkSVG() {
  const W = 360, H = 320
  const cx = W / 2, cy = H / 2
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" style={{ display: 'block' }}>
      {LOGIN_EDGES.map(([a, b], i) => {
        const na = LOGIN_NODES.find(n => n.id === a)
        const nb = LOGIN_NODES.find(n => n.id === b)
        if (!na || !nb) return null
        return (
          <line
            key={i}
            x1={cx + na.x} y1={cy + na.y}
            x2={cx + nb.x} y2={cy + nb.y}
            stroke="rgba(255,255,255,.35)"
            strokeWidth="1.5"
          />
        )
      })}
      {LOGIN_NODES.map(n => (
        <g key={n.id} transform={`translate(${cx + n.x},${cy + n.y})`}>
          <circle
            r={n.query ? 20 : 16}
            fill="none"
            stroke="rgba(255,255,255,.6)"
            strokeWidth={n.query ? 2.5 : 1.5}
          />
          <text
            textAnchor="middle"
            dy=".35em"
            fontSize={n.query ? 10 : 8.5}
            fontFamily="ui-monospace, monospace"
            fontWeight="500"
            fill="rgba(255,255,255,.85)"
          >
            {n.id}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const { mutate: login, isPending, error } = useLogin()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const t = useText()
  // Back to the page that sent the visitor here (a search, a shared view),
  // not always the home page.
  const destination = returnPath(useLocation().state)

  if (isLoggedIn) return <Navigate to={destination} replace />

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    login({ username, password }, { onSuccess: () => navigate(destination, { replace: true }) })
  }

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 56px)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
      }}
    >
      {/* Form side */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 80,
          background: 'var(--surface)',
        }}
      >
        <div style={{ width: '100%', maxWidth: 380 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: '-.02em',
              margin: '0 0 6px',
              color: 'var(--text)',
            }}
          >
            {t('auth.login.title')}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 28px' }}>
            {t('auth.login.subtitle')}
          </p>

          <form onSubmit={handleSubmit}>
            <label
              htmlFor="login-username"
              style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block' }}
            >
              {t('auth.login.username')}
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="op-input"
              style={{ margin: '6px 0 16px' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label
                htmlFor="login-password"
                style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}
              >
                {t('auth.login.password')}
              </label>
              <Link
                to="/forgot-password"
                style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none' }}
              >
                {t('auth.login.forgot')}
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="op-input"
              style={{ margin: '6px 0 20px' }}
            />

            {error && (
              <p style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 16px' }}>
                {t('auth.login.error')}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="op-btn primary"
              style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14 }}
            >
              {isPending ? t('auth.login.submitting') : t('auth.login.submit')}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 28, fontSize: 13, color: 'var(--text-muted)' }}>
            {t('auth.login.newPrompt')}{' '}
            <Link
              to="/register"
              style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}
            >
              {t('auth.login.newLink')}
            </Link>
          </p>
        </div>
      </div>

      {/* Gradient panel */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #0ea5e9 100%)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, opacity: 0.6 }}>
          <LoginNetworkSVG />
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: 48,
            right: 48,
            color: '#fff',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              opacity: 0.8,
              textTransform: 'uppercase',
              letterSpacing: '.1em',
              marginBottom: 12,
            }}
          >
            {t('auth.login.panelEyebrow')}
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 500,
              lineHeight: 1.35,
              letterSpacing: '-.01em',
              maxWidth: 420,
            }}
          >
            {t('auth.login.panelQuote')}
          </div>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 12 }}>
            {t('auth.login.panelAttribution')}
          </div>
        </div>
      </div>
    </div>
  )
}
