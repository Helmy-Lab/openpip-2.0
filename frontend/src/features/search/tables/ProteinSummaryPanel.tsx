import { useEffect, useState } from 'react'
import { useStructureAvailability } from '../network/useStructureAvailability'
import { StructureViewer } from '../network/StructureViewer'
import { useUniprotEntry } from '../network/useUniprotEntry'
import type { Protein, Interaction } from '../../../types/api'
import { useText } from '../../../text'

interface Props {
  protein: Protein
  interactions: Interaction[]
  isQueryProtein: boolean
}

const SECTION: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '.07em',
  marginBottom: 8,
  marginTop: 20,
}

// Scoped styles - only for things inline styles can't express (media query, box-sizing)
const STYLES = `
  .psp-wrap { display: flex; flex-wrap: wrap; align-items: flex-start; min-height: 480px; }
  .psp-left { flex: 1 1 50%; min-width: 320px; padding: 20px 24px; box-sizing: border-box; }
  .psp-right {
    flex: 1 1 50%; min-width: 320px; padding: 20px;
    box-sizing: border-box;
    border-left: 1px solid var(--border);
    position: sticky; top: 0; align-self: flex-start;
  }
  @media (max-width: 720px) {
    .psp-right { border-left: none; border-top: 1px solid var(--border); position: static; }
  }
`

export function ProteinSummaryPanel({ protein, interactions, isQueryProtein }: Props) {
  const t = useText()
  const [seqCopied, setSeqCopied] = useState(false)
  const [structureSource, setStructureSource] = useState<'alphafold' | 'pdb'>('alphafold')
  const [prevProteinId, setPrevProteinId] = useState(protein.protein_id)

  // Reset to AlphaFold when protein changes (React render-phase pattern)
  if (protein.protein_id !== prevProteinId) {
    setPrevProteinId(protein.protein_id)
    setStructureSource('alphafold')
  }

  const gene = protein.protein_gene_name || protein.protein_uniprot_id || '-'
  const uniprotId = protein.protein_uniprot_id

  const { pdbId, loading: pdbLoading, error: pdbError } = useStructureAvailability(uniprotId)
  const { data: entry } = useUniprotEntry(uniprotId)

  useEffect(() => {
    if (uniprotId) import('molstar/lib/mol-plugin-ui').catch(() => {})
  }, [uniprotId])

  const pdbDisabled = pdbLoading || pdbId === null
  const pdbTitle = pdbError
    ? 'Could not check PDB availability'
    : pdbLoading
      ? 'Checking PDB availability…'
      : 'No PDB structure available for this protein'

  const interactionsInNetwork = interactions.filter(
    (ix) =>
      ix.interactor_A.protein_id === protein.protein_id ||
      ix.interactor_B.protein_id === protein.protein_id
  ).length

  const topTissues = Object.entries(protein.tissue_expression_array as Record<string, string>)
    .map(([k, v]) => ({ tissue: k.replace(/_/g, ' '), score: parseFloat(v) }))
    .filter((t) => !isNaN(t.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  const maxTissueScore = topTissues[0]?.score ?? 1

  const subcellularLocs = Object.entries(
    protein.subcellular_location_expression_array as Record<string, string>
  )
    .filter(([, v]) => v && v.length > 0)
    .map(([k, v]) => ({ location: k.replace(/_/g, ' '), status: v }))

  const annotations = Object.entries(protein.annotation_array).filter(
    ([k, v]) =>
      k !== 'tissue_expression' &&
      k !== 'subcellular_location' &&
      !String(v).trim().startsWith('{'),
  )

  const copyFasta = () => {
    const fasta = `>${gene} | ${protein.protein_protein_name}\n${protein.protein_sequence}`
    navigator.clipboard.writeText(fasta).then(() => {
      setSeqCopied(true)
      setTimeout(() => setSeqCopied(false), 2000)
    })
  }

  const ids = [
    { label: 'UniProt', value: uniprotId, href: uniprotId ? `https://www.uniprot.org/uniprot/${uniprotId}` : undefined },
    { label: 'Ensembl', value: protein.protein_ensembl_id, href: protein.protein_ensembl_id ? `https://www.ensembl.org/id/${protein.protein_ensembl_id}` : undefined },
    { label: 'Entrez', value: protein.protein_entrez_id, href: protein.protein_entrez_id ? `https://www.ncbi.nlm.nih.gov/gene/${protein.protein_entrez_id}` : undefined },
    { label: 'Gene', value: gene, href: undefined },
  ].filter((x) => x.value)

  const links = [
    protein.protein_entrez_id && { label: 'NCBI Gene', href: `https://www.ncbi.nlm.nih.gov/gene/${protein.protein_entrez_id}`, fav: 'https://www.ncbi.nlm.nih.gov/favicon.ico' },
    uniprotId && { label: 'UniProt', href: `https://www.uniprot.org/uniprot/${uniprotId}`, fav: 'https://www.uniprot.org/favicon.ico' },
    uniprotId && { label: 'Human Protein Atlas', href: `https://www.proteinatlas.org/${uniprotId}`, fav: 'https://www.proteinatlas.org/favicon.ico' },
    protein.protein_ensembl_id && { label: 'Ensembl', href: `https://www.ensembl.org/id/${protein.protein_ensembl_id}`, fav: 'https://www.ensembl.org/favicon.ico' },
    gene !== '-' && { label: 'GeneCards', href: `https://www.genecards.org/cgi-bin/carddisp.pl?gene=${gene}`, fav: 'https://www.genecards.org/favicon.ico' },
  ].filter(Boolean) as { label: string; href: string; fav: string }[]

  return (
    <>
      <style>{STYLES}</style>
      <div className="psp-wrap">

        {/* ── Left: protein info ── */}
        <div className="psp-left">

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                {gene}
              </div>
              {protein.protein_protein_name && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                  {protein.protein_protein_name}
                </div>
              )}
            </div>
            {isQueryProtein && (
              <span style={{
                fontSize: 11, fontWeight: 600,
                background: 'var(--primary-soft)', color: 'var(--primary-deep)',
                borderRadius: 10, padding: '3px 10px', marginTop: 4, flexShrink: 0,
              }}>
                Query protein
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 6 }}>
            {isQueryProtein
              ? 'Click any interactor node in the network to view its details here.'
              : 'Click any other node to switch to its details.'}
          </div>

          {/* Identifiers */}
          <div style={SECTION}>{t('search.panel.identifiers')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {ids.map(({ label, value, href }) => (
              <div key={label} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '8px 12px',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>
                  {label}
                </div>
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--mono)', textDecoration: 'none' }}>
                    {value}
                  </a>
                ) : (
                  <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text)' }}>{value}</div>
                )}
              </div>
            ))}
          </div>

          {/* Interaction counts */}
          <div style={SECTION}>{t('search.panel.interactions')}</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { label: t('search.panel.inNetwork'), value: interactionsInNetwork },
              { label: t('search.panel.inDatabase'), value: protein.number_of_interactions_in_database },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '10px 16px', minWidth: 110,
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary-deep)' }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Overview, from UniProt: what the stored record does not carry */}
          {entry && (
            <>
              <div style={SECTION}>{t('search.panel.overview')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                {[
                  { label: t('search.panel.organism'), value: entry.organism },
                  { label: t('search.panel.length'), value: entry.length && `${entry.length} aa` },
                  { label: t('search.panel.mass'), value: entry.mass && `${(entry.mass / 1000).toFixed(1)} kDa` },
                ].filter((x) => x.value).map(({ label, value }) => (
                  <div key={label} style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 6, padding: '8px 12px',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text)' }}>{value}</div>
                  </div>
                ))}
              </div>
              {entry.function && (
                <>
                  <div style={SECTION}>{t('search.panel.function')}</div>
                  <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, margin: 0 }}>
                    {entry.function}
                  </p>
                </>
              )}
              {entry.keywords.length > 0 && (
                <>
                  <div style={SECTION}>{t('search.panel.keywords')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {entry.keywords.map((k) => (
                      <span key={k} style={{
                        fontSize: 12, background: 'var(--surface-2)', color: 'var(--text)',
                        border: '1px solid var(--border)', borderRadius: 12, padding: '2px 10px',
                      }}>
                        {k}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Description */}
          {protein.protein_description && (
            <>
              <div style={SECTION}>{t('search.panel.description')}</div>
              <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, margin: 0 }}>
                {protein.protein_description}
              </p>
            </>
          )}

          {/* Annotations */}
          {annotations.length > 0 && (
            <>
              <div style={SECTION}>{t('search.panel.annotations')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {annotations.map(([key, value]) => (
                  <div key={key}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {key.replace(/_/g, ' ')}:{' '}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text)' }}>
                      {String(value).length > 400 ? String(value).slice(0, 400) + '…' : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Top tissue expression */}
          {topTissues.length > 0 && (
            <>
              <div style={SECTION}>{t('search.panel.topTissue')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {topTissues.map(({ tissue, score }) => (
                  <div key={tissue} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 160, fontSize: 12, color: 'var(--text)', textAlign: 'right', flexShrink: 0, textTransform: 'capitalize' }}>
                      {tissue}
                    </div>
                    {/* --surface would vanish against the surrounding surface, and
                        --primary keeps the admin's raw brand hex in dark mode. Only
                        --primary-deep is derived per theme, so it reads in both. */}
                    <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.max(2, (score / maxTissueScore) * 100)}%`,
                        background: 'var(--primary-deep)',
                        borderRadius: 4,
                      }} />
                    </div>
                    <div style={{ width: 42, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', fontFamily: 'var(--mono)', flexShrink: 0 }}>
                      {score.toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Subcellular locations */}
          {subcellularLocs.length > 0 && (
            <>
              <div style={SECTION}>{t('search.panel.subcellular')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {subcellularLocs.map(({ location, status }) => (
                  <span key={location} style={{
                    fontSize: 12, background: 'var(--primary-soft)', color: 'var(--primary-deep)',
                    borderRadius: 12, padding: '3px 10px', textTransform: 'capitalize',
                  }}>
                    {location}
                    {status !== 'validated' && (
                      <span style={{ fontSize: 10, opacity: 0.7 }}> ({status})</span>
                    )}
                  </span>
                ))}
              </div>
            </>
          )}

          {/* Sequence */}
          {protein.protein_sequence && (
            <>
              <div style={{ ...SECTION, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{t('search.panel.sequence')}</span>
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-soft)', textTransform: 'none', letterSpacing: 0 }}>
                  {protein.protein_sequence.length} aa
                </span>
                <button
                  onClick={copyFasta}
                  style={{
                    marginLeft: 'auto', fontSize: 11, padding: '2px 10px',
                    background: seqCopied ? 'var(--primary-soft)' : 'var(--surface)',
                    color: seqCopied ? 'var(--primary-deep)' : 'var(--text-muted)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  {seqCopied ? 'Copied!' : 'Copy FASTA'}
                </button>
              </div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.9,
                wordBreak: 'break-all', color: 'var(--text)',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '10px 12px',
                maxHeight: 140, overflowY: 'auto',
              }}>
                {protein.protein_sequence.match(/.{1,10}/g)?.join(' ')}
              </div>
            </>
          )}

          {/* External links */}
          <div style={SECTION}>{t('search.panel.externalDatabases')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', paddingBottom: 24 }}>
            {links.map(({ label, href, fav }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 12, color: 'var(--accent)', textDecoration: 'none',
              }}>
                <img src={fav} width={14} height={14} alt="" style={{ borderRadius: 2, flexShrink: 0 }} />
                {label}
              </a>
            ))}
          </div>
        </div>

        {/* ── Right: 3D structure ── */}
        <div className="psp-right">
          <div style={{ ...SECTION, marginTop: 0 }}>3D Structure</div>

          {uniprotId ? (
            <>
              {/* AlphaFold / PDB source toggle */}
              <div style={{
                display: 'flex', borderRadius: 6, overflow: 'hidden',
                border: '1px solid var(--border)', marginBottom: 12,
              }}>
                <button
                  type="button"
                  onClick={() => setStructureSource('alphafold')}
                  style={{
                    flex: 1, padding: '7px 0', border: 'none',
                    borderRight: '1px solid var(--border)',
                    background: structureSource === 'alphafold' ? 'var(--accent)' : 'transparent',
                    color: structureSource === 'alphafold' ? '#fff' : 'var(--text-muted)',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  AlphaFold
                </button>
                <button
                  type="button"
                  onClick={() => { if (!pdbDisabled) setStructureSource('pdb') }}
                  disabled={pdbDisabled}
                  title={pdbDisabled ? pdbTitle : undefined}
                  style={{
                    flex: 1, padding: '7px 0', border: 'none',
                    background: structureSource === 'pdb' ? 'var(--accent)' : 'transparent',
                    color: structureSource === 'pdb' ? '#fff' : 'var(--text-muted)',
                    fontSize: 12, fontWeight: 700,
                    cursor: pdbDisabled ? 'not-allowed' : 'pointer',
                    opacity: pdbDisabled ? 0.4 : 1,
                  }}
                >
                  PDB{pdbId ? ` (${pdbId})` : ''}
                </button>
              </div>

              <StructureViewer
                uniprotId={uniprotId}
                source={structureSource}
                pdbId={pdbId}
                height={460}
              />

              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {structureSource === 'alphafold'
                  ? 'AlphaFold predicted structure · EBI'
                  : pdbId
                    ? `Experimental structure · RCSB PDB (${pdbId})`
                    : 'No experimental structure found in PDB.'}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
              No UniProt ID - 3D structure not available.
            </div>
          )}
        </div>

      </div>
    </>
  )
}
