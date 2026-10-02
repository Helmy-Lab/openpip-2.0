import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import type { DatasetRef, PublicationStatus } from '../types/api'

export interface InteractionCategory {
  id: number
  category_name: string
  order: string
}

export interface DatasetPreviewResult {
  dry_run: boolean
  rows_sampled: number | null
  proteins_created: number
  proteins_existing: number
  interactions_created: number
  interactions_skipped: number
  errors: { row: number; reason: string }[]
}

export function useInteractionCategories() {
  return useQuery<InteractionCategory[]>({
    // Not the admin list's key: that endpoint returns camelCase fields, and a
    // shared key let whichever loaded first be shown here with blank names.
    // The prefix still matches, so the admin mutations' invalidation reaches it.
    queryKey: ['interaction-categories', 'public'],
    queryFn: () => apiClient.get('/interactions/categories').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  })
}

export function useDatasetPreview() {
  return useMutation<DatasetPreviewResult, Error, FormData>({
    mutationFn: (formData) =>
      apiClient
        .post('/datasets/preview', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((r) => r.data),
  })
}

export function useDatasetDelete() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: (id) => apiClient.delete(`/datasets/${id}`).then(() => {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] })
      queryClient.invalidateQueries({ queryKey: ['counts'] })
    },
  })
}

export function useDatasetUpload() {
  const queryClient = useQueryClient()
  return useMutation<DatasetPreviewResult, Error, FormData>({
    mutationFn: (formData) =>
      apiClient
        .post('/datasets/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] })
      queryClient.invalidateQueries({ queryKey: ['counts'] })
    },
  })
}

/** The citation and About-page fields an admin can edit on a dataset. */
export interface DatasetEditable {
  description?: string
  pubmed_id?: string
  author?: string
  year?: string
  title?: string
  journal?: string
  doi?: string
  url?: string
  publication_status?: PublicationStatus
  about_heading?: string
  about_body?: string
  show_on_about?: boolean
  about_order?: number
}

/**
 * Edit a dataset that has already been imported.
 *
 * The upload wizard can only capture citation details for new imports, so this
 * is the only route by which datasets loaded before citations existed can get
 * one — or by which a wrong reference gets corrected.
 */
export function useDatasetUpdate() {
  const queryClient = useQueryClient()
  return useMutation<DatasetRef, Error, { id: number; patch: DatasetEditable }>({
    mutationFn: ({ id, patch }) =>
      apiClient.patch(`/datasets/${id}`, patch).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] })
    },
  })
}

export interface CitationLookupResult {
  pubmed_id: string | null
  doi: string | null
  title: string | null
  journal: string | null
  year: string | null
  author: string | null
  url: string | null
}

/** Resolve a PubMed ID or DOI into citation fields for the admin to review. */
export function useCitationLookup() {
  return useMutation<CitationLookupResult, Error, { pubmed_id?: string; doi?: string }>({
    mutationFn: (params) =>
      apiClient
        .get('/datasets/citation-lookup', { params })
        .then((r) => r.data),
  })
}
