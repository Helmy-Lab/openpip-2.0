import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import { useAuthStore } from '../store/authStore'

export function useLogin() {
  const login = useAuthStore((s) => s.login)
  return useMutation({
    mutationFn: (body: { username: string; password: string }) =>
      apiClient.post('/auth/login', body).then((r) => r.data),
    onSuccess: (data) => login(data.access, data.refresh, data.is_admin),
  })
}

export function useLogout() {
  const { logout, refreshToken } = useAuthStore()
  return useMutation({
    mutationFn: () =>
      apiClient.post('/auth/logout', { refresh: refreshToken }).then((r) => r.data),
    onSettled: () => logout(),
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: (body: {
      username: string
      email: string
      password: string
      security_questions: { question: string; answer: string }[]
    }) => apiClient.post('/auth/register', body).then((r) => r.data),
  })
}

export function useSecurityQuestion() {
  return useMutation({
    mutationFn: (body: { email: string }) =>
      apiClient
        .post('/auth/security-question', body)
        .then((r) => r.data as { questions: string[] }),
  })
}

export function useSecurityAnswer() {
  return useMutation({
    mutationFn: (body: { email: string; answers: string[] }) =>
      apiClient
        .post('/auth/security-answer', body)
        .then((r) => r.data as { uid: string; token: string }),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: { uid: string; token: string; password: string }) =>
      apiClient.post('/auth/password-reset-confirm', body).then((r) => r.data),
  })
}

export interface Profile {
  username: string
  email: string
  is_admin: boolean
  /** Optional display name; falls back to the username on screen. */
  name: string
  affiliation: string
  position: string
  website: string
  bio: string
  avatar: string | null
  /** Off hides you from people search and stops others sharing networks with you. */
  discoverable: boolean
}

export function useProfile() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get('/auth/me').then((r) => r.data as Profile),
    enabled: isLoggedIn,
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * Every profile detail is optional. Sent as multipart so the avatar file rides
 * along with the text fields; an empty `avatar` clears the current picture.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (changes: Partial<Omit<Profile, 'avatar'>> & { avatar?: File | '' }) => {
      const form = new FormData()
      Object.entries(changes).forEach(([key, value]) => {
        if (value !== undefined) form.append(key, value as string | Blob)
      })
      return apiClient.patch('/auth/me', form).then((r) => r.data as Profile)
    },
    onSuccess: (data) => queryClient.setQueryData(['profile'], data),
  })
}
