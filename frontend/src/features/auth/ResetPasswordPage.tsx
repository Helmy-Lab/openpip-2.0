import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useResetPassword } from '../../api/auth'
import { useText } from '../../text'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const t = useText()
  const uid = searchParams.get('uid') ?? ''
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [validationError, setValidationError] = useState('')
  const { mutate, isPending, isSuccess, error } = useResetPassword()

  const linkInvalid = !uid || !token

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError('')
    if (password.trim().length < 8) {
      setValidationError(t('auth.reset.tooShort'))
      return
    }
    if (password !== confirm) {
      setValidationError(t('auth.reset.mismatch'))
      return
    }
    mutate({ uid, token, password })
  }

  const apiError =
    error && (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

  if (linkInvalid) {
    return (
      <div
        style={{
          minHeight: 'calc(100vh - 56px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--surface)',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <p style={{ color: 'var(--danger)', fontSize: 15, marginBottom: 16 }}>
            This reset link is missing required parameters.
          </p>
          <Link to="/forgot-password" style={{ color: 'var(--primary)', fontSize: 14 }}>
            Request a new reset link
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 56px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface)',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: '-.02em',
            margin: '0 0 8px',
            color: 'var(--text)',
          }}
        >
          Choose a new password
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 28px' }}>
          Enter a new password for your account.
        </p>

        {isSuccess ? (
          <div>
            <div
              style={{
                padding: '14px 16px',
                background: 'var(--success-bg, #f0fdf4)',
                border: '1px solid var(--success-border, #bbf7d0)',
                borderRadius: 8,
                color: 'var(--success-text, #166534)',
                fontSize: 14,
                lineHeight: 1.5,
                marginBottom: 20,
              }}
            >
              Your password has been updated.
            </div>
            <Link
              to="/login"
              className="op-btn primary"
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '11px',
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              Sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label
              htmlFor="new-password"
              style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block' }}
            >
              New password
            </label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="op-input"
              style={{ margin: '6px 0 16px' }}
              placeholder={t('auth.reset.placeholder')}
            />

            <label
              htmlFor="confirm-password"
              style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block' }}
            >
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="op-input"
              style={{ margin: '6px 0 20px' }}
            />

            {(validationError || apiError) && (
              <p style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 16px' }}>
                {validationError || apiError}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="op-btn primary"
              style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14 }}
            >
              {isPending ? t('auth.reset.submitting') : t('auth.reset.submit')}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-muted)' }}>
          <Link to="/login" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
