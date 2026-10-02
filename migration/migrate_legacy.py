#!/usr/bin/env python3
"""
One-time migration: legacy MySQL (mysql8 Docker container) → 2.0 Postgres.

Usage:
    cd ~/openpip-2.0
    backend/.venv/bin/python migration/migrate_legacy.py [--reset]

    --reset   Truncate all target tables before inserting (for dev re-runs).

Prerequisites:
    - docker compose up -d db  (2.0 Postgres running on localhost:5432)
    - cd backend && python manage.py migrate
    - DATABASE_URL in ~/openpip-2.0/.env
"""
import argparse
import os
import sys

import psycopg2
import psycopg2.extras
import pymysql
import pymysql.cursors
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# The temporary MySQL container holding the legacy dump (see the operator
# guide, "Migrating from the original openPIP").
MYSQL_HOST = os.environ.get("MYSQL_HOST", "127.0.0.1")
MYSQL_USER = os.environ.get("MYSQL_USER", "root")
MYSQL_PASS = os.environ.get("MYSQL_PASS", "secret")
MYSQL_DB = os.environ.get("MYSQL_DB", "huri")

BATCH_SIZE = 5000

# Tables in FK dependency order — parents before children.
# Skip: user (FOSUserBundle format), fos_group, fos_user_user_group, test_table
TABLES = [
    "admin_settings",
    "announcement",
    "annotation_type",
    "organism",
    "protein",
    "identifier",
    "protein_identifier",
    "protein_organism",
    "protein_isoform",
    "interaction_category",
    "interaction",
    "dataset",
    "interaction_dataset",
    "interaction_interaction_category",
    "domain",
    "interaction_domain",
    "complex",
    "complex_protein",
    "annotation",
    "annotation_protein",
    "annotation_interaction",
    "interaction_network",
    "interaction_interaction_networks",
    "support_information",
    "interaction_support_information",
    "data_file",
    "dataset_request",
    "dataset_request_dataset",
    "external_link",
]


def get_mysql_columns(mysql_conn, table: str) -> list[str]:
    with mysql_conn.cursor() as cur:
        cur.execute(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA=%s AND TABLE_NAME=%s ORDER BY ORDINAL_POSITION",
            (MYSQL_DB, table),
        )
        return [row["COLUMN_NAME"] for row in cur.fetchall()]


def get_pg_columns(pg_conn, table: str) -> set[str]:
    with pg_conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name=%s",
            (table,),
        )
        return {row[0] for row in cur.fetchall()}


def get_pg_bool_columns(pg_conn, table: str) -> set[str]:
    with pg_conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name=%s AND data_type='boolean'",
            (table,),
        )
        return {row[0] for row in cur.fetchall()}


def migrate_table(mysql_conn, pg_conn, table: str, reset: bool) -> int:
    mysql_cols = get_mysql_columns(mysql_conn, table)
    pg_cols = get_pg_columns(pg_conn, table)
    bool_cols = get_pg_bool_columns(pg_conn, table)

    # Only migrate columns that exist in both schemas
    shared_cols = [c for c in mysql_cols if c in pg_cols]
    if not shared_cols:
        print(f"  {table}: no shared columns, skipping")
        return 0

    skipped = [c for c in mysql_cols if c not in pg_cols]
    if skipped:
        print(f"  {table}: skipping legacy-only columns: {skipped}")

    col_list = ", ".join(f"`{c}`" for c in shared_cols)
    with mysql_conn.cursor() as cur:
        cur.execute(f"SELECT COUNT(*) as n FROM `{table}`")
        total = cur.fetchone()["n"]

    if total == 0:
        print(f"  {table}: empty")
        return 0

    with pg_conn.cursor() as cur:
        if reset:
            cur.execute(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE')
        cur.execute("SET session_replication_role = replica")
    pg_conn.commit()

    inserted = 0
    pg_col_list = ", ".join(f'"{c}"' for c in shared_cols)
    insert_sql = (
        f'INSERT INTO "{table}" ({pg_col_list}) VALUES %s ON CONFLICT DO NOTHING'
    )

    with mysql_conn.cursor() as cur:
        cur.execute(f"SELECT {col_list} FROM `{table}`")
        while True:
            rows = cur.fetchmany(BATCH_SIZE)
            if not rows:
                break
            values = [
                tuple(
                    bool(row[c]) if c in bool_cols and row[c] is not None else row[c]
                    for c in shared_cols
                )
                for row in rows
            ]
            with pg_conn.cursor() as pg_cur:
                psycopg2.extras.execute_values(pg_cur, insert_sql, values)
            pg_conn.commit()
            inserted += len(rows)

    with pg_conn.cursor() as cur:
        cur.execute("SET session_replication_role = DEFAULT")
        if "id" in shared_cols:
            cur.execute(
                f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                f'COALESCE(MAX(id), 1)) FROM "{table}"'
            )
    pg_conn.commit()

    return inserted


def main():
    parser = argparse.ArgumentParser(
        description="Migrate legacy MySQL data to Postgres"
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Truncate tables before inserting (safe for dev re-runs)",
    )
    args = parser.parse_args()

    db_url = os.environ.get(
        "DATABASE_URL", "postgres://openpip:openpip_dev@localhost:5432/openpip"
    )
    pg_conn = psycopg2.connect(db_url)
    mysql_conn = pymysql.connect(
        host=MYSQL_HOST,
        user=MYSQL_USER,
        password=MYSQL_PASS,
        database=MYSQL_DB,
        cursorclass=pymysql.cursors.DictCursor,
        charset="utf8mb4",
    )

    total_rows = 0
    failed = []

    for table in TABLES:
        try:
            rows = migrate_table(mysql_conn, pg_conn, table, reset=args.reset)
            print(f"  OK {table}: {rows} rows")
            total_rows += rows
        except Exception as exc:
            print(f"  FAIL {table}: {exc}")
            failed.append(table)
            pg_conn.rollback()

    mysql_conn.close()
    pg_conn.close()

    print(f"\nDone. {total_rows} total rows migrated.")
    if failed:
        print(f"Failed tables: {failed}")
        sys.exit(1)


if __name__ == "__main__":
    main()
