"""
Shared fixtures and helpers for parity tests.

Run parity tests with:
    pytest -m parity --no-header -q

They require:
  1. Network access to openpip.usask.ca
  2. The live openpip database running (docker compose up -d db)

These tests bypass the pytest-django test database and query the live
`openpip` database directly (read-only). The django_db_setup override
below skips test DB creation entirely.
"""

import json
import os
import re

import pytest
import requests

LEGACY_BASE = os.environ.get("LEGACY_BASE", "https://openpip.usask.ca")


@pytest.fixture(scope="session")
def django_db_setup():
    """Skip test DB creation — parity tests read from the live openpip database."""
    pass


LEGACY_TIMEOUT = 20  # seconds


def fetch_legacy_search(search_term: str, filter_parameter: str = "None") -> dict:
    """
    POST /search_results_interactions on the legacy site.

    The legacy Symfony controller does:
        $json = json_encode(array(...));          # PHP string
        $response = new JsonResponse();
        $response->setData($json);               # JsonResponse re-encodes the string
    so the HTTP body is a JSON-encoded string. We unwrap both layers.
    """
    terms = [t.strip() for t in search_term.split(",") if t.strip()]
    payload: dict = {
        "search_term_parameter": search_term,
        "filter_parameter": filter_parameter,
    }
    for i, t in enumerate(terms):
        payload[f"search_term_array[{i}]"] = t

    resp = requests.post(
        f"{LEGACY_BASE}/search_results_interactions",
        data=payload,
        timeout=LEGACY_TIMEOUT,
    )
    resp.raise_for_status()

    parsed = resp.json()
    # Handle double-encoding: if JsonResponse wrapped a pre-encoded string
    if isinstance(parsed, str):
        return json.loads(parsed)
    return parsed


def gene_names(result: dict) -> set:
    return {
        p["protein_gene_name"]
        for p in result.get("all_proteins", [])
        if p.get("protein_gene_name")
    }


def interaction_ids(result: dict) -> set:
    # Normalize to int: legacy MySQLi fetch_assoc() returns IDs as strings;
    # Django ORM returns integer PKs.
    return {int(ix["interaction_id"]) for ix in result.get("all_interactions", [])}


def split_summary(s: str) -> set:
    """Split a <br>-delimited summary string into a set of terms."""
    return {
        t.strip() for t in re.split(r"</?br\s*/?>", s, flags=re.IGNORECASE) if t.strip()
    }
