import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useNotifications,
  useMarkNotificationRead,
  useClearNotifications,
  useMarkAllRead,
} from '../api/sharing'
import { useAuthStore } from '../store/authStore'
import { playChime, chimeMuted, setChimeMuted } from '../lib/chime'

const PANEL_BTN: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  fontSize: 12,
  padding: '2px 4px',
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
]
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "2 hours ago", "yesterday" — smallest unit Intl.RelativeTimeFormat won't
 * need us to reimplement (it already knows "yesterday", "next week", etc). */
function relativeTime(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000
  if (seconds < 45) return 'just now'
  for (const [unit, secondsInUnit] of RELATIVE_UNITS) {
    if (seconds >= secondsInUnit) {
      return rtf.format(-Math.round(seconds / secondsInUnit), unit)
    }
  }
  return rtf.format(-Math.round(seconds / 60), 'minute')
}

export function NotificationBell() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { data: notifications = [] } = useNotifications()
  const markRead = useMarkNotificationRead()
  const clearAll = useClearNotifications()
  const markAllRead = useMarkAllRead()
  const [muted, setMuted] = useState(chimeMuted())

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const unread = notifications.filter((n) => !n.read).length

  // Sound only for a count that grew: marking one read lowers it, and a
  // reload should not announce what was already waiting.
  const seenUnread = useRef<number | null>(null)
  useEffect(() => {
    if (seenUnread.current !== null && unread > seenUnread.current) playChime()
    seenUnread.current = unread
  }, [unread])

  if (!isLoggedIn) return null

  function pick(id: number, link: string) {
    markRead.mutate(id)
    setOpen(false)
    if (link) navigate(link)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
        aria-expanded={open}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          // Sits on the header bar, so it takes the header's own foreground
          // like the theme toggle and the nav links beside it.
          color: 'var(--color-header, #ffffff)',
          position: 'relative',
          padding: 4,
          lineHeight: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" style={{ opacity: 0.75 }}>
          <path d="M9 2a4.5 4.5 0 0 0-4.5 4.5c0 3.5-1.5 4.5-1.5 4.5h12s-1.5-1-1.5-4.5A4.5 4.5 0 0 0 9 2Z" />
          <path d="M7.5 13.5a1.6 1.6 0 0 0 3 0" />
        </svg>
        {unread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              minWidth: 15,
              height: 15,
              borderRadius: 8,
              background: 'var(--primary)',
              color: '#fff',
              fontSize: 10,
              lineHeight: '15px',
              textAlign: 'center',
              padding: '0 3px',
            }}
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: 6,
            zIndex: 60,
            width: 300,
            maxHeight: 340,
            overflowY: 'auto',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {notifications.length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 10px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setChimeMuted(!muted)
                  setMuted(!muted)
                }}
                aria-pressed={muted}
                title={muted ? 'Sound off' : 'Sound on'}
                style={PANEL_BTN}
              >
                {muted ? 'Sound off' : 'Sound on'}
              </button>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  title="Mark every notification read, but keep the list"
                  style={PANEL_BTN}
                >
                  Mark all read
                </button>
                <button
                  type="button"
                  onClick={() => clearAll.mutate()}
                  disabled={clearAll.isPending}
                  title="Delete every notification"
                  style={PANEL_BTN}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          {notifications.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 12, margin: 0 }}>
              Nothing yet.
            </p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => pick(n.id, n.link)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: n.read ? 'none' : 'color-mix(in srgb, var(--primary) 8%, transparent)',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  padding: '10px 12px',
                  color: 'var(--text)',
                  fontSize: 13,
                }}
              >
                {n.text}
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                  {relativeTime(n.created_at)}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
