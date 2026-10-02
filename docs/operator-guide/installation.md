# Installation

This page sets up an openPIP portal on a Linux server with Docker, behind a
web server that handles HTTPS. It describes the reference deployment at
`https://openpip.usask.ca/v2`, which serves openPIP under the `/v2` path.

## What runs

openPIP runs as five containers, defined in `docker-compose.yml` and
`docker-compose.prod.yml`:

| Service | Image | Role |
|---|---|---|
| `frontend` | built from `frontend/Dockerfile` | nginx serving the web interface and this documentation, and passing `/api/`, `/psicquic/` and public media to the backend. Listens on **127.0.0.1:8080**. |
| `backend` | built from `backend/Dockerfile` | Django REST API, run by Gunicorn with 3 workers. Listens on 127.0.0.1:8001 for local checks. |
| `celery` | same image as `backend` | Background worker for dataset imports and UniProt enrichment. |
| `db` | `postgres:16` | The database, stored in the `postgres_data` volume. |
| `redis` | `redis:7-alpine` | Job queue for `celery`, and the store for rate-limit counters. |

Uploaded files (logos, avatars, published files, the cached dataset archive)
live in the `media` volume, shared by `backend` and `celery`.

```text
browser ──HTTPS──▶ host web server ──/v2/ stripped──▶ frontend :8080 ──▶ backend :8000
                   (TLS, your domain)                  (nginx)              │
                                                                            ├── db (Postgres)
                                                       celery ◀── redis ◀──┘
```

## Requirements

- A Linux server with **Docker Engine** and the **Docker Compose plugin,
  version 2.24.4 or later**. The production file uses Compose's `!override`
  tag, which older versions do not understand. Check with
  `docker compose version`.
- At least 2 GB of memory for the containers. The reference deployment's five
  containers use about 1.1 GB when idle. You also need disk space for your data.
- A domain name and a web server on the host for HTTPS, such as nginx with a
  certificate from Let's Encrypt.
- Outbound internet access from the server, used during imports to fetch
  protein details from UniProt, Ensembl and NCBI.

## 1. Get the code

```bash
git clone https://github.com/hamid-ananda/openpip-2.0.git
cd openpip-2.0
```

## 2. Configure

```bash
cp .env.example .env
```

Edit `.env`. At a minimum:

```ini
SECRET_KEY=<generated, see below>
DB_PASSWORD=<a strong password>
ALLOWED_HOSTS=openpip.example.org
CSRF_TRUSTED_ORIGINS=https://openpip.example.org
```

Generate the secret key with:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

!!! danger "Set `DB_PASSWORD` before the first start"
    Postgres takes its password from `DB_PASSWORD` only when the `db` volume is
    first created. If you start without it, the password is `openpip_dev`, which
    is published in this repository. Changing it afterwards needs an extra step;
    see [Maintenance](maintenance.md#changing-the-database-password).

The backend refuses to start with the example `SECRET_KEY`. Every variable is
described in the [Configuration reference](configuration.md).

## 3. Start

Production needs **both** compose files and the `prod` profile:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod up -d --build
```

| Part | Why it is needed |
|---|---|
| `-f docker-compose.prod.yml` | Switches the backend to production settings (HTTPS, the `/v2` prefix, real secret key), runs the code built into the image, and mounts the `media` volume. Without it the backend runs development settings with debug pages. |
| `--profile prod` | The `frontend` service only starts with this profile. |
| `--build` | Builds the images from your checkout. |

!!! warning "Never run plain `docker compose up -d` on a production server"
    Without the second file, Compose recreates the backend with development
    settings, and the site stops working behind the `/v2` prefix.

To save typing, define a shell alias:

```bash
alias dc='docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod'
```

On every start, the backend applies database migrations, collects static
files, and loads the default settings and four interaction categories if the
database has none yet. Then Gunicorn starts.

Check that everything is up:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend printenv DJANGO_SETTINGS_MODULE
```

All five services should be `running`, and the second command must print
`openpip.settings.prod`.

## 4. Put HTTPS in front

The `frontend` container serves plain HTTP on port 8080 and expects requests
**without** the `/v2` prefix. Your host web server terminates HTTPS, strips
`/v2` and forwards the request. A minimal nginx `server` block for the host:

```nginx
location /v2/ {
    proxy_pass http://127.0.0.1:8080/;          # trailing slash strips /v2
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;  # required, see below
    proxy_set_header X-Forwarded-For $remote_addr;
    client_max_body_size 500m;                   # dataset uploads
}
```

- **`X-Forwarded-Proto` is required.** Production settings redirect any
  request they believe arrived over plain HTTP to HTTPS, and they learn the
  original scheme from this header. Without it, every page redirects in a loop.
- **`X-Forwarded-For $remote_addr`** gives the backend the visitor's real
  address for rate limiting. Setting it to `$remote_addr`, rather than
  appending to whatever the client sent, stops visitors from choosing their own
  address.
- **`client_max_body_size`** must allow your largest dataset file. The
  frontend container itself accepts up to 500 MB.

!!! note "Serving at a different path"
    The `/v2` prefix is built into both images (`FORCE_SCRIPT_NAME` in
    `backend/openpip/settings/prod.py` and `VITE_BASE` in
    `frontend/.env.production`). To serve openPIP elsewhere, change both and
    rebuild.

Check from outside the server:

```bash
curl -s https://openpip.example.org/v2/api/counts
```

```json
{"proteins": 0, "interactions": 0, "datasets": 0}
```

## 5. Create the first administrator {#create-the-first-administrator}

Registration on the site creates ordinary accounts. Create the first
administrator on the server:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

Answer the prompts for username, email and password, then sign in on the site.
The **Admin** menu appears. From there you can promote other registered
accounts to administrators.

An account created this way has no security questions, so it cannot use
"Forgot password". Keep its password safe, or reset it on the server as
described in [Maintenance](maintenance.md#resetting-a-users-password).

## 6. Check that the ports are closed

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod ps
```

The `db` and `redis` rows should show no published port, and `frontend` and
`backend` should show `127.0.0.1:` only. Nothing is reachable from outside
except through your HTTPS proxy. If you see `0.0.0.0:` mappings, you are
running without `docker-compose.prod.yml`, or with a copy from before this was
fixed. Docker's published ports bypass `ufw`, so a host firewall alone does
not protect them.

## Next steps

- [Load your data](data-formats.md).
- Customise the portal from the **Admin** sidebar: **Site Identity** (name,
  logo, footer), **Appearance** (colours, network colours) and the **Pages**
  section (home page text, example searches, page content).
- Plan [backups](maintenance.md#backups).
