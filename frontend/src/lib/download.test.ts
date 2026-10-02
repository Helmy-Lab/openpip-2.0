import { describe, it, expect, vi } from 'vitest'
import { formatSIF, formatInteractionsCSV, formatInteractorsCSV, formatFASTA, formatPSIMI, buildFilename, saveBlob } from './download'
import type { Protein, Interaction } from '../types/api'
import { makeDatasetRef } from '../mocks/fixtures/datasetRef'

const p1: Protein = {
  protein_id: 1, protein_uniprot_id: 'Q92934', protein_ensembl_id: 'ENSG1',
  protein_entrez_id: '572', protein_gene_name: 'BAD', protein_protein_name: 'BAD protein',
  protein_description: 'Apoptosis', protein_sequence: 'MSEQ',
  number_of_interactions_in_database: 12,
  annotation_array: {}, tissue_expression_array: {}, subcellular_location_expression_array: {},
}
const p2: Protein = {
  protein_id: 2, protein_uniprot_id: 'Q07817', protein_ensembl_id: 'ENSG2',
  protein_entrez_id: '598', protein_gene_name: 'BCL2L1', protein_protein_name: 'BCL2L1 protein',
  protein_description: 'Anti-apoptosis', protein_sequence: 'MSEQ2',
  number_of_interactions_in_database: 28,
  annotation_array: {}, tissue_expression_array: {}, subcellular_location_expression_array: {},
}
const interaction: Interaction = {
  interaction_id: 1,
  interactor_A: { protein_id: 1, protein_uniprot_id: 'Q92934', protein_gene_name: 'BAD', protein_ensembl_id: 'ENSG1' },
  interactor_B: { protein_id: 2, protein_uniprot_id: 'Q07817', protein_gene_name: 'BCL2L1', protein_ensembl_id: 'ENSG2' },
  score: 0.82,
  annotation_array: {}, experiment_array: [],
  dataset_array: [makeDatasetRef({ id: 1, dataset_reference: '12345', dataset_author: 'Rolland et al.(2014)', year: '2014', description: 'HuRI', interaction_status: 'Published', name: 'HuRI' })],
  interaction_category_array: { highest_category_status: 'Published', highest_order: 1, interaction_category_array: [{ category_name: 'Published', order: 1 }] },
}

describe('formatSIF', () => {
  it('produces tab-separated GeneA pp GeneB lines', () => {
    const result = formatSIF([interaction], [p1, p2])
    expect(result).toBe('BAD\tpp\tBCL2L1\n')
  })
})

describe('formatInteractionsCSV', () => {
  it('has header row with correct columns', () => {
    const result = formatInteractionsCSV([interaction], [p1, p2])
    const lines = result.split('\n')
    expect(lines[0]).toBe(
      'UniProt A,UniProt B,Gene A,Gene B,Ensembl A,Ensembl B,Query Status A,Query Status B,Score,Category,Dataset'
    )
  })

  it('has data row with correct values', () => {
    const result = formatInteractionsCSV([interaction], [p1, p2])
    const lines = result.split('\n')
    expect(lines[1]).toBe('Q92934,Q07817,BAD,BCL2L1,ENSG1,ENSG2,non_query,non_query,0.82,Published,Rolland et al.(2014)')
  })

  it('marks interactor A as query when its id is in queryProteinIds', () => {
    const result = formatInteractionsCSV([interaction], [p1, p2], new Set([1]))
    const cols = result.split('\n')[1].split(',')
    expect(cols[6]).toBe('query')
    expect(cols[7]).toBe('non_query')
  })

  it('joins multiple datasets with semicolon', () => {
    const multiDataset: typeof interaction = {
      ...interaction,
      dataset_array: [
        makeDatasetRef({ id: 1, dataset_reference: '12345', dataset_author: 'Rolland et al.(2014)', year: '2014', description: 'HuRI', interaction_status: 'Published', name: 'HuRI' }),
        makeDatasetRef({ id: 2, dataset_reference: '67890', dataset_author: 'Luck et al.(2020)', year: '2020', description: 'HuRI2', interaction_status: 'Published', name: 'HuRI2' }),
      ],
    }
    const result = formatInteractionsCSV([multiDataset], [p1, p2])
    const cols = result.split('\n')[1].split(',')
    expect(cols[10]).toBe('Rolland et al.(2014);Luck et al.(2020)')
  })
})

describe('formatInteractorsCSV', () => {
  it('has header row', () => {
    const result = formatInteractorsCSV([p1])
    const lines = result.split('\n')
    expect(lines[0]).toBe('Gene Name,UniProt ID,Ensembl ID,Entrez ID,Number of Interactions')
  })

  it('has data row with correct values', () => {
    const result = formatInteractorsCSV([p1])
    const lines = result.split('\n')
    expect(lines[1]).toBe('BAD,Q92934,ENSG1,572,12')
  })
})

describe('formatFASTA', () => {
  it('produces correct FASTA format', () => {
    const result = formatFASTA([p1])
    expect(result).toBe('>BAD|Q92934\nMSEQ\n')
  })

  it('includes all proteins passed in - both query and interactors', () => {
    const result = formatFASTA([p1, p2])
    expect(result).toContain('>BAD|Q92934')
    expect(result).toContain('>BCL2L1|Q07817')
  })

  it('skips proteins with no sequence', () => {
    const noSeq: Protein = { ...p1, protein_sequence: '' }
    const result = formatFASTA([noSeq, p2])
    expect(result).not.toContain('BAD')
    expect(result).toContain('>BCL2L1|Q07817')
  })
})

/** The export now leads with "#" citation comments; rows start after them. */
function psimiRows(result: string): string[] {
  return result.split('\n').filter((line) => line && !line.startsWith('#'))
}

describe('formatPSIMI', () => {
  it('puts uniprotkb-prefixed IDs in col 0 and 1', () => {
    const result = formatPSIMI([interaction], [p1, p2])
    const cols = psimiRows(result)[0].split('\t')
    expect(cols[0]).toBe('uniprotkb:Q92934')
    expect(cols[1]).toBe('uniprotkb:Q07817')
  })

  it('puts gene names with uniprotkb prefix in col 4 and 5', () => {
    const result = formatPSIMI([interaction], [p1, p2])
    const cols = psimiRows(result)[0].split('\t')
    expect(cols[4]).toBe('uniprotkb:BAD(gene name)')
    expect(cols[5]).toBe('uniprotkb:BCL2L1(gene name)')
  })

  it('puts score in col 14', () => {
    const result = formatPSIMI([interaction], [p1, p2])
    const cols = psimiRows(result)[0].split('\t')
    expect(cols[14]).toBe('0.82')
  })

  it('produces exactly 42 columns', () => {
    const result = formatPSIMI([interaction], [p1, p2])
    const cols = psimiRows(result)[0].split('\t')
    expect(cols).toHaveLength(42)
  })

  it('fills unused columns with dashes', () => {
    const result = formatPSIMI([interaction], [p1, p2])
    const cols = psimiRows(result)[0].split('\t')
    expect(cols[2]).toBe('-')
    expect(cols[3]).toBe('-')
    expect(cols[6]).toBe('-')
    expect(cols[41]).toBe('-')
  })
})

describe('buildFilename', () => {
  it('starts with openPIP_download_', () => {
    const name = buildFilename('SIF', 'sif')
    expect(name).toMatch(/^openPIP_download_SIF_/)
    expect(name).toMatch(/\.sif$/)
  })
})

describe('formatPSIMI citation header', () => {
  it('names the source datasets in leading comment lines', () => {
    const result = formatPSIMI([interaction], [p1, p2])
    const header = result.split('\n').filter((l) => l.startsWith('#'))
    expect(header[0]).toContain('please cite the original publications')
    expect(header.join('\n')).toContain('HuRI')
  })

  it('puts author-year and PubMed ID in the publication columns', () => {
    const cited = {
      ...interaction,
      dataset_array: [
        makeDatasetRef({
          id: 1,
          name: 'HuRI',
          author: 'Luck et al.',
          year: '2020',
          pubmed_id: '32296183',
        }),
      ],
    }
    const cols = psimiRows(formatPSIMI([cited], [p1, p2]))[0].split('\t')
    expect(cols[7]).toBe('Luck-2020')
    expect(cols[8]).toBe('pubmed:32296183')
  })

  it('still produces 42 columns with the header present', () => {
    const rows = psimiRows(formatPSIMI([interaction], [p1, p2]))
    expect(rows[0].split('\t')).toHaveLength(42)
  })
})

describe('saveBlob', () => {
  it('clicks an attached link and frees the URL only afterwards', async () => {
    vi.useFakeTimers()
    const created = vi.fn(() => 'blob:x')
    const revoked = vi.fn()
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked })
    let attachedWhenClicked = false
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      attachedWhenClicked = document.body.contains(this)
    })

    saveBlob(new Blob(['x']), 'f.txt')

    expect(attachedWhenClicked).toBe(true)
    expect(revoked).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revoked).toHaveBeenCalledWith('blob:x')
    click.mockRestore()
    vi.useRealTimers()
  })
})
