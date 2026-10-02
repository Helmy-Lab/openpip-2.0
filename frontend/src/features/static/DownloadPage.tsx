import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useDatasets } from '../../api/downloads'
import { usePublicFiles } from '../../api/files'
import type { UploadedFile } from '../../api/files'
import { useSettings } from '../../api/settings'
import { useText } from '../../text'
import { BASE_URL } from '../../api/client'
import { referenceHref, referenceLabel, shortCitation } from '../../lib/citation'
import { saveBlob } from '../../lib/download'


async function triggerDownload(datasetId: number, fmt: string, token: string | null) {
  const url = `${BASE_URL}/datasets/${datasetId}/download?fmt=${fmt}`
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(`Download failed (${res.status})`)
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = disposition.match(/filename="([^"]+)"/)
  saveBlob(blob, match ? match[1] : `dataset_${datasetId}.${fmt}`)
}

const STATUS_BADGE: Record<string, string> = {
  Published: 'var(--literature)',
  Validated: 'var(--success)',
  Verified: 'var(--hi-union)',
  Literature: 'var(--accent)',
}

function KindChip({ status }: { status: string }) {
  const color = STATUS_BADGE[status] ?? 'var(--text-muted)'
  return (
    <span
      className="op-chip"
      style={{ color, background: 'transparent', borderColor: 'var(--border)', fontSize: 10 }}
    >
      {status}
    </span>
  )
}

export function DownloadPage() {
  const token = useAuthStore((s) => s.token)
  const { data: datasets, isLoading } = useDatasets()
  const { data: suppFiles } = usePublicFiles()
  const { data: settings } = useSettings()
  const [downloading, setDownloading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const t = useText()

  async function handleDownload(datasetId: number, fmt: string) {
    const key = `${datasetId}-${fmt}`
    setDownloading(key)
    setError(null)
    try {
      await triggerDownload(datasetId, fmt, token)
    } catch {
      setError(`Could not download ${fmt.toUpperCase()}. Please try again.`)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      {/* Header */}
      <section style={{ padding: '48px 80px 24px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="op-chip primary" style={{ marginBottom: 16 }}>
            {t('downloads.chip')}
          </div>
          <h1
            style={{
              fontSize: 38,
              fontWeight: 600,
              letterSpacing: '-.025em',
              margin: '0 0 12px',
              color: 'var(--text)',
            }}
          >
            {t('downloads.title')}
          </h1>
          <p
            style={{
              fontSize: 15,
              color: 'var(--text-muted)',
              margin: 0,
              maxWidth: 640,
              lineHeight: 1.6,
            }}
          >
            {t('downloads.subtitle')}
          </p>
        </div>
      </section>

      {settings?.download && (
        <section style={{ padding: '0 80px 8px' }}>
          <div
            style={{ maxWidth: 1280, margin: '0 auto', lineHeight: 1.7, fontSize: 14, color: 'var(--text)' }}
            dangerouslySetInnerHTML={{ __html: settings.download }}
          />
        </section>
      )}

      {/* Dataset table */}
      {(settings?.showDownloads ?? true) && (
      <section style={{ padding: '0 80px 64px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          {error && (
            <div
              role="alert"
              style={{
                marginBottom: 14,
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--danger, #e53e3e)',
                border: '1px solid var(--border)',
                borderRadius: 6,
              }}
            >
              {error}
            </div>
          )}
          {isLoading ? (
            <div style={{ padding: '48px 0', color: 'var(--text-muted)', fontSize: 14 }}>
              {t('downloads.loading')}
            </div>
          ) : (
            <div className="op-card" style={{ overflow: 'hidden' }}>
              {/* Table header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 160px 200px',
                  padding: '14px 24px',
                  background: 'var(--surface-2)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                }}
              >
                <div>{t('downloads.table.dataset')}</div>
                <div>{t('downloads.table.year')}</div>
                <div style={{ textAlign: 'right' }}>{t('downloads.table.download')}</div>
              </div>

              {/* Table rows */}
              {datasets?.map((ds) => (
                <div
                  key={ds.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 160px 200px',
                    padding: '16px 24px',
                    borderBottom: '1px solid var(--border)',
                    alignItems: 'center',
                  }}
                >
                  <div data-selectable>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 3,
                      }}
                    >
                      <span
                        className="op-num"
                        style={{ fontWeight: 500, fontSize: 14, color: 'var(--text)' }}
                      >
                        {ds.name}
                      </span>
                      <KindChip status={ds.interaction_status} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {ds.description}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 2, lineHeight: 1.5 }}>
                      {ds.citation ?? shortCitation(ds) ?? 'Unpublished dataset'}
                      {referenceHref(ds) && (
                        <>
                          {' '}
                          <a
                            href={referenceHref(ds)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--primary)', textDecoration: 'none' }}
                          >
                            {referenceLabel(ds)}
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  <div
                    className="op-num"
                    style={{ fontSize: 13, color: 'var(--text-muted)' }}
                  >
                    {ds.year ?? '-'}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                    {(['tab', 'sif', 'csv'] as const).map((fmt) => {
                      const key = `${ds.id}-${fmt}`
                      const busy = downloading === key
                      return (
                        <button
                          key={fmt}
                          className="op-btn"
                          disabled={busy}
                          onClick={() => handleDownload(ds.id, fmt)}
                          style={{
                            padding: '5px 10px',
                            fontSize: 11,
                            fontFamily: 'var(--mono)',
                            textTransform: 'uppercase',
                            opacity: busy ? 0.6 : 1,
                            cursor: busy ? 'wait' : 'pointer',
                          }}
                        >
                          {busy ? '…' : `.${fmt}`}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              {datasets?.length === 0 && (
                <div style={{ padding: '32px 24px', color: 'var(--text-muted)', fontSize: 14 }}>
                  No datasets available.
                </div>
              )}
            </div>
          )}
        </div>
      </section>
      )}

      {/* Supplementary Files */}
      {(settings?.showDownloadAll ?? true) && suppFiles && suppFiles.length > 0 && (
        <section style={{ padding: '0 80px 64px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                marginBottom: 14,
              }}
            >
              Supplementary Files
            </div>
            <div className="op-card" style={{ overflow: 'hidden' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px 200px',
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
                <div style={{ textAlign: 'right' }}>Download</div>
              </div>
              {suppFiles.map((f: UploadedFile) => (
                <SuppFileRow key={f.id} file={f} token={token} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function SuppFileRow({ file, token }: { file: UploadedFile; token: string | null }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const ext = file.file_name.split('.').pop()?.toLowerCase() ?? ''

  async function handleDownload() {
    setBusy(true)
    setFailed(false)
    try {
      const res = await fetch(`${BASE_URL}/files/${file.id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(`Download failed (${res.status})`)
      saveBlob(await res.blob(), file.file_name)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 80px 200px',
        padding: '14px 24px',
        borderBottom: '1px solid var(--border)',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          className="op-chip"
          style={{ fontSize: 10, background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          .{ext}
        </span>
        <span data-selectable style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--mono)' }}>
          {file.file_name}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatBytes(file.file_size)}</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
        {failed && (
          <span role="alert" style={{ fontSize: 11, color: 'var(--danger, #e53e3e)' }}>
            Failed
          </span>
        )}
        <button
          className="op-btn"
          disabled={busy}
          onClick={handleDownload}
          style={{ padding: '5px 14px', fontSize: 11, opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer' }}
        >
          {busy ? '…' : 'Download'}
        </button>
      </div>
    </div>
  )
}
