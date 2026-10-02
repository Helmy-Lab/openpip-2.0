# Authentication and accounts

Endpoints for signing in, registering, recovering a password, managing your
own profile, and finding other users. How tokens are sent is covered in the
[overview](index.md#authentication).

## Signing in

### POST /api/auth/login

Exchange a username and password for a pair of tokens. No authentication.

| Field | Type | Notes |
|---|---|---|
| `username` | string | Case-sensitive. |
| `password` | string | Leading and trailing spaces are ignored, as at registration. |

```json
{
  "access": "eyJhbGciOiJIUzI1NiIs...",
  "refresh": "eyJhbGciOiJIUzI1NiIs...",
  "is_admin": false
}
```

`access` is the token to send as `Authorization: Bearer ...`. It lasts 1 hour.
`refresh` lasts 7 days and is used only with the refresh endpoint below.
`is_admin` says whether the account is a site administrator.

| Status | Body |
|---|---|
| 401 | `{"detail": "Invalid credentials"}` |

### POST /api/auth/token/refresh

Trade a refresh token for a new access token **and a new refresh token**. No
authentication header. Each refresh token works once: the one you send is
retired, so store the new one.

```json
{"refresh": "eyJhbGciOiJIUzI1NiIs..."}
```

```json
{"access": "eyJ...", "refresh": "eyJ..."}
```

A refresh token stops working when it expires, after it has been used once,
after logout, after the account's password changes, and when the account is
deactivated. Administrator status is re-read from the database on every
refresh, so a promoted or demoted account's next access token reflects the
change.

| Status | Body |
|---|---|
| 401 | `{"detail": "Token is invalid or expired", "code": "token_not_valid"}` |
| 401 | `{"detail": "Token is no longer valid for this account", "code": "token_not_valid"}`: the password changed or the account was deactivated. |

### POST /api/auth/logout

Retire a refresh token. No authentication.

```json
{"refresh": "eyJhbGciOiJIUzI1NiIs..."}
```

Always answers `200 {"detail": "Logged out"}`, even if the token was missing
or already invalid. The access token issued with it keeps working until it
expires, up to an hour later. Discard it on the client.

## Registering

### POST /api/auth/register

Create an ordinary (non-administrator) account. No authentication. The new
account is not signed in: call login afterwards.

| Field | Type | Notes |
|---|---|---|
| `username` | string | Required. Must be unused. |
| `email` | string | Required. Must not already be registered, compared case-insensitively. |
| `password` | string | Required. At least 8 characters after leading and trailing spaces are removed. |
| `security_questions` | array | Required. Exactly 3 objects `{"question": "...", "answer": "..."}` with 3 different questions and non-empty answers. These are the only way to recover the account. openPIP sends no email. |

Answers are stored hashed, like passwords, and compared without regard to
capitalisation or extra spaces.

Success is `201 {"detail": "Registration successful"}`.

| Status | Body (`detail`) |
|---|---|
| 400 | `All fields required.` |
| 400 | `Password must be at least 8 characters.` |
| 400 | `Answer 3 security questions.` |
| 400 | `Pick three different security questions.` |
| 400 | `Username already taken.` |
| 400 | `Email already registered.` |

## Recovering a password

Recovery takes three requests: fetch the account's questions, answer them to
receive a one-time reset token, then set a new password with that token.

### POST /api/auth/security-question

```json
{"email": "ada@example.org"}
```

```json
{"questions": ["Name of your first pet?", "City you were born in?", "Your first school?"]}
```

| Status | Body (`detail`) |
|---|---|
| 404 | `No security questions are set for that email.` |

Accounts created before security questions were introduced have none, and
cannot recover themselves. The site operator has to set a new password for
them from the server; see
[Managing users](../../operator-guide/maintenance.md#resetting-a-users-password).

### POST /api/auth/security-answer

```json
{"email": "ada@example.org", "answers": ["Rex", "Regina", "Elm"]}
```

`answers` must be in the same order as the questions were returned. All three
must be right.

```json
{"uid": "MTI", "token": "cxq4u5-8f1e2a..."}
```

| Status | Body (`detail`) |
|---|---|
| 400 | `Those answers are incorrect.` |
| 429 | Limited to 10 attempts per hour per IP address for anonymous callers. |

### POST /api/auth/password-reset-confirm

| Field | Type | Notes |
|---|---|---|
| `uid` | string | From the previous step. |
| `token` | string | From the previous step. Valid for 3 days, and only until the password changes. |
| `password` | string | The new password. At least 8 characters after spaces are trimmed. |

Success is `200 {"detail": "Password updated successfully."}`. Every refresh
token issued before the change stops working, which signs the account out
everywhere within the hour.

| Status | Body (`detail`) |
|---|---|
| 400 | `uid, token, and password are required.` |
| 400 | `Password must be at least 8 characters.` |
| 400 | `Invalid reset link.` |
| 400 | `Reset link is invalid or has expired.` |

## Your profile

### GET /api/auth/me

Requires authentication.

```json
{
  "username": "ada",
  "email": "ada@example.org",
  "is_admin": false,
  "name": "Ada Lovelace",
  "affiliation": "University of Saskatchewan",
  "position": "Postdoctoral fellow",
  "website": "https://example.org/ada",
  "bio": "Interactome mapping.",
  "discoverable": true,
  "avatar": "/media/avatars/5f0c...e1.png"
}
```

`avatar` is `null` when none is set. It is a path on the same site, so prefix
it with the deployment's root URL.

### PATCH /api/auth/me

Requires authentication. Send JSON, or multipart form data when uploading an
avatar. Every field is optional. An omitted field is left alone, and an empty
string clears it. Username, email and administrator status cannot be changed
here.

| Field | Type | Notes |
|---|---|---|
| `name` | string | Display name, up to 150 characters. |
| `affiliation` | string | Up to 200 characters. |
| `position` | string | Up to 100 characters. |
| `website` | string | Must be a URL. |
| `bio` | string | Free text. |
| `discoverable` | boolean | When false, other users cannot find you in user search or share networks with you. Any signed-in user who has your username can still open your profile. |
| `avatar` | file | PNG, JPEG, GIF or WebP, up to 2 MB. Send an empty `avatar` value to remove the current one. |

Returns the updated profile, as `GET` does.

| Status | Body |
|---|---|
| 400 | `{"detail": "Unsupported image type."}` |
| 400 | `{"detail": "Image must be 2 MB or smaller."}` |
| 400 | Field errors, e.g. `{"website": ["Enter a valid URL."]}` |

## Other users

### GET /api/users/search

Find people to share a network with. Requires authentication.

| Parameter | Notes |
|---|---|
| `q` | At least 2 characters, otherwise the result is empty. Matches part of a username, name or affiliation, or an **exact** email address. |

Returns up to 10 matching active, discoverable users, excluding yourself:

```json
[{"username": "grace", "name": "Grace Hopper", "affiliation": "VIDO", "avatar": null}]
```

### GET /api/users/{username}

A user's public profile. Requires authentication.

```json
{
  "username": "grace",
  "name": "Grace Hopper",
  "affiliation": "VIDO",
  "avatar": null,
  "position": "Research scientist",
  "website": "",
  "bio": "",
  "joined": "2026-08-27T14:02:11.512Z"
}
```

| Status | Body |
|---|---|
| 404 | `{"detail": "No such user."}`, also for deactivated accounts. |
