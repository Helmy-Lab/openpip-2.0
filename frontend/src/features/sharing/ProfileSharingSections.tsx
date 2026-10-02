import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useSavedViews,
  useDeleteSavedView,
  type SavedView,
} from '../../api/sharing'
import { useSavedNetworks, useDeleteNetwork } from '../../api/networks'
import { ShareDialog } from './ShareDialog'
import { ShareList } from './ShareList'
import { SavedViewDetails } from './SavedViewDetails'

const CARD_LABEL = {
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--text-muted)',
  textTransform: 'uppercase' as const,
  letterSpacing: '.08em',
  marginBottom: 16,
}

const ROW = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
}

const SMALL_BTN = { fontSize: 11, padding: '5px 10px' }

/** Two kinds of record, one list. */
interface Row {
  key: string
  id: number
  name: string
  query: string
  /** Sorts the list; a legacy network may not carry one. */
  when: string | null
  live: boolean
  detail: string
  view?: SavedView
}

/**
 * Everything you have kept, in one place: views that re-run the search with
 * the filters you saved, and the older saved networks that pin a fixed set of
 * interactions. Both stay on their own tables — the legacy one is Phase 1
 * parity and does not get rewritten — so the list says which kind each row is.
 */
export function ProfileSharingSections() {
  const navigate = useNavigate()
  const { data: views = [], isLoading: viewsLoading } = useSavedViews()
  const { data: networks = [], isLoading: networksLoading } = useSavedNetworks()
  const deleteView = useDeleteSavedView()
  const deleteNetwork = useDeleteNetwork()
  const [sharing, setSharing] = useState<SavedView | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)

  const rows: Row[] = [
    ...views.map((view) => ({
      key: `view-${view.id}`,
      id: view.id,
      name: view.name,
      query: view.query,
      when: view.updated_at,
      live: true,
      detail: 'filters and layout, re-run on open',
      view,
    })),
    ...networks.map((net) => ({
      key: `network-${net.id}`,
      id: net.id,
      name: net.name,
      query: net.query,
      when: net.created_at,
      live: false,
      detail: `${net.interaction_count} interactions, as they were`,
    })),
  ].sort((a, b) => (b.when ?? '').localeCompare(a.when ?? ''))

  return (
    <>
      <div className="op-card" style={{ padding: 28, marginBottom: 20 }}>
        <div style={CARD_LABEL}>Saved Views</div>
        {viewsLoading || networksLoading ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Nothing saved yet. Share or save a network from the search page and it
            is kept here.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((row) => (
              <div key={row.key} style={{ ...ROW, flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                      {row.name}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                      <span className="op-chip" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                        {row.query}
                      </span>
                      <span
                        style={{ fontSize: 11, color: 'var(--text-muted)' }}
                        title={row.detail}
                      >
                        {row.live ? 'Live view' : 'Snapshot'} · {row.detail}
                      </span>
                    </div>
                  </div>
                  <button
                    className="op-btn"
                    style={SMALL_BTN}
                    onClick={() =>
                      navigate(
                        row.live ? `/views/${row.id}` : `/networks/${row.id}`,
                      )
                    }
                  >
                    Open
                  </button>
                  {row.view && (
                    <button
                      className="op-btn"
                      style={SMALL_BTN}
                      aria-expanded={openKey === row.key}
                      onClick={() => setOpenKey(openKey === row.key ? null : row.key)}
                    >
                      {openKey === row.key ? 'Hide details' : 'Details'}
                    </button>
                  )}
                  {/* Only a live view can be shared: a share points at one, and a
                      snapshot would hand over yesterday's interactions. */}
                  {row.view && (
                    <button
                      className="op-btn"
                      style={SMALL_BTN}
                      onClick={() => setSharing(row.view!)}
                    >
                      Share
                    </button>
                  )}
                  <button
                    onClick={() =>
                      row.live ? deleteView.mutate(row.id) : deleteNetwork.mutate(row.id)
                    }
                    aria-label={`Delete ${row.name}`}
                    title="Delete"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      fontSize: 18,
                      lineHeight: 1,
                      padding: 4,
                    }}
                  >
                    ×
                  </button>
                </div>
                {row.view && openKey === row.key && <SavedViewDetails view={row.view} />}
              </div>
            ))}
          </div>
        )}
      </div>

      <ShareList direction="received" />
      <ShareList direction="sent" />

      {sharing && (
        <ShareDialog
          savedViewId={sharing.id}
          savedViewName={sharing.name}
          onClose={() => setSharing(null)}
        />
      )}
    </>
  )
}
