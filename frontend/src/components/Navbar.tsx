import { NavLink, useLocation } from 'react-router-dom'
import { useLogout } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { useDarkMode } from '../store/darkModeStore'
import { useText } from '../text'
import { NotificationBell } from './NotificationBell'

interface NavbarProps {
  isLoggedIn: boolean
}

const publicLinks = [
  { to: '/', textKey: 'nav.home', end: true },
  { to: '/search', textKey: 'nav.search', end: false },
  { to: '/proteins', textKey: 'nav.proteins', end: false },
  { to: '/download', textKey: 'nav.downloads', end: false },
  { to: '/developer', textKey: 'nav.api', end: false },
  { to: '/about', textKey: 'nav.about', end: false },
  { to: '/faq', textKey: 'nav.faq', end: false },
  { to: '/contact', textKey: 'nav.contact', end: false },
]

const linkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--color-header, #ffffff)',
  opacity: isActive ? 1 : 0.72,
  background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
  textDecoration: 'none',
  transition: 'all .15s',
  display: 'inline-block',
})

export function Navbar({ isLoggedIn }: NavbarProps) {
  const location = useLocation()
  const logout = useLogout()
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const { dark, toggle } = useDarkMode()
  const t = useText()

  return (
    <nav
      style={{ display: 'flex', alignItems: 'center', flex: 1, flexWrap: 'wrap' }}
      aria-label={t('nav.ariaLabel')}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          flexWrap: 'wrap',
          gap: 2,
          padding: '0 8px',
        }}
      >
        {publicLinks.map((link) => (
          <NavLink key={link.to} to={link.to} style={linkStyle} end={link.end}>
            {t(link.textKey)}
          </NavLink>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          padding: '0 20px',
          flexShrink: 0,
        }}
      >
        <button
          onClick={toggle}
          aria-label={dark ? t('nav.themeToLight') : t('nav.themeToDark')}
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            color: 'var(--color-header, #ffffff)',
            opacity: 0.75,
            fontSize: 16,
            transition: 'opacity .15s',
            padding: 0,
          }}
        >
          {dark ? '☀' : '☾'}
        </button>
        {isLoggedIn ? (
          <>
            <NotificationBell />
            {isAdmin && (
              <NavLink to="/admin" style={linkStyle}>
                {t('nav.admin')}
              </NavLink>
            )}
            <NavLink to="/profile" style={linkStyle}>
              {t('nav.profile')}
            </NavLink>
            <button
              onClick={() => logout.mutate()}
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--color-header, #ffffff)',
                opacity: 0.72,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: 6,
                fontFamily: 'var(--font)',
                transition: 'opacity .15s',
              }}
            >
              {t('nav.logout')}
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login" state={{ from: location }} style={linkStyle}>
              {t('nav.login')}
            </NavLink>
            <NavLink
              to="/register"
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                background: 'rgba(255,255,255,0.18)',
                color: 'var(--color-header, #ffffff)',
                border: '1px solid rgba(255,255,255,0.35)',
                textDecoration: 'none',
                transition: 'background .15s',
                display: 'inline-block',
              }}
            >
              {t('nav.register')}
            </NavLink>
          </>
        )}
      </div>
    </nav>
  )
}
