import { http, HttpResponse } from 'msw'
import { settingsFixture } from '../fixtures/settings'
import type { AdminSettings } from '../../types/api'

// Stateful so PATCH updates are reflected in GET within the same test run.
// In the browser, browser.ts uses passthrough() for all requests instead.
let currentSettings: AdminSettings = {
  showTissueExpression: true,
  horizontalFilterBar: false,
  showSubcellularLocation: true, ...settingsFixture }

export const settingsHandlers = [
  http.get('/api/settings', () => HttpResponse.json(currentSettings)),
  http.patch('/api/settings', async ({ request }) => {
    const body = await request.json()
    currentSettings = { ...currentSettings, ...(body as object) }
    return HttpResponse.json(currentSettings)
  }),
  http.post('/api/settings/logo', () => HttpResponse.json(currentSettings)),
  http.delete('/api/settings/logo', () => HttpResponse.json(currentSettings)),
]
