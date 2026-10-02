import type { TextEntry, TextGroup } from './types'
import { navGroup } from './groups/nav'
import { homeGroup } from './groups/home'
import { searchGroup } from './groups/search'
import { searchExamplesGroup } from './groups/searchExamples'
import { proteinsGroup } from './groups/proteins'
import { aboutGroup } from './groups/about'
import { apiGroup } from './groups/api'
import { faqGroup, contactGroup, downloadsGroup } from './groups/staticPages'
import { authGroup, authLabelsGroup } from './groups/auth'

/**
 * Every text group, in the order the admin editor lists them.
 *
 * Several groups are deliberately not wired to a settings tab. `search` and
 * `proteins` are dense UI labelling that nobody asked to retitle; `api` derives
 * its one deployment-specific value, the base URL, from the Site URL setting;
 * `about`, `faq` and `contact` keep the single rich-text block their pages have
 * always had instead; `authLabels` is the sign-in furniture — "Password",
 * "Forgot?", "Send reset link" — which every site words the same way. They all
 * stay registered so their pages keep resolving through `t()` — dropping them
 * would make every key render as its own name — they simply always serve their
 * shipped defaults.
 */
export const TEXT_GROUPS: readonly TextGroup[] = [
  navGroup,
  homeGroup,
  searchGroup,
  searchExamplesGroup,
  proteinsGroup,
  downloadsGroup,
  aboutGroup,
  apiGroup,
  faqGroup,
  contactGroup,
  authGroup,
  authLabelsGroup,
]

/** Group id → group, for editors that render one page's copy at a time. */
export const TEXT_GROUP_BY_ID: Readonly<Record<string, TextGroup>> = Object.fromEntries(
  TEXT_GROUPS.map((group) => [group.id, group])
)

/** Flat key → entry lookup, built once at module load. */
export const TEXT_ENTRIES: Readonly<Record<string, TextEntry>> = Object.fromEntries(
  TEXT_GROUPS.flatMap((group) => group.entries.map((entry) => [entry.key, entry]))
)

/** Flat key → shipped default. */
export const TEXT_DEFAULTS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(TEXT_ENTRIES).map(([key, entry]) => [key, entry.default])
)

export type TextKey = string

/**
 * The shipped copy for a key. Returns the key itself for an unregistered key so
 * a typo shows up visibly in development rather than rendering as a blank.
 */
export function getTextDefault(key: string): string {
  const entry = TEXT_ENTRIES[key]
  return entry ? entry.default : key
}

/**
 * Resolves a key against admin overrides, falling back to the shipped default.
 *
 * An override of `''` is honoured — blanking a label is a deliberate choice, and
 * callers that need to hide their surrounding markup check for an empty result.
 */
export function resolveText(overrides: Record<string, string> | undefined, key: string): string {
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, key)) {
    return overrides[key]
  }
  return getTextDefault(key)
}
