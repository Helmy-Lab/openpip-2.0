# openPIP 2.0 — Known Bugs & Issues

Tracked here until migrated to the project issue tracker.
Format: **[STATUS]** — `open` · `in-progress` · `fixed` (include commit).

---

## Open

From the full-project audit of 2026-10-01, branch `fix/security-audit`.
"Verified" means the bug was reproduced; the rest come from reading the code.
Each fix gets a regression test.

### Critical

- [x] **BUG-003 — Default `SECRET_KEY` in production (verified).** _Fixed: new key
  in `.env`, stack recreated 2026-10-01; old-key tokens now 401._ The running
  prod backend uses the fallback hard-coded in `backend/openpip/settings/base.py:12`,
  so anyone can sign an admin JWT. Generate a real key in `.env`; make `prod.py`
  refuse to start when it is missing or the default. Rotating it logs everyone out.
- [x] **BUG-004 — Avatar upload is stored XSS (verified).** `core/views.py` `MeView`
  trusts the client's content type; `evil.html` sent as `image/png` is served
  as `text/html` from `/media/avatars/`, which can read the JWTs in localStorage.
  Store under a generated name with an extension derived from the allowed type.
  _Fixed in code; live only after the backend image is rebuilt._
- [x] **BUG-005 — Empty search returns the whole DB (verified).**
  `GET /api/search?q=` (or `q=" , "`) → 20k proteins / 123k interactions, ~17 s,
  anonymous. `search_service.py` `execute_search`: no terms → empty `Q()` matches
  every identifier. Return the empty result when `terms` is empty.
  _Fixed in code; live after the backend image is rebuilt._

### High

- [x] **BUG-006 — Overlapping upload rows not linked to the new dataset (parity).**
  `upload_parser.py` skips a row when the pair already exists, without adding
  an `InteractionDataset` link. Legacy reuses the interaction and links it
  (`DataController.php:629`). Affects counts, downloads, search dataset labels.
  _Fixed: overlaps credit both datasets and attach the new detection method /
  annotations; the existing score is kept. Same change fixed the duplicate check
  matching an A–A self-interaction for A–B, and the async (Celery) import never
  refreshing dataset counts._
- [x] **BUG-007 — Saving a network fails above ~15 genes.**
  `interactions/serializers.py` caps `query`, `name` and `category_array` at
  100 chars; the dialog pre-fills name with the query. Use the existing
  3000-char `interactor_query_string` column for the query (no schema change).
  _Fixed; category list left at 100 — 4 categories join to 39 chars today._
- [x] **BUG-008 — Media path traversal (verified in Django).**
  `/media/avatars/../uploads/private.csv` serves a private upload; the
  `openpip/urls.py` regex is checked before `serve()` normalises `..`. nginx
  likely blocks it today. Reject paths containing `..` / pin to the subdirectory.

### Medium

- [x] **BUG-009 — PSICQUIC paging unstable and unbounded.** `psicquic/miql.py`
  returns an unordered queryset, so `firstResult` pages can skip/duplicate rows;
  `maxResults` has no cap. Add `order_by("pk")` and a max.
  _Fixed: ordered by pk; `maxResults` over 2500 → 400 (the spec sets no tab
  cap; a 400 mirrors its XML limit). No legacy counterpart to parity-test._
- [x] **BUG-010 — Long share/comment notification → 500.** Name (150) + view name
  (200) can exceed `Notification.text` max_length 300 in `sharing/views.py`.
  Truncate the text. _Fixed in `notify()`, which both callers use._
- [x] **BUG-011 — No server-side password rules on register; inconsistent strip.**
  `RegisterView` accepts 1-char passwords (reset requires 8). Register/reset
  `.strip()` the password, login does not.
  _Fixed: register enforces the same 8-char minimum; login strips too, so
  every account created through register can still sign in._
- [x] **BUG-012 — Refresh tokens survive a password reset.** Blacklist the
  user's outstanding tokens in `PasswordResetConfirmView`.
  _Fixed differently: simplejwt 5.3.1 never records rotated refresh tokens
  against the user, so blacklisting would miss every session that had
  refreshed once. Refresh tokens now carry a password-hash fingerprint and are
  refused once it changes. Access tokens still live out their 1 h. Tokens
  issued before the deploy have no fingerprint, so everyone is logged out
  once more when it ships._
- [x] **BUG-013 — Dataset archive built in memory per anonymous request.**
  `DatasetArchiveDownloadView` rebuilds the full zip every call.
  _Fixed: built once to `MEDIA_ROOT/cache/datasets.zip` (atomic replace) and
  served from disk; deleted after every import, dataset delete and dataset
  edit. A change landing mid-build can leave that stale zip until the next one._

### Low

- [x] **BUG-014 —** `SummaryDropdown.tsx` shows a literal `<br>` between not-found
  terms; `foundSummary` is rendered as raw HTML (raw saved query for saved networks).
  _Fixed: both render as text. Worse than Low — a saved query opened through a
  public link was stored XSS._
- [x] **BUG-015 —** Demoted admin keeps admin UI (not access) until logout:
  token refresh carries the old `is_admin` claim forward. _Fixed: refresh
  re-reads `is_staff`; the UI updates within the 1 h access lifetime. Refresh
  now also refuses deactivated users, which simplejwt 5.3.1 did not check._
- [x] **BUG-016 —** Dataset exports don't filter `removed != "0"` (none exist yet).
  _Fixed for the per-dataset file and the archive. Dataset counts still include
  removed rows._
- [x] **BUG-017 —** Categories sort by the text `order` column ("10" before "2").
  _Fixed: numeric sort, as legacy's `ksort` did; non-numeric values go last._
- [x] **BUG-018 —** Admin endpoints: non-numeric `category_id` → 500;
  `bool("false")` is True for `show` / `is_last_batch` if sent as strings.
  _Fixed: bad or unknown `category_id` → 400 before any import work; `force`
  on file upload no longer 500s on a JSON boolean._
- [x] **BUG-019 —** _Fixed: root-owned `0.4.4/` moved aside (`sudo rm` it later)._ `backend/.ruff_cache` permission error; `ruff check` only
  works with `--no-cache`.

---

## Fixed

### BUG-001 — Password reset email not delivered

**Status:** `fixed` — cause removed, not repaired  
**Severity:** was High (blocked user self-service account recovery)  
**Reported:** 2026-05-23 · **Closed:** 2026-08-15  

**Symptoms:**  
Submitting the Forgot Password form returned a success message but no email
arrived. The backend was running `openpip.settings.dev`, whose `console` email
backend prints messages to stdout instead of sending them.

**Why it was not simply repaired:**  
Making it work needed an SMTP relay openPIP does not have, and every fix
attempt would have left account recovery depending on mail being configured
correctly on each deployment — the exact failure mode that produced this bug.

Account recovery now runs on security questions instead: three questions set at
registration, hashed like passwords, answered to mint the same reset token the
emailed link used to carry. That left `PasswordResetRequestView` with no
callers in the frontend, the CLI, or the docs, and it was the only `send_mail`
in the codebase.

**Fix:** deleted the endpoint, its route and tests, and the `EMAIL_*`,
`DEFAULT_FROM_EMAIL` and `FRONTEND_URL` settings along with their compose and
`.env.example` plumbing. openPIP now sends no mail at all, so there is no mail
configuration to get wrong. Anything added later that must send will have to
set up a backend deliberately.

**Note for operators:** users created before the security-questions migration
have none set and cannot self-recover. Reset those from the Django shell.

---

### BUG-002 — Password reset link goes to wrong base URL in dev

**Status:** `fixed` — cause removed  
**Severity:** was Low (dev only)  
**Reported:** 2026-05-23 · **Closed:** 2026-08-15  

**Symptoms:**  
When `FRONTEND_URL` was unset, the emailed reset link used the
`localhost:5173` default regardless of where the app was actually running.

**Fix:** the only consumer of `FRONTEND_URL` was the reset email deleted in
BUG-001; the setting is gone with it. The reset page is now reached by an
in-app redirect, which cannot point at the wrong host.
