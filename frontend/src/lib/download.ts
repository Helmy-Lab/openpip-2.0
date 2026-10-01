import type { Protein, Interaction } from '../types/api'
import { citationHeaderLines, tabAuthorYear } from './citation'

function getProteinMap(proteins: Protein[]): Map<number, Protein> {
  return new Map(proteins.map((p) => [p.protein_id, p]))
}

export function formatSIF(interactions: Interaction[], proteins: Protein[]): string {
  const pm = getProteinMap(proteins)
  return interactions
    .map((i) => {
      const geneA = pm.get(i.interactor_A.protein_id)?.protein_gene_name ?? i.interactor_A.protein_gene_name
      const geneB = pm.get(i.interactor_B.protein_id)?.protein_gene_name ?? i.interactor_B.protein_gene_name
      return `${geneA}\tpp\t${geneB}`
    })
    .join('\n') + '\n'
}

export function formatInteractionsCSV(
  interactions: Interaction[],
  proteins: Protein[],
  queryProteinIds: Set<number> = new Set()
): string {
  const pm = getProteinMap(proteins)
  const header =
    'UniProt A,UniProt B,Gene A,Gene B,Ensembl A,Ensembl B,Query Status A,Query Status B,Score,Category,Dataset'
  const rows = interactions.map((i) => {
    const pA = pm.get(i.interactor_A.protein_id)
    const pB = pm.get(i.interactor_B.protein_id)
    const dataset = i.dataset_array.map((d) => d.dataset_author).join(';')
    const queryStatusA = queryProteinIds.has(i.interactor_A.protein_id) ? 'query' : 'non_query'
    const queryStatusB = queryProteinIds.has(i.interactor_B.protein_id) ? 'query' : 'non_query'
    return [
      i.interactor_A.protein_uniprot_id,
      i.interactor_B.protein_uniprot_id,
      pA?.protein_gene_name ?? i.interactor_A.protein_gene_name,
      pB?.protein_gene_name ?? i.interactor_B.protein_gene_name,
      pA?.protein_ensembl_id ?? i.interactor_A.protein_ensembl_id,
      pB?.protein_ensembl_id ?? i.interactor_B.protein_ensembl_id,
      queryStatusA,
      queryStatusB,
      i.score ?? '',
      i.interaction_category_array.highest_category_status,
      dataset,
    ].join(',')
  })
  return [header, ...rows].join('\n')
}

export function formatInteractorsCSV(proteins: Protein[]): string {
  const header = 'Gene Name,UniProt ID,Ensembl ID,Entrez ID,Number of Interactions'
  const rows = proteins.map((p) =>
    [p.protein_gene_name, p.protein_uniprot_id, p.protein_ensembl_id, p.protein_entrez_id, p.number_of_interactions_in_database].join(',')
  )
  return [header, ...rows].join('\n')
}

export function formatFASTA(proteins: Protein[]): string {
  return proteins
    .filter((p) => p.protein_sequence)
    .map((p) => `>${p.protein_gene_name}|${p.protein_uniprot_id}\n${p.protein_sequence}\n`)
    .join('')
}

export function formatPSIMI(interactions: Interaction[], proteins: Protein[]): string {
  const pm = getProteinMap(proteins)
  const cols42 = Array(42).fill('-')
  const rows = interactions.map((i) => {
    const pA = pm.get(i.interactor_A.protein_id)
    const pB = pm.get(i.interactor_B.protein_id)
    const row = [...cols42]
    row[0] = `uniprotkb:${i.interactor_A.protein_uniprot_id}`
    row[1] = `uniprotkb:${i.interactor_B.protein_uniprot_id}`
    row[4] = pA?.protein_gene_name ? `uniprotkb:${pA.protein_gene_name}(gene name)` : '-'
    row[5] = pB?.protein_gene_name ? `uniprotkb:${pB.protein_gene_name}(gene name)` : '-'
    // Cols 8 and 9 are the publication columns; they were left as "-" before
    // datasets carried citation details.
    const source = i.dataset_array?.[0]
    if (source) {
      row[7] = tabAuthorYear(source)
      row[8] = source.pubmed_id ? `pubmed:${source.pubmed_id}` : '-'
    }
    row[14] = i.score != null ? `${i.score}` : '-'
    return row.join('\t')
  })

  // Leading "#" comments are legal in PSI-MI TAB and are skipped by our own
  // upload parser, so an exported file can be re-imported unchanged.
  const header = citationHeaderLines(interactions.flatMap((i) => i.dataset_array ?? []))
  return [...header, ...rows].join('\n') + '\n'
}

export function buildFilename(format: string, ext: string): string {
  const now = new Date()
  const month = now.toLocaleString('default', { month: 'long' })
  const day = now.getDate()
  const year = now.getFullYear()
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  return `openPIP_download_${format}_${month}_${day}_${year}_${time}.${ext}`
}

export function downloadFile(filename: string, content: string): void {
  const a = document.createElement('a')
  a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function downloadImageFile(cy: any, format: 'png' | 'jpg', bg = '#ffffff'): void {
  const dataUri: string =
    format === 'png'
      ? cy.png({ output: 'base64uri', scale: 2, bg })
      : cy.jpg({ output: 'base64uri', scale: 2, quality: 0.92, bg })
  const a = document.createElement('a')
  a.href = dataUri
  a.download = buildFilename(format.toUpperCase(), format)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
