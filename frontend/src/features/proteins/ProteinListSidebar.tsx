import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProteinListParams, ProteinListRow, ProteinOrdering } from '../../api/proteins'
import { useProteinList } from '../../api/proteins'
import { useText } from '../../text'

const STYLES = `
  .pls-row {
    display: block; width: 100%; text-align: left;
    padding: 9px 14px; border: none;
    background: transparent; cursor: pointer; font: inherit;
    border-bottom: 1px solid var(--border);
    transition: background .12s var(--ease-out-quart);
  }
  .pls-row:hover { background: var(--surface-2); }
  /* Selection reads as a tinted surface plus a weight shift, so it survives
     both themes without a coloured edge stripe. */
  .pls-row[aria-selected='true'] { background: var(--primary-soft); }
  .pls-row[aria-selected='true'] .pls-gene { color: var(--primary-deep); font-weight: 700; }
  .pls-row:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }

  .pls-gene { font-size: 13px; font-weight: 600; color: var(--text); font-family: var(--mono); }
`

const ORDERING_OPTIONS: { value: ProteinOrdering; label: string }[] = [
  { value: 'gene', label: 'Gene name (A→Z)' },
  { value: '-gene', label: 'Gene name (Z→A)' },
  { value: '-interactions', label: 'Most interactions' },
  { value: 'interactions', label: 'Fewest interactions' },
]

const FILTERS: { key: keyof ProteinListParams; label: string; title: string }[] = [
  {
    key: 'hasInteractions',
    label: 'Has interactions',
    title: 'Only proteins with at least one interaction in the database',
  },
  {
    key: 'hasStructure',
    label: 'Has UniProt accession',
    title: 'Only proteins with a UniProt accession, which an AlphaFold model requires',
  },
  {
    key: 'hasSequence',
    label: 'Has sequence',
    title: 'Only proteins with a stored amino-acid sequence',
  },
  {
    key: 'includeEmpty',
    label: 'Include unnamed entries',
    title: 'Also show bare UniProt accessions with no gene name or interactions',
  },
]

export interface ProteinListSidebarProps {
  query: string
  onQueryChange: (query: string) => void
  selectedIdentifier: string
  onSelect: (row: ProteinListRow) => void
}

export function ProteinListSidebar({
  query,
  onQueryChange,
  selectedIdentifier,
  onSelect,
}: ProteinListSidebarProps) {
  const t = useText()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const [ordering, setOrdering] = useState<ProteinOrdering>('gene')
  const [filters, setFilters] = useState<Partial<ProteinListParams>>({})
  const [debouncedQuery, setDebouncedQuery] = useState(query)
  const [activeIndex, setActiveIndex] = useState(-1)

  // Debounce so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250)
    return () => clearTimeout(timer)
  }, [query])

  const params = useMemo<ProteinListParams>(
    () => ({ q: debouncedQuery, ordering, ...filters }),
    [debouncedQuery, ordering, filters]
  )

  // A new result set invalidates whatever row the keyboard cursor was on
  // (render-phase reset rather than an effect, so there is no extra paint).
  const paramsKey = JSON.stringify(params)
  const [prevParamsKey, setPrevParamsKey] = useState(paramsKey)
  if (paramsKey !== prevParamsKey) {
    setPrevParamsKey(paramsKey)
    setActiveIndex(-1)
  }

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useProteinList(params)

  const rows = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data]
  )
  const total = data?.pages[0]?.count ?? 0

  // Infinite scroll: pull the next page when the sentinel below the list scrolls in.
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage()
      },
      { root: listRef.current, rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, rows.length])

  // "/" focuses the search box from anywhere on the page, unless the user is
  // already typing into a field.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== '/' || event.metaKey || event.ctrlKey) return
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      event.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const moveActive = (delta: number) => {
    if (rows.length === 0) return
    setActiveIndex((current) => {
      const next = Math.min(Math.max(current + delta, 0), rows.length - 1)
      document
        .getElementById(`protein-row-${next}`)
        ?.scrollIntoView({ block: 'nearest' })
      // Near the end of the loaded rows, start pulling the next page in.
      if (next > rows.length - 10 && hasNextPage && !isFetchingNextPage) fetchNextPage()
      return next
    })
  }

  const onListKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveActive(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveActive(-1)
    } else if (event.key === 'Enter' && activeIndex >= 0 && rows[activeIndex]) {
      event.preventDefault()
      onSelect(rows[activeIndex])
    } else if (event.key === 'Escape' && query) {
      event.preventDefault()
      onQueryChange('')
    }
  }

  const toggleFilter = (key: keyof ProteinListParams) =>
    setFilters((current) => ({ ...current, [key]: !current[key] }))

  return (
    <>
      <style>{STYLES}</style>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          borderRight: '1px solid var(--border)',
          background: 'var(--surface)',
          minHeight: 0,
        }}
      >
        {/* Search + controls */}
        <div style={{ padding: 14, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              className="op-input"
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={onListKeyDown}
              placeholder={t('proteins.searchPlaceholder')}
              aria-label={t('proteins.searchLabel')}
              style={{ width: '100%', paddingRight: 34, boxSizing: 'border-box' }}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  onQueryChange('')
                  inputRef.current?.focus()
                }}
                aria-label={t('proteins.clearSearch')}
                title={t('proteins.clearSearch')}
                style={{
                  position: 'absolute',
                  right: 6,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  borderRadius: '50%',
                  width: 20,
                  height: 20,
                  lineHeight: 1,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            )}
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 10,
              fontSize: 11,
              color: 'var(--text-muted)',
            }}
          >
            {t('proteins.sortLabel')}
            <select
              className="op-input"
              value={ordering}
              onChange={(e) => setOrdering(e.target.value as ProteinOrdering)}
              style={{ flex: 1, fontSize: 12, padding: '4px 6px' }}
            >
              {ORDERING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 10 }}>
            {FILTERS.map(({ key, label, title }) => (
              <label
                key={key}
                title={title}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(filters[key])}
                  onChange={() => toggleFilter(key)}
                  style={{ margin: 0 }}
                />
                {label}
              </label>
            ))}
          </div>

          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-soft)' }}>
            {isLoading
              ? t('proteins.loadingList')
              : t('proteins.resultCount', {
                  shown: rows.length.toLocaleString(),
                  total: total.toLocaleString(),
                })}
          </div>
        </div>

        {/* Result list */}
        <div
          ref={listRef}
          role="listbox"
          tabIndex={0}
          aria-label={t('proteins.listLabel')}
          aria-activedescendant={activeIndex >= 0 ? `protein-row-${activeIndex}` : undefined}
          onKeyDown={onListKeyDown}
          style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}
        >
          {isError && (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--warn)' }}>
              {t('proteins.listError')}
            </div>
          )}

          {!isLoading && !isError && rows.length === 0 && (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>
              {t('proteins.noResults')}
            </div>
          )}

          {rows.map((row, index) => {
            const gene = row.protein_gene_name || row.protein_uniprot_id
            const isSelected =
              selectedIdentifier.toUpperCase() === gene.toUpperCase() ||
              selectedIdentifier.toUpperCase() === row.protein_uniprot_id.toUpperCase()
            return (
              <button
                key={row.protein_id}
                id={`protein-row-${index}`}
                role="option"
                type="button"
                aria-selected={isSelected}
                className="pls-row"
                onClick={() => {
                  setActiveIndex(index)
                  onSelect(row)
                }}
                style={
                  index === activeIndex && !isSelected
                    ? { background: 'var(--surface-2)' }
                    : undefined
                }
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span className="pls-gene">{gene || '—'}</span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 11,
                      color: 'var(--text-soft)',
                      flexShrink: 0,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                    title={t('proteins.interactionsTitle')}
                  >
                    {row.number_of_interactions_in_database.toLocaleString()}
                  </span>
                </div>
                {row.protein_protein_name && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.protein_protein_name}
                  </div>
                )}
              </button>
            )
          })}

          <div ref={sentinelRef} style={{ height: 1 }} />

          {isFetchingNextPage && (
            <div
              style={{
                padding: 12,
                fontSize: 12,
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              {t('proteins.loadingMore')}
            </div>
          )}
        </div>

        <div
          style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--border)',
            fontSize: 10,
            color: 'var(--text-soft)',
            flexShrink: 0,
          }}
        >
          {t('proteins.keyboardHint')}
        </div>
      </div>
    </>
  )
}
