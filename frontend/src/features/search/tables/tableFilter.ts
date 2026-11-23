/** Rows whose text contains the query, case-insensitively; all rows for none. */
export function matchRows<T>(rows: T[], query: string, text: (row: T) => string[]): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((row) => text(row).some((v) => v.toLowerCase().includes(q)))
}

/** Distinct cell values, sorted, for the box to suggest. */
export function suggestionsFrom(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort()
}
