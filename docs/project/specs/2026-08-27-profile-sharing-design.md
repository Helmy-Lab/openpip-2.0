# Profile & Network Sharing — Design

**Date:** 2026-08-27 · **Branch:** `feature/phase4-profile` · **Status:** approved by Mahafujul (in-session)

Users find each other, share saved network views, and discuss them — entirely
inside the website. openPIP still sends no mail.

## Scope (approved features 1–7)

1. Saved views (bookmark a search + its filter/layout state)
2. Share a saved view with another user, with a note
3. Share back / re-share (same mechanism, no extra code)
4. Revoke (sender) / dismiss (recipient)
5. Public profile page
6. Comments on a shared view (flat, no threading)
7. Privacy toggle (`discoverable`)

Shared views are **live**: the recipient re-runs the search with the saved
settings; no result snapshotting.

## Decisions that reverse or touch earlier ones

- **Email field returns** as a searchable identifier only. The `email` column
  already exists on the `user` table (AbstractUser); the change is a partial
  unique constraint (`unique where email != ''`) plus collecting it at
  registration. Mail-sending stays deleted. **Flag to Dr. Helmy.**
- **Comments** carry moderation questions. **Flag to Dr. Helmy.**

## Data model

New Django app `sharing`. One change in `core`:

- `User.email` — partial unique constraint; registration collects it.
- `User.discoverable` — boolean, default true. False = absent from
  people-search and cannot receive shares.

`sharing` models (snake_case tables, `related_name` on every FK, per backend
conventions):

- **SavedView**: `user` FK, `name`, `query` (text), `state` (JSONField: score /
  category / annotation / tissue filters, filter mode, layout, highlight,
  active table tab), `created_at`, `updated_at`.
- **Share**: `saved_view` FK (CASCADE), `sender` FK, `recipient` FK, `note`
  (text, blank), `created_at`. Revoke and dismiss both delete the row;
  comments cascade away.
- **Comment**: `share` FK (CASCADE), `author` FK, `body`, `created_at`.
- **Notification**: `user` FK, `text`, `link` (site-relative URL), `read`
  (boolean, default false), `created_at`.

## API (all `IsAuthenticated` unless noted)

- `GET /api/users/search?q=` — matches display name, username, email,
  affiliation; discoverable users only; returns public card fields.
- `GET /api/users/<username>/` — public profile (name, affiliation, position,
  website, bio, avatar). 404 for undiscoverable users? No — profiles stay
  public; `discoverable=false` only hides search/shares.
- `SavedViewViewSet` — CRUD, scoped to `request.user`.
- `ShareViewSet` — create (view id + recipient username + note), list
  (`?direction=received|sent`), retrieve (sender or recipient only), destroy
  (sender or recipient). Sharing with an undiscoverable or unknown user
  returns the same "user not found" error (no existence leak).
- `GET/POST /api/shares/<id>/comments/` — sender and recipient only.
- `NotificationViewSet` — list (own), `PATCH` mark read. Unread count derived
  from the list.

Creating a share writes its Notification in the same transaction. A comment
notifies sender + recipient minus the author.

## Frontend

- **Save view** button on the search toolbar → name dialog → POST.
- **Share dialog**: user autocomplete (users/search) + note.
- **Profile page**: new "My views" and "Shared with me" tabs.
- **Public profile** route `/profile/:username`; names link to it.
- **Notification bell** in TopBar; TanStack Query poll every ~45 s; dropdown
  lists notifications, click marks read and navigates to `link`.
- **`/shared/:id`**: fetch share → run the saved query live → hydrate
  `searchStore` from `state` → render network with note + comments panel.
- **Registration** form gains the email field.

## Error handling

- Revoked/deleted share → friendly "no longer shared" page (404 from API).
- Saved view whose query now returns nothing → the normal empty-results state.
- Duplicate share (same view, same recipient) → allowed; it is a new
  notification, not an error.

## Testing & verification

Backend: model/view tests in `sharing/tests/`, registration email tests in
`core`. Frontend: vitest + MSW for dialogs, bell, hydration. Not a parity
feature — verification is pytest + ruff + black, vitest + eslint + build.
