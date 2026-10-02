import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import { CytoscapeNetwork } from '../search/network/CytoscapeNetwork'
import type { SearchResult } from '../../types/search'
import { useText } from '../../text'

function useHomeNetwork(refreshKey: number) {
  return useQuery<SearchResult>({
    queryKey: ['home-network', refreshKey],
    queryFn: () => apiClient.get('/home/network').then((r) => r.data),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

export function MiniNetworkGraph() {
  const [refreshKey, setRefreshKey] = useState(0)
  const { data, isLoading } = useHomeNetwork(refreshKey)
  const t = useText()

  const proteins = data?.all_proteins ?? []
  const interactions = data?.all_interactions ?? []
  const queryIds = data?.query_protein_id_array ?? []
  const queryGene = proteins.find((p) => queryIds.includes(p.protein_id))?.protein_gene_name ?? ''

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '.08em',
            }}
          >
            {t('home.network.heading')}
          </span>
          {queryGene && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
              {t('home.network.neighborhood', { gene: queryGene })}
            </span>
          )}
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="op-btn"
          style={{ fontSize: 12, padding: '4px 12px' }}
          disabled={isLoading}
        >
          {isLoading ? t('home.network.loading') : t('home.network.viewAnother')}
        </button>
      </div>

      <div
        style={{
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          height: 320,
          position: 'relative',
        }}
      >
        {isLoading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexDirection: 'column', gap: 12, zIndex: 10,
            background: 'var(--surface)',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '2px solid var(--border)', borderTopColor: 'var(--primary)',
              animation: 'spin .8s linear infinite',
            }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading network…</span>
          </div>
        )}
        {!isLoading && proteins.length > 0 && (
          <CytoscapeNetwork
            proteins={proteins}
            interactions={interactions}
            queryProteinIds={queryIds}
            layout="cola"
            height={320}
            showControls={false}
          />
        )}
        {!isLoading && proteins.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
            No network data available.
          </div>
        )}
      </div>
    </div>
  )
}
