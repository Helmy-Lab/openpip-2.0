import type { EnrichmentSource } from '../../../api/enrichment'
import { ENRICHMENT_SOURCE_INFO } from './sources'

/**
 * Attribution footer shown under every data tab whose source is not the
 * openPIP interaction database itself. Resource names link to the resource
 * homepage (stable), with the primary citation as plain text.
 * Provenance notes live in `sources.ts`.
 */
export function SourceNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border)',
        fontSize: 11,
        color: 'var(--text-soft)',
        lineHeight: 1.5,
        background: 'var(--bg)',
      }}
    >
      {children}
    </div>
  )
}

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
      {children}
    </a>
  )
}

/**
 * Tissue expression is GTEx-derived, not HPA. The tab credited the Human
 * Protein Atlas until 2026-08; the tissue vocabulary was always GTEx.
 *
 * The release is GTEx v6.0, processed with YARN (Paulson et al., BMC
 * Bioinformatics 2017) and inherited from HuRI. That is why there are 36 tissues
 * rather than GTEx's 54, and why brain appears as three clusters — YARN merged
 * the subregions by PCoA into basal ganglia / cerebellum / other. Traced from
 * the HuRI portal's About page, since neither codebase records it.
 *
 * The values are qsmooth-normalized, so the >= 5.0 threshold is NOT convertible
 * to TPM — do not describe it in TPM terms. Whether a log2 step followed qsmooth
 * is the one part still unconfirmed, which is why the note states the threshold
 * without interpreting it. See docs/project/DATA_PROVENANCE_QUESTIONS.md.
 */
export function GtexSourceNote() {
  return (
    <SourceNote>
      Data source: <Ext href="https://gtexportal.org">GTEx v6.0</Ext> (GTEx Consortium),
      normalized with YARN (Paulson et al., <i>BMC Bioinformatics</i> 2017) as distributed
      with <Ext href="https://interactome-atlas.org">HuRI</Ext> (Luck et al., <i>Nature</i>{' '}
      2020). Covers 36 tissues, with brain regions grouped into three clusters. Proteins are
      listed for a tissue at a qsmooth-normalized expression level &ge; 5.0.
    </SourceNote>
  )
}

export function HpaSourceNote() {
  return (
    <SourceNote>
      Data source: <Ext href="https://www.proteinatlas.org">Human Protein Atlas</Ext> Cell
      Atlas (Thul et al., <i>Science</i> 2017). Reliability scores are assigned by HPA.
    </SourceNote>
  )
}

export function EnrichmentSourceNote({ source }: { source: EnrichmentSource }) {
  const info = ENRICHMENT_SOURCE_INFO[source]
  return (
    <SourceNote>
      Terms from <Ext href={info.href}>{info.name}</Ext> ({info.citation}); enrichment
      computed with <Ext href="https://biit.cs.ut.ee/gprofiler">g:Profiler</Ext> (Raudvere
      et al., <i>NAR</i> 2019), p-values FDR-corrected at 0.05.
    </SourceNote>
  )
}
