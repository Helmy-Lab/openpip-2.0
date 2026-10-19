import { http, HttpResponse } from 'msw'
import type { SavedNetwork } from '../../types/api'

let nextId = 1
let store: SavedNetwork[] = []

export function resetNetworkStore() {
  nextId = 1
  store = []
}

export function seedNetworks(networks: SavedNetwork[]) {
  store = networks
}

export const networksHandlers = [
  http.get('/api/networks', ({ request }) => {
    const auth = request.headers.get('Authorization')
    if (!auth) return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })
    return HttpResponse.json([...store])
  }),

  http.post('/api/networks', async ({ request }) => {
    const auth = request.headers.get('Authorization')
    if (!auth) return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })
    const body = (await request.json()) as {
      name: string
      query: string
      interaction_ids: number[]
      note?: string
    }
    const now = new Date().toISOString()
    const network: SavedNetwork = {
      id: nextId++,
      name: body.name,
      query: body.query,
      interaction_count: body.interaction_ids.length,
      note: body.note ?? '',
      created_at: now,
      updated_at: now,
    }
    store.push(network)
    return HttpResponse.json(
      { id: network.id, name: network.name, interaction_count: network.interaction_count },
      { status: 201 },
    )
  }),

  http.patch('/api/networks/:id', async ({ params, request }) => {
    const auth = request.headers.get('Authorization')
    if (!auth) return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })
    const network = store.find((n) => n.id === Number(params.id))
    if (!network) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    const { note } = (await request.json()) as { note: string }
    Object.assign(network, { note, updated_at: new Date(Date.now() + 5000).toISOString() })
    return HttpResponse.json(network)
  }),

  http.delete('/api/networks/:id', ({ params, request }) => {
    const auth = request.headers.get('Authorization')
    if (!auth) return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })
    const id = Number(params.id)
    const idx = store.findIndex((n) => n.id === id)
    if (idx === -1) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    store.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),
]
