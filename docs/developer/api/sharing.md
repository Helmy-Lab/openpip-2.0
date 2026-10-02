# Saved networks and sharing

Endpoints for keeping networks, sharing them with colleagues, discussing them,
and the notifications that follow. Everything here requires authentication
except opening a public link. Each account only ever sees its own saved
networks, the shares it sent or received, and its own notifications.

openPIP has two ways to keep a network:

- **Saved views** store the search and the view settings (filters, layout,
  highlight). Opening one runs the search again, so it reflects the portal's
  current data. Saved views can be shared and given public links.
- **Saved networks** store the exact interactions that were on screen, as a
  snapshot. They come from the original openPIP and cannot be shared.

## Saved views

Saved view paths end with a slash.

### GET /api/saved-views/

Your saved views.

```json
[{
  "id": 12,
  "name": "MAPK cluster",
  "query": "MAPK1",
  "state": {"scoreFilter": 0.4, "selectedLayout": "cose"},
  "note": "Check the liver subset.",
  "public_token": null,
  "created_at": "2026-09-14T08:30:00Z",
  "updated_at": "2026-09-14T08:30:00Z"
}]
```

| Key | Contents |
|---|---|
| `query` | The search to run. |
| `state` | How to display the result. The server stores any JSON object here. The web interface writes these keys: `scoreFilter` (number), `categoryFilter` and `annotationFilter` (objects of name → boolean), `filterMode` (`None`, `query_query` or `query_interactor`), `tissueFilter` (list), `selectedLayout`, `highlight` (`{"term", "genes"}` or `null`) and `activeTableTab`. |
| `note` | Your private note. People you share the view with do not see it. |
| `public_token` | The public link's token, or `null` when there is none. |

### POST /api/saved-views/

Save a view. `name` (up to 200 characters) and `query` are required. `state`
and `note` are optional. Returns 201 with the saved view.

### GET /api/saved-views/{pk}/

One of your saved views. Another account's view returns 404.

### PUT /api/saved-views/{pk}/

Replace a saved view's `name`, `query`, `state` and `note`.

### PATCH /api/saved-views/{pk}/

Change some of those fields.

### DELETE /api/saved-views/{pk}/

Delete the view, every share of it, and their discussions. Returns 204.

### POST /api/saved-views/{pk}/public-link/

Create a link that opens the view without logging in. If the view already has
one, the same token is returned. Returns the saved view with `public_token`
set. The web interface builds the link as `<site>/public/<token>`.

### DELETE /api/saved-views/{pk}/public-link/

Revoke the public link. Anyone holding it gets 404 from then on. Returns the
saved view with `public_token: null`.

### GET /api/public-views/{token}

Open a view by its public link. No authentication, and any `Authorization`
header is ignored.

```json
{"name": "MAPK cluster", "query": "MAPK1", "state": {"scoreFilter": 0.4, "selectedLayout": "cose"}}
```

Neither the owner nor the owner's note is revealed.

| Status | Body |
|---|---|
| 404 | `{"detail": "This link is no longer active."}` |

## Sharing with colleagues

Share paths end with a slash, except the comment paths.

### POST /api/shares/

Send one of your saved views to another user. They are notified.

| Field | Notes |
|---|---|
| `saved_view` | ID of one of your saved views. |
| `recipient` | The recipient's username. They must be an active account that allows sharing ("discoverable"). |
| `note` | Optional message. |

To share with several people, send one request per recipient. Returns 201
with the share:

```json
{
  "id": 31,
  "saved_view": {"id": 12, "name": "MAPK cluster", "query": "MAPK1",
                 "state": {"scoreFilter": 0.4}, "created_at": "...", "updated_at": "..."},
  "sender": {"username": "ada", "name": "Ada Lovelace", "affiliation": "VIDO", "avatar": null},
  "recipient": {"username": "grace", "name": "Grace Hopper", "affiliation": "", "avatar": null},
  "note": "Look at the liver cluster",
  "created_at": "2026-09-14T08:41:00Z"
}
```

The recipient sees the view's search and settings, not your private note or
public-link token.

| Status | Body (`detail`) |
|---|---|
| 400 | `No such saved view.` |
| 400 | `No such user.`: also returned for accounts that turned sharing off, and for yourself, so the endpoint cannot be used to test whether an account exists. |

### GET /api/shares/

Shares you received. Add `?direction=sent` for shares you sent.

### GET /api/shares/{pk}/

One share you sent or received. Any other returns 404.

### DELETE /api/shares/{pk}/

For the sender, revoke the share. For the recipient, dismiss it. Either way it
is deleted, with its discussion. Returns 204.

### GET /api/shares/{pk}/comments

The discussion on a share, oldest first. Only the share's sender and recipient
can read it.

```json
[{"id": 5, "author": {"username": "grace", "name": "Grace Hopper", "affiliation": "", "avatar": null},
  "body": "MDM2 shows up twice here.", "created_at": "2026-09-14T09:02:00Z", "edited": false}]
```

| Status | Body |
|---|---|
| 404 | `{"detail": "No such user."}`: no such share, or you are not part of it. |

### POST /api/shares/{pk}/comments

Add a comment: `{"body": "..."}`. The other participant is notified. Returns
201 with the comment.

| Status | Body (`detail`) |
|---|---|
| 400 | `Comment cannot be empty.` |
| 404 | `No such user.` |

### PATCH /api/shares/{pk}/comments/{comment_id}

Edit your own comment: `{"body": "..."}`. It is marked `edited: true`. Only the
comment's author can edit it.

| Status | Body (`detail`) |
|---|---|
| 400 | `Comment cannot be empty.` |
| 404 | `No such user.` |

## Notifications

Created when someone shares a view with you or comments on a share you are part
of. openPIP sends no email: notifications are only shown in the portal.
Notification paths end with a slash.

### GET /api/notifications/

Your newest 50 notifications.

```json
[{"id": 88, "text": "Ada Lovelace shared \"MAPK cluster\" with you",
  "link": "/shared/31", "read": false, "created_at": "2026-09-14T08:41:00Z"}]
```

`link` is a page path within the portal. `text` is at most 300 characters,
shortened with `…` when names are long.

### PUT /api/notifications/{pk}/

### PATCH /api/notifications/{pk}/

Mark one notification read or unread: `{"read": true}`. Only `read` can be
changed.

### POST /api/notifications/mark-all-read/

Mark all your notifications read. Returns 204.

### POST /api/notifications/clear/

Delete all your notifications. The shares themselves are kept. Returns 204.

## Saved networks (snapshots)

### GET /api/networks

Your saved networks, newest first.

```json
[{"id": 41, "name": "TP53 neighbourhood", "query": "TP53",
  "interaction_count": 238, "created_at": "2026-09-01T16:20:00Z"}]
```

### POST /api/networks

Save the interactions currently shown.

| Field | Notes |
|---|---|
| `name` | Required, up to 100 characters. |
| `query` | Required, up to 3,000 characters. The search that produced the network. |
| `interaction_ids` | Required, non-empty list of interaction IDs to keep. |
| `score_parameter` | Score threshold in use, as text. Default `"0.00"`. |
| `category_array` | Categories in use, as text, up to 100 characters. |
| `tissue_expression_array` | Tissue filter in use, comma-separated, up to 100 characters. |

```json
{"id": 41, "name": "TP53 neighbourhood", "interaction_count": 238}
```

### GET /api/networks/{pk}

The saved network: its `id`, `name`, `query`, `score_parameter`,
`category_array` and `tissue_expression_array`, plus the same keys as a
[search result](proteins-and-search.md#get-apisearch), built from the saved
interactions.

| Status | Body |
|---|---|
| 403 | The network belongs to another account. |
| 404 | No such network. |

### DELETE /api/networks/{pk}

Delete one of your saved networks. Returns 204.
