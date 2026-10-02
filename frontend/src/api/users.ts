import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'

/** The slice of a profile other users can see. */
export interface UserCard {
  username: string
  name: string
  affiliation: string
  avatar: string | null
}

export interface PublicProfile extends UserCard {
  position: string
  website: string
  bio: string
  joined: string
}

/** Name, username, lab, or exact email. The backend ignores anything shorter
 * than two characters, so the query stays disabled until then. */
export function useUserSearch(q: string) {
  const term = q.trim()
  return useQuery({
    queryKey: ['userSearch', term],
    queryFn: () =>
      apiClient.get('/users/search', { params: { q: term } }).then((r) => r.data as UserCard[]),
    enabled: term.length >= 2,
    staleTime: 30 * 1000,
  })
}

export function usePublicProfile(username: string) {
  return useQuery({
    queryKey: ['publicProfile', username],
    queryFn: () => apiClient.get(`/users/${username}`).then((r) => r.data as PublicProfile),
    enabled: !!username,
    staleTime: 5 * 60 * 1000,
  })
}
