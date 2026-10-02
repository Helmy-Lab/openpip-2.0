import { useState } from 'react'
import { useAutocomplete } from '../api/proteins'

interface TokenOptions {
  /** Candidate completions for the token being typed. */
  suggestions: string[]
  /** What separates tokens: commas/spaces for a gene list, ' ' for a phrase. */
  separator: string | RegExp
  /** Rendered between tokens when a suggestion is accepted. */
  joiner: string
}

/**
 * Token-aware autocomplete: completes the last token and leaves earlier ones
 * intact, with keyboard navigation and a mouse-select that keeps input focus
 * (onMouseDown + preventDefault, so no blur). Pair with <GeneSuggestionList/>.
 *
 * Separated from the gene-specific wrapper below because the hero also
 * completes tissue names inside a typed phrase, and duplicating arrow-key and
 * focus handling for that would be two implementations to keep in step.
 */
export function useTokenAutocomplete(
  value: string,
  onChange: (v: string) => void,
  idPrefix: string,
  { suggestions, separator, joiner }: TokenOptions
) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const tokens = value.split(separator)
  const activeToken = (tokens[tokens.length - 1] ?? '').trim()
  const showList = showSuggestions && activeToken.length >= 2 && suggestions.length > 0

  const selectSuggestion = (v: string) => {
    const head = tokens
      .slice(0, -1)
      .map((t) => t.trim())
      .filter(Boolean)
    onChange([...head, v].join(joiner))
    setShowSuggestions(false)
    setActiveIndex(-1)
  }

  const inputProps = {
    role: 'combobox' as const,
    'aria-autocomplete': 'list' as const,
    'aria-expanded': showList,
    'aria-controls': `${idPrefix}-list`,
    'aria-activedescendant': activeIndex >= 0 ? `${idPrefix}-option-${activeIndex}` : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(e.target.value)
      setShowSuggestions(true)
      setActiveIndex(-1)
    },
    onFocus: () => setShowSuggestions(true),
    onBlur: () => window.setTimeout(() => setShowSuggestions(false), 120),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!showList) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault()
        selectSuggestion(suggestions[activeIndex])
      } else if (e.key === 'Escape') {
        setShowSuggestions(false)
        setActiveIndex(-1)
      }
    },
  }

  return { showList, suggestions, activeIndex, setActiveIndex, selectSuggestion, inputProps }
}

/** Same separators the backend splits a gene query on. */
const GENE_SEPARATOR = /[,\s]+/

/**
 * Gene-list autocomplete for the hero and the search sidebar: several genes
 * separated by commas, spaces, or newlines, completing the one after the last
 * separator.
 */
export function useGeneAutocomplete(
  value: string,
  onChange: (v: string) => void,
  idPrefix: string
) {
  const tokens = value.split(GENE_SEPARATOR)
  const activeToken = (tokens[tokens.length - 1] ?? '').trim()
  const chosen = tokens.slice(0, -1).map((t) => t.trim().toLowerCase())
  const { data: raw = [] } = useAutocomplete(activeToken)
  const suggestions = raw.filter((s) => !chosen.includes(s.toLowerCase()))

  return useTokenAutocomplete(value, onChange, idPrefix, {
    suggestions,
    separator: GENE_SEPARATOR,
    joiner: ', ',
  })
}
