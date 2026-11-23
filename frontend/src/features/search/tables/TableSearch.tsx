import { useId } from 'react'
import { useText } from '../../../text'

interface TableSearchProps {
  value: string
  onChange: (value: string) => void
  /** Values from the table's cells, offered as the visitor types. */
  suggestions: string[]
  /** Column names the box matches, named in its placeholder. */
  fields: string[]
  /** The table; give it width 100% so it and the box line up. */
  children: React.ReactNode
}

/**
 * A filter box over a results table, as wide as the table under it, which is
 * itself never narrower than 60% of the panel. It matches any column's text,
 * and the browser's own datalist suggests cell values as the visitor types.
 */
export function TableSearch({ value, onChange, suggestions, fields, children }: TableSearchProps) {
  const t = useText()
  const listId = useId()
  const placeholder = t('search.table.search', { fields: fields.join(', ') })
  return (
    <div style={{ width: 'fit-content', minWidth: '60%', maxWidth: '100%', margin: '0 auto' }}>
      <div style={{ padding: '8px 0', background: 'var(--bg)' }}>
        <input
          list={listId}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            fontSize: 13,
            padding: '5px 10px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--surface)',
            color: 'var(--text)',
          }}
        />
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      {children}
    </div>
  )
}

