/**
 * The interaction filter attached to a homepage/sidebar search example.
 *
 * The admin_settings columns are free-text, and legacy rows spell the
 * "no filter" case as "all" (or leave it null). The stored value is spelled
 * "None" — the backend's filter parameter uses that name — so normalise to it
 * and let exampleTypeLabel handle what the screen shows.
 */
export type ExampleType = 'None' | 'query-query' | 'query-interactor'

export const EXAMPLE_TYPES: ExampleType[] = ['None', 'query-query', 'query-interactor']

export function normalizeExampleType(type: string | undefined | null): ExampleType {
  if (type === 'query-query') return 'query-query'
  if (type === 'query-interactor') return 'query-interactor'
  return 'None'
}

/**
 * How an example's filter is written on screen: "None" reads as the filter
 * dropdown's "No Filter", and everything is lowercased so it matches the shape
 * of "query-query". The stored value keeps its capital N — the backend's
 * filter parameter is spelled that way.
 */
export function exampleTypeLabel(type: string | undefined | null): string {
  const normalized = normalizeExampleType(type)
  return (normalized === 'None' ? 'No Filter' : normalized).toLowerCase()
}

export function toFilterMode(
  type: string | undefined | null,
): 'None' | 'query_query' | 'query_interactor' {
  const normalized = normalizeExampleType(type)
  if (normalized === 'None') return 'None'
  return normalized === 'query-query' ? 'query_query' : 'query_interactor'
}
