import { describe, it, expect, vi } from 'vitest'
import axios from 'axios'
import { apiClient } from '../client'

describe('apiClient token refresh', () => {
  it('rejects every queued request when the refresh fails, instead of hanging', async () => {
    localStorage.setItem('openpip_access_token', 'expired')
    localStorage.setItem('openpip_refresh_token', 'blacklisted')
    apiClient.defaults.adapter = (config) =>
      Promise.reject(
        Object.assign(new Error('401'), { config, response: { status: 401 } })
      )
    vi.spyOn(axios, 'post').mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error('refresh failed')), 10))
    )

    const results = await Promise.allSettled([apiClient.get('/a'), apiClient.get('/b')])

    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected'])
  })
})
