# Site settings and administration

Endpoints behind the portal's admin panel: appearance and text, announcements,
interaction categories and administrator accounts. Reading settings, text,
announcements, counts and categories is public, because every page needs them.
Every change requires an administrator account.

## Site settings

### GET /api/settings

The portal's configuration: titles, colours, page content and feature
switches. Returns `{}` on a portal that has never been configured.

From the reference portal (long values shortened):

```json
{
  "title": "openPIP: Protein Interaction Portal",
  "shortTitle": "openPIP",
  "url": "https://openpip.usask.ca/v2/",
  "version": "2.0",
  "mainColorScheme": "#0f766e",
  "mainColorScheme2": "#06b6d4",
  "gradientAngle": 135,
  "navStyle": "solid",
  "queryNodeColor": "#e11d48",
  "interactorNodeColor": "#0f766e",
  "showTissueExpression": true,
  "showSubcellularLocation": true,
  "horizontalFilterBar": true,
  "example1": "TP53",
  "example1Type": "None",
  "faq": "<h2>Getting started</h2>...",
  "logoUrl": null,
  ...
}
```

| Keys | Meaning |
|---|---|
| `title`, `shortTitle` | Full and short portal name. |
| `url`, `version` | Shown on the About page. |
| `logoUrl` | Path of the uploaded logo, or `null`. Read-only. Set it with `POST /api/settings/logo`. |
| `mainColorScheme`, `mainColorScheme2`, `gradientAngle` | Primary colour, second colour and angle (degrees) for gradient headers. |
| `headerColorScheme`, `logoColorScheme`, `buttonColorScheme` | Header text, logo and button colours. |
| `navStyle` | Navigation bar style: `solid`, `gradient` or `light`. |
| `navStyleOverrides` | Per-page navigation styles, e.g. `home:gradient,search:solid`. |
| `queryNodeColor`, `interactorNodeColor` | Network colours for the proteins searched for and for their partners. |
| `publishedEdgeColor`, `validatedEdgeColor`, `verifiedEdgeColor`, `literatureEdgeColor` | Network edge colours. Each edge takes the colour for its highest [interaction category](#interaction-categories) `order`: 1, 2, 3 and 4 use these four in turn, whatever the categories are called. Any other order is drawn grey (`#cccccc`). |
| `canvasBackgroundColor` | Network canvas background, or `null` for the default. |
| `horizontalFilterBar` | `true` puts the search page's filters in a ribbon above the network instead of a side panel. |
| `showTissueExpression`, `showSubcellularLocation` | Turn off for portals whose organism has no such annotations. |
| `showDownloads`, `showDownloadAll` | Show the dataset table and the supplementary files section of the Downloads page ("Show Dataset Downloads" and "Show Supplementary Files" in the admin panel). They hide links only, as in the original openPIP: the download endpoints stay available. |
| `example1`, `example2`, `example3` | Example searches offered on the home page. |
| `example1Type`, `example2Type`, `example3Type` | Network filter for each example: `None`, `query-query` or `query-interactor` (see [search filters](proteins-and-search.md#get-apisearch)). |
| `about`, `faq`, `contact`, `download`, `footer`, `homePage` | Page content as HTML. |
| `missionTitle`, `missionText`, `methodTitle`, `methodText` | Home page text. Read-only here. Change it through [site text](#site-text). |

### PATCH /api/settings

Change any of the keys above (except the read-only ones). Send only the keys
to change. Returns the full settings.

| Status | Body |
|---|---|
| 400 | Field errors, e.g. `{"gradientAngle": ["A valid integer is required."]}` |

### POST /api/settings/logo

Upload the portal logo. Multipart form data, field `logo`: PNG, JPEG, GIF, SVG
or WebP. Replaces any existing logo. Returns the full settings.

| Status | Body (`detail`) |
|---|---|
| 400 | `No file provided.` |
| 400 | `Unsupported file type.` |

### DELETE /api/settings/logo

Remove the logo. Returns `{"detail": "Logo removed."}`.

## Site text

Every label and paragraph in the interface has a built-in default. An
administrator can override any of them. This endpoint stores only the
overrides. The interface falls back to its defaults for everything else.

### GET /api/settings/text

| Parameter | Notes |
|---|---|
| `locale` | Language code, default `en`, e.g. `en` or `fr-CA`. |

```json
{"locale": "en", "text": {"nav.home": "Home", "home.mission.heading": "<h4>Our Mission</h4>"}}
```

| Status | Body (`detail`) |
|---|---|
| 400 | `Invalid locale.` |

### PUT /api/settings/text

Add, change or remove overrides in one request. Takes the same `locale`
parameter.

```json
{"entries": [
  {"key": "nav.home", "value": "Start"},
  {"key": "home.mission.heading", "value": null}
]}
```

A `null` or missing `value` removes the override, so the built-in default
applies again. An empty string is kept, which deliberately blanks that text.
Keys are up to 200 characters. Returns all overrides for the locale, as `GET`
does.

| Status | Body |
|---|---|
| 400 | `{"detail": "Expected a list under 'entries'."}` |
| 400 | Field errors, e.g. a blank key. |

## Announcements

### GET /api/announcements

Announcements for the home page, newest first. No authentication. An
announcement is listed only when both `show` and `showOnHomePage` are true.
The admin panel's **Hide** turns `show` off.

For example:

```json
[{"id": 7, "title": "New dataset", "text": "<p>HuRI isoforms are now searchable.</p>",
  "date": "2026-09-30T12:00:00Z", "show": true, "showOnHomePage": true}]
```

`text` is HTML.

### GET /api/admin/announcements

Every announcement, newest first.

### POST /api/admin/announcements

| Field | Notes |
|---|---|
| `title` | Required, up to 100 characters. |
| `text` | Required, up to 4,000 characters. |
| `showOnHomePage` | Required, boolean. |
| `date` | Date and time, or `null`. |
| `show` | Boolean, default `true`. |

Returns 201 with the announcement.

### PATCH /api/admin/announcements/{pk}

Change some fields. Returns the announcement, or 404 `{"detail": "Not found."}`.

### DELETE /api/admin/announcements/{pk}

Returns 204, or 404.

## Counts

### GET /api/counts

The totals shown on the home page. No authentication.

```json
{"proteins": 20015, "interactions": 122933, "datasets": 10}
```

`interactions` excludes interactions marked removed.

## Interaction categories

Categories group interactions by kind of evidence, such as published,
validated, verified or literature-curated. Each interaction can belong to
several. Readers can filter the network by category, and each edge is coloured
by its highest-`order` category through the
[edge colour settings](#get-apisettings). A category's own `colorScheme` is
stored for compatibility with the original openPIP, which did not display it
either. The admin panel shows each category the edge colour its order gives.

### GET /api/interaction-categories

No authentication. From the reference portal:

```json
[
  {"id": 1, "categoryName": "Published", "order": "1", "colorScheme": "#38761d",
   "description": "Published interactions from peer-reviewed sources."},
  {"id": 2, "categoryName": "Validated", "order": "2", "colorScheme": "#1155cc",
   "description": "Validated interactions from high-throughput experiments."}
]
```

Sorted by the numeric value of `order`, which is stored as a string.

### POST /api/interaction-categories

Create a category with `categoryName`, `order`, `colorScheme` and
`description`. Returns 201.

### PATCH /api/interaction-categories/{pk}

Change some fields. Returns the category, or 404 `{"detail": "Not found."}`.

### DELETE /api/interaction-categories/{pk}

Delete the category, and with it every interaction's membership in it. The
interactions themselves stay. Returns 204, or 404.

## Administrator accounts

New accounts are never administrators. An existing administrator promotes
them. The first administrator is created on the server; see
[Installation](../../operator-guide/installation.md#create-the-first-administrator).

### GET /api/admin/users

All accounts, administrators first, then by username.

| Parameter | Notes |
|---|---|
| `search` | Matches part of the username or email. |

For example:

```json
[{"id": 1, "username": "admin", "email": "admin@example.org",
  "isAdmin": true, "isSuperuser": true, "dateJoined": "2026-05-11T09:00:00Z"}]
```

### PATCH /api/admin/users/{pk}

Grant or revoke administrator access: `{"isAdmin": true}`. The change applies
to the account's API requests immediately. Its interface shows or hides the
admin panel at its next token refresh, within an hour.

| Status | Body |
|---|---|
| 400 | `{"isAdmin": "Expected true or false."}`: the value must be a JSON boolean. |
| 400 | `{"isAdmin": "You cannot revoke your own admin access."}` |
| 400 | `{"isAdmin": "Superusers cannot have their admin access revoked."}` |
| 404 | `{"detail": "Not found."}` |

Refusing to revoke your own access means a portal can never be left without
an administrator from inside the admin panel.
