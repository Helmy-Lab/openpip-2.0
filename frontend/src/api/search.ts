import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { SearchResult } from '../types/search'

export function useSearch(term: string, enabled = true) {
  return useQuery<SearchResult>({
    queryKey: ['search', term],
    queryFn: () => apiClient.get('/search', { params: { q: term } }).then((r) => r.data),
    enabled: enabled && !!term && term !== 'no_search',
    staleTime: 5 * 60 * 1000,
  })
}
