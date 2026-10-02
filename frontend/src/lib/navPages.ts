/**
 * The site's pages, as far as the navbar is concerned.
 *
 * An admin picks the navbar style per page, so the appearance editor and the
 * theme both need one list of what a "page" is and which routes belong to it.
 * Grouped the way the admin sidebar groups them — every sign-in screen is one
 * "Accounts" choice, not five.
 */
export interface NavPage {
  id: string
  label: string
  /** Route prefixes this page owns. `/` matches only itself. */
  paths: string[]
}

export const NAV_PAGES: readonly NavPage[] = [
  { id: 'home', label: 'Home', paths: ['/'] },
  { id: 'search', label: 'Search', paths: ['/search'] },
  { id: 'proteins', label: 'Proteins', paths: ['/proteins', '/protein'] },
  { id: 'downloads', label: 'Downloads', paths: ['/download'] },
  { id: 'about', label: 'About', paths: ['/about'] },
  { id: 'developer', label: 'API', paths: ['/developer'] },
  { id: 'faqs', label: 'FAQs', paths: ['/faq'] },
  { id: 'contact', label: 'Contact', paths: ['/contact'] },
  {
    id: 'accounts',
    label: 'Accounts',
    paths: ['/login', '/register', '/profile', '/forgot-password', '/reset-password'],
  },
  { id: 'admin', label: 'Admin', paths: ['/admin'] },
]

/** The page a route belongs to, or null for one no page claims. */
export function navPageIdFor(pathname: string): string | null {
  if (pathname === '/' || pathname === '') return 'home'
  const matches = NAV_PAGES.flatMap((page) =>
    page.paths
      .filter((path) => path !== '/' && (pathname === path || pathname.startsWith(`${path}/`)))
      .map((path) => ({ id: page.id, path }))
  )
  // Longest prefix wins, so a future /about/team stays with About even if some
  // shorter path also matches.
  matches.sort((a, b) => b.path.length - a.path.length)
  return matches[0]?.id ?? null
}

/**
 * `"home:gradient,search:solid"` → `{ home: 'gradient', search: 'solid' }`.
 * Unknown page ids are dropped: a page that was renamed should lose its
 * override, not break the navbar.
 */
export function parseNavOverrides(value?: string | null): Record<string, string> {
  const known = new Set(NAV_PAGES.map((p) => p.id))
  const pairs = (value ?? '')
    .split(',')
    .map((part) => part.split(':').map((s) => s.trim()))
    .filter(([id, style]) => id && style && known.has(id))
  return Object.fromEntries(pairs)
}

export function formatNavOverrides(overrides: Record<string, string>): string {
  return NAV_PAGES.filter((p) => overrides[p.id])
    .map((p) => `${p.id}:${overrides[p.id]}`)
    .join(',')
}
