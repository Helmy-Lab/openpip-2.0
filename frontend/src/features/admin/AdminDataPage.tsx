import { useState, useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCounts } from '../../api/counts'
import { useDatasets } from '../../api/downloads'
import {
  useInteractionCategories,
  useDatasetDelete,
  useCitationLookup,
} from '../../api/datasets'
import type { DatasetPreviewResult } from '../../api/datasets'
import type { PublicationStatus } from '../../types/api'
import { apiClient } from '../../api/client'
import { startAsyncImport, pollImportStatus } from '../../api/asyncImport'
import type { AsyncImportStatus } from '../../api/asyncImport'

// ─────────────────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────────────────

function StatCard({ value, label, icon }: { value: string | number; label: string; icon: React.ReactNode }) {
  return (
    <div
      className="op-card"
      style={{
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: 'var(--primary-soft)',
          color: 'var(--primary)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          className="op-num"
          style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--text)' }}
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{label}</div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────────────────

const STEP_LABELS = ['Select file', 'Metadata', 'Preview', 'Result']

function StepIndicator({ current }: { current: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        marginBottom: 28,
      }}
    >
      {STEP_LABELS.map((label, i) => {
        const stepNum = i + 1
        const done = stepNum < current
        const active = stepNum === current
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_LABELS.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: done ? 'var(--success)' : active ? 'var(--primary)' : 'var(--surface-2)',
                  color: done || active ? '#fff' : 'var(--text-muted)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  border: active ? '2px solid var(--primary)' : done ? '2px solid var(--success)' : '2px solid var(--border)',
                  transition: 'background .2s, border-color .2s',
                  flexShrink: 0,
                }}
              >
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  stepNum
                )}
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--text)' : done ? 'var(--success)' : 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: done ? 'var(--success)' : 'var(--border)',
                  margin: '0 8px',
                  marginBottom: 20,
                  transition: 'background .2s',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Wizard state
// ─────────────────────────────────────────────────────────

interface WizardState {
  file: File | null
  datasetName: string
  interactionStatus: string
  categoryId: string
  // Citation — optional, and blank for the common unpublished upload. Anything
  // left blank here can still be filled in later by editing the dataset.
  pubmedId: string
  doi: string
  author: string
  year: string
  title: string
  journal: string
  publicationStatus: PublicationStatus
  aboutBody: string
}

const INITIAL_STATE: WizardState = {
  file: null,
  datasetName: '',
  interactionStatus: 'published',
  categoryId: '',
  pubmedId: '',
  doi: '',
  author: '',
  year: '',
  title: '',
  journal: '',
  publicationStatus: 'unpublished',
  aboutBody: '',
}

// ─────────────────────────────────────────────────────────
// Step 1 - file picker
// ─────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// ─── format guide ───

type ColStatus = 'required' | 'parsed' | 'ignored'

// Mirrors what datasets/upload_parser.py actually reads. If the parser learns a
// column, change it here too — an admin who is told a column is ignored will not
// bother to include it, so a stale "ignored" quietly costs real data.
const PSIMI_COLS_SPEC: { col: number; name: string; status: ColStatus; note: string }[] = [
  { col: 1,  name: 'Unique identifier - Protein A',   status: 'required', note: 'e.g. uniprotkb:P04637 or a bare gene name' },
  { col: 2,  name: 'Unique identifier - Protein B',   status: 'required', note: 'same format as column 1' },
  { col: 3,  name: 'Alternative IDs - Protein A',     status: 'ignored',  note: 'looked up from UniProt instead' },
  { col: 4,  name: 'Alternative IDs - Protein B',     status: 'ignored',  note: 'looked up from UniProt instead' },
  { col: 5,  name: 'Aliases - Protein A',             status: 'parsed',   note: 'gene names extracted, e.g. uniprotkb:TP53(gene name)' },
  { col: 6,  name: 'Aliases - Protein B',             status: 'parsed',   note: 'same format as column 5' },
  { col: 7,  name: 'Detection method',                status: 'parsed',   note: 'e.g. psi-mi:"MI:0018"(two hybrid)' },
  { col: 8,  name: 'First author',                    status: 'ignored',  note: 'use dataset metadata in the next step instead' },
  { col: 9,  name: 'Publication ID (PubMed)',         status: 'ignored',  note: 'use dataset metadata in the next step instead' },
  { col: 10, name: 'Taxon - Protein A',               status: 'parsed',   note: 'e.g. taxid:9606(human). If absent, taken from UniProt' },
  { col: 11, name: 'Taxon - Protein B',               status: 'parsed',   note: 'same format as column 10' },
  { col: 12, name: 'Interaction type',                status: 'parsed',   note: 'e.g. psi-mi:"MI:0915"(physical association). A stated type wins over any openPIP infers' },
  { col: 13, name: 'Source database',                 status: 'ignored',  note: '' },
  { col: 14, name: 'Interaction identifier',          status: 'ignored',  note: '' },
  { col: 15, name: 'Confidence score',                status: 'parsed',   note: 'e.g. 0.92 or intact-miscore:0.92' },
  { col: 16, name: 'Expansion method',                status: 'ignored',  note: '' },
  { col: 17, name: 'Biological role - Protein A',     status: 'parsed',   note: 'e.g. psi-mi:"MI:0499"(unspecified role)' },
  { col: 18, name: 'Biological role - Protein B',     status: 'parsed',   note: 'same format as column 17' },
  { col: 19, name: 'Experimental role - Protein A',   status: 'parsed',   note: 'e.g. psi-mi:"MI:0496"(bait)' },
  { col: 20, name: 'Experimental role - Protein B',   status: 'parsed',   note: 'e.g. psi-mi:"MI:0498"(prey)' },
  { col: 21, name: 'Interactor type - Protein A',     status: 'parsed',   note: 'e.g. psi-mi:"MI:0326"(protein)' },
  { col: 22, name: 'Interactor type - Protein B',     status: 'parsed',   note: 'same format as column 21' },
  { col: 23, name: 'Xref - Protein A',                status: 'ignored',  note: 'PDB and InterPro looked up from UniProt instead' },
  { col: 24, name: 'Xref - Protein B',                status: 'ignored',  note: 'looked up from UniProt instead' },
  { col: 25, name: 'Xref - Interaction',              status: 'ignored',  note: '' },
  { col: 26, name: 'Annotations - Protein A',         status: 'parsed',   note: 'key:value pairs stored as support info' },
  { col: 27, name: 'Annotations - Protein B',         status: 'parsed',   note: 'same format as column 26' },
  { col: 28, name: 'Annotations - Interaction',       status: 'parsed',   note: 'pipe-separated key:value pairs' },
  { col: 29, name: 'Host organism',                   status: 'ignored',  note: '' },
  { col: 30, name: 'Interaction parameters',          status: 'ignored',  note: '' },
  { col: 31, name: 'Creation date',                   status: 'ignored',  note: '' },
  { col: 32, name: 'Update date',                     status: 'ignored',  note: '' },
  { col: 33, name: 'Checksum - Protein A',            status: 'ignored',  note: 'computed on export as a ROGID, not read' },
  { col: 34, name: 'Checksum - Protein B',            status: 'ignored',  note: 'computed on export as a ROGID, not read' },
  { col: 35, name: 'Checksum - Interaction',          status: 'ignored',  note: 'computed on export as a RIGID, not read' },
  { col: 36, name: 'Negative',                        status: 'parsed',   note: 'true marks a reported non-interaction; anything else is positive' },
  { col: 37, name: 'Features - Protein A',            status: 'parsed',   note: 'free text, e.g. binding-associated region:1-50' },
  { col: 38, name: 'Features - Protein B',            status: 'parsed',   note: 'same format as column 37' },
  { col: 39, name: 'Stoichiometry - Protein A',       status: 'parsed',   note: 'free text' },
  { col: 40, name: 'Stoichiometry - Protein B',       status: 'parsed',   note: 'same format as column 39' },
  { col: 41, name: 'Identification method - A',       status: 'parsed',   note: 'e.g. psi-mi:"MI:0396"(predetermined participant)' },
  { col: 42, name: 'Identification method - B',       status: 'parsed',   note: 'same format as column 41' },
  { col: 43, name: 'Biological effect - Protein A',   status: 'parsed',   note: 'TAB 2.8 (CausalTAB). Kept, though openPIP generates none' },
  { col: 44, name: 'Biological effect - Protein B',   status: 'parsed',   note: 'same format as column 43' },
  { col: 45, name: 'Causal regulatory mechanism',     status: 'ignored',  note: 'TAB 2.8 (CausalTAB)' },
  { col: 46, name: 'Causal statement',                status: 'ignored',  note: 'TAB 2.8 (CausalTAB)' },
]

const STATUS_BADGE: Record<ColStatus, { label: string; color: string; bg: string }> = {
  required: { label: 'Required', color: '#fff',               bg: 'var(--primary)' },
  parsed:   { label: 'Parsed',   color: 'var(--success)',     bg: 'rgba(16,185,129,.12)' },
  ignored:  { label: 'Ignored',  color: 'var(--text-muted)',  bg: 'var(--surface-2)' },
}

const CSV_COLS_SPEC: { name: string; status: ColStatus; note: string }[] = [
  { name: 'protein_a', status: 'required', note: 'UniProtKB accession, Ensembl ID, Entrez ID, or bare gene name' },
  { name: 'protein_b', status: 'required', note: 'same format as protein_a' },
  { name: 'score',     status: 'parsed',   note: 'numeric confidence value, e.g. 0.92' },
  { name: 'pubmed',    status: 'ignored',  note: 'use dataset metadata in the next step instead' },
]

const CSV_EXAMPLE_ROWS = [
  ['P04637', 'Q9NQC3', '0.92', ''],
  ['O14757', 'P31749', '0.75', ''],
]

function FileFormatGuide() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'psimi' | 'csv'>('psimi')

  return (
    <div style={{ marginBottom: 20, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          background: 'var(--surface-2)',
          border: 'none',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
          aria-hidden
          style={{ flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>File format reference</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
          - view all columns and their status before uploading
        </span>
      </button>

      {open && (
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {(['psimi', 'csv'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: `1px solid ${tab === t ? 'var(--primary)' : 'var(--border)'}`,
                  background: tab === t ? 'var(--primary-soft)' : 'transparent',
                  color: tab === t ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {t === 'psimi' ? 'PSI-MI TAB 2.5-2.8  (.tab / .tsv / .txt)' : 'CSV  (.csv)'}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            {(Object.entries(STATUS_BADGE) as [ColStatus, typeof STATUS_BADGE[ColStatus]][]).map(([key, b]) => (
              <span
                key={key}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 4,
                  background: b.bg,
                  color: b.color,
                  border: key === 'required' ? 'none' : '1px solid var(--border)',
                  letterSpacing: '.04em',
                  textTransform: 'uppercase',
                }}
              >
                {b.label}
              </span>
            ))}
            <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>
              - "ignored" columns may be present in the file but are not stored
            </span>
          </div>

          {tab === 'psimi' ? (
            <>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>
                Tab-separated. A file may stop at any version's width - 15 columns for TAB 2.5, 36 for 2.6, 42 for
                2.7, 46 for 2.8 - and anything beyond what it carries is treated as absent. Lines starting with{' '}
                <code style={{ fontFamily: 'var(--mono)' }}>#</code> are skipped (use them for comments or a
                human-readable header), and a file with no header line is read from its first row. Columns 1 and 2 are
                the only ones required - all others may be{' '}
                <code style={{ fontFamily: 'var(--mono)' }}>-</code> (dash) if unknown.
              </p>
              <div style={{ overflowX: 'auto', borderRadius: 6, border: '1px solid var(--border)', maxHeight: 340, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', width: 44 }}>#</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Column name</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>Status</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Notes / example value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PSIMI_COLS_SPEC.map((c, i) => {
                      const badge = STATUS_BADGE[c.status]
                      return (
                        <tr
                          key={c.col}
                          style={{
                            borderBottom: i < PSIMI_COLS_SPEC.length - 1 ? '1px solid var(--border)' : undefined,
                            background: c.status === 'required' ? 'rgba(99,102,241,.04)' : undefined,
                          }}
                        >
                          <td style={{ padding: '5px 10px', fontFamily: 'var(--mono)', color: 'var(--text-muted)', fontSize: 11 }}>{c.col}</td>
                          <td style={{ padding: '5px 10px', color: 'var(--text)', fontWeight: c.status === 'required' ? 600 : 400 }}>{c.name}</td>
                          <td style={{ padding: '5px 10px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: badge.bg, color: badge.color, border: c.status === 'required' ? 'none' : '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                              {badge.label}
                            </span>
                          </td>
                          <td style={{ padding: '5px 10px', color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 10 }}>{c.note || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>
                Comma-separated with a header row. Column names are case-insensitive.{' '}
                <code style={{ fontFamily: 'var(--mono)' }}>protein_a</code> and{' '}
                <code style={{ fontFamily: 'var(--mono)' }}>protein_b</code> are the only required columns.
              </p>

              {/* Column spec */}
              <div style={{ borderRadius: 6, border: '1px solid var(--border)', marginBottom: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Column name</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>Status</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Notes / example value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CSV_COLS_SPEC.map((c, i) => {
                      const badge = STATUS_BADGE[c.status]
                      return (
                        <tr key={c.name} style={{ borderBottom: i < CSV_COLS_SPEC.length - 1 ? '1px solid var(--border)' : undefined, background: c.status === 'required' ? 'rgba(99,102,241,.04)' : undefined }}>
                          <td style={{ padding: '5px 10px', fontFamily: 'var(--mono)', color: 'var(--text)', fontWeight: c.status === 'required' ? 700 : 400 }}>{c.name}</td>
                          <td style={{ padding: '5px 10px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: badge.bg, color: badge.color, border: c.status === 'required' ? 'none' : '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                              {badge.label}
                            </span>
                          </td>
                          <td style={{ padding: '5px 10px', color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 10 }}>{c.note}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Example */}
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Example</div>
              <div style={{ overflowX: 'auto', borderRadius: 6, border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--mono)' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      {CSV_COLS_SPEC.map((c) => (
                        <th key={c.name} style={{ padding: '5px 10px', textAlign: 'left', color: 'var(--primary)', fontWeight: 700, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CSV_EXAMPLE_ROWS.map((row, ri) => (
                      <tr key={ri} style={{ borderBottom: ri < CSV_EXAMPLE_ROWS.length - 1 ? '1px solid var(--border)' : undefined }}>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{ padding: '5px 10px', color: cell ? 'var(--text)' : 'var(--text-muted)', fontStyle: cell ? 'normal' : 'italic' }}>
                            {cell || '(optional)'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── validation ───

interface ValidationResult {
  valid: boolean
  errors: string[]
  detectedFormat: 'psimi' | 'csv'
}

async function validateUploadedFile(file: File): Promise<ValidationResult> {
  const snippet = await file.slice(0, 16384).text()
  const csv = file.name.toLowerCase().endsWith('.csv')
  const lines = snippet.split('\n').filter((l) => l.trim())
  const errors: string[] = []

  if (csv) {
    if (lines.length === 0) {
      errors.push('File is empty.')
      return { valid: false, errors, detectedFormat: 'csv' }
    }
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
    if (!header.includes('protein_a')) errors.push('Missing required column: protein_a')
    if (!header.includes('protein_b')) errors.push('Missing required column: protein_b')
    const dataLines = lines.slice(1)
    if (dataLines.length === 0) errors.push('File has a header but no data rows.')
    return { valid: errors.length === 0, errors, detectedFormat: 'csv' }
  }

  const dataLines = lines.filter((l) => !l.startsWith('#'))
  if (dataLines.length === 0) {
    errors.push('File has no data rows (all lines are comments or blank).')
    return { valid: false, errors, detectedFormat: 'psimi' }
  }
  const badRows = dataLines.slice(0, 10).filter((l) => {
    const cols = l.split('\t')
    return cols.length < 2 || !cols[0]?.trim() || !cols[1]?.trim()
  })
  if (badRows.length > 0)
    errors.push('Some rows are missing Protein A or Protein B values (columns 1 and 2).')
  return { valid: errors.length === 0, errors, detectedFormat: 'psimi' }
}

interface Step1Props {
  file: File | null
  onChange: (file: File) => void
  onNext: () => void
}

function Step1({ file, onChange, onNext }: Step1Props) {
  const [dragging, setDragging] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [validating, setValidating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    (f: File) => {
      onChange(f)
      setValidation(null)
      setValidating(true)
      validateUploadedFile(f).then((result) => {
        setValidation(result)
        setValidating(false)
      })
    },
    [onChange],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const dropped = e.dataTransfer.files[0]
      if (dropped) handleFile(dropped)
    },
    [handleFile],
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = () => setDragging(false)

  const canProceed = !!file && !validating && !!validation?.valid

  return (
    <div>
      <FileFormatGuide />

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Drop zone for interaction data file"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
        style={{
          border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--border-strong)'}`,
          borderRadius: 10,
          padding: '40px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'var(--primary-soft)' : 'var(--surface-2)',
          transition: 'border-color .15s, background .15s',
          marginBottom: 14,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".tab,.tsv,.txt,.csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
        <div style={{ marginBottom: 10 }}>
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="1.5"
            aria-hidden
            style={{ display: 'inline-block' }}
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        </div>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>
          Drag & drop an interaction file
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          or{' '}
          <span style={{ color: 'var(--primary)', fontWeight: 500 }}>browse</span>
          {' '}to select - PSI-MI TAB (.tab, .tsv, .txt) or CSV (.csv)
        </div>
      </div>

      {file && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            background: 'var(--surface-2)',
            borderRadius: 8,
            border: '1px solid var(--border)',
            marginBottom: 12,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1 }}>{file.name}</span>
          <span className="op-chip" style={{ fontSize: 11 }}>{formatBytes(file.size)}</span>
        </div>
      )}

      {/* Validation banner */}
      {file && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 8,
            marginBottom: 20,
            border: `1px solid ${
              validating
                ? 'var(--border)'
                : validation?.valid
                  ? 'var(--success)'
                  : 'var(--warn)'
            }`,
            background: validating
              ? 'var(--surface-2)'
              : validation?.valid
                ? 'rgba(16,185,129,.07)'
                : 'rgba(241,87,66,.07)',
          }}
        >
          {validating ? (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Validating file format…</span>
            </>
          ) : validation?.valid ? (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>
                  File is valid - ready for next step
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Detected format: {validation.detectedFormat === 'csv' ? 'CSV' : 'PSI-MI TAB'}
                </div>
              </div>
            </>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="2.5" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warn)', marginBottom: 4 }}>
                  File format issues detected
                </div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: 'var(--warn)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {validation?.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  See the "File format reference" above for the expected column layout.
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="op-btn primary" onClick={onNext} disabled={!canProceed}>
          Next →
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Step 2 - metadata
// ─────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'published', label: 'Published' },
  { value: 'validated', label: 'Validated' },
  { value: 'verified', label: 'Verified' },
  { value: 'literature', label: 'Literature' },
]

interface Step2Props {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onBack: () => void
  onNext: () => void
}

function Step2({ state, onChange, onBack, onNext }: Step2Props) {
  const { data: categories = [], isLoading: catsLoading } = useInteractionCategories()

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Dataset name <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            className="op-input"
            type="text"
            value={state.datasetName}
            onChange={(e) => onChange({ datasetName: e.target.value })}
            placeholder="e.g. HuRI-2024"
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Interaction status
          </label>
          <select
            className="op-input"
            value={state.interactionStatus}
            onChange={(e) => onChange({ interactionStatus: e.target.value })}
            style={{ width: '100%' }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Category
          </label>
          <select
            className="op-input"
            value={state.categoryId}
            onChange={(e) => onChange({ categoryId: e.target.value })}
            style={{ width: '100%' }}
            disabled={catsLoading}
          >
            <option value="">- None -</option>
            {categories.map((cat) => (
              <option key={cat.id} value={String(cat.id)}>{cat.category_name}</option>
            ))}
          </select>
        </div>

        <CitationFields state={state} onChange={onChange} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
        <button className="op-btn" onClick={onBack}>← Back</button>
        <button
          className="op-btn primary"
          onClick={onNext}
          disabled={!state.datasetName.trim()}
        >
          Preview →
        </button>
      </div>
    </div>
  )
}

const citationLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: 5,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

/**
 * Optional citation + About copy, collapsed by default.
 *
 * Most uploads are unpublished screens with nothing to cite, so this stays out
 * of the way; nothing entered here is required, and it can all be filled in
 * afterwards by editing the dataset.
 */
function CitationFields({
  state,
  onChange,
}: {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
}) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const lookup = useCitationLookup()

  const handleLookup = async () => {
    setNote(null)
    const pmid = state.pubmedId.trim()
    const doi = state.doi.trim()
    if (!pmid && !doi) {
      setNote('Enter a PubMed ID or a DOI first.')
      return
    }
    try {
      const found = await lookup.mutateAsync(pmid ? { pubmed_id: pmid } : { doi })
      onChange({
        pubmedId: state.pubmedId || found.pubmed_id || '',
        doi: state.doi || found.doi || '',
        author: state.author || found.author || '',
        year: state.year || found.year || '',
        title: state.title || found.title || '',
        journal: state.journal || found.journal || '',
        publicationStatus:
          state.publicationStatus === 'unpublished' ? 'published' : state.publicationStatus,
      })
      setNote('Found — review the fields below before importing.')
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail
      setNote(detail ?? 'Lookup failed.')
    }
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          background: 'var(--surface-2)',
          border: 'none',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
          aria-hidden
          style={{ flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
          Citation and About-page copy
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
          - optional, and editable later
        </span>
      </button>

      {open && (
        <div style={{ padding: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={citationLabelStyle}>PubMed ID</label>
              <input
                className="op-input"
                style={{ width: '100%' }}
                value={state.pubmedId}
                onChange={(e) => onChange({ pubmedId: e.target.value })}
                placeholder="25416956"
              />
            </div>
            <div>
              <label style={citationLabelStyle}>DOI</label>
              <input
                className="op-input"
                style={{ width: '100%' }}
                value={state.doi}
                onChange={(e) => onChange({ doi: e.target.value })}
                placeholder="10.1016/j.cell.2014.10.050"
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" className="op-btn" onClick={handleLookup} disabled={lookup.isPending}>
              {lookup.isPending ? 'Looking up…' : 'Look up details'}
            </button>
            {note && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{note}</span>}
          </div>

          <div>
            <label style={citationLabelStyle}>Title</label>
            <input
              className="op-input"
              style={{ width: '100%' }}
              value={state.title}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14 }}>
            <div>
              <label style={citationLabelStyle}>Journal</label>
              <input
                className="op-input"
                style={{ width: '100%' }}
                value={state.journal}
                onChange={(e) => onChange({ journal: e.target.value })}
              />
            </div>
            <div>
              <label style={citationLabelStyle}>Year</label>
              <input
                className="op-input"
                style={{ width: '100%' }}
                value={state.year}
                onChange={(e) => onChange({ year: e.target.value })}
                placeholder="2014"
              />
            </div>
            <div>
              <label style={citationLabelStyle}>Status</label>
              <select
                className="op-input"
                style={{ width: '100%' }}
                value={state.publicationStatus}
                onChange={(e) => onChange({ publicationStatus: e.target.value as PublicationStatus })}
              >
                <option value="published">Published</option>
                <option value="preprint">Preprint</option>
                <option value="unpublished">Unpublished</option>
              </select>
            </div>
          </div>

          <div>
            <label style={citationLabelStyle}>Authors</label>
            <input
              className="op-input"
              style={{ width: '100%' }}
              value={state.author}
              onChange={(e) => onChange({ author: e.target.value })}
              placeholder="Rolland et al."
            />
          </div>

          <div>
            <label style={citationLabelStyle}>About-page paragraph</label>
            <textarea
              className="op-input"
              style={{ width: '100%', minHeight: 100, resize: 'vertical', lineHeight: 1.6 }}
              value={state.aboutBody}
              onChange={(e) => onChange({ aboutBody: e.target.value })}
              placeholder="Describe the screen, its search space, and what was identified…"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Step 3 - dry-run preview
// ─────────────────────────────────────────────────────────

const PSIMI_COLS = [
  { idx: 0,  label: 'Protein A' },
  { idx: 1,  label: 'Protein B' },
  { idx: 6,  label: 'Method' },
  { idx: 8,  label: 'PubMed' },
  { idx: 9,  label: 'Taxon A' },
  { idx: 14, label: 'Score' },
]

const CSV_COLS = [
  { idx: 0, label: 'Protein A' },
  { idx: 1, label: 'Protein B' },
  { idx: 2, label: 'Score' },
  { idx: 3, label: 'PubMed' },
]

function isCsvFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.csv')
}

interface FileSnippet { rows: string[][]; totalRows: number; isCsv: boolean }

function parseFileSnippet(file: File): Promise<FileSnippet> {
  const csv = isCsvFile(file)
  return file.text().then((text) => {
    if (csv) {
      const lines = text.split('\n').filter((l) => l.trim())
      // lines[0] is the header - skip it for data rows
      const dataLines = lines.slice(1)
      return { rows: dataLines.slice(0, 5).map((l) => l.split(',')), totalRows: dataLines.length, isCsv: true }
    }
    const dataLines = text.split('\n').filter((l) => l.trim() && !l.startsWith('#'))
    return { rows: dataLines.slice(0, 5).map((l) => l.split('\t')), totalRows: dataLines.length, isCsv: false }
  })
}

const BATCH = 500

async function runBatchedPreview(
  file: File,
  onProgress: (p: number) => void,
  onDone: (r: DatasetPreviewResult) => void,
  onError: (msg: string) => void,
) {
  try {
    const text = await file.text()
    const uniqueIds = new Set<string>()
    let totalRows = 0
    const csv = isCsvFile(file)

    const lines = text.split('\n')
    let aIdx = 0
    let bIdx = 1

    if (csv) {
      // Parse header to find protein_a / protein_b column positions
      const header = (lines[0] || '').split(',').map((h) => h.trim().toLowerCase())
      aIdx = header.indexOf('protein_a')
      bIdx = header.indexOf('protein_b')
      if (aIdx === -1) aIdx = 0
      if (bIdx === -1) bIdx = 1
    }

    for (const line of csv ? lines.slice(1) : lines) {
      const l = line.trim()
      if (!l || (!csv && l.startsWith('#'))) continue
      const cols = csv ? l.split(',') : l.split('\t')
      if (cols.length < 2) continue
      const a = cols[aIdx]?.trim(); const b = cols[bIdx]?.trim()
      if (!a || !b) continue
      totalRows++
      uniqueIds.add(a)
      if (a !== b) uniqueIds.add(b)
    }

    const ids = Array.from(uniqueIds)
    const batches: string[][] = []
    for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH))
    if (batches.length === 0) {
      onDone({ dry_run: true, rows_sampled: null, proteins_created: 0, proteins_existing: 0, interactions_created: 0, interactions_skipped: 0, errors: [] })
      return
    }

    let completed = 0
    const counts = await Promise.all(
      batches.map(async (batch) => {
        const res = await apiClient.post<{ existing: number }>('/datasets/check-proteins', { identifiers: batch })
        completed++
        onProgress(Math.round((completed / batches.length) * 100))
        return res.data.existing
      })
    )
    const existingTotal = counts.reduce((s, n) => s + n, 0)

    onDone({
      dry_run: true,
      rows_sampled: null,
      proteins_created: ids.length - existingTotal,
      proteins_existing: existingTotal,
      interactions_created: totalRows,
      interactions_skipped: 0,
      errors: [],
    })
  } catch (e: unknown) {
    onError(e instanceof Error ? e.message : 'Unknown error')
  }
}

interface Step3Props {
  state: WizardState
  onBack: () => void
  onNext: (result: DatasetPreviewResult) => void
}

function Step3({ state, onBack, onNext }: Step3Props) {
  const hasRun = useRef(false)
  const [snippet, setSnippet] = useState<FileSnippet | null>(null)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<DatasetPreviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (state.file) parseFileSnippet(state.file).then(setSnippet)
    if (hasRun.current) return
    hasRun.current = true
    if (!state.file) return
    runBatchedPreview(state.file, setProgress, setResult, setError)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isPending = !result && !error

  return (
    <div>
      {/* File snippet - shown immediately from local parse */}
      {snippet && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, display: 'flex', gap: 10, alignItems: 'baseline' }}>
            File contents
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
              {snippet.totalRows.toLocaleString()} data rows · {state.file?.name}
            </span>
          </div>
          <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--mono)' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {(snippet.isCsv ? CSV_COLS : PSIMI_COLS).map((c) => (
                    <th key={c.idx} style={{ padding: '7px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snippet.rows.map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: ri < snippet.rows.length - 1 ? '1px solid var(--border)' : undefined }}>
                    {(snippet.isCsv ? CSV_COLS : PSIMI_COLS).map((c) => {
                      const val = row[c.idx] ?? '-'
                      return (
                        <td key={c.idx} title={val} style={{ padding: '6px 12px', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                          {val.length > 30 ? val.slice(0, 30) + '…' : val || '-'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Progress bar - real batched progress */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {error ? 'Analysis failed' : isPending ? 'Checking proteins against database…' : 'Analysis complete'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
            {progress}%
          </div>
        </div>
        <div style={{ height: 6, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${error ? 100 : progress}%`,
              borderRadius: 99,
              background: error ? 'var(--warn)' : 'var(--primary)',
              transition: 'width 0.15s ease-out',
            }}
          />
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(241,87,66,.08)', border: '1px solid var(--warn)', borderRadius: 8, padding: '16px 20px', color: 'var(--warn)', fontSize: 13, marginBottom: 20 }}>
          Preview failed: {error}
        </div>
      )}

      {result && (
        <div className="op-card" style={{ padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>
            Preview results
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div className="op-num" style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>{result.proteins_created.toLocaleString()}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Proteins new</div>
            </div>
            <div>
              <div className="op-num" style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>{result.proteins_existing.toLocaleString()}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Proteins existing</div>
            </div>
            <div>
              <div className="op-num" style={{ fontSize: 22, fontWeight: 600, color: 'var(--success)' }}>{result.interactions_created.toLocaleString()}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Interactions (total rows)</div>
            </div>
            <div>
              <div className="op-num" style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-muted)' }}>{result.interactions_skipped.toLocaleString()}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Already in database</div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <button className="op-btn" onClick={onBack} disabled={isPending}>← Back</button>
        <button
          className="op-btn primary"
          onClick={() => result && onNext(result)}
          disabled={isPending || !!error || !result}
        >
          Import →
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Step 4 - final upload
// ─────────────────────────────────────────────────────────

interface ImportTotals {
  proteins_created: number
  interactions_created: number
  interactions_skipped: number
  errors: { row: number; reason: string }[]
}

// ─────────────────────────────────────────────────────────
// Stage checklist
// ─────────────────────────────────────────────────────────

type StageChecklistRowState = 'pending' | 'active' | 'warn' | 'done'

interface StageChecklistProps {
  stage: AsyncImportStatus['stage']
}

const STAGE_ORDER = [
  'parsing',
  'enriching_uniprot',
  'enriching_ensembl',
  'enriching_organisms',
  'done',
] as const

function stageIndex(stage: StageChecklistProps['stage']): number {
  if (!stage) return -1
  const base = stage.replace('_warn', '') as (typeof STAGE_ORDER)[number]
  return STAGE_ORDER.indexOf(base)
}

function StageChecklist({ stage }: StageChecklistProps) {
  const [warned, setWarned] = useState({ uniprot: false, ensembl: false, organisms: false })
  const [prevStage, setPrevStage] = useState(stage)

  if (stage !== prevStage) {
    setPrevStage(stage)
    if (stage === 'enriching_uniprot_warn') setWarned((w) => ({ ...w, uniprot: true }))
    if (stage === 'enriching_ensembl_warn') setWarned((w) => ({ ...w, ensembl: true }))
    if (stage === 'enriching_organisms_warn') setWarned((w) => ({ ...w, organisms: true }))
  }

  const idx = stageIndex(stage)

  const rowState = (rowIdx: number, warnKey?: keyof typeof warned): StageChecklistRowState => {
    if (warnKey && warned[warnKey]) return 'warn'
    if (idx > rowIdx) return 'done'
    if (idx === rowIdx) return 'active'
    return 'pending'
  }

  const rows: { label: string; state: StageChecklistRowState; warnMsg?: string }[] = [
    { label: 'Parsing rows', state: rowState(0) },
    { label: 'Fetching UniProt metadata', state: rowState(1, 'uniprot'), warnMsg: 'UniProt unavailable, metadata skipped' },
    { label: 'Fetching Ensembl data', state: rowState(2, 'ensembl'), warnMsg: 'Ensembl unavailable, data skipped' },
    { label: 'Fetching organism names', state: rowState(3, 'organisms'), warnMsg: 'NCBI unavailable, names skipped' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
      {rows.map((row) => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 20, height: 20, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
            {row.state === 'done' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" aria-hidden>
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
            {row.state === 'active' && (
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                border: '2px solid var(--primary)', borderTopColor: 'transparent',
                animation: 'spin 0.7s linear infinite',
              }} />
            )}
            {row.state === 'warn' && (
              <span style={{ fontSize: 14, color: 'var(--warn)' }}>⚠</span>
            )}
            {row.state === 'pending' && (
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border)' }} />
            )}
          </div>
          <div>
            <span style={{
              fontSize: 12,
              color: row.state === 'pending' ? 'var(--text-muted)' : row.state === 'warn' ? 'var(--warn)' : 'var(--text)',
              fontWeight: row.state === 'active' ? 500 : 400,
            }}>
              {row.label}
            </span>
            {row.state === 'warn' && row.warnMsg && (
              <span style={{ fontSize: 11, color: 'var(--warn)', marginLeft: 6 }}>· {row.warnMsg}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

interface Step4Props {
  state: WizardState
  onReset: () => void
}

function Step4({ state, onReset }: Step4Props) {
  const queryClient = useQueryClient()
  const hasRun = useRef(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [progress, setProgress] = useState(0)
  const [totals, setTotals] = useState<ImportTotals>({ proteins_created: 0, interactions_created: 0, interactions_skipped: 0, errors: [] })
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<AsyncImportStatus['stage']>(null)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true
    if (!state.file) return

    startAsyncImport(
      state.file,
      {
        dataset_name: state.datasetName,
        interaction_status: state.interactionStatus,
        category_id: state.categoryId,
        pubmed_id: state.pubmedId.trim(),
        doi: state.doi.trim(),
        author: state.author.trim(),
        year: state.year.trim(),
        title: state.title.trim(),
        journal: state.journal.trim(),
        publication_status: state.publicationStatus,
        about_body: state.aboutBody.trim(),
      },
    ).then((taskId) => {
      pollRef.current = setInterval(async () => {
        try {
          const s = await pollImportStatus(taskId)
          setProgress(s.progress)
          setStage(s.stage ?? null)
          setTotals({
            proteins_created: s.proteins_created,
            interactions_created: s.interactions_created,
            interactions_skipped: s.interactions_skipped,
            errors: s.errors,
          })
          if (s.status === 'SUCCESS') {
            clearInterval(pollRef.current!)
            setDone(true)
            queryClient.invalidateQueries({ queryKey: ['datasets'] })
            queryClient.invalidateQueries({ queryKey: ['counts'] })
          } else if (s.status === 'FAILURE') {
            clearInterval(pollRef.current!)
            setError('Import failed on the server.')
          }
        } catch (e) {
          clearInterval(pollRef.current!)
          setError(e instanceof Error ? e.message : 'Unknown error')
        }
      }, 1000)
    }).catch((e) => setError(e instanceof Error ? e.message : 'Unknown error'))

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isPending = !done && !error

  return (
    <div>
      {/* Progress bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {error ? 'Import failed' : done ? 'Import complete' : 'Importing dataset…'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{progress}%</div>
        </div>
        <div style={{ height: 6, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${error ? 100 : progress}%`,
            borderRadius: 99,
            background: error ? 'var(--warn)' : done ? 'var(--success)' : 'var(--primary)',
            transition: 'width 0.15s ease-out',
          }} />
        </div>
      </div>

      {/* Stage checklist */}
      <StageChecklist stage={stage} />

      {/* Live running totals while importing */}
      {isPending && (
        <div className="op-card" style={{ padding: '16px 20px', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <div className="op-num" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{totals.proteins_created.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Proteins so far</div>
          </div>
          <div>
            <div className="op-num" style={{ fontSize: 18, fontWeight: 600, color: 'var(--success)' }}>{totals.interactions_created.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Interactions so far</div>
          </div>
          <div>
            <div className="op-num" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-muted)' }}>{totals.interactions_skipped.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Skipped so far</div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(241,87,66,.08)', border: '1px solid var(--warn)', borderRadius: 8, padding: '16px 20px', color: 'var(--warn)', fontSize: 13, marginBottom: 20 }}>
          Import failed: {error}
        </div>
      )}

      {done && (
        <div className="op-card" style={{ padding: '24px', marginBottom: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16,185,129,.12)', color: 'var(--success)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Dataset imported successfully</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <div className="op-num" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>{totals.proteins_created.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Proteins created</div>
              </div>
              <div>
                <div className="op-num" style={{ fontSize: 20, fontWeight: 600, color: 'var(--success)' }}>{totals.interactions_created.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Interactions created</div>
              </div>
              <div>
                <div className="op-num" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-muted)' }}>{totals.interactions_skipped.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Already in database</div>
              </div>
            </div>
          </div>
          {totals.errors.length > 0 && (
            <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warn)', marginBottom: 8 }}>
                {totals.errors.length} row{totals.errors.length !== 1 ? 's' : ''} failed (first few shown):
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
                {totals.errors.slice(0, 5).map((e, i) => (
                  <div key={i}>row {e.row}: {e.reason}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(done || error) && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button className="op-btn" onClick={onReset}>Upload another file</button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Upload wizard orchestrator
// ─────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────
// Datasets table with delete
// ─────────────────────────────────────────────────────────

import type { DatasetRef } from '../../types/api'
import { DatasetEditDialog } from './DatasetEditDialog'

function DatasetTable({ datasets }: { datasets: DatasetRef[] }) {
  const deleteMutation = useDatasetDelete()
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [editing, setEditing] = useState<DatasetRef | null>(null)

  function handleDelete(id: number) {
    deleteMutation.mutate(id, { onSuccess: () => setConfirmId(null) })
  }

  return (
    <div className="op-card" style={{ overflow: 'hidden' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 80px 160px 76px',
          padding: '12px 20px',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--border)',
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '.06em',
        }}
      >
        <div>Dataset</div>
        <div>Year</div>
        <div>Status</div>
        <div />
      </div>
      {datasets.map((ds) => (
        <div key={ds.id}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 160px 76px',
              padding: '12px 20px',
              borderBottom: confirmId === ds.id ? 'none' : '1px solid var(--border)',
              alignItems: 'center',
              fontSize: 13,
            }}
          >
            <div>
              <span className="op-num" style={{ fontWeight: 500, color: 'var(--text)', marginRight: 8 }}>
                {ds.name}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ds.description}</span>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>
                {ds.citation ?? <span style={{ fontStyle: 'italic' }}>No citation</span>}
                {!ds.about_body && (
                  <span style={{ fontStyle: 'italic' }}> · No About paragraph</span>
                )}
              </div>
            </div>
            <div className="op-num" style={{ color: 'var(--text-muted)', fontSize: 13 }}>{ds.year ?? '-'}</div>
            <div><span className="op-chip" style={{ fontSize: 10 }}>{ds.interaction_status}</span></div>
            <div style={{ display: 'flex', gap: 2 }}>
              <button
                onClick={() => setEditing(ds)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', lineHeight: 0 }}
                title="Edit citation and About paragraph"
                aria-label={`Edit ${ds.name}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
                </svg>
              </button>
              <button
                onClick={() => setConfirmId(confirmId === ds.id ? null : ds.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', lineHeight: 0 }}
                title="Delete dataset"
                aria-label={`Delete ${ds.name}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              </button>
            </div>
          </div>
          {confirmId === ds.id && (
            <div
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--border)',
                background: 'rgba(241,87,66,.05)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontSize: 13,
              }}
            >
              <span style={{ color: 'var(--warn)', flex: 1 }}>
                Delete <strong>{ds.name}</strong>? This will also remove interactions that belong only to this dataset.
              </span>
              <button
                className="op-btn"
                onClick={() => setConfirmId(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </button>
              <button
                className="op-btn"
                style={{ background: 'var(--warn)', color: '#fff', borderColor: 'var(--warn)' }}
                onClick={() => handleDelete(ds.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      ))}
      {datasets.length === 0 && (
        <div style={{ padding: '24px 20px', color: 'var(--text-muted)', fontSize: 13 }}>No datasets yet.</div>
      )}
      {editing && (
        <DatasetEditDialog dataset={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

function UploadWizard() {
  const [step, setStep] = useState(1)
  const [wizState, setWizState] = useState<WizardState>(INITIAL_STATE)

  const patch = useCallback((p: Partial<WizardState>) => setWizState((s) => ({ ...s, ...p })), [])

  const handleFileChosen = useCallback(
    (file: File) => {
      const name = file.name.replace(/\.[^.]+$/, '')
      patch({ file, datasetName: name })
    },
    [patch],
  )

  const reset = useCallback(() => {
    setStep(1)
    setWizState(INITIAL_STATE)
  }, [])

  return (
    <div>
      <StepIndicator current={step} />

      {step === 1 && (
        <Step1
          file={wizState.file}
          onChange={handleFileChosen}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <Step2
          state={wizState}
          onChange={patch}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <Step3
          state={wizState}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}

      {step === 4 && (
        <Step4
          state={wizState}
          onReset={reset}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────

export function AdminDataPage() {
  const { data: counts } = useCounts()
  const { data: datasets, isLoading } = useDatasets()

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%', padding: '40px 48px' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-.02em',
            margin: '0 0 6px',
            color: 'var(--text)',
          }}
        >
          Data Manager
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 28px' }}>
          Monitor database contents and manage datasets.
        </p>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 32 }}>
          <StatCard
            value={counts?.proteins ?? '-'}
            label="Proteins indexed"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
              </svg>
            }
          />
          <StatCard
            value={counts?.interactions ?? '-'}
            label="Interactions"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
            }
          />
          <StatCard
            value={datasets?.length ?? '-'}
            label="Datasets"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
            }
          />
        </div>

        {/* Datasets table — each row edits its citation and About paragraph */}
        <div style={{ marginBottom: 32 }}>
          <h3
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              margin: '0 0 14px',
            }}
          >
            Registered datasets
          </h3>
          {isLoading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '16px 0' }}>Loading…</div>
          ) : (
            <DatasetTable datasets={datasets ?? []} />
          )}
        </div>

        {/* Upload wizard */}
        <h3
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '.08em',
            margin: '0 0 14px',
          }}
        >
          Upload dataset
        </h3>
        <div className="op-card" style={{ padding: 24 }}>
          <UploadWizard />
        </div>
      </div>
    </div>
  )
}
