# Configuration reference

openPIP is configured through environment variables, read when each container
starts, plus a few build-time variables baked into the web interface. This
page lists every variable the code reads. A test in the backend suite fails
if a variable is added to the code without being listed here, or listed here
without being read.

## Where values come from

When you run openPIP with Docker Compose (the supported way), Compose fills in
`${...}` placeholders in `docker-compose.yml` and `docker-compose.prod.yml`
from a file named **`.env` in the repository root**. Start from the example:

```bash
cp .env.example .env
```

The Django settings also read that root `.env` directly when you run
`manage.py` on the host, outside Docker. Variables already set in the
environment take precedence over the file. The `backend/.env.example` file is
not read by anything.

## Backend variables

Read by `backend/openpip/settings/`.

| Variable | Default when unset | What it controls |
|---|---|---|
| `SECRET_KEY` | `django-insecure-dev-key-change-in-production` | Signs sessions, password-reset tokens and **every login token (JWT)**. Anyone who knows it can mint an administrator token. Production settings refuse to start if it begins with `django-insecure`. |
| `DATABASE_URL` | `sqlite:///dev.db` | Database connection, as a URL: `postgres://USER:PASSWORD@HOST:5432/NAME`. Compose sets it for you from `DB_PASSWORD`. |
| `REDIS_URL` | unset | Redis connection, used as the Celery job queue and as the cache that stores rate-limit counters. Compose sets it to `redis://redis:6379/0`. Without it, rate limits are counted separately in each worker process. |
| `ALLOWED_HOSTS` | empty (development settings allow any host) | Comma-separated host names this site may be served under, e.g. `openpip.example.org`. |
| `URL_PREFIX` | `/v2` | Production only: the path the site is served under, without a trailing slash, e.g. `/openpip`. Set it to an empty value (`URL_PREFIX=`) for a site at the root of its domain. Used by the backend and, at image build time, by the web interface, so rebuild the frontend image after changing it. |
| `CSRF_TRUSTED_ORIGINS` | empty | Comma-separated origins (`https://openpip.example.org`) trusted for form posts to the Django admin. |

### Variables used only by Docker Compose

| Variable | Default when unset | What it controls |
|---|---|---|
| `DB_PASSWORD` | `openpip_dev` | Password of the `openpip` Postgres user. Postgres applies it **only when the database volume is first created**. Changing it later needs an `ALTER USER` as well (see [Security checklist](#security-checklist)). |
| `DOCS_SITE_URL` | `https://openpip.usask.ca/v2/docs/` | Full public address of this documentation site, built into the frontend image. Set it to your own `https://<domain><URL_PREFIX>/docs/`. |
| `DJANGO_SETTINGS_MODULE` | set by the compose files | `openpip.settings.dev` in `docker-compose.yml`, `openpip.settings.prod` in `docker-compose.prod.yml`. Do not set it in `.env`. |

## Web interface build variables

Read by Vite when the frontend image is **built**, from
`frontend/.env.production` (production builds) or `frontend/.env.development`
(`npm run dev`). Changing them means rebuilding the frontend image.

| Variable | Default when unset | What it controls |
|---|---|---|
| `VITE_BASE` | `/` | URL path the interface is served under. `frontend/.env.production` sets `/v2/`. The Docker build sets it from `URL_PREFIX`. |
| `VITE_API_BASE_URL` | `<VITE_BASE>api` | Where the interface sends API requests. Leave unset in production. Development sets `/api`, which the dev server proxies to the backend on port 8001. |
| `VITE_USE_MSW` | mock API **on** in development | Development only: any value except `false` replaces the real API with built-in mock data. `frontend/.env.development` sets `false`. |

## Fixed settings

Browser requests to `/api/` and `/psicquic/` are accepted from any origin
(CORS). This is deliberate: the data is public, and login tokens are sent in a
header, not as cookies, so another site cannot act for a signed-in user.

These are set in code, not by environment variables.

| Setting | Value | Where |
|---|---|---|
| Login token lifetime | access 1 hour, refresh 7 days; refresh tokens rotate on use | `settings/base.py` `SIMPLE_JWT` |
| Rate limits | anonymous 600/min, signed-in 1200/min, PSICQUIC 60/min, security-question answers 10/hour per caller and 10/hour per email address | `settings/base.py` `DEFAULT_THROTTLE_RATES` |
| HTTPS (production) | HTTPS redirect, secure cookies, HSTS 1 hour; trusts `X-Forwarded-Proto: https` from the proxy | `settings/prod.py` |
| Client address (production) | the last address in `X-Forwarded-For`, which your HTTPS proxy must set | `settings/prod.py` `NUM_PROXIES` |
| Upload size limit | 500 MB per request | `frontend/nginx.conf` `client_max_body_size` |
| Media files | `backend/mediafiles/` (development); the `media` volume (production) | `settings/base.py` `MEDIA_ROOT` |

## Generating a secret key

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

Put the output in `.env` as `SECRET_KEY=...`. Changing the key signs everyone
out, because every existing login token becomes invalid.

## Security checklist

Before exposing a deployment:

- [ ] `SECRET_KEY` is a newly generated value, not the example.
- [ ] `DB_PASSWORD` is set to a strong value **before the first start**.
- [ ] `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` name only your domain.
- [ ] No port is published on a public interface. With both compose files,
      `docker compose ps` shows no port for `db` and `redis`, and only
      `127.0.0.1:` for `frontend` and `backend`.

