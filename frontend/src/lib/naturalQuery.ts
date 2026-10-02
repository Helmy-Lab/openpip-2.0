import { TISSUE_LABELS, tissueLabel } from './tissues'

/**
 * Turn a typed phrase into a gene search plus filter settings.
 *
 * Deliberately not a language model. Every entity a biologist names in one of
 * these questions — a gene, a tissue, a dataset — is already a value in our own
 * database, so matching against those lists answers the realistic queries with
 * no dependency, no API call, no data leaving the deployment, and no capacity to
 * invent a filter nobody asked for. openPIP is software other labs install; a
 * model would become their problem too.
 *
 * The design rule that matters: this never silently reinterprets a search. What
 * it understood is returned in `applied` and shown to the user, and the filters
 * it sets are the same ones in the sidebar, so a wrong guess is visible and can
 * be switched off. What it did not understand is returned in `ignored` and said
 * out loud rather than dropped.
 */

export interface ParsedQuery {
  /** The gene term to search — what actually goes in the URL. */
  term: string
  /** Tissue keys to filter by, if any were named. */
  tissues: string[]
  /** Minimum interaction score, if a confidence was described. */
  minScore: number | null
  /** Human-readable descriptions of what was applied, for display. */
  applied: string[]
  /** Words we recognised as intent but cannot honour. */
  ignored: string[]
}

/** Words that carry no meaning for us; dropped before looking for gene names. */
const STOP_WORDS = new Set([
  'a', 'all', 'an', 'and', 'are', 'as', 'at', 'between', 'binds', 'binding',
  'by', 'find', 'for', 'from', 'get', 'in', 'interaction', 'interactions',
  'interactor', 'interactors', 'is', 'me', 'of', 'only', 'partners', 'protein',
  'proteins', 'show', 'that', 'the', 'to', 'what', 'which', 'with', 'within',
])

/** Phrases we recognise but cannot act on — better named than silently dropped. */
export const UNSUPPORTED_INTENTS: Record<string, string> = {
  'two-hybrid': 'detection method',
  'two hybrid': 'detection method',
  y2h: 'detection method',
  'pull down': 'detection method',
  'pull-down': 'detection method',
  bait: 'experimental role',
  prey: 'experimental role',
}

export const CONFIDENCE_WORDS: Record<string, number> = {
  'high confidence': 0.5,
  'high-confidence': 0.5,
  'highly confident': 0.5,
  confident: 0.5,
  reliable: 0.5,
}

/** Tissue names, longest first so "brain cerebellum" wins over "brain". */
const TISSUE_PHRASES: [string, string][] = Object.keys(TISSUE_LABELS)
  .map((key): [string, string] => [tissueLabel(key).toLowerCase(), key])
  .sort((a, b) => b[0].length - a[0].length)

/**
 * True when the input is an ordinary gene search and should be left alone.
 *
 * A comma or newline list, or a single token, is what the box has always
 * accepted. Reinterpreting those would change existing behaviour for everyone
 * who is not writing a sentence.
 */
export function looksLikeGeneList(input: string): boolean {
  const trimmed = input.trim()
  if (!trimmed) return true
  if (/[,\n]/.test(trimmed)) return true
  return trimmed.split(/\s+/).length === 1
}

function extractScore(text: string): { score: number | null; rest: string; label: string | null } {
  // "score above 0.8", "score > 0.8"
  const explicit = text.match(/score\s*(?:above|over|greater than|>=?|of at least)\s*(\d*\.?\d+)/i)
  if (explicit) {
    return {
      score: parseFloat(explicit[1]),
      rest: text.replace(explicit[0], ' '),
      label: `score ≥ ${parseFloat(explicit[1])}`,
    }
  }
  for (const [phrase, value] of Object.entries(CONFIDENCE_WORDS)) {
    if (text.includes(phrase)) {
      return { score: value, rest: text.replace(phrase, ' '), label: `score ≥ ${value}` }
    }
  }
  return { score: null, rest: text, label: null }
}

function extractTissues(text: string): { keys: string[]; rest: string } {
  const keys: string[] = []
  let rest = text
  for (const [phrase, key] of TISSUE_PHRASES) {
    if (rest.includes(phrase)) {
      keys.push(key)
      rest = rest.replace(phrase, ' ')
    }
  }
  return { keys, rest }
}

/**
 * Parse a phrase into a search term and filters.
 *
 * Returns null when the input is an ordinary gene search, so callers can keep
 * their existing path rather than routing everything through here.
 */
export function parseNaturalQuery(
  input: string,
  options: { tissuesEnabled?: boolean } = {}
): ParsedQuery | null {
  if (looksLikeGeneList(input)) return null
  const tissuesEnabled = options.tissuesEnabled !== false

  const applied: string[] = []
  const ignored: string[] = []
  let working = ` ${input.toLowerCase()} `

  for (const [phrase, description] of Object.entries(UNSUPPORTED_INTENTS)) {
    if (working.includes(phrase)) {
      working = working.replace(phrase, ' ')
      if (!ignored.includes(description)) ignored.push(description)
    }
  }

  // A deployment whose organism has no tissues hides the filter, so the phrase
  // search must not offer one either — it would apply a filter with no visible
  // control and no way to undo it.
  const tissue = tissuesEnabled
    ? extractTissues(working)
    : { keys: [] as string[], rest: working }
  working = tissue.rest
  if (tissue.keys.length) {
    applied.push(`expressed in ${tissue.keys.map(tissueLabel).join(' and ')}`)
  }

  const score = extractScore(working)
  working = score.rest
  if (score.label) applied.push(score.label)

  // Whatever survives, minus filler, is what the user is searching for. Case is
  // restored from the original input so gene symbols stay recognisable.
  const original = input.split(/[\s,]+/).filter(Boolean)
  const remaining = working
    .split(/[\s,]+/)
    .filter((word) => word && !STOP_WORDS.has(word))
    .map((word) => original.find((o) => o.toLowerCase() === word) ?? word)

  const term = remaining.join(', ')
  return { term, tissues: tissue.keys, minScore: score.score, applied, ignored }
}

/**
 * What the box understands, described for the admin help panel.
 *
 * Generated from the same constants the parser uses, so the documentation
 * cannot claim a capability that was renamed or removed. Anything hand-written
 * here would drift the first time the vocabulary changed.
 */
export function supportedPatterns() {
  return {
    genes: {
      title: 'Gene names',
      examples: ['TP53', 'TP53, MDM2'],
      note: 'A single gene, or a list separated by commas, spaces, or newlines.',
    },
    tissues: {
      title: 'A tissue',
      examples: ['BCL2 in liver', 'what binds CDK2 in testis'],
      note: `Any of the ${Object.keys(TISSUE_LABELS).length} tissues openPIP holds expression data for. Typing part of a name offers the rest.`,
      values: Object.keys(TISSUE_LABELS).map(tissueLabel),
    },
    confidence: {
      title: 'A confidence threshold',
      examples: ['TP53 with high confidence', 'BCL2 with score above 0.8'],
      note: `Either an explicit score, or one of: ${Object.keys(CONFIDENCE_WORDS).join(', ')}.`,
    },
  }
}

/** Intents the box recognises but cannot honour, with what each would need. */
export function unsupportedPatterns(): string[] {
  return [...new Set(Object.values(UNSUPPORTED_INTENTS))]
}
