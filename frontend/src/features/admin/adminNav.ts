/**
 * The admin sidebar: every screen an administrator can reach, grouped.
 *
 * Site Settings used to be a row of ten horizontal tabs sitting under a
 * separate row of links to News, Datasets and Files — two navigations for one
 * job, and the settings row had run out of horizontal room. Both collapse into
 * this one list, so "where do I change X" is answered by scanning a single
 * column.
 *
 * Items that carry a `tab` are panels of the Site Settings form and share its
 * one Save button; the rest are pages of their own. This module owns the labels
 * for both kinds, so the sidebar and the settings form can never disagree about
 * what a section is called.
 */

/** A panel of the Site Settings form, addressed as `/admin/settings?tab=<id>`. */
export type SettingsTabId =
  | 'global'
  | 'appearance'
  | 'home'
  | 'search'
  | 'downloads'
  | 'about'
  | 'faqs'
  | 'contact'
  | 'accounts'

export interface AdminNavItem {
  label: string
  /** One line under the label saying what lives here. */
  hint: string
  /** Path with any query string, e.g. `/admin/settings?tab=home`. */
  to: string
  /** Present when this item is a Site Settings panel rather than its own page. */
  tab?: SettingsTabId
}

export interface AdminNavSection {
  title: string
  items: AdminNavItem[]
}

/** A Site Settings panel, as a sidebar item. */
function settings(tab: SettingsTabId, label: string, hint: string): AdminNavItem {
  return { label, hint, to: `/admin/settings?tab=${tab}`, tab }
}

export const ADMIN_NAV: readonly AdminNavSection[] = [
  {
    title: 'Site',
    items: [
      settings('global', 'Site Identity', 'Title, URL, version, logo, footer'),
      settings('appearance', 'Appearance', 'Theme, buttons, network colors'),
    ],
  },
  {
    title: 'Pages',
    items: [
      settings('home', 'Home', 'Hero, mission, methods, citation'),
      settings('search', 'Search', 'Example queries, interaction categories'),
      settings('downloads', 'Downloads', 'What is offered, and the page intro'),
      settings('about', 'About', 'Page content'),
      settings('faqs', 'FAQs', 'Page content'),
      settings('contact', 'Contact', 'Page content'),
      settings('accounts', 'Accounts', 'Sign-in and registration copy'),
    ],
  },
  {
    title: 'Content',
    items: [
      { label: 'News', hint: 'Homepage announcements', to: '/admin/announcement' },
      { label: 'Datasets', hint: 'Import and manage interaction data', to: '/admin/data' },
      { label: 'Files', hint: 'Downloadable supplementary files', to: '/admin/files' },
    ],
  },
]

/** Every sidebar item, flattened, in the order the sidebar lists them. */
export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = ADMIN_NAV.flatMap((s) => s.items)

/** The Site Settings panels, in sidebar order. */
export const SETTINGS_TABS: readonly { id: SettingsTabId; label: string; hint: string }[] =
  ADMIN_NAV_ITEMS.filter((item) => item.tab).map((item) => ({
    id: item.tab as SettingsTabId,
    label: item.label,
    hint: item.hint,
  }))

const SETTINGS_TAB_IDS = new Set<string>(SETTINGS_TABS.map((t) => t.id))

/** The panel shown when no `?tab=` is given. */
export const DEFAULT_SETTINGS_TAB: SettingsTabId = 'global'

export function isSettingsTab(value: string | null): value is SettingsTabId {
  return value !== null && SETTINGS_TAB_IDS.has(value)
}

/** The `?tab=` of a URL, or the default panel when it is missing or unknown. */
export function settingsTabFromSearch(search: string): SettingsTabId {
  const tab = new URLSearchParams(search).get('tab')
  return isSettingsTab(tab) ? tab : DEFAULT_SETTINGS_TAB
}

export function settingsTabLabel(tab: SettingsTabId): string {
  return SETTINGS_TABS.find((t) => t.id === tab)?.label ?? tab
}

export function settingsTabHint(tab: SettingsTabId): string {
  return SETTINGS_TABS.find((t) => t.id === tab)?.hint ?? ''
}
