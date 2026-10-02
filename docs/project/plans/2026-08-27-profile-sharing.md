# Profile & Network Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Saved network views, in-site sharing with notes/comments/notifications, people search, and public profiles — per `docs/specs/2026-08-27-profile-sharing-design.md`.

**Architecture:** New Django app `sharing` (SavedView, Share, Comment, Notification) plus small `core` changes (email uniqueness, `discoverable`, people search, public profile). Frontend: new `api/sharing.ts` + `api/users.ts` hooks, `applyViewState`/`captureViewState` on the existing searchStore, a Save-view/Share dialog pair, profile tabs, a TopBar notification bell polling via TanStack Query, and a `/shared/:id` page that re-runs the saved query live and hydrates the store.

**Tech Stack:** Django 5 + DRF, PostgreSQL, React 18 + TS, TanStack Query, Zustand, vitest + MSW, pytest.

**Key discovery:** email is already collected at registration and stored (`RegisterView`, `SecurityQuestionView`). Only uniqueness is missing.

---

### Task 1: `sharing` app — models + migrations

**Files:** Create `backend/sharing/` (`__init__.py`, `apps.py`, `models.py`, `admin.py`, `migrations/`), modify `backend/openpip/settings/base.py` (INSTALLED_APPS), test `backend/sharing/tests/test_models.py`.

- [ ] Models (new tables, no legacy constraint — plain snake_case names):

```python
from django.conf import settings
from django.db import models


class SavedView(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_views"
    )
    name = models.CharField(max_length=200)
    query = models.TextField()
    # searchStore view state: score/category/annotation/tissue filters,
    # filter mode, layout, highlight, active table tab. Opaque to the backend.
    state = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "saved_views"
        ordering = ["-updated_at"]

    def __str__(self):
        return self.name


class Share(models.Model):
    saved_view = models.ForeignKey(
        SavedView, on_delete=models.CASCADE, related_name="shares"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="shares_sent"
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shares_received",
    )
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "shares"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.saved_view.name} -> {self.recipient.username}"


class Comment(models.Model):
    share = models.ForeignKey(Share, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+"
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "share_comments"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.author.username}: {self.body[:40]}"


class Notification(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    text = models.CharField(max_length=300)
    link = models.CharField(max_length=300, blank=True)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]

    def __str__(self):
        return self.text
```

- [ ] `makemigrations sharing`, migrate on a fresh dev DB, commit.

### Task 2: `core` — email uniqueness + `discoverable`

**Files:** Modify `backend/core/models.py`, `backend/core/views.py` (RegisterView, `_profile_payload`), `backend/core/serializers.py` (ProfileSerializer), new migration; test in `backend/core/tests/test_views.py`.

- [ ] `discoverable = models.BooleanField(default=True)` on User.
- [ ] Migration adds a case-insensitive partial unique constraint (existing blank emails must not collide):

```python
migrations.AddConstraint(
    model_name="user",
    constraint=models.UniqueConstraint(
        Lower("email"),
        condition=~Q(email=""),
        name="user_email_unique_nonblank",
    ),
)
```

- [ ] RegisterView rejects duplicates before insert: `User.objects.filter(email__iexact=email).exists()` → 400 "Email already registered."
- [ ] `discoverable` in `_profile_payload` and ProfileSerializer (PATCHable bool).
- [ ] Tests: duplicate email 400 (case-insensitive), discoverable round-trips via /auth/me PATCH.

### Task 3: people search + public profile (`core`)

**Files:** Modify `backend/core/views.py`, `backend/core/urls.py`; tests in `backend/core/tests/test_views.py`.

- [ ] `GET /api/users/search?q=` (IsAuthenticated): q min 2 chars else `[]`; filter `is_active=True, discoverable=True`; match `username__icontains | first_name__icontains | affiliation__icontains | email__iexact` (email exact-only — no address harvesting); exclude self; cap 10; return `[{username, name, affiliation, avatar}]`.
- [ ] `GET /api/users/<username>/` (IsAuthenticated): public card — username, name, affiliation, position, website, bio, avatar. 404 for inactive. Discoverable=False does NOT hide the profile (only search/shares).
- [ ] Tests: undiscoverable user absent from search but profile still fetchable; email exact match works, partial email does not.

### Task 4: `sharing` API

**Files:** Create `backend/sharing/serializers.py`, `backend/sharing/views.py`, `backend/sharing/urls.py`; modify `backend/openpip/urls.py`; tests `backend/sharing/tests/test_views.py`.

- [ ] `SavedViewViewSet` (ModelViewSet): queryset = own views; create sets user.
- [ ] `ShareViewSet` (create/list/retrieve/destroy):
  - create body `{saved_view: id, recipient: username, note}`; saved_view must be sender's; recipient must exist + discoverable + not self, else uniform 400 "User not found." (no existence leak); writes recipient Notification (`"<sender name> shared \"<view>\" with you"`, link `/shared/<id>`) in the same transaction.
  - list `?direction=received|sent` (default received); retrieve/destroy limited to sender or recipient (queryset = `Q(sender=u) | Q(recipient=u)`). Destroy = revoke/dismiss; comments cascade.
  - share payload embeds the saved view (name, query, state), sender/recipient cards, note, created_at.
- [ ] `ShareCommentsView` (APIView, get/post at `/api/shares/<id>/comments/`): participants only; post notifies the other participant(s) minus author.
- [ ] `NotificationViewSet` (list + partial_update): own only; PATCH `{read: true}`; list returns newest 50.
- [ ] Router under `path("api/", include("sharing.urls"))`.
- [ ] Tests: non-participant 404 on share/comments; revoke removes recipient's access; share to undiscoverable == share to nonexistent (same error body); notification created with share; comment notifies other party only.

### Task 5: frontend API layer

**Files:** Create `frontend/src/api/sharing.ts`, `frontend/src/api/users.ts`; types inline (feature-local shapes) or `frontend/src/types/api.ts` if shared; MSW: `frontend/src/mocks/handlers/sharing.ts` + fixtures, registered in handlers index.

- [ ] `users.ts`: `useUserSearch(q)` (enabled `q.trim().length >= 2`, staleTime 30s), `usePublicProfile(username)`.
- [ ] `sharing.ts`: `useSavedViews`, `useCreateSavedView`, `useDeleteSavedView`, `useShares(direction)`, `useShare(id)`, `useCreateShare`, `useDeleteShare`, `useShareComments(id)`, `useAddComment(id)`, `useNotifications` (refetchInterval 45_000, enabled when logged in), `useMarkNotificationRead`. Mutations invalidate their list queries.

### Task 6: searchStore view-state capture/apply

**Files:** Modify `frontend/src/features/search/searchStore.ts`; test `frontend/src/features/search/searchStore.test.ts` (or extend existing store tests).

- [ ] Export `interface ViewState` (scoreFilter, categoryFilter, annotationFilter, filterMode, tissueFilter, selectedLayout, highlight, activeTableTab).
- [ ] `captureViewState(): ViewState` — plain function over `getState()`.
- [ ] Store action `applyViewState(v: Partial<ViewState>)` — single `set` merging only ViewState keys.
- [ ] Test: capture → reset → apply round-trips.

### Task 7: Save view + Share dialogs on the search toolbar

**Files:** Create `frontend/src/features/search/toolbar/SaveViewButton.tsx` (button + name dialog → `useCreateSavedView({name, query: searchTerm, state: captureViewState()})`), `frontend/src/features/sharing/ShareDialog.tsx` (recipient autocomplete via `useUserSearch`, note textarea → `useCreateShare`); wire into the search toolbar next to existing dropdowns. Tests colocated.

- [ ] Save requires a logged-in user; hidden otherwise.
- [ ] After save, offer "Share it" opening ShareDialog with the new view preselected.

### Task 8: profile tabs + public profile page

**Files:** Modify `frontend/src/features/auth/ProfilePage.tsx` (add "My views" and "Shared with me" tabs listing saved views — open/share/delete — and received shares — open/dismiss); create `frontend/src/features/sharing/PublicProfilePage.tsx`; route `profile/:username` in `App.tsx`; link user names in shares/comments to it. Tests colocated.

### Task 9: notification bell

**Files:** Create `frontend/src/components/NotificationBell.tsx`; modify `frontend/src/components/TopBar.tsx`. Test colocated.

- [ ] Bell with unread badge (from `useNotifications`), dropdown list, click = mark read + navigate to `link`. Rendered only when logged in.

### Task 10: shared view page

**Files:** Create `frontend/src/features/sharing/SharedViewPage.tsx`; modify `frontend/src/features/search/SearchResultsPage.tsx` (optional props `term`, `viewState`, `shareBanner`); route `shared/:id` in `App.tsx`. Tests colocated.

- [ ] SharedViewPage fetches the share; renders SearchResultsPage with the saved query and state; banner shows sender, note, and a comments panel (list + add box).
- [ ] SearchResultsPage: `term = props.term ?? routeParam`; in the existing `setSearchData` effect, apply `viewState` after data lands.
- [ ] Revoked/missing share → friendly "This network is no longer shared with you."

### Task 11: verification & wrap-up

- [ ] Backend: `pytest`, `ruff check --no-cache .`, `black --check .`
- [ ] Frontend: `npm run test`, `npm run lint` (0 errors), `npm run build`
- [ ] Fresh-DB migration check (`migrate` on empty sqlite/postgres per check-migration skill).
- [ ] Commit per task, conventional messages, no co-author trailers.

**Deliberately skipped:** email verification (no mail by design), share re-invite/duplicate guard (duplicate share = new notification, allowed), comment threading, websockets (poll), pagination on shares/views (cap + ordering suffice at this scale).
