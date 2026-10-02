import { http, HttpResponse } from 'msw'
import type { SavedView, Share, ShareComment, Notification } from '../../api/sharing'
import type { UserCard } from '../../api/users'

const CARD: UserCard = {
  username: 'hleung',
  name: 'Helen Leung',
  affiliation: 'Helmy Lab',
  avatar: null,
}

// The same person /api/auth/me returns, so "is this mine?" checks in the UI
// line up with what these handlers store.
const ME: UserCard = { username: 'admin', name: 'Test User', affiliation: '', avatar: null }

let nextId = 1
let views: SavedView[] = []
let shares: Share[] = []
let comments: ShareComment[] = []
let notifications: Notification[] = []

export function resetSharingStore() {
  nextId = 1
  views = []
  shares = []
  comments = []
  notifications = []
}

export function seedSharing(seed: {
  views?: SavedView[]
  shares?: Share[]
  comments?: ShareComment[]
  notifications?: Notification[]
}) {
  if (seed.views) views = seed.views
  if (seed.shares) shares = seed.shares
  if (seed.comments) comments = seed.comments
  if (seed.notifications) notifications = seed.notifications
}

export const sharingHandlers = [
  http.get('/api/users/search', ({ request }) => {
    const q = new URL(request.url).searchParams.get('q') ?? ''
    if (q.trim().length < 2) return HttpResponse.json([])
    const hit =
      CARD.username.includes(q) ||
      CARD.name.toLowerCase().includes(q.toLowerCase()) ||
      CARD.affiliation.toLowerCase().includes(q.toLowerCase())
    return HttpResponse.json(hit ? [CARD] : [])
  }),

  http.get('/api/users/:username', ({ params }) =>
    params.username === CARD.username
      ? HttpResponse.json({
          ...CARD,
          position: 'Postdoc',
          website: '',
          bio: 'Networks.',
          joined: '2026-01-15T00:00:00Z',
        })
      : HttpResponse.json({ detail: 'No such user.' }, { status: 404 }),
  ),

  http.get('/api/saved-views/', () => HttpResponse.json([...views])),

  http.post('/api/saved-views/', async ({ request }) => {
    const body = (await request.json()) as Omit<SavedView, 'id' | 'created_at' | 'updated_at'>
    const now = new Date().toISOString()
    const view: SavedView = { id: nextId++, ...body, created_at: now, updated_at: now }
    views.push(view)
    return HttpResponse.json(view, { status: 201 })
  }),

  http.patch('/api/saved-views/:id', async ({ params, request }) => {
    const view = views.find((v) => v.id === Number(params.id))
    if (!view) return HttpResponse.json({ detail: 'Not found.' }, { status: 404 })
    Object.assign(view, (await request.json()) as Partial<SavedView>)
    return HttpResponse.json(view)
  }),

  http.post('/api/saved-views/:id/public-link/', ({ params }) => {
    const view = views.find((v) => v.id === Number(params.id))
    if (!view) return HttpResponse.json({ detail: 'Not found.' }, { status: 404 })
    view.public_token ??= `tok${view.id}`
    return HttpResponse.json(view)
  }),

  http.delete('/api/saved-views/:id/public-link/', ({ params }) => {
    const view = views.find((v) => v.id === Number(params.id))
    if (!view) return HttpResponse.json({ detail: 'Not found.' }, { status: 404 })
    view.public_token = null
    return HttpResponse.json(view)
  }),

  http.get('/api/public-views/:token', ({ params }) => {
    const view = views.find((v) => v.public_token && v.public_token === params.token)
    return view
      ? HttpResponse.json({ name: view.name, query: view.query, state: view.state })
      : HttpResponse.json({ detail: 'This link is no longer active.' }, { status: 404 })
  }),

  http.delete('/api/saved-views/:id', ({ params }) => {
    views = views.filter((v) => v.id !== Number(params.id))
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/shares/', ({ request }) => {
    const direction = new URL(request.url).searchParams.get('direction') ?? 'received'
    return HttpResponse.json(
      shares.filter((s) =>
        direction === 'sent' ? s.sender.username === ME.username : s.recipient.username === ME.username,
      ),
    )
  }),

  http.get('/api/shares/:id/comments', () => HttpResponse.json([...comments])),

  http.post('/api/shares/:id/comments', async ({ request }) => {
    const { body } = (await request.json()) as { body: string }
    const comment: ShareComment = {
      id: nextId++,
      author: ME,
      body,
      created_at: new Date().toISOString(),
      edited: false,
    }
    comments.push(comment)
    return HttpResponse.json(comment, { status: 201 })
  }),

  http.patch('/api/shares/:id/comments/:commentId', async ({ params, request }) => {
    const { body } = (await request.json()) as { body: string }
    const comment = comments.find((c) => c.id === Number(params.commentId))
    if (!comment || comment.author.username !== ME.username) {
      return HttpResponse.json({ detail: 'No such user.' }, { status: 404 })
    }
    comment.body = body
    comment.edited = true
    return HttpResponse.json(comment)
  }),

  http.get('/api/shares/:id', ({ params }) => {
    const share = shares.find((s) => s.id === Number(params.id))
    return share
      ? HttpResponse.json(share)
      : HttpResponse.json({ detail: 'No such user.' }, { status: 404 })
  }),

  http.post('/api/shares/', async ({ request }) => {
    const body = (await request.json()) as { saved_view: number; recipient: string; note?: string }
    const view = views.find((v) => v.id === body.saved_view)
    if (!view) return HttpResponse.json({ detail: 'No such saved view.' }, { status: 400 })
    if (body.recipient !== CARD.username) {
      return HttpResponse.json({ detail: 'No such user.' }, { status: 400 })
    }
    const share: Share = {
      id: nextId++,
      saved_view: view,
      sender: ME,
      recipient: CARD,
      note: body.note ?? '',
      created_at: new Date().toISOString(),
    }
    shares.push(share)
    return HttpResponse.json(share, { status: 201 })
  }),

  http.delete('/api/shares/:id', ({ params }) => {
    shares = shares.filter((s) => s.id !== Number(params.id))
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/notifications/', () => HttpResponse.json([...notifications])),

  http.post('/api/notifications/clear/', () => {
    notifications = []
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/notifications/mark-all-read/', () => {
    notifications.forEach((n) => {
      n.read = true
    })
    return new HttpResponse(null, { status: 204 })
  }),

  http.patch('/api/notifications/:id', ({ params }) => {
    const note = notifications.find((n) => n.id === Number(params.id))
    if (note) note.read = true
    return HttpResponse.json(note ?? {})
  }),
]
