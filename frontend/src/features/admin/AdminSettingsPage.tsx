import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSettings, useUpdateSettings, useUploadLogo, useDeleteLogo } from '../../api/settings'
import { injectCSSVars } from '../../lib/theme'
import { NAV_PAGES, parseNavOverrides, formatNavOverrides } from '../../lib/navPages'
import { mediaUrl } from '../../api/client'
import { EXAMPLE_TYPES, exampleTypeLabel, normalizeExampleType } from '../../lib/exampleType'
import type { AdminSettings } from '../../types/api'
import { RichTextEditor } from '../../components/RichTextEditor'
import { TEXT_GROUP_BY_ID } from '../../text'
import { SiteTextFields } from './SiteTextFields'
import { PhraseHelp } from './PhraseHelp'
import { useSiteTextDrafts } from './useSiteTextDrafts'
import {
  settingsTabFromSearch,
  settingsTabHint,
  settingsTabLabel,
  SETTINGS_TABS,
} from './adminNav'
import type { SettingsTabId } from './adminNav'
import { useAdminDirty } from '../../store/adminDirty'
import { useAdminUsers, useSetAdminAccess } from '../../api/adminUsers'
import { useProfile } from '../../api/auth'
import type { AdminUser } from '../../types/api'
import {
  useInteractionCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '../../api/interactionCategories'
import type { InteractionCategory } from '../../types/api'

// ─────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────
const DEFAULT_COLORS: Partial<AdminSettings> = {
  navStyle:            'solid',
  mainColorScheme:     '#2563eb',
  mainColorScheme2:    '#0ea5e9',
  gradientAngle:       135,
  headerColorScheme:   '#ffffff',
  logoColorScheme:     '#ffffff',
  buttonColorScheme:   '#2563eb',
  queryNodeColor:      '#e11d48',
  interactorNodeColor: '#2563eb',
  publishedEdgeColor:  '#38761d',
  validatedEdgeColor:  '#1155cc',
  verifiedEdgeColor:   '#cc0000',
  literatureEdgeColor: '#0ea5e9',
}

// ─────────────────────────────────────────────────────────
// Preset themes
// ─────────────────────────────────────────────────────────
interface Preset {
  name: string
  preview: string
  colors: Partial<AdminSettings>
}

const PRESETS: Preset[] = [
  {
    name: 'openPIP Blue',
    preview: 'linear-gradient(135deg,#2563eb,#0ea5e9)',
    colors: { navStyle:'gradient', mainColorScheme:'#2563eb', mainColorScheme2:'#0ea5e9', gradientAngle:135, headerColorScheme:'#ffffff', queryNodeColor:'#e11d48', interactorNodeColor:'#2563eb', literatureEdgeColor:'#0ea5e9', publishedEdgeColor:'#7c3aed', validatedEdgeColor:'#1155cc', verifiedEdgeColor:'#cc0000' },
  },
  {
    name: 'Crimson',
    preview: 'linear-gradient(135deg,#a51c30,#e11d48)',
    colors: { navStyle:'gradient', mainColorScheme:'#a51c30', mainColorScheme2:'#e11d48', gradientAngle:135, headerColorScheme:'#ffffff', queryNodeColor:'#ff6b6b', interactorNodeColor:'#a51c30', literatureEdgeColor:'#0ea5e9', publishedEdgeColor:'#7c3aed', validatedEdgeColor:'#1155cc', verifiedEdgeColor:'#e11d48' },
  },
  {
    name: 'Forest',
    preview: 'linear-gradient(135deg,#166534,#10b981)',
    colors: { navStyle:'gradient', mainColorScheme:'#166534', mainColorScheme2:'#10b981', gradientAngle:135, headerColorScheme:'#ffffff', queryNodeColor:'#e11d48', interactorNodeColor:'#166534', literatureEdgeColor:'#0ea5e9', publishedEdgeColor:'#10b981', validatedEdgeColor:'#1155cc', verifiedEdgeColor:'#cc0000' },
  },
  {
    name: 'Purple',
    preview: 'linear-gradient(135deg,#6d28d9,#a855f7)',
    colors: { navStyle:'gradient', mainColorScheme:'#6d28d9', mainColorScheme2:'#a855f7', gradientAngle:135, headerColorScheme:'#ffffff', queryNodeColor:'#e11d48', interactorNodeColor:'#6d28d9', literatureEdgeColor:'#38bdf8', publishedEdgeColor:'#a855f7', validatedEdgeColor:'#6d28d9', verifiedEdgeColor:'#e11d48' },
  },
  {
    name: 'Ocean',
    preview: 'linear-gradient(135deg,#0f766e,#06b6d4)',
    colors: { navStyle:'gradient', mainColorScheme:'#0f766e', mainColorScheme2:'#06b6d4', gradientAngle:135, headerColorScheme:'#ffffff', queryNodeColor:'#e11d48', interactorNodeColor:'#0f766e', literatureEdgeColor:'#06b6d4', publishedEdgeColor:'#10b981', validatedEdgeColor:'#0f766e', verifiedEdgeColor:'#e11d48' },
  },
  {
    name: 'Midnight',
    preview: 'linear-gradient(135deg,#0f172a,#1e40af)',
    colors: { navStyle:'gradient', mainColorScheme:'#0f172a', mainColorScheme2:'#1e40af', gradientAngle:135, headerColorScheme:'#94a3b8', queryNodeColor:'#fb7185', interactorNodeColor:'#60a5fa', literatureEdgeColor:'#38bdf8', publishedEdgeColor:'#a78bfa', validatedEdgeColor:'#60a5fa', verifiedEdgeColor:'#fb7185' },
  },
  {
    name: 'Sunset',
    preview: 'linear-gradient(135deg,#dc2626,#ea580c,#f59e0b)',
    colors: { navStyle:'gradient', mainColorScheme:'#dc2626', mainColorScheme2:'#f59e0b', gradientAngle:135, headerColorScheme:'#ffffff', queryNodeColor:'#dc2626', interactorNodeColor:'#ea580c', literatureEdgeColor:'#f59e0b', publishedEdgeColor:'#10b981', validatedEdgeColor:'#1155cc', verifiedEdgeColor:'#dc2626' },
  },
  {
    name: 'Light',
    preview: 'var(--surface)',
    colors: { navStyle:'light', mainColorScheme:'#2563eb', headerColorScheme:'#1e293b', logoColorScheme:'#2563eb' },
  },
]

// ─────────────────────────────────────────────────────────
// Field metadata
// ─────────────────────────────────────────────────────────
type TabId = SettingsTabId

/** Fields that only affect appearance — used for dirty-tracking and reset. */
const COLOR_FIELDS: (keyof AdminSettings)[] = [
  'navStyle',
  'navStyleOverrides',
  'mainColorScheme',
  'mainColorScheme2',
  'gradientAngle',
  'headerColorScheme',
  'logoColorScheme',
  'buttonColorScheme',
  'queryNodeColor',
  'interactorNodeColor',
  'publishedEdgeColor',
  'validatedEdgeColor',
  'verifiedEdgeColor',
  'literatureEdgeColor',
]

/** Small inline dropdown, as used by the per-page navbar and example types. */
const SELECT_STYLE: React.CSSProperties = {
  fontSize: 12,
  padding: '4px 8px',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontFamily: 'var(--font)',
  cursor: 'pointer',
  outline: 'none',
}

interface TabConfig {
  /** Settings columns edited on this tab. Drives the unsaved-changes marker. */
  fields?: (keyof AdminSettings)[]
  /** Text-registry group ids whose copy is edited on this tab. */
  textGroups?: string[]
}

/**
 * What each sidebar panel edits. A panel owns both the structured settings for
 * its page and that page's editable copy, so an admin changing "the About page"
 * never has to work out which of two editors a given string lives in.
 *
 * Not every page exposes its copy. Search and the protein browser are dense UI
 * labelling that ships fixed; the API page's only deployment-specific content
 * is its base URL, which follows Site URL. About, FAQs and Contact each keep
 * the single rich-text block they have always had, and nothing more. Accounts
 * offers the prose on the sign-in and registration pages but not the forms:
 * "Password" and "Send reset link" are the words visitors expect.
 *
 * Keyed by tab id, so a panel added to the sidebar without a config here — or
 * a config for a panel the sidebar dropped — fails to compile.
 */
const TAB_CONFIG: Record<TabId, TabConfig> = {
  global: {
    fields: ['title', 'shortTitle', 'url', 'version', 'footer', 'logoUrl'],
    textGroups: ['nav'],
  },
  appearance: { fields: COLOR_FIELDS },
  home: { textGroups: ['home'] },
  search: {
    fields: [
      'example1', 'example2', 'example3',
      'example1Type', 'example2Type', 'example3Type',
      'showTissueExpression', 'showSubcellularLocation',
      'horizontalFilterBar', 'canvasBackgroundColor',
    ],
    // The phrase examples live beside the gene ones they sit next to on the
    // page, rather than on Home where the rest of the hero copy is edited.
    textGroups: ['searchExamples'],
  },
  downloads: {
    fields: ['download', 'showDownloads', 'showDownloadAll'],
    textGroups: ['downloads'],
  },
  about:         { fields: ['about'] },
  documentation: { textGroups: ['documentation'] },
  faqs:          { fields: ['faq'] },
  contact:       { fields: ['contact'] },
  accounts:      { textGroups: ['auth'] },
}

/** The panels, in the order the sidebar lists them. */
const TABS = SETTINGS_TABS.map((tab) => ({ id: tab.id, ...TAB_CONFIG[tab.id] }))

/** Every text key a tab is responsible for, so its dirty marker can be derived. */
const TAB_TEXT_KEYS: Record<string, string[]> = Object.fromEntries(
  TABS.map((tab) => [
    tab.id,
    // Tolerate an unknown group id: a renamed text group should drop its
    // fields from the editor, not take the whole settings page down.
    (tab.textGroups ?? []).flatMap((id) =>
      (TEXT_GROUP_BY_ID[id]?.entries ?? []).map((e) => e.key)
    ),
  ])
)

// ─────────────────────────────────────────────────────────
// Small reusable form primitives
// ─────────────────────────────────────────────────────────
function FieldLabel({
  children,
  changed,
  onRevert,
}: {
  children: React.ReactNode
  /** Marks the field as edited-but-unsaved and shows a revert affordance. */
  changed?: boolean
  onRevert?: () => void
}) {
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--text-muted)',
        marginBottom: 6,
      }}
    >
      {children}
      {changed && onRevert && (
        <button
          type="button"
          onClick={onRevert}
          title="Revert this field to the last saved value"
          style={{
            fontSize: 10,
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: 'var(--primary)',
            cursor: 'pointer',
            fontFamily: 'var(--font)',
            textDecoration: 'underline',
          }}
        >
          revert
        </button>
      )}
    </span>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="op-input"
    />
  )
}

function TextareaInput({
  value,
  onChange,
  rows = 4,
  mono,
}: {
  value: string
  onChange: (v: string) => void
  rows?: number
  mono?: boolean
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      style={{
        width: '100%',
        padding: '9px 12px',
        borderRadius: 8,
        border: '1px solid var(--border-strong)',
        background: 'var(--surface)',
        fontFamily: mono ? 'var(--mono)' : 'var(--font)',
        fontSize: 13,
        color: 'var(--text)',
        outline: 'none',
        resize: 'vertical',
        lineHeight: 1.6,
      }}
      onFocus={(e) => {
        e.target.style.borderColor = 'var(--primary)'
        e.target.style.boxShadow = '0 0 0 3px var(--primary-soft)'
      }}
      onBlur={(e) => {
        e.target.style.borderColor = 'var(--border-strong)'
        e.target.style.boxShadow = 'none'
      }}
    />
  )
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
      }}
    >
      <label
        style={{
          position: 'relative',
          width: 36,
          height: 36,
          borderRadius: 8,
          overflow: 'hidden',
          border: '2px solid var(--border-strong)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: value,
            borderRadius: 6,
          }}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0,
            width: '100%',
            height: '100%',
            cursor: 'pointer',
          }}
        />
      </label>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
          {label}
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onChange(e.target.value)
          }}
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
            border: 'none',
            background: 'transparent',
            outline: 'none',
            width: 80,
            padding: 0,
          }}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Panels
// ─────────────────────────────────────────────────────────
interface TabPanelProps {
  id: TabId
  active: boolean
  children: React.ReactNode
}

function TabPanel({ id, active, children }: TabPanelProps) {
  if (!active) return null
  return (
    <section
      id={`settings-panel-${id}`}
      aria-label={settingsTabLabel(id)}
      style={{ padding: '28px 32px' }}
    >
      {/* Mount only the visible panel. All ten at once is several hundred
          inputs and a Quill instance each, which makes every keystroke crawl.
          Form state lives in the parent, so unmounting loses no edits. */}
      {children}
    </section>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '.08em',
        margin: '0 0 16px',
      }}
    >
      {children}
    </h3>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <SectionHeader>{title}</SectionHeader>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Live header preview
// ─────────────────────────────────────────────────────────
function NavPreview({
  style = 'solid', main, main2, angle = 135, header,
}: {
  style?: string; main: string; main2?: string; angle?: number; header: string
}) {
  let bg: string
  if (style === 'gradient') bg = `linear-gradient(${angle}deg, ${main}, ${main2 ?? '#0ea5e9'})`
  else if (style === 'light') bg = 'var(--surface)'
  else bg = main

  const borderB = style === 'light' ? '1px solid var(--border)' : 'none'

  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', marginTop: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', padding: '6px 10px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
        Navbar preview
      </div>
      <div style={{ background: bg, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 24, borderBottom: borderB }}>
        {/* Mini logo */}
        <svg width="18" height="18" viewBox="0 0 32 32" fill="none" aria-hidden>
          <circle cx="16" cy="16" r="4" fill="rgba(255,255,255,0.9)" />
          <circle cx="5"  cy="8"  r="2.2" fill="rgba(255,255,255,0.65)" />
          <circle cx="27" cy="9"  r="2.2" fill="rgba(255,255,255,0.65)" />
          <circle cx="6"  cy="25" r="2.2" fill="rgba(255,255,255,0.65)" />
          <circle cx="26" cy="25" r="2.2" fill="rgba(255,255,255,0.65)" />
        </svg>
        <span style={{ color: header, fontWeight: 600, fontSize: 13 }}>openPIP</span>
        {['Home', 'Search', 'Downloads', 'About'].map((l) => (
          <span key={l} style={{ color: header, opacity: 0.72, fontSize: 12 }}>{l}</span>
        ))}
        <span style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.35)', color: header, fontSize: 11, fontWeight: 600 }}>
          Register
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Mini network preview
// ─────────────────────────────────────────────────────────
function NetworkPreview({
  queryColor,
  interactorColor,
  edgeColors,
}: {
  queryColor: string
  interactorColor: string
  edgeColors: { published: string; validated: string; verified: string; literature: string }
}) {
  const nodes = [
    { id: 'BAD',    x: 120, y: 100, query: true },
    { id: 'BCL2',   x: 230, y: 50,  query: false },
    { id: 'AKT1',   x: 240, y: 155, query: false },
    { id: 'YWHAZ',  x: 50,  y: 60,  query: false },
    { id: 'RAF1',   x: 55,  y: 150, query: false },
  ]
  const edges: [string, string, string][] = [
    ['BAD', 'BCL2',  edgeColors.literature],
    ['BAD', 'AKT1',  edgeColors.published],
    ['BAD', 'YWHAZ', edgeColors.validated],
    ['BAD', 'RAF1',  edgeColors.verified],
  ]

  return (
    <div
      style={{
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        marginTop: 20,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--text-muted)',
          padding: '6px 10px',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        Network preview
      </div>
      <svg
        width="100%"
        height="200"
        viewBox="0 0 290 200"
        style={{ display: 'block', background: 'var(--bg)' }}
        aria-hidden="true"
      >
        {edges.map(([a, b, color], i) => {
          const na = nodes.find((n) => n.id === a)!
          const nb = nodes.find((n) => n.id === b)!
          return (
            <line
              key={i}
              x1={na.x} y1={na.y}
              x2={nb.x} y2={nb.y}
              stroke={color}
              strokeWidth="2"
              opacity="0.7"
            />
          )
        })}
        {nodes.map((n) => (
          <g key={n.id} transform={`translate(${n.x},${n.y})`}>
            <circle r={n.query ? 20 : 16} fill={n.query ? queryColor : interactorColor} />
            <text
              textAnchor="middle"
              dy=".35em"
              fontSize="9"
              fontFamily="var(--mono)"
              fontWeight="500"
              fill="#fff"
            >
              {n.id}
            </text>
          </g>
        ))}
      </svg>
      <div
        style={{
          padding: '8px 12px',
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        {[
          { label: 'Query', color: queryColor },
          { label: 'Interactor', color: interactorColor },
        ].map(({ label, color }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {label}
          </span>
        ))}
        {[
          { label: 'Published', color: edgeColors.published },
          { label: 'Validated', color: edgeColors.validated },
          { label: 'Verified', color: edgeColors.verified },
          { label: 'Literature', color: edgeColors.literature },
        ].map(({ label, color }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ width: 14, height: 2, background: color, display: 'inline-block', borderRadius: 1 }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Logo upload
// ─────────────────────────────────────────────────────────
function LogoUploadSection({ currentLogoUrl }: { currentLogoUrl?: string | null }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const { mutate: upload, isPending: uploading } = useUploadLogo()
  const { mutate: removeLogo, isPending: removing } = useDeleteLogo()

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) upload(file)
    e.target.value = ''
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
        {/* Preview */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {currentLogoUrl ? (
            <img
              src={mediaUrl(currentLogoUrl)}
              alt="Site logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }}
            />
          ) : (
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden>
              <circle cx="16" cy="16" r="4" fill="#e11d48" opacity=".5" />
              <circle cx="5" cy="8" r="2.2" fill="#2563eb" opacity=".5" />
              <circle cx="27" cy="9" r="2.2" fill="#2563eb" opacity=".5" />
              <circle cx="6" cy="25" r="2.2" fill="#2563eb" opacity=".5" />
              <circle cx="26" cy="25" r="2.2" fill="#2563eb" opacity=".5" />
            </svg>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <button
              type="button"
              className="op-btn"
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading…' : currentLogoUrl ? 'Replace logo' : 'Upload logo'}
            </button>
            {currentLogoUrl && (
              <button
                type="button"
                className="op-btn"
                style={{ padding: '6px 12px', fontSize: 12, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={() => removeLogo()}
                disabled={removing}
              >
                {removing ? 'Removing…' : 'Remove'}
              </button>
            )}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-soft)', margin: 0 }}>
            PNG, JPG, SVG, WebP · Displayed at 28px height in the nav. Use a square or wide format.
          </p>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Admin access
// ─────────────────────────────────────────────────────────

/** Pulls a readable message out of a DRF error body ({detail} or per-field). */
function serverErrorMessage(error: unknown): string {
  const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data
  if (data) {
    if (typeof data.detail === 'string') return data.detail
    const first = Object.values(data)[0]
    if (typeof first === 'string') return first
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0]
  }
  return 'Could not change admin access.'
}

/**
 * Why a revoke may be unavailable, or null when it is allowed. Mirrors the
 * guards in AdminUserDetailView so the button explains itself rather than
 * waiting for a 400.
 */
function revokeBlockedReason(user: AdminUser, currentUsername?: string): string | null {
  if (user.username === currentUsername) return 'You cannot revoke your own admin access'
  if (user.isSuperuser) return 'Superusers keep admin access'
  return null
}

function UserRow({
  user,
  currentUsername,
  busy,
  onSetAdmin,
}: {
  user: AdminUser
  currentUsername?: string
  busy: boolean
  onSetAdmin: (isAdmin: boolean) => void
}) {
  const blocked = user.isAdmin ? revokeBlockedReason(user, currentUsername) : null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{user.username}</span>
        {user.isAdmin && (
          <span
            style={{
              marginLeft: 8,
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 999,
              color: 'var(--success)',
              border: '1px solid var(--success)',
            }}
          >
            admin
          </span>
        )}
        <span
          style={{
            display: 'block',
            fontSize: 11,
            color: 'var(--text-soft)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {user.email}
        </span>
      </span>

      <button
        type="button"
        className="op-btn"
        style={{
          padding: '4px 10px',
          fontSize: 11,
          ...(user.isAdmin && !blocked
            ? { color: 'var(--danger)', borderColor: 'var(--danger)' }
            : {}),
        }}
        disabled={busy || Boolean(blocked)}
        title={blocked ?? undefined}
        onClick={() => onSetAdmin(!user.isAdmin)}
      >
        {user.isAdmin ? 'Revoke admin' : 'Grant admin'}
      </button>
    </div>
  )
}

function AdminAccessSection() {
  const [search, setSearch] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const { data: users = [], isLoading } = useAdminUsers(search)
  const { data: profile } = useProfile()
  const { mutate: setAdminAccess, error, reset } = useSetAdminAccess()

  const clearFeedback = () => {
    setDone(null)
    reset()
  }

  const handleSetAdmin = (user: AdminUser, isAdmin: boolean) => {
    clearFeedback()
    setPendingId(user.id)
    setAdminAccess(
      { userId: user.id, isAdmin },
      {
        onSuccess: (updated) => {
          setDone(
            updated.isAdmin
              ? `“${updated.username}” now has admin access.`
              : `Admin access removed from “${updated.username}”.`
          )
        },
        onSettled: () => setPendingId(null),
      }
    )
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <p style={{ fontSize: 12, color: 'var(--text-soft)', margin: '0 0 14px' }}>
        Grant or revoke admin access on an existing account. Registering never
        confers it, so this is the only way in. You cannot revoke your own
        access, and superusers always keep theirs.
      </p>

      <label style={{ display: 'block', marginBottom: 10 }}>
        <FieldLabel>Find a user</FieldLabel>
        <TextInput
          value={search}
          onChange={(v) => {
            setSearch(v)
            clearFeedback()
          }}
          placeholder="Search by username or email…"
        />
      </label>

      <div
        role="group"
        aria-label="Accounts"
        style={{
          border: '1px solid var(--border)',
          borderRadius: 8,
          maxHeight: 260,
          overflowY: 'auto',
          marginBottom: 12,
        }}
      >
        {isLoading ? (
          <p style={{ fontSize: 12, color: 'var(--text-soft)', padding: '10px' }}>
            Loading accounts…
          </p>
        ) : users.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-soft)', padding: '10px' }}>
            No accounts match “{search}”.
          </p>
        ) : (
          users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              currentUsername={profile?.username}
              busy={pendingId === user.id}
              onSetAdmin={(isAdmin) => handleSetAdmin(user, isAdmin)}
            />
          ))
        )}
      </div>

      {error && (
        <p role="alert" style={{ fontSize: 12, color: 'var(--danger)', margin: 0 }}>
          {serverErrorMessage(error)}
        </p>
      )}

      {done && (
        <p role="status" style={{ fontSize: 12, color: 'var(--success)', margin: 0 }}>
          {done}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Interaction category table
// ─────────────────────────────────────────────────────────
function CategoryTable() {
  const { data: categories = [], isLoading } = useInteractionCategories()
  const { mutate: createCat, isPending: creating } = useCreateCategory()
  const { mutate: updateCat } = useUpdateCategory()
  const { mutate: deleteCat } = useDeleteCategory()

  const [drafts, setDrafts] = useState<Record<number, Partial<InteractionCategory>>>({})
  const [newRow, setNewRow] = useState<Omit<InteractionCategory, 'id'>>({
    categoryName: '',
    order: '',
    colorScheme: '#2563eb',
    description: '',
  })

  const setDraft = (id: number, field: keyof InteractionCategory, value: string) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [field]: value } }))

  const getDraft = (
    cat: InteractionCategory,
    field: Exclude<keyof InteractionCategory, 'id'>
  ): string =>
    (drafts[cat.id]?.[field] as string | undefined) ?? cat[field]

  if (isLoading) return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Name', 'Order', 'Color', 'Description', ''].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '6px 8px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontSize: 10,
                  letterSpacing: '.06em',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <tr key={cat.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '6px 8px' }}>
                <input
                  className="op-input"
                  style={{ fontSize: 12, padding: '4px 8px' }}
                  value={getDraft(cat, 'categoryName')}
                  onChange={(e) => setDraft(cat.id, 'categoryName', e.target.value)}
                />
              </td>
              <td style={{ padding: '6px 8px', width: 60 }}>
                <input
                  className="op-input"
                  style={{ fontSize: 12, padding: '4px 8px' }}
                  value={getDraft(cat, 'order')}
                  onChange={(e) => setDraft(cat.id, 'order', e.target.value)}
                />
              </td>
              <td style={{ padding: '6px 8px', width: 60 }}>
                <input
                  type="color"
                  value={getDraft(cat, 'colorScheme')}
                  onChange={(e) => setDraft(cat.id, 'colorScheme', e.target.value)}
                  style={{ width: 36, height: 28, cursor: 'pointer', border: 'none', padding: 0, background: 'transparent' }}
                />
              </td>
              <td style={{ padding: '6px 8px' }}>
                <input
                  className="op-input"
                  style={{ fontSize: 12, padding: '4px 8px' }}
                  value={getDraft(cat, 'description')}
                  onChange={(e) => setDraft(cat.id, 'description', e.target.value)}
                />
              </td>
              <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                <button
                  type="button"
                  className="op-btn"
                  style={{ fontSize: 11, padding: '3px 10px', marginRight: 6 }}
                  disabled={!drafts[cat.id] || Object.keys(drafts[cat.id]).length === 0}
                  onClick={() =>
                    updateCat(
                      { id: cat.id, ...drafts[cat.id] },
                      {
                        onSuccess: () =>
                          setDrafts((d) => {
                            const next = { ...d }
                            delete next[cat.id]
                            return next
                          }),
                      }
                    )
                  }
                >
                  Save
                </button>
                <button
                  type="button"
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    background: 'transparent',
                    border: '1px solid var(--danger)',
                    borderRadius: 6,
                    color: 'var(--danger)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                  }}
                  onClick={() => {
                    if (window.confirm(`Delete "${cat.categoryName}"?`)) deleteCat(cat.id)
                  }}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
          {/* New row */}
          <tr>
            <td style={{ padding: '6px 8px' }}>
              <input
                className="op-input"
                style={{ fontSize: 12, padding: '4px 8px' }}
                placeholder="Name"
                value={newRow.categoryName}
                onChange={(e) => setNewRow((r) => ({ ...r, categoryName: e.target.value }))}
              />
            </td>
            <td style={{ padding: '6px 8px' }}>
              <input
                className="op-input"
                style={{ fontSize: 12, padding: '4px 8px' }}
                placeholder="Order"
                value={newRow.order}
                onChange={(e) => setNewRow((r) => ({ ...r, order: e.target.value }))}
              />
            </td>
            <td style={{ padding: '6px 8px' }}>
              <input
                type="color"
                value={newRow.colorScheme}
                onChange={(e) => setNewRow((r) => ({ ...r, colorScheme: e.target.value }))}
                style={{ width: 36, height: 28, cursor: 'pointer', border: 'none', padding: 0, background: 'transparent' }}
              />
            </td>
            <td style={{ padding: '6px 8px' }}>
              <input
                className="op-input"
                style={{ fontSize: 12, padding: '4px 8px' }}
                placeholder="Description"
                value={newRow.description}
                onChange={(e) => setNewRow((r) => ({ ...r, description: e.target.value }))}
              />
            </td>
            <td style={{ padding: '6px 8px' }}>
              <button
                type="button"
                className="op-btn primary"
                style={{ fontSize: 11, padding: '3px 10px' }}
                disabled={creating || !newRow.categoryName}
                onClick={() => {
                  createCat(newRow)
                  setNewRow({ categoryName: '', order: '', colorScheme: '#2563eb', description: '' })
                }}
              >
                + Add
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Main form
// ─────────────────────────────────────────────────────────
function seedDefaults(s: AdminSettings): AdminSettings {
  // Null color fields mean "never saved" - seed with display defaults so
  // the first Save writes real values instead of null back to the DB.
  return {
    ...s,
    queryNodeColor:      s.queryNodeColor      ?? DEFAULT_COLORS.queryNodeColor!,
    interactorNodeColor: s.interactorNodeColor ?? DEFAULT_COLORS.interactorNodeColor!,
    publishedEdgeColor:  s.publishedEdgeColor  ?? DEFAULT_COLORS.publishedEdgeColor!,
    validatedEdgeColor:  s.validatedEdgeColor  ?? DEFAULT_COLORS.validatedEdgeColor!,
    verifiedEdgeColor:   s.verifiedEdgeColor   ?? DEFAULT_COLORS.verifiedEdgeColor!,
    literatureEdgeColor: s.literatureEdgeColor ?? DEFAULT_COLORS.literatureEdgeColor!,
    mainColorScheme:     s.mainColorScheme     ?? DEFAULT_COLORS.mainColorScheme!,
    headerColorScheme:   s.headerColorScheme   ?? DEFAULT_COLORS.headerColorScheme!,
  }
}

function SettingsForm({ initialSettings }: { initialSettings: AdminSettings }) {
  const {
    mutate: update,
    isPending: savingSettings,
    isSuccess: settingsSaved,
    isError: settingsFailed,
    reset: resetMutation,
  } = useUpdateSettings()
  const text = useSiteTextDrafts()
  const [saved, setSaved] = useState<AdminSettings>(() => seedDefaults(initialSettings))
  const [form, setForm] = useState<AdminSettings>(() => seedDefaults(initialSettings))
  const [searchParams] = useSearchParams()
  const activeTab: TabId = settingsTabFromSearch(searchParams.toString())

  const set = useCallback(<K extends keyof AdminSettings>(field: K, value: AdminSettings[K]) => {
    setForm((f) => ({ ...f, [field]: value }))
  }, [])

  // Per-page navbar style. Stored as one string so it rides along with the
  // rest of the settings form; a page with no entry follows navStyle.
  const navOverrides = parseNavOverrides(form.navStyleOverrides)
  function setNavOverride(pageId: string, style: string) {
    const next = { ...navOverrides }
    if (style) next[pageId] = style
    else delete next[pageId]
    set('navStyleOverrides', formatNavOverrides(next))
  }

  const changedFields = useMemo(
    () =>
      (Object.keys(form) as (keyof AdminSettings)[]).filter(
        (key) => (form[key] ?? '') !== (saved[key] ?? '')
      ),
    [form, saved]
  )
  const settingsDirty = changedFields.length > 0
  // The two halves of the form save through different endpoints, but the admin
  // sees one Save button, so dirtiness is counted across both.
  const dirtyCount = changedFields.length + text.pending.length
  const isDirty = dirtyCount > 0
  const isPending = savingSettings || text.isPending
  const isSuccess = (settingsSaved || text.isSuccess) && !isDirty
  const isError = settingsFailed || text.isError

  const { pendingKeys } = text
  const dirtyTabs = useMemo(() => {
    const marked = new Set<TabId>()
    for (const tab of TABS) {
      const hasFieldEdit = (tab.fields ?? []).some((field) => changedFields.includes(field))
      const hasTextEdit = TAB_TEXT_KEYS[tab.id].some((key) => pendingKeys.has(key))
      if (hasFieldEdit || hasTextEdit) marked.add(tab.id)
    }
    return marked
  }, [changedFields, pendingKeys])

  // Publish the markers to the sidebar, which lists the panels and so is the
  // only place an edit left on another panel can be seen from here.
  const setDirtyTabs = useAdminDirty((s) => s.setDirtyTabs)
  useEffect(() => {
    setDirtyTabs(TABS.filter((t) => dirtyTabs.has(t.id)).map((t) => t.id))
  }, [dirtyTabs, setDirtyTabs])
  // Leaving the form drops its edits; the markers must not outlive them.
  useEffect(() => () => setDirtyTabs([]), [setDirtyTabs])

  // Live preview: apply CSS vars immediately as the admin adjusts any visual
  // setting, then put the *saved* theme back when this form unmounts. Without
  // the cleanup, abandoning the page left an unsaved theme applied site-wide.
  useEffect(() => {
    injectCSSVars(form)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.navStyle, form.mainColorScheme, form.mainColorScheme2, form.gradientAngle,
    form.headerColorScheme, form.logoColorScheme, form.buttonColorScheme,
    form.queryNodeColor, form.interactorNodeColor,
    form.publishedEdgeColor, form.validatedEdgeColor, form.verifiedEdgeColor, form.literatureEdgeColor,
  ])

  const savedRef = useRef(saved)
  useEffect(() => {
    savedRef.current = saved
  }, [saved])
  useEffect(() => () => injectCSSVars(savedRef.current), [])

  // Warn before a browser navigation would drop unsaved edits.
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // Let the success banner fade instead of sitting there indefinitely.
  const resetTextMutation = text.resetMutation
  useEffect(() => {
    if (!isSuccess) return
    const timer = setTimeout(() => {
      resetMutation()
      resetTextMutation()
    }, 4000)
    return () => clearTimeout(timer)
  }, [isSuccess, resetMutation, resetTextMutation])

  const urlError =
    form.url && !/^https?:\/\/\S+$/i.test(form.url.trim())
      ? 'Enter a full URL starting with http:// or https://'
      : ''

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (urlError) return
    // Two independent writes: skip the settings PUT when only copy changed, so
    // editing one label doesn't rewrite every settings column.
    if (settingsDirty) {
      update(form, { onSuccess: (updated) => setSaved(seedDefaults(updated)) })
    }
    text.save()
  }

  const handleDiscard = () => {
    if (!window.confirm('Discard all unsaved changes?')) return
    setForm(saved)
    text.discard()
    resetMutation()
    text.resetMutation()
  }

  const handleResetColors = () => {
    if (!window.confirm('Reset all colors to defaults? Content (titles, footer, etc.) will not be changed.')) return
    setForm((f) => ({ ...f, ...DEFAULT_COLORS }))
  }

  const revertField = useCallback(
    (field: keyof AdminSettings) => setForm((f) => ({ ...f, [field]: saved[field] })),
    [saved]
  )

  const colorsDirty = changedFields.some((f) => COLOR_FIELDS.includes(f))

  /** The editable copy belonging to a tab, rendered under its settings. */
  const pageText = (tabId: TabId) => {
    const groupIds = TABS.find((t) => t.id === tabId)?.textGroups ?? []
    if (groupIds.length === 0) return null
    // Rendering before the overrides land would briefly show customized copy as
    // empty, which reads as "nothing is set here".
    if (text.isLoading) {
      return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading page text…</p>
    }
    return groupIds.map((groupId) => (
      <SiteTextFields
        key={groupId}
        group={TEXT_GROUP_BY_ID[groupId]}
        drafts={text.drafts}
        overrides={text.overrides}
        onChange={text.setDraft}
        onRevert={text.revertDraft}
      />
    ))
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* ── GLOBAL SETTINGS ── */}
      <TabPanel id="global" active={activeTab === 'global'}>
        <Section title="Site identity">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <FieldLabel changed={changedFields.includes('title')} onRevert={() => revertField('title')}>Site Title</FieldLabel>
              <TextInput value={form.title ?? ''} onChange={(v) => set('title', v)} />
            </div>
            <div>
              <FieldLabel changed={changedFields.includes('shortTitle')} onRevert={() => revertField('shortTitle')}>Short Title</FieldLabel>
              <TextInput value={form.shortTitle ?? ''} onChange={(v) => set('shortTitle', v)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <FieldLabel changed={changedFields.includes('url')} onRevert={() => revertField('url')}>Site URL</FieldLabel>
              <TextInput value={form.url ?? ''} onChange={(v) => set('url', v)} placeholder="https://…" />
              {urlError && (
                <p style={{ fontSize: 11, color: 'var(--danger)', margin: '5px 0 0' }}>{urlError}</p>
              )}
            </div>
            <div>
              <FieldLabel changed={changedFields.includes('version')} onRevert={() => revertField('version')}>Version</FieldLabel>
              <TextInput value={form.version ?? ''} onChange={(v) => set('version', v)} placeholder="2.0" />
            </div>
          </div>
        </Section>

        <Section title="Logo">
          <LogoUploadSection currentLogoUrl={form.logoUrl} />
        </Section>

        <Section title="Footer">
          <FieldLabel changed={changedFields.includes('footer')} onRevert={() => revertField('footer')}>Footer HTML</FieldLabel>
          <RichTextEditor value={form.footer ?? ''} onChange={(v) => set('footer', v)} rows={3} />
        </Section>

        {pageText('global')}
      </TabPanel>

      {/* ── APPEARANCE ── */}
      <TabPanel id="appearance" active={activeTab === 'appearance'}>
        {/* Preset themes */}
        <Section title="Themes">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => setForm((f) => ({ ...f, ...preset.colors }))}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  background: 'var(--surface)',
                  padding: 0,
                  textAlign: 'left',
                  transition: 'box-shadow .15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '' }}
              >
                <div style={{ height: 36, background: preset.preview }} />
                <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
                  {preset.name}
                </div>
              </button>
            ))}
          </div>
        </Section>

        {/* Nav style */}
        <Section title="Navbar style">
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {(['solid', 'gradient', 'light'] as const).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => set('navStyle', style)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 8,
                  border: `2px solid ${(form.navStyle ?? 'solid') === style ? 'var(--primary)' : 'var(--border)'}`,
                  background: (form.navStyle ?? 'solid') === style ? 'var(--primary-soft)' : 'var(--surface)',
                  color: (form.navStyle ?? 'solid') === style ? 'var(--primary-deep)' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                  textTransform: 'capitalize',
                  transition: 'all .15s',
                }}
              >
                {style === 'solid'    && '◼ Solid'}
                {style === 'gradient' && '◐ Gradient'}
                {style === 'light'    && '◻ Light'}
              </button>
            ))}
          </div>

          {/* Colors - shown contextually */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ColorInput
              label={(form.navStyle ?? 'solid') === 'gradient' ? 'Gradient start' : 'Primary color'}
              value={form.mainColorScheme ?? '#2563eb'}
              onChange={(v) => set('mainColorScheme', v)}
            />
            {(form.navStyle ?? 'solid') === 'gradient' && (
              <ColorInput
                label="Gradient end"
                value={form.mainColorScheme2 ?? '#0ea5e9'}
                onChange={(v) => set('mainColorScheme2', v)}
              />
            )}
            {(form.navStyle ?? 'solid') !== 'light' && (
              <ColorInput
                label="Header text color"
                value={form.headerColorScheme ?? '#ffffff'}
                onChange={(v) => set('headerColorScheme', v)}
              />
            )}
            <ColorInput
              label="Logo color"
              value={form.logoColorScheme ?? '#ffffff'}
              onChange={(v) => set('logoColorScheme', v)}
            />
          </div>

          {/* Gradient angle slider */}
          {(form.navStyle ?? 'solid') === 'gradient' && (
            <div style={{ marginTop: 16 }}>
              <FieldLabel>Gradient angle</FieldLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={5}
                  value={form.gradientAngle ?? 135}
                  onChange={(e) => set('gradientAngle', parseInt(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--primary)' }}
                />
                <span className="op-num" style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 36 }}>
                  {form.gradientAngle ?? 135}°
                </span>
              </div>
            </div>
          )}
        </Section>

        {/* Per-page overrides. The style above is the site's default; a page
            listed here departs from it. */}
        <Section title="Per-page navbar">
          <p style={{ fontSize: 12, color: 'var(--text-soft)', margin: '0 0 12px' }}>
            Every page uses the style above unless you choose another for it here.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px' }}>
            {NAV_PAGES.map((page) => (
              <label
                key={page.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  fontSize: 13,
                  color: 'var(--text)',
                }}
              >
                {page.label}
                <select
                  value={navOverrides[page.id] ?? ''}
                  onChange={(e) => setNavOverride(page.id, e.target.value)}
                  style={SELECT_STYLE}
                >
                  <option value="">Site default</option>
                  <option value="solid">Solid</option>
                  <option value="gradient">Gradient</option>
                  <option value="light">Light</option>
                </select>
              </label>
            ))}
          </div>
        </Section>

        {/* Buttons */}
        <Section title="Buttons &amp; accents">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ColorInput
              label="Button color"
              value={form.buttonColorScheme ?? '#2563eb'}
              onChange={(v) => set('buttonColorScheme', v)}
            />
          </div>
        </Section>

        {/* Live nav preview */}
        <NavPreview
          style={form.navStyle ?? 'solid'}
          main={form.mainColorScheme ?? '#2563eb'}
          main2={form.mainColorScheme2 ?? '#0ea5e9'}
          angle={form.gradientAngle ?? 135}
          header={form.navStyle === 'light' ? 'var(--text)' : (form.headerColorScheme ?? '#ffffff')}
        />

        <Section title="Node colors">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ColorInput label="Query Node Color"      value={form.queryNodeColor ?? '#e11d48'}      onChange={(v) => set('queryNodeColor', v)} />
            <ColorInput label="Interactor Node Color" value={form.interactorNodeColor ?? '#2563eb'} onChange={(v) => set('interactorNodeColor', v)} />
          </div>
        </Section>

        <Section title="Edge colors">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ColorInput label="Published Edge"  value={form.publishedEdgeColor ?? '#38761d'}  onChange={(v) => set('publishedEdgeColor', v)} />
            <ColorInput label="Validated Edge"  value={form.validatedEdgeColor ?? '#1155cc'}  onChange={(v) => set('validatedEdgeColor', v)} />
            <ColorInput label="Verified Edge"   value={form.verifiedEdgeColor ?? '#cc0000'}   onChange={(v) => set('verifiedEdgeColor', v)} />
            <ColorInput label="Literature Edge" value={form.literatureEdgeColor ?? '#ff9900'} onChange={(v) => set('literatureEdgeColor', v)} />
          </div>
        </Section>

        <Section title="Network preview">
          <NetworkPreview
            queryColor={form.queryNodeColor ?? '#e11d48'}
            interactorColor={form.interactorNodeColor ?? '#2563eb'}
            edgeColors={{
              published: form.publishedEdgeColor ?? '#38761d',
              validated: form.validatedEdgeColor ?? '#1155cc',
              verified: form.verifiedEdgeColor ?? '#cc0000',
              literature: form.literatureEdgeColor ?? '#ff9900',
            }}
          />
        </Section>
      </TabPanel>

      {/* ── HOME PAGE ── */}
      <TabPanel id="home" active={activeTab === 'home'}>
        {/* The mission and methods blocks used to be settings columns edited
            here. They are site-text keys now, so they arrive with the rest of
            the page's copy below rather than in a separate pair of forms. */}
        {pageText('home')}
      </TabPanel>

      {/* ── SEARCH ── */}
      <TabPanel id="search" active={activeTab === 'search'}>
        <Section title="Search examples">
          {([1, 2, 3] as const).map((n) => {
            const proteinsKey = `example${n}` as 'example1' | 'example2' | 'example3'
            const typeKey = `example${n}Type` as 'example1Type' | 'example2Type' | 'example3Type'
            return (
              <div key={n} style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <FieldLabel>Example {n}</FieldLabel>
                  <select
                    value={normalizeExampleType(form[typeKey])}
                    onChange={(e) => set(typeKey, e.target.value)}
                    style={SELECT_STYLE}
                  >
                    {EXAMPLE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {exampleTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </div>
                <TextareaInput
                  value={form[proteinsKey] ?? ''}
                  onChange={(v) => set(proteinsKey, v)}
                  rows={5}
                  mono
                />
                <p style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 4 }}>
                  One protein symbol per line.
                </p>
              </div>
            )
          })}
        </Section>

        <Section title="Interaction categories">
          <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 12 }}>
            Each row controls how an interaction source is displayed in search results.
          </p>
          <CategoryTable />
        </Section>

        <Section title="Annotation tabs">
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px', maxWidth: '62ch' }}>
            Tissue expression and subcellular location only mean something for a
            multicellular organism. Turn off whichever this deployment's data
            cannot support and the tab disappears from search results, along
            with the tissue filter and the phrase search's tissue suggestions.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(
              [
                { key: 'showTissueExpression', label: 'Show Tissue Expression tab' },
                { key: 'showSubcellularLocation', label: 'Show Subcellular Location tab' },
              ] as { key: 'showTissueExpression' | 'showSubcellularLocation'; label: string }[]
            ).map(({ key, label }) => (
              <label
                key={key}
                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}
              >
                <input
                  type="checkbox"
                  checked={form[key] ?? true}
                  onChange={(e) => set(key, e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <span style={{ color: 'var(--text)' }}>{label}</span>
              </label>
            ))}
          </div>
        </Section>

        <Section title="Filter layout">
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px', maxWidth: '62ch' }}>
            Search filters and tools normally sit in a sidebar down the left of
            the results page. Turn this on and they move into a ribbon under the
            navbar instead, each one opening its panel when pressed — more room
            for the network, fewer controls in view at once.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={form.horizontalFilterBar ?? false}
              onChange={(e) => set('horizontalFilterBar', e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
            <span style={{ color: 'var(--text)' }}>Show filters as a ribbon under the navbar</span>
          </label>
        </Section>

        <Section title="Network canvas">
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px', maxWidth: '62ch' }}>
            The default background behind the interaction network, also used
            for PNG and JPG exports. Unset, it follows the light or dark theme.
            Visitors can pick their own from the canvas's Layout menu.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 420 }}>
            <div style={{ flex: 1 }}>
              <ColorInput
                label="Canvas Background"
                value={form.canvasBackgroundColor || '#fafafa'}
                onChange={(v) => set('canvasBackgroundColor', v)}
              />
            </div>
            <button
              type="button"
              className="op-btn"
              disabled={!form.canvasBackgroundColor}
              onClick={() => set('canvasBackgroundColor', null)}
              style={{ fontSize: 13 }}
            >
              Follow theme
            </button>
          </div>
        </Section>

        <PhraseHelp />
        {pageText('search')}
      </TabPanel>

      {/* ── ABOUT ── */}
      <TabPanel id="about" active={activeTab === 'about'}>
        <Section title="About page content">
          <RichTextEditor
            value={form.about ?? ''}
            onChange={(v) => set('about', v)}
            placeholder="Enter the About page body…"
            rows={16}
          />
        </Section>

      </TabPanel>

      {/* ── DOCUMENTATION ── */}
      <TabPanel id="documentation" active={activeTab === 'documentation'}>
        {pageText('documentation')}
      </TabPanel>

      {/* ── FAQS ── */}
      <TabPanel id="faqs" active={activeTab === 'faqs'}>
        <Section title="FAQ page content">
          <RichTextEditor
            value={form.faq ?? ''}
            onChange={(v) => set('faq', v)}
            placeholder="Enter FAQ content…"
            rows={16}
          />
        </Section>

      </TabPanel>

      {/* ── CONTACT ── */}
      <TabPanel id="contact" active={activeTab === 'contact'}>
        <Section title="Contact page intro text">
          <RichTextEditor
            value={form.contact ?? ''}
            onChange={(v) => set('contact', v)}
            placeholder="Introductory text shown above the contact form…"
            rows={10}
          />
        </Section>

      </TabPanel>

      {/* ── ACCOUNTS ── */}
      <TabPanel id="accounts" active={activeTab === 'accounts'}>
        <Section title="Admin access">
          <AdminAccessSection />
        </Section>

        {pageText('accounts')}
      </TabPanel>

      {/* ── DOWNLOADS ── */}
      <TabPanel id="downloads" active={activeTab === 'downloads'}>
        <Section title="Visibility">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(
              [
                { key: 'showDownloads',   label: 'Show Dataset Downloads' },
                { key: 'showDownloadAll', label: 'Show Download All Datasets' },
              ] as { key: 'showDownloads' | 'showDownloadAll'; label: string }[]
            ).map(({ key, label }) => (
              <label
                key={key}
                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}
              >
                <input
                  type="checkbox"
                  checked={form[key] ?? false}
                  onChange={(e) => set(key, e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <span style={{ color: 'var(--text)' }}>{label}</span>
              </label>
            ))}
          </div>
        </Section>

        <Section title="Downloads page content">
          <RichTextEditor
            value={form.download ?? ''}
            onChange={(v) => set('download', v)}
            placeholder="Introductory text shown at the top of the Downloads page…"
            rows={12}
          />
        </Section>

        {pageText('downloads')}
      </TabPanel>

      {/* Save bar. Sticks to the bottom of the card: with the panels reachable
          from the sidebar rather than a strip above the form, some of them are
          long enough that Save would otherwise scroll out of reach. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 32px',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface-2)',
          flexWrap: 'wrap',
          position: 'sticky',
          bottom: 0,
          zIndex: 5,
        }}
      >
        <button
          type="submit"
          disabled={isPending || !isDirty || Boolean(urlError)}
          className="op-btn primary"
          style={{ padding: '9px 20px' }}
        >
          {isPending
            ? 'Saving…'
            : isDirty
              ? `Save ${dirtyCount} change${dirtyCount === 1 ? '' : 's'}`
              : 'Save Settings'}
        </button>
        {isDirty && (
          <button type="button" className="op-btn" onClick={handleDiscard} disabled={isPending}>
            Discard changes
          </button>
        )}
        <button
          type="button"
          className="op-btn"
          onClick={handleResetColors}
          title="Reset all colors to their defaults"
        >
          Reset colors
        </button>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {isDirty
            ? `${dirtyCount} unsaved change${dirtyCount === 1 ? '' : 's'}${colorsDirty ? ' (theme previewed live)' : ''}`
            : 'No unsaved changes'}
        </span>
        {isSuccess && (
          <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>
            ✓ Settings saved
          </span>
        )}
        {isError && (
          <span style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 500 }}>
            ✗ Save failed - check that you are logged in as an admin
          </span>
        )}
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────────────────
// Page shell
// ─────────────────────────────────────────────────────────
export function AdminSettingsPage() {
  const { data: settings, isLoading } = useSettings()
  const [searchParams] = useSearchParams()
  const activeTab = settingsTabFromSearch(searchParams.toString())

  if (isLoading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading settings...
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%', padding: '40px 48px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* The sidebar says which panel is open; the heading says it again in
            the content column, where the eye lands after clicking. */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '.08em',
            color: 'var(--text-soft)',
            marginBottom: 6,
          }}
        >
          Site Settings
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-.02em',
            margin: '0 0 6px',
            color: 'var(--text)',
          }}
        >
          {settingsTabLabel(activeTab)}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 24px', maxWidth: 640 }}>
          {settingsTabHint(activeTab)}.
          {/* Only panels that edit copy have empty-means-default fields. */}
          {(TAB_CONFIG[activeTab].textGroups ?? []).length > 0 &&
            ' Leave a text field empty to use the wording openPIP ships with, shown as grey placeholder text.'}
        </p>
        {settings && (
          <div className="op-card" style={{ overflow: 'hidden' }}>
            <SettingsForm initialSettings={settings} />
          </div>
        )}
      </div>
    </div>
  )
}
