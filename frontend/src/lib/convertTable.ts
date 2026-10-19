// Rewrites someone's own tab-separated interaction table (e.g. FlyBI's
// fbgn1/gene1/fbgn2/gene2/...) as PSI-MI TAB, the layout upload_parser.py reads.
// Every column is kept: the ones mapped to a MITAB field go there, the rest go
// to column 28 as "header:value" interaction annotations.

export type ColumnTarget = 'a' | 'b' | 'alias_a' | 'alias_b' | 'taxon_a' | 'taxon_b' | 'score' | 'annotation'

// 0-based MITAB column each target writes to.
const TARGET_COL: Record<Exclude<ColumnTarget, 'annotation'>, number> = {
  a: 0,
  b: 1,
  alias_a: 4,
  alias_b: 5,
  taxon_a: 9,
  taxon_b: 10,
  score: 14,
}

const ANNOTATION_COL = 27
export const MITAB_OUT_WIDTH = ANNOTATION_COL + 1

// The parser splits annotations on "|" and a key from its value on the first
// ":", so neither may appear in a key, nor "|" in a value.
const annotationKey = (name: string) => name.replace(/[:|]/g, ' ').trim()

export function splitTable(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => l.split('\t').map((c) => c.trim()))
}

export function convertTableToMitab(
  text: string,
  targets: ColumnTarget[],
  hasHeader: boolean,
  mitabHeader: string[],
): string {
  const rows = splitTable(text)
  const header = hasHeader ? rows[0].map((c) => c.replace(/^#/, '')) : []
  const keys = targets.map((_, i) => annotationKey(header[i] ?? '') || `column_${i + 1}`)
  const out = ['#' + mitabHeader.slice(0, MITAB_OUT_WIDTH).join('\t')]

  for (const cells of hasHeader ? rows.slice(1) : rows) {
    if (cells[0]?.startsWith('#')) continue
    const row: string[] = Array(MITAB_OUT_WIDTH).fill('-')
    const annotations: string[] = []
    targets.forEach((target, i) => {
      const value = cells[i]
      if (!value || value === '-') return
      if (target === 'annotation') annotations.push(`${keys[i]}:${value.replace(/\|/g, ',')}`)
      else if (target === 'alias_a' || target === 'alias_b') row[TARGET_COL[target]] = `${value}(gene name)`
      else row[TARGET_COL[target]] = value
    })
    if (row[0] === '-' || row[1] === '-') continue
    if (annotations.length) row[ANNOTATION_COL] = annotations.join('|')
    out.push(row.join('\t'))
  }
  return out.join('\n') + '\n'
}
