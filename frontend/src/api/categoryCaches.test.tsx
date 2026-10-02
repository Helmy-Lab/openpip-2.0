import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi } from 'vitest'
import { apiClient } from './client'
import { useInteractionCategories as useAdminCategories } from './interactionCategories'
import { useInteractionCategories as useUploadCategories } from './datasets'

describe('interaction category caches', () => {
  it('keeps the admin and upload lists apart', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === '/interaction-categories'
            ? [{ id: 1, categoryName: 'Published' }]
            : [{ id: 1, category_name: 'Published' }],
      })
    )
    const qc = new QueryClient()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const admin = renderHook(() => useAdminCategories(), { wrapper })
    await waitFor(() => expect(admin.result.current.data).toBeDefined())
    const upload = renderHook(() => useUploadCategories(), { wrapper })
    await waitFor(() => expect(upload.result.current.data).toBeDefined())

    expect(upload.result.current.data?.[0]).toHaveProperty('category_name', 'Published')
  })
})
