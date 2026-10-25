import { describe, it, expect } from 'vitest'
import { candidatePairs, convertTableToMitab, MITAB_OUT_WIDTH, nameRank } from './convertTable'
import type { ColumnTarget } from './convertTable'

const HEADER = Array.from({ length: 46 }, (_, i) => `c${i + 1}`)

describe('convertTableToMitab', () => {
  it('maps chosen columns, keeps the rest as annotations, skips rows without A or B', () => {
    const text =
      'fbgn1\tgene1\tgene2\tdirection\tassays\n' +
      'FBgn1\t14-3-3zeta\tSC35\tad->db\tassay 1,assay|3\n' +
      'FBgn2\t\tsinah\tad->db\tassay 1\n'
    const out = convertTableToMitab(text, ['annotation', 'a', 'b', 'annotation', 'annotation'], true, HEADER)
    const [header, row, ...rest] = out.trim().split('\n')

    expect(header.split('\t')).toHaveLength(MITAB_OUT_WIDTH)
    expect(rest).toHaveLength(0)
    const cols = row.split('\t')
    expect(cols).toHaveLength(MITAB_OUT_WIDTH)
    expect(cols[0]).toBe('14-3-3zeta')
    expect(cols[1]).toBe('SC35')
    expect(cols[27]).toBe('fbgn1:FBgn1|direction:ad->db|assays:assay 1,assay,3')
  })

  it('writes gene name aliases in the form the parser reads', () => {
    const out = convertTableToMitab('P1\tP2\tTP53\n', ['a', 'b', 'alias_a'], false, HEADER)
    expect(out.trim().split('\n')[1].split('\t')[4]).toBe('TP53(gene name)')
  })

  it('fills a file-wide organism where no column gives one', () => {
    const text = 'Act42A\tSC35\t-\ttaxid:9606(human)\n'
    const targets: ColumnTarget[] = ['a', 'b', 'taxon_a', 'taxon_b']
    const out = convertTableToMitab(text, targets, false, HEADER, 'taxid:7227(fruit fly)')
    const cols = out.trim().split('\n')[1].split('\t')
    expect(cols[9]).toBe('taxid:7227(fruit fly)')
    expect(cols[10]).toBe('taxid:9606(human)')
  })
})

describe('candidatePairs', () => {
  it('finds 1/2, a/b and bait/prey pairs with the A side first', () => {
    const flybi = ['fbgn1 r645', 'gene1 r645', 'fbgn2 r645', 'gene2 r645', 'direction', 'screens', 'assays']
    expect(candidatePairs(flybi)).toEqual([
      [0, 2],
      [1, 3],
    ])
    expect(candidatePairs(['Protein_B', 'score', 'Protein_A'])).toEqual([[2, 0]])
    expect(candidatePairs(['bait_id', 'prey_id'])).toEqual([[0, 1]])
    expect(candidatePairs(['direction', 'screens'])).toEqual([])
  })

  it('ranks gene symbols above other identifier columns', () => {
    expect(nameRank('gene1 r645')).toBeLessThan(nameRank('fbgn1 r645'))
  })
})
