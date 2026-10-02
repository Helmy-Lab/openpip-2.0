# Migrating from the original openPIP

A portal running the original openPIP (PHP and MySQL) can move its data into
openPIP 2.0 with `migration/migrate_legacy.py`. The script copies the
database's tables into the new PostgreSQL schema, which keeps the original
table and column names.

!!! warning "Work from a copy"
    Never point the script at your live MySQL server. Export a dump and load it
    into a separate MySQL instance used only for the migration, as below.

## What is migrated

Copied, in an order that respects foreign keys: site settings,
announcements, proteins and their identifiers, isoforms, organisms, interaction
categories, interactions, datasets, domains, complexes, annotations, saved
networks, supporting information, data files, dataset requests and external
links.

Not copied:

- **User accounts.** The original openPIP's password format cannot be carried
  over. Users register again, and you recreate administrators (see
  [Installation](installation.md#create-the-first-administrator)).
- Tables that exist only in 2.0, such as interaction participants and
  published files. They start empty.

Only columns that exist in both schemas are copied.

## Steps

### 1. Prepare openPIP 2.0

Install openPIP 2.0 as in [Installation](installation.md), and start it once
so the database tables exist. The script connects to Postgres from the host
on `localhost:5432`, using `DATABASE_URL` from the repository's `.env`:

```ini
DATABASE_URL=postgres://openpip:<DB_PASSWORD>@localhost:5432/openpip
```

The development compose file publishes port 5432 on the host. If yours does
not, run the migration on a development copy and move the result to
production with a [database backup and restore](maintenance.md#backups).

### 2. Load the old database into a temporary MySQL

Export the original database with `mysqldump`, then load it into a temporary
MySQL 8 container:

```bash
docker run -d --name legacy-mysql -e MYSQL_ROOT_PASSWORD=secret -e MYSQL_DATABASE=huri mysql:8
# wait until it accepts connections, then:
docker exec -i legacy-mysql mysql -uroot -psecret huri < openpip-legacy.sql
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' legacy-mysql
```

The last command prints the container's address.

### 3. Point the script at it

The MySQL connection is set at the top of `migration/migrate_legacy.py`:

```python
MYSQL_HOST = '172.18.0.3'
MYSQL_USER = 'root'
MYSQL_PASS = 'secret'
MYSQL_DB = 'huri'
```

Set `MYSQL_HOST` to the address from step 2, and the other three to match your
temporary container. The script connects on MySQL's default port, 3306.

### 4. Run it

```bash
python3 -m venv .venv-migrate
.venv-migrate/bin/pip install -r migration/requirements.txt
.venv-migrate/bin/python migration/migrate_legacy.py --reset
```

`--reset` empties each target table first. Use it: on its first start,
openPIP 2.0 created default site settings and four interaction categories,
and without `--reset` those rows would be kept instead of your own. The script
prints a line per table and exits with an error if any table failed.

### 5. Finish

- Link proteins to their organisms, which the original openPIP did not
  record (see
  [Linking proteins to organisms](maintenance.md#linking-proteins-to-organisms)).
- Create an administrator, and check the site settings and dataset citations
  in the admin panel.
- Remove the temporary container: `docker rm -f legacy-mysql`.
