import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import { useAuthStore } from '../store/authStore'
import type { SavedNetwork } from '../types/api'
import type { SearchResult } from '../types/search'

export function useSavedNetworks() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  return useQuery<SavedNetwork[]>({
    queryKey: ['networks'],
    queryFn: () => apiClient.get('/networks').then((r) => r.data),
    enabled: isLoggedIn,
    staleTime: 60 * 1000,
  })
}

/** One saved network: its stored interactions, shaped like a search result. */
export function useSavedNetwork(id: string) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  return useQuery<SearchResult & SavedNetworkDetail>({
    queryKey: ['networks', id],
    queryFn: () => apiClient.get(`/networks/${id}`).then((r) => r.data),
    enabled: isLoggedIn && !!id,
  })
}

interface SavedNetworkDetail {
  id: number
  name: string
  query: string
  score_parameter: string
  category_array: string
}

export function useSaveNetwork() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      name: string
      query: string
      score_parameter: string
      category_array: string
      tissue_expression_array: string
      interaction_ids: number[]
    }) => apiClient.post('/networks', body).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networks'] })
    },
  })
}

export function useDeleteNetwork() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient.delete(`/networks/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networks'] })
    },
  })
}
