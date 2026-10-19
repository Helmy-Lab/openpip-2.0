import type { AdminSettings } from '../../../types/api'

/** Build an NCBI Gene URL for a gene. Prefers a direct Entrez Gene record when
 * the numeric ID is known; otherwise falls back to an NCBI Gene symbol search. */
export function ncbiGeneUrl(entrezId: string | undefined, symbol: string): string {
  if (entrezId && entrezId.trim()) {
    return `https://www.ncbi.nlm.nih.gov/gene/${entrezId.trim()}`
  }
  return `https://www.ncbi.nlm.nih.gov/gene/?term=${encodeURIComponent(symbol)}%5Bsym%5D`
}

/** The identifiers a result-table row knows about its protein. */
export interface ProteinIds {
  gene: string
  uniprot?: string
  entrez?: string
  ensembl?: string
}

/**
 * Where a gene name in the search result tables links to, per the admin's
 * `proteinLinkTarget` setting. `internal` means a router path in this app.
 */
export function proteinLink(
  ids: ProteinIds,
  settings?: Pick<AdminSettings, 'proteinLinkTarget' | 'proteinLinkTemplate'>,
): { href: string; internal: boolean } {
  const target = settings?.proteinLinkTarget
  if (target === 'protein_page') {
    return { href: `/proteins/${encodeURIComponent(ids.uniprot || ids.gene)}`, internal: true }
  }
  const template = settings?.proteinLinkTemplate
  // The server only stores http(s) templates; re-check so a bad value can
  // never become a javascript: href.
  if (target === 'custom' && template && /^https?:\/\//i.test(template)) {
    const href = template.replace(/\{(gene|uniprot|entrez|ensembl)\}/g, (_, key: keyof ProteinIds) =>
      encodeURIComponent(ids[key]?.trim() ?? ''),
    )
    return { href, internal: false }
  }
  return { href: ncbiGeneUrl(ids.entrez, ids.gene), internal: false }
}
