import { useCallback, useRef, useState } from 'react'
import { useAdminFiles, useUploadFile, useToggleFileVisibility, useDeleteFile } from '../../api/files'
import { useAuthStore } from '../../store/authStore'
import type { UploadedFile } from '../../api/files'
import { BASE_URL } from '../../api/client'
import { saveBlob } from '../../lib/download'

const ALLOWED_EXTS = ['.fasta', '.fa', '.tab', '.tsv', '.sif', '.csv']
const MAX_MB = 500

const EXT_COLOR: Record<string, string> = {
  fasta: 'var(--success)',
  fa: 'var(--success)',
  tab: 'var(--primary)',
  tsv: 'var(--primary)',
  sif: 'var(--accent)',
  csv: 'var(--text-muted)',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function extOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function FileTypeChip({ name }: { name: string }) {
  const ext = extOf(name)
  return (
    <span
      className="op-chip"
      style={{
        fontSize: 10,
        color: EXT_COLOR[ext] ?? 'var(--text-muted)',
        background: 'transparent',
        borderColor: 'var(--border)',
      }}
    >
      .{ext}
    </span>
  )
}

function FileRow({ file }: { file: UploadedFile }) {
  const token = useAuthStore((s) => s.token)
  const toggle = useToggleFileVisibility()
  const del = useDeleteFile()

  function handleDownload() {
    const url = `${BASE_URL}/files/${file.id}/download`
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((blob) => saveBlob(blob, file.file_name))
      .catch(() => {})
  }

  function handleDelete() {
    if (!window.confirm(`Permanently delete "${file.file_name}"? This cannot be undone.`)) return
    del.mutate(file.id)
  }

  const date = new Date(file.uploaded_at).toLocaleDateString('en-CA')

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 80px 110px 120px',
        padding: '14px 24px',
        borderBottom: '1px solid var(--border)',
        alignItems: 'center',
        opacity: file.show ? 1 : 0.55,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <FileTypeChip name={file.file_name} />
        <span style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--mono)' }}>
          {file.file_name}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatBytes(file.file_size)}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{date}</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <button
          className="op-btn"
          onClick={handleDownload}
          style={{ padding: '4px 10px', fontSize: 11 }}
          title="Download file"
        >
          Download
        </button>
        <button
          className="op-btn"
          onClick={() => toggle.mutate({ id: file.id, show: !file.show })}
          disabled={toggle.isPending}
          style={{ padding: '4px 10px', fontSize: 11 }}
          title={file.show ? 'Hide from Downloads page' : 'Show on Downloads page'}
        >
          {file.show ? 'Hide' : 'Show'}
        </button>
        <button
          className="op-btn"
          onClick={handleDelete}
          disabled={del.isPending}
          style={{ padding: '4px 10px', fontSize: 11, color: 'var(--error)' }}
          title="Permanently delete"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

type UploadState =
  | { type: 'idle' }
  | { type: 'collision'; file: File }
  | { type: 'uploading' }
  | { type: 'error'; message: string }
  | { type: 'success'; name: string }

export function AdminFilePage() {
  const { data: files, isLoading } = useAdminFiles()
  const upload = useUploadFile()
  const [dragging, setDragging] = useState(false)
  const [uploadState, setUploadState] = useState<UploadState>({ type: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)

  const existingNames = new Set(files?.map((f) => f.file_name) ?? [])

  const doUpload = useCallback(
    (file: File, force = false) => {
      const ext = '.' + extOf(file.name)
      if (!ALLOWED_EXTS.includes(ext)) {
        setUploadState({ type: 'error', message: `"${ext}" not allowed. Use: ${ALLOWED_EXTS.join(', ')}` })
        return
      }
      const maxBytes = MAX_MB * 1024 * 1024
      if (file.size > maxBytes) {
        setUploadState({ type: 'error', message: `File exceeds ${MAX_MB} MB limit.` })
        return
      }
      if (!force && existingNames.has(file.name)) {
        setUploadState({ type: 'collision', file })
        return
      }
      const form = new FormData()
      form.append('file', file)
      if (force) form.append('force', 'true')
      setUploadState({ type: 'uploading' })
      upload.mutate(form, {
        onSuccess: () => setUploadState({ type: 'success', name: file.name }),
        onError: (err: unknown) => {
          const e = err as { response?: { data?: { detail?: string } } }
          const msg = e?.response?.data?.detail ?? 'Upload failed.'
          if (msg === 'collision') {
            setUploadState({ type: 'collision', file })
          } else {
            setUploadState({ type: 'error', message: msg })
          }
        },
      })
    },
    [existingNames, upload],
  )

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) doUpload(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) doUpload(file)
    e.target.value = ''
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%', padding: '40px 48px' }}>
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
          File Manager
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 28px' }}>
          Upload supplementary files (FASTA, TAB, SIF, CSV). Visible files appear on the Downloads page.
        </p>

        {/* Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 12,
            padding: '36px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? 'color-mix(in oklch, var(--primary) 5%, var(--bg))' : 'var(--surface)',
            transition: 'border-color .15s, background .15s',
            marginBottom: 20,
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_EXTS.join(',')}
            style={{ display: 'none' }}
            onChange={onFileChange}
          />
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="1.5"
            style={{ marginBottom: 10 }}
            aria-hidden
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>
            Drop a file here or click to browse
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {ALLOWED_EXTS.join(', ')} · max {MAX_MB} MB
          </div>
        </div>

        {/* Upload state banners */}
        {uploadState.type === 'uploading' && (
          <div className="op-card" style={{ padding: '12px 16px', marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
            Uploading…
          </div>
        )}

        {uploadState.type === 'success' && (
          <div
            className="op-card"
            style={{ padding: '12px 16px', marginBottom: 16, borderLeft: '3px solid var(--success)', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span><strong>{uploadState.name}</strong> uploaded successfully.</span>
            <button className="op-btn" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => setUploadState({ type: 'idle' })}>Dismiss</button>
          </div>
        )}

        {uploadState.type === 'error' && (
          <div
            className="op-card"
            style={{ padding: '12px 16px', marginBottom: 16, borderLeft: '3px solid var(--error)', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span style={{ color: 'var(--error)' }}>{uploadState.message}</span>
            <button className="op-btn" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => setUploadState({ type: 'idle' })}>Dismiss</button>
          </div>
        )}

        {uploadState.type === 'collision' && (
          <div
            className="op-card"
            style={{ padding: '16px 20px', marginBottom: 16, borderLeft: '3px solid var(--warn)' }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>
              File already exists
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.55 }}>
              A file named <strong>{uploadState.file.name}</strong> already exists. Rename your file
              before uploading, or proceed to upload with a unique suffix added automatically.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="op-btn primary"
                style={{ padding: '5px 14px', fontSize: 12 }}
                onClick={() => doUpload(uploadState.file, true)}
              >
                Upload anyway
              </button>
              <button
                className="op-btn"
                style={{ padding: '5px 14px', fontSize: 12 }}
                onClick={() => setUploadState({ type: 'idle' })}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* File list */}
        <div className="op-card" style={{ overflow: 'hidden' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 110px 120px',
              padding: '12px 24px',
              background: 'var(--surface-2)',
              borderBottom: '1px solid var(--border)',
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '.06em',
            }}
          >
            <div>File</div>
            <div>Size</div>
            <div>Uploaded</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>

          {isLoading && (
            <div style={{ padding: '32px 24px', fontSize: 14, color: 'var(--text-muted)' }}>
              Loading files…
            </div>
          )}

          {!isLoading && files?.length === 0 && (
            <div style={{ padding: '32px 24px', fontSize: 14, color: 'var(--text-muted)' }}>
              No files uploaded yet.
            </div>
          )}

          {files?.map((f) => <FileRow key={f.id} file={f} />)}
        </div>
      </div>
    </div>
  )
}
