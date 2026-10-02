import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ADMIN_NAV, settingsTabFromSearch } from './adminNav'
import type { AdminNavItem } from './adminNav'
import { useAdminDirty } from '../../store/adminDirty'

/**
 * Shell for the admin section: one categorized sidebar on the left, the current
 * screen on the right.
 *
 * The sidebar lists the Site Settings panels alongside News, Datasets and Files
 * — they were two separate navigations before, and the settings half was a
 * horizontal tab strip that had outgrown the width available to it.
 */
export function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const dirtyTabs = useAdminDirty((s) => s.tabs)

  const onSettings = location.pathname.startsWith('/admin/settings')
  const activeTab = onSettings ? settingsTabFromSearch(location.search) : null

  const isCurrent = (item: AdminNavItem) =>
    item.tab ? onSettings && item.tab === activeTab : location.pathname.startsWith(item.to)

  /**
   * Settings edits live in the form's own state, so a link that unmounts it
   * throws them away. Moving between settings panels is safe — same component.
   */
  const handleClick = (e: React.MouseEvent, item: AdminNavItem) => {
    e.preventDefault()
    const leavingForm = onSettings && !item.tab && dirtyTabs.length > 0
    if (leavingForm && !window.confirm('Leave Site Settings? Unsaved changes will be lost.')) return
    // replace: moving between panels shouldn't stack up history entries.
    navigate(item.to, { replace: Boolean(item.tab) && onSettings })
  }

  return (
    <div
      style={{
        background: 'var(--bg)',
        minHeight: '100%',
        display: 'grid',
        gridTemplateColumns: 'minmax(200px, 240px) minmax(0, 1fr)',
        alignItems: 'start',
      }}
    >
      <nav
        aria-label="Admin sections"
        style={{
          position: 'sticky',
          top: 56,
          maxHeight: 'calc(100vh - 56px)',
          overflowY: 'auto',
          borderRight: '1px solid var(--border)',
          background: 'var(--surface)',
          padding: '20px 12px 32px',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '.08em',
            color: 'var(--text-soft)',
            padding: '0 10px 14px',
          }}
        >
          Admin
        </div>

        {ADMIN_NAV.map((section) => (
          <div key={section.title} style={{ marginBottom: 18 }}>
            <h2
              id={`admin-nav-${section.title.toLowerCase()}`}
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '.06em',
                color: 'var(--text-soft)',
                margin: '0 0 6px',
                padding: '0 10px',
              }}
            >
              {section.title}
            </h2>
            <ul
              aria-labelledby={`admin-nav-${section.title.toLowerCase()}`}
              style={{ listStyle: 'none', margin: 0, padding: 0 }}
            >
              {section.items.map((item) => {
                const current = isCurrent(item)
                const dirty = item.tab ? dirtyTabs.includes(item.tab) : false
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      title={item.hint}
                      onClick={(e) => handleClick(e, item)}
                      aria-current={current ? 'page' : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '7px 10px',
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: current ? 600 : 500,
                        // The chip pair, not raw --primary on --surface-2. Both
                        // of those fail in dark mode: theme.ts sets --primary
                        // inline on the root from the admin's brand colour, so
                        // it overrides the dark-theme token and lands whatever
                        // lightness the brand happens to be — 1.05:1 for the
                        // Midnight preset. --surface-2 against the sidebar's
                        // --surface is 1.06:1, so the background gave no
                        // fallback signal either. --primary-soft/-deep are
                        // derived per theme precisely for selected rows, with
                        // --primary-deep held to 4.5:1 against the soft
                        // background whatever the brand.
                        color: current ? 'var(--primary-deep)' : 'var(--text-muted)',
                        background: current ? 'var(--primary-soft)' : 'transparent',
                        textDecoration: 'none',
                      }}
                    >
                      {item.label}
                      {dirty && (
                        <span
                          aria-label="has unsaved changes"
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: 'var(--primary)',
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div style={{ minWidth: 0 }}>
        <Outlet />
      </div>
    </div>
  )
}
