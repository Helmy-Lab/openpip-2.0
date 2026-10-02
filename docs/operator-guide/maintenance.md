# Maintenance

Routine tasks for a running portal. Every command is run from the repository
checkout on the server. For readability this page uses `dc` as shorthand for
the production compose command:

```bash
alias dc='docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod'
```

## Starting, stopping and logs

```bash
dc up -d          # start, or apply configuration changes
dc stop           # stop, keeping the containers
dc ps             # status of each service
dc logs -f backend celery   # follow the logs
```

Prefer `dc stop` to `dc down`. `down` removes the containers. Your data
survives because it lives in volumes, but there is rarely a reason to remove
the containers.

The backend logs warnings and errors. The `celery` log shows each import as it
runs.

## Backups

A portal's state lives in two volumes: the database and the uploaded media.
Back up both.

Docker Compose names volumes after the project, which is the checkout's folder
name. List them with:

```bash
docker volume ls | grep -E '_(postgres_data|media)$'
```

The examples below use the reference deployment's names, `openpip-20_media`
and `openpip-20_postgres_data`.

### Database

```bash
dc exec -T db pg_dump -U openpip -Fc openpip > openpip-$(date +%F).dump
```

This takes a consistent snapshot while the site keeps running. On the
reference deployment (about 123,000 interactions) it takes about 8 seconds and
writes a 33 MB file.

### Media

```bash
docker run --rm -v openpip-20_media:/media:ro -v "$PWD":/backup alpine \
  tar czf /backup/media-$(date +%F).tar.gz -C /media .
```

The media volume holds the logo, user avatars, files published on the
Downloads page, and the cached all-datasets archive (`cache/`), which is
rebuilt on demand and need not be kept.

### Restoring

Stop the services that write to the database, restore, then start again:

```bash
dc stop backend celery
dc exec -T db pg_restore -U openpip -d openpip --clean --if-exists < openpip-2026-10-01.dump
docker run --rm -v openpip-20_media:/media -v "$PWD":/backup alpine \
  tar xzf /backup/media-2026-10-01.tar.gz -C /media
dc up -d
```

Restoring a database also restores its user accounts and passwords as they
were at the time of the backup.

## Upgrading

```bash
git pull
dc up -d --build
```

The backend applies any new database migrations as it starts. Back up first,
and read the release notes for anything that needs doing by hand.

Rebuilding recreates the containers, which interrupts the site for a few
seconds. After an upgrade, check:

```bash
dc ps
dc exec backend printenv DJANGO_SETTINGS_MODULE    # must be openpip.settings.prod
curl -s https://openpip.example.org/v2/api/counts
```

## Managing users

Administrators promote and demote accounts in **Admin → Accounts**.
Tasks that need the server:

### Creating an administrator

```bash
dc exec backend python manage.py createsuperuser
```

### Resetting a user's password

For a user who has forgotten their password and has no security questions,
which is the case for accounts created before security questions existed and
for accounts made with `createsuperuser`:

```bash
dc exec backend python manage.py changepassword <username>
```

Changing the password signs that account out of every browser within an hour.

## The Django admin

Superusers can also manage the database directly at `/django-admin/` (on the
reference deployment, `https://openpip.usask.ca/v2/django-admin/`). Use it with
care: it edits tables directly, without the checks the admin panel makes.

## Changing the database password

`DB_PASSWORD` in `.env` is only read when the database volume is first
created. To change it on an existing portal:

1. Set the new password inside Postgres:

    ```bash
    dc exec db psql -U openpip -d openpip -c "ALTER USER openpip PASSWORD 'new-password';"
    ```

2. Put the same value in `.env` as `DB_PASSWORD=new-password`.
3. Recreate the services that connect to the database:

    ```bash
    dc up -d --force-recreate backend celery
    ```

Until step 3 finishes, the backend keeps working on its existing connections
but cannot open new ones, so do the three steps together.

## Changing the secret key

Edit `SECRET_KEY` in `.env`, then:

```bash
dc up -d --force-recreate backend celery
```

Every user is signed out, because tokens signed with the old key stop working.

## Housekeeping

Retired sign-in tokens are kept in the database until they expire. Remove the
expired ones occasionally:

```bash
dc exec backend python manage.py flushexpiredtokens
```

## Linking proteins to organisms

Data migrated from the original openPIP has no organism information, so the
taxon columns of PSICQUIC output show `-`. This command looks each protein's
organism up in UniProt and links it. It needs internet access, and you can
run it again safely:

```bash
dc exec backend python manage.py backfill_protein_organisms --dry-run   # report only
dc exec backend python manage.py backfill_protein_organisms
```

| Option | Meaning |
|---|---|
| `--dry-run` | Report what would change without saving. |
| `--limit N` | Process at most N proteins. |
| `--sleep S` | Seconds to wait between UniProt requests. Default 1. |

Proteins added through the upload wizard are linked automatically during the
import.
