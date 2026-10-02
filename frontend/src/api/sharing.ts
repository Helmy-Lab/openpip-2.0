import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import { useAuthStore } from '../store/authStore'
import type { UserCard } from './users'
import type { ViewState } from '../features/search/searchStore'

export interface SavedView {
  id: number
  name: string
  query: string
  state: Partial<ViewState>
  /** The owner's own notes. Only on your own views — a share leaves it out. */
  note?: string
  /** Set while the no-login public link is on; null once revoked. */
  public_token?: string | null
  created_at: string
  updated_at: string
}

/** What a no-login visitor gets from a public link. */
export interface PublicView {
  name: string
  query: string
  state: Partial<ViewState>
}

export interface Share {
  id: number
  saved_view: SavedView
  sender: UserCard
  recipient: UserCard
  note: string
  created_at: string
}

export interface ShareComment {
  id: number
  author: UserCard
  body: string
  created_at: string
  edited: boolean
}

export interface Notification {
  id: number
  text: string
  link: string
  read: boolean
  created_at: string
}

export function useSavedViews() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  return useQuery({
    queryKey: ['savedViews'],
    queryFn: () => apiClient.get('/saved-views/').then((r) => r.data as SavedView[]),
    enabled: isLoggedIn,
  })
}

export function useCreateSavedView() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; query: string; state: Partial<ViewState> }) =>
      apiClient.post('/saved-views/', body).then((r) => r.data as SavedView),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['savedViews'] }),
  })
}

export function useUpdateSavedViewNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) =>
      apiClient.patch(`/saved-views/${id}/`, { note }).then((r) => r.data as SavedView),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['savedViews'] }),
  })
}

/** Turn the no-login link on (keeps an existing one) or off. Owner only. */
export function usePublicLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, on }: { id: number; on: boolean }) =>
      apiClient[on ? 'post' : 'delete'](`/saved-views/${id}/public-link/`).then(
        (r) => r.data as SavedView,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['savedViews'] }),
  })
}

export function usePublicView(token: string) {
  return useQuery({
    queryKey: ['publicView', token],
    queryFn: () => apiClient.get(`/public-views/${token}`).then((r) => r.data as PublicView),
    enabled: !!token,
    retry: false,
  })
}

/** The shareable address for a public token, under whatever base the app is served at. */
export function publicViewUrl(token: string): string {
  return new URL(`public/${token}`, window.location.origin + import.meta.env.BASE_URL).href
}

export function useDeleteSavedView() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/saved-views/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['savedViews'] }),
  })
}

export function useShares(direction: 'received' | 'sent' = 'received') {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  return useQuery({
    queryKey: ['shares', direction],
    queryFn: () =>
      apiClient.get('/shares/', { params: { direction } }).then((r) => r.data as Share[]),
    enabled: isLoggedIn,
  })
}

export function useShare(id: string | number) {
  return useQuery({
    queryKey: ['share', String(id)],
    queryFn: () => apiClient.get(`/shares/${id}/`).then((r) => r.data as Share),
    enabled: !!id,
    retry: false,
  })
}

export function useCreateShare() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { saved_view: number; recipient: string; note?: string }) =>
      apiClient.post('/shares/', body).then((r) => r.data as Share),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shares'] }),
  })
}

/** Revoke, if you sent it; dismiss, if you received it. */
export function useDeleteShare() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/shares/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shares'] }),
  })
}

export function useShareComments(id: string | number) {
  return useQuery({
    queryKey: ['shareComments', String(id)],
    queryFn: () => apiClient.get(`/shares/${id}/comments`).then((r) => r.data as ShareComment[]),
    enabled: !!id,
    // An open discussion is a live one — poll it like the bell.
    refetchInterval: 10 * 1000,
    refetchIntervalInBackground: true,
  })
}

/** Only your own messages, and only the text. */
export function useEditComment(id: string | number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: number; body: string }) =>
      apiClient
        .patch(`/shares/${id}/comments/${commentId}`, { body })
        .then((r) => r.data as ShareComment),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['shareComments', String(id)] }),
  })
}

export function useAddComment(id: string | number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) =>
      apiClient.post(`/shares/${id}/comments`, { body }).then((r) => r.data as ShareComment),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['shareComments', String(id)] }),
  })
}

export function useNotifications() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.get('/notifications/').then((r) => r.data as Notification[]),
    enabled: isLoggedIn,
    // ponytail: polling, not websockets. A share is not urgent enough to keep
    // a socket open per logged-in tab.
    // In background too: a second window watching for a share is exactly the
    // case that matters, and that window is by definition not the focused one.
    refetchInterval: 10 * 1000,
    refetchIntervalInBackground: true,
  })
}

export function useClearNotifications() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post('/notifications/clear/'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

/** Quiets the badge without deleting anything, unlike useClearNotifications. */
export function useMarkAllRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post('/notifications/mark-all-read/'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient.patch(`/notifications/${id}/`, { read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
