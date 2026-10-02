import { useState } from 'react'
import { RichTextEditor } from '../../components/RichTextEditor'
import type { TextEntry, TextGroup } from '../../text'
import type { SiteTextDraftMap } from './useSiteTextDrafts'

/**
 * The editable copy for one page, rendered flat inside that page's settings tab.
 *
 * A field left empty has no override and shows the shipped wording as grey
 * placeholder text, so future copy improvements keep flowing through to
 * anything the admin never customized.
 */

/** Groups long enough that scanning them benefits from a filter box. */
const FILTER_THRESHOLD = 8

function matchesQuery(entry: TextEntry, needle: string): boolean {
  if (!needle) return true
  return [entry.key, entry.label, entry.default, entry.hint ?? '', entry.section ?? '']
    .join(' ')
    .toLowerCase()
    .includes(needle)
}

function FieldEditor({
  entry,
  value,
  isOverridden,
  onChange,
  onRevert,
}: {
  entry: TextEntry
  value: string
  isOverridden: boolean
  onChange: (v: string) => void
  onRevert: () => void
}) {
  const kind = entry.kind ?? 'text'
  const fieldId = `text-${entry.key}`
  // Two blocks on the same page can each have a field called "Body", so the
  // accessible name carries the block it belongs to even though the visible
  // label stays short — the section heading above it supplies the context on
  // screen, but a screen reader reading field by field has no such anchor.
  const accessibleName = entry.section ? `${entry.section}: ${entry.label}` : entry.label
  // Quill renders a contenteditable div rather than a form control, so there is
  // nothing for htmlFor to point at; the editor is named as a group instead.
  const isRich = kind === 'html'

  return (
    <div style={{ padding: '14px 0', borderTop: '1px solid var(--border)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 6,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          {/* The chip sits outside the label so it stays out of the field's
              accessible name — screen readers announce "Home link", not
              "Home link customized". */}
          {isRich ? (
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
              {entry.label}
            </span>
          ) : (
            <label htmlFor={fieldId} style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
              {entry.label}
            </label>
          )}
          {isOverridden && (
            <span className="op-chip" style={{ fontSize: 10, padding: '1px 7px' }}>
              customized
            </span>
          )}
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <code
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              color: 'var(--text-soft)',
            }}
          >
            {entry.key}
          </code>
          {(value !== '' || isOverridden) && (
            <button
              type="button"
              onClick={onRevert}
              style={{
                fontSize: 11,
                background: 'transparent',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                padding: '2px 8px',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontFamily: 'var(--font)',
              }}
              title="Clear this field to go back to the shipped wording"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {isRich ? (
        <div role="group" aria-label={accessibleName}>
          <RichTextEditor value={value} onChange={onChange} placeholder={entry.default} rows={4} />
        </div>
      ) : kind === 'multiline' ? (
        <textarea
          id={fieldId}
          aria-label={accessibleName}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={entry.default}
          rows={Math.min(10, Math.max(2, Math.ceil(entry.default.length / 90)))}
          className="op-input"
          style={{ resize: 'vertical', lineHeight: 1.6, fontSize: 13 }}
        />
      ) : (
        <input
          id={fieldId}
          aria-label={accessibleName}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={entry.default}
          className="op-input"
          style={{ fontSize: 13 }}
        />
      )}

      {entry.hint && (
        <p
          style={{
            fontSize: 11,
            color: 'var(--text-soft)',
            margin: '5px 0 0',
            lineHeight: 1.5,
          }}
        >
          {entry.hint}
        </p>
      )}
    </div>
  )
}

export interface SiteTextFieldsProps {
  group: TextGroup
  drafts: SiteTextDraftMap
  overrides: Record<string, string>
  onChange: (key: string, value: string) => void
  onRevert: (key: string) => void
}

export function SiteTextFields({
  group,
  drafts,
  overrides,
  onChange,
  onRevert,
}: SiteTextFieldsProps) {
  const [filter, setFilter] = useState('')
  const [showChrome, setShowChrome] = useState(false)
  const needle = filter.trim().toLowerCase()

  const isOverridden = (entry: TextEntry) =>
    Object.prototype.hasOwnProperty.call(overrides, entry.key)

  const entries = group.entries.filter((entry) => matchesQuery(entry, needle))
  const customizedCount = group.entries.filter(isOverridden).length

  // Prose splits into the blocks a visitor sees, in page order; everything
  // unsectioned is chrome and collapses out of the way. A Map keeps insertion
  // order, so a section declared once renders once even if its entries are
  // not contiguous in the group file.
  const bySection = new Map<string, TextEntry[]>()
  const chrome: TextEntry[] = []
  for (const entry of entries) {
    if (!entry.section) {
      chrome.push(entry)
      continue
    }
    const existing = bySection.get(entry.section)
    if (existing) existing.push(entry)
    else bySection.set(entry.section, [entry])
  }

  // A filter that only matched chrome would otherwise look like no results.
  const chromeOpen = showChrome || needle !== ''
  const chromeCustomized = chrome.filter(isOverridden).length

  const renderField = (entry: TextEntry) => (
    <FieldEditor
      key={entry.key}
      entry={entry}
      value={drafts[entry.key] ?? ''}
      isOverridden={isOverridden(entry)}
      onChange={(v) => onChange(entry.key, v)}
      onRevert={() => onRevert(entry.key)}
    />
  )

  return (
    <div style={{ marginBottom: 32 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 10,
        }}
      >
        <h3
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '.08em',
            margin: 0,
          }}
        >
          {group.label} text
        </h3>
        <span style={{ fontSize: 11, color: 'var(--text-soft)' }}>
          {group.entries.length} {group.entries.length === 1 ? 'item' : 'items'}
          {customizedCount > 0 && ` · ${customizedCount} customized`}
        </span>
        {group.route && (
          <a
            href={import.meta.env.BASE_URL.replace(/\/$/, '') + group.route}
            target="_blank"
            rel="noreferrer"
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: 'var(--primary)',
              textDecoration: 'none',
            }}
          >
            View page ↗
          </a>
        )}
      </div>

      <p
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          margin: '0 0 10px',
          lineHeight: 1.5,
        }}
      >
        {group.description ?? 'Leave a field empty to use the wording openPIP ships with.'}
      </p>

      {group.entries.length > FILTER_THRESHOLD && (
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter these fields…"
          className="op-input"
          style={{ fontSize: 13, marginBottom: 4 }}
          aria-label={`Filter ${group.label} text fields`}
        />
      )}

      {entries.length === 0 && (
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            padding: '20px 0',
          }}
        >
          Nothing matches “{filter}”.
        </p>
      )}

      {[...bySection].map(([name, sectionEntries]) => (
        <section key={name} style={{ marginTop: 18 }}>
          <h4
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text)',
              margin: '0 0 2px',
            }}
          >
            {name}
          </h4>
          {sectionEntries.map(renderField)}
        </section>
      ))}

      {chrome.length > 0 && (
        <section style={{ marginTop: 18 }}>
          <button
            type="button"
            onClick={() => setShowChrome((open) => !open)}
            aria-expanded={chromeOpen}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 0',
              borderTop: '1px solid var(--border)',
              borderLeft: 'none',
              borderRight: 'none',
              borderBottom: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'var(--font)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-muted)',
              textAlign: 'left',
            }}
          >
            <span aria-hidden style={{ fontSize: 10 }}>
              {chromeOpen ? '▾' : '▸'}
            </span>
            Labels &amp; buttons ({chrome.length})
            {chromeCustomized > 0 && (
              <span style={{ color: 'var(--text-soft)' }}>· {chromeCustomized} customized</span>
            )}
            <span
              style={{
                marginLeft: 'auto',
                fontWeight: 400,
                color: 'var(--text-soft)',
              }}
            >
              button captions, placeholders, empty states
            </span>
          </button>
          {chromeOpen && chrome.map(renderField)}
        </section>
      )}
    </div>
  )
}
