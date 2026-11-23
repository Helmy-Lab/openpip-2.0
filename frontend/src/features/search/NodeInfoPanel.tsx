import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStructureAvailability } from './network/useStructureAvailability'
import { StructureViewer } from './network/StructureViewer'
import type { Protein, Interaction } from '../../types/api'
import { useText } from '../../text'
import { useDatasets } from '../../api/downloads'

const SECTION = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase' as const,
  letterSpacing: '.07em',
  marginBottom: 6,
  marginTop: 14,
}

const EXT_LINK = { fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }

export interface NodeInfoPanelProps {
  protein: Protein
  networkInteractions: Interaction[]
  onClose: () => void
  onRemove: (id: number) => void
}

export function NodeInfoPanel({
  protein,
  networkInteractions,
  onClose,
  onRemove,
}: NodeInfoPanelProps) {
  const navigate = useNavigate()
  const t = useText()
  // The search runs over every dataset this deployment hosts; name them.
  const { data: datasets } = useDatasets()
  const datasetNames = datasets?.map((d) => d.name).filter(Boolean).join(', ')
  const gene = protein.protein_gene_name || protein.protein_uniprot_id || '-'

  const [viewerOpen, setViewerOpen] = useState(false)
  const [structureSource, setStructureSource] = useState<'alphafold' | 'pdb'>('alphafold')

  const { pdbId, loading: pdbLoading, error: pdbError } = useStructureAvailability(
    protein.protein_uniprot_id
  )

  // Pre-kick Mol* dynamic import so chunk is in-flight before user expands.
  // .catch() swallows any rejection so tests don't see an unhandled promise.
  useEffect(() => {
    if (protein.protein_uniprot_id) {
      import('molstar/lib/mol-plugin-ui').catch(() => {})
    }
  }, [protein.protein_uniprot_id])

  const interactionsInNetwork = networkInteractions.filter(
    (ix) =>
      ix.interactor_A.protein_id === protein.protein_id ||
      ix.interactor_B.protein_id === protein.protein_id
  ).length

  const ncbiId = protein.protein_entrez_id
  const ensemblId = protein.protein_ensembl_id
  const uniprotId = protein.protein_uniprot_id

  const pdbDisabled = pdbLoading || pdbId === null
  const pdbTitle = pdbError
    ? 'Could not check PDB availability'
    : pdbLoading
      ? 'Checking PDB availability…'
      : 'No PDB structure available for this protein'

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 20,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '16px 18px',
        width: 272,
        boxShadow: '0 6px 24px rgba(0,0,0,.14)',
        maxHeight: 'calc(100% - 24px)',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
            {gene}
          </div>
          {protein.protein_protein_name && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              {protein.protein_protein_name}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label={t('search.panel.close')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: 18,
            lineHeight: 1,
            padding: '0 0 0 8px',
          }}
        >
          ×
        </button>
      </div>

      {/* 3D Structure - only when UniProt ID is known */}
      {uniprotId && (
        <div style={{ marginTop: 12 }}>
          <button
            aria-label={t('search.panel.structure')}
            onClick={() => setViewerOpen((v) => !v)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              background: 'var(--surface-alt, #2a3060)',
              border: '1px solid var(--border)',
              borderRadius: viewerOpen ? '6px 6px 0 0' : 6,
              color: 'var(--accent)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span>⬡</span>
            <span>3D Structure</span>
            <span style={{ marginLeft: 'auto', fontSize: 10 }}>{viewerOpen ? '▲' : '▼'}</span>
          </button>

          {viewerOpen && (
            <div
              style={{
                border: '1px solid var(--border)',
                borderTop: 'none',
                borderRadius: '0 0 6px 6px',
                overflow: 'hidden',
              }}
            >
              {/* AlphaFold / PDB tab strip */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                <button
                  onClick={() => setStructureSource('alphafold')}
                  style={{
                    flex: 1,
                    padding: '4px 0',
                    border: 'none',
                    borderRight: '1px solid var(--border)',
                    background: structureSource === 'alphafold' ? 'var(--accent)' : 'transparent',
                    color: structureSource === 'alphafold' ? '#fff' : 'var(--text-muted)',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  AlphaFold
                </button>
                <button
                  onClick={() => { if (!pdbDisabled) setStructureSource('pdb') }}
                  disabled={pdbDisabled}
                  title={pdbDisabled ? pdbTitle : undefined}
                  style={{
                    flex: 1,
                    padding: '4px 0',
                    border: 'none',
                    background: structureSource === 'pdb' ? 'var(--accent)' : 'transparent',
                    color: structureSource === 'pdb' ? '#fff' : 'var(--text-muted)',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: pdbDisabled ? 'not-allowed' : 'pointer',
                    opacity: pdbDisabled ? 0.4 : 1,
                  }}
                >
                  PDB
                </button>
              </div>

              <StructureViewer
                uniprotId={uniprotId}
                source={structureSource}
                pdbId={pdbId}
              />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={SECTION}>{t('search.panel.actions')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <button
          className="op-btn"
          style={{ fontSize: 12, padding: '6px 12px', textAlign: 'left' }}
          onClick={() => {
            onClose()
            navigate(`/search/${encodeURIComponent(gene)}`)
          }}
        >
          Search {gene} in {datasetNames || 'openPIP'}
        </button>
        <button
          className="op-btn"
          style={{ fontSize: 12, padding: '6px 12px', textAlign: 'left', color: 'var(--warn)' }}
          onClick={() => {
            onRemove(protein.protein_id)
            onClose()
          }}
        >
          Remove {gene} From Network
        </button>
      </div>

      {/* Links */}
      <div style={SECTION}>{t('search.panel.links')}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
        {ncbiId && (
          <a
            href={`https://www.ncbi.nlm.nih.gov/gene/${ncbiId}`}
            target="_blank"
            rel="noreferrer"
            style={{ ...EXT_LINK, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <img
              src="https://www.ncbi.nlm.nih.gov/favicon.ico"
              width={14}
              height={14}
              alt=""
              style={{ borderRadius: 2, flexShrink: 0 }}
            />
            NCBI Gene
          </a>
        )}
        {uniprotId && (
          <a
            href={`https://www.proteinatlas.org/${uniprotId}`}
            target="_blank"
            rel="noreferrer"
            style={{ ...EXT_LINK, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <img
              src="https://www.proteinatlas.org/favicon.ico"
              width={14}
              height={14}
              alt=""
              style={{ borderRadius: 2, flexShrink: 0 }}
            />
            Human Protein Atlas
          </a>
        )}
        {ensemblId && (
          <a
            href={`https://www.ensembl.org/id/${ensemblId}`}
            target="_blank"
            rel="noreferrer"
            style={{ ...EXT_LINK, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <img
              src="https://www.ensembl.org/favicon.ico"
              width={14}
              height={14}
              alt=""
              style={{ borderRadius: 2, flexShrink: 0 }}
            />
            Ensembl
          </a>
        )}
        {gene !== '-' && (
          <a
            href={`https://www.genecards.org/cgi-bin/carddisp.pl?gene=${gene}`}
            target="_blank"
            rel="noreferrer"
            style={{ ...EXT_LINK, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <img
              src="https://www.genecards.org/favicon.ico"
              width={14}
              height={14}
              alt=""
              style={{ borderRadius: 2, flexShrink: 0 }}
            />
            GeneCards
          </a>
        )}
        {uniprotId && (
          <a
            href={`https://www.uniprot.org/uniprot/${uniprotId}`}
            target="_blank"
            rel="noreferrer"
            style={{ ...EXT_LINK, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <img
              src="https://www.uniprot.org/favicon.ico"
              width={14}
              height={14}
              alt=""
              style={{ borderRadius: 2, flexShrink: 0 }}
            />
            UniProt
          </a>
        )}
      </div>

      {/* Interaction counts */}
      <div style={SECTION}>{t('search.panel.interactionCount')}</div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div>
          Interactions in Network: <strong>{interactionsInNetwork}</strong>
        </div>
        <div>
          Interactions in Database:{' '}
          <strong>{protein.number_of_interactions_in_database}</strong>
        </div>
      </div>

      {/* Description */}
      {protein.protein_description && (
        <>
          <div style={SECTION}>{t('search.panel.description')}</div>
          <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>
            {protein.protein_description}
          </p>
        </>
      )}
    </div>
  )
}
