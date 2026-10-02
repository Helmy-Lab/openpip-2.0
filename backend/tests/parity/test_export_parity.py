"""
Parity tests: export / download content.

Tests the four production download endpoints by POSTing the legacy search result
to the production DownloadController on localhost:8000.  The production controller
receives pre-built JSON from the frontend and reformats it — it does NOT re-query
the DB independently.  Legacy download routes are not exposed on openpip.usask.ca
(Symfony routing cache issue), so we use the local Docker container directly.

For each format we verify that the gene names / interaction pairs in the legacy
download file match what the 2.0 search API returns for the same query.

Format notes: export-format-comparison spec (archived outside the repository).

Run with:
    pytest -m parity --no-header -q
"""

import csv
import json

import pytest
import requests as http

from rest_framework.test import APIClient

from .conftest import fetch_legacy_search, LEGACY_TIMEOUT

# Legacy download endpoints live in the local Docker container.
# Production routes on openpip.usask.ca return 404 (Symfony routing cache).
# From inside the backend container, reach the host via the Docker gateway.
import os as _os

LEGACY_DOWNLOAD_BASE = _os.environ.get("LEGACY_DOWNLOAD_BASE", "http://172.19.0.1:8000")

EXPORT_QUERIES = ["BRCA1", "TP53"]


# ── Helpers ──────────────────────────────────────────────────────────────────


def _post_legacy_download(path: str, data: dict) -> str:
    """POST to a legacy download endpoint; skip on any failure."""
    try:
        resp = http.post(
            f"{LEGACY_DOWNLOAD_BASE}{path}",
            data=data,
            timeout=LEGACY_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.text
    except (http.RequestException, OSError) as exc:
        pytest.skip(f"Legacy download endpoint unreachable: {exc}")


def _legacy_payload_interactions(legacy: dict) -> dict:
    """POST body for interaction-based downloads (interaction CSV, PSI-MI TAB)."""
    return {
        "data_request_data": json.dumps(legacy.get("all_interactions", [])),
        "data_request_query_id_array": json.dumps(
            legacy.get("query_protein_id_array", [])
        ),
        "data_request_search_query": legacy.get("search_term", ""),
        "data_request_query_parameters": json.dumps(["parity-test", 0, {}, []]),
    }


def _legacy_payload_proteins(legacy: dict) -> dict:
    """POST body for protein-based downloads (interactor CSV, FASTA)."""
    return {
        "data_request_data": json.dumps(legacy.get("all_proteins", [])),
        "data_request_query_id_array": json.dumps(
            legacy.get("query_protein_id_array", [])
        ),
        "data_request_search_query": legacy.get("search_term", ""),
        "data_request_query_parameters": json.dumps(["parity-test", 0, {}, []]),
    }


def _fetch_legacy(q: str) -> dict | None:
    try:
        return fetch_legacy_search(q)
    except Exception as exc:
        pytest.skip(f"Legacy search unreachable: {exc}")


def _v2_search(client: APIClient, q: str) -> dict:
    resp = client.get("/api/search", {"q": q, "filter": "None"})
    assert resp.status_code == 200, f"2.0 returned {resp.status_code} for '{q}'"
    return resp.json()


def _skip_if_empty(v2: dict, q: str) -> None:
    if not v2.get("all_proteins"):
        pytest.skip(f"2.0 DB has no data for '{q}' — run migration first")


# ── Data row filters ──────────────────────────────────────────────────────────


def _data_rows(text: str) -> list[list[str]]:
    """Return non-empty, non-comment rows (skips header and ## footer)."""
    return [
        row
        for row in csv.reader(
            line
            for line in text.replace("\r\n", "\n").splitlines()
            if line and not line.startswith("#")
        )
    ]


# ── Parsers for legacy production download formats ───────────────────────────


def _parse_interaction_csv_pairs(text: str) -> set:
    """
    Production interaction CSV:
      header: Unique identifier for interactor A,...,Interaction Status
      cols:   UniProt A, UniProt B, Ensembl A, Ensembl B, Gene A, Gene B, ...
    Gene names are in columns 4 and 5 (0-indexed).
    """
    rows = _data_rows(text)
    pairs: set = set()
    for row in rows[1:]:  # skip header
        if len(row) >= 6:
            g1, g2 = row[4].strip(), row[5].strip()
            if g1 and g2:
                pairs.add(frozenset((g1, g2)))
    return pairs


def _parse_interactor_csv_genes(text: str) -> set:
    """
    Production interactor CSV:
      header: Gene Name,UniProt ID,Ensembl ID,Entrez ID,Description,Query Status,...
    Gene name is in column 0.
    """
    rows = _data_rows(text)
    return {row[0].strip() for row in rows[1:] if row and row[0].strip()}


def _parse_fasta_genes(text: str) -> set:
    """
    Production FASTA header format:
      >Gene Name:BRCA1,UniProt ID:P38398,Ensembl ID:...,Entrez ID:...,Query Status:query

    Legacy PHP outputs FASTA entries even for proteins with null sequences
    (malformed FASTA — empty sequence line).  We match 2.0 behaviour by only
    including genes whose sequence line is non-empty.
    """
    genes: set = set()
    current_gene: str | None = None
    for line in text.splitlines():
        line = line.rstrip("\r")
        if line.startswith(">"):
            current_gene = None
            for part in line[1:].split(","):
                k, _, v = part.partition(":")
                if k.strip() == "Gene Name" and v.strip():
                    current_gene = v.strip()
                    break
        elif current_gene is not None:
            if line.strip():  # non-empty sequence → valid FASTA entry
                genes.add(current_gene)
            current_gene = None
    return genes


def _parse_psimitab_pairs(text: str) -> set:
    """
    Production PSI-MI TAB:
      col[0] = UniProt A (no prefix), col[4] = Gene A, col[5] = Gene B
    """
    pairs: set = set()
    lines = text.replace("\r\n", "\n").splitlines()
    for line in lines[1:]:  # skip header
        if not line or line.startswith("#"):
            continue
        cols = line.split("\t")
        if len(cols) >= 6:
            g1, g2 = cols[4].strip(), cols[5].strip()
            if g1 and g2 and g1 != "-" and g2 != "-":
                pairs.add(frozenset((g1, g2)))
    return pairs


# ── Extractors for 2.0 search result ─────────────────────────────────────────


def _v2_interaction_pairs(v2: dict) -> set:
    return {
        frozenset(
            (
                ix["interactor_A"]["protein_gene_name"],
                ix["interactor_B"]["protein_gene_name"],
            )
        )
        for ix in v2.get("all_interactions", [])
    }


def _v2_gene_names(v2: dict) -> set:
    return {
        p["protein_gene_name"]
        for p in v2.get("all_proteins", [])
        if p.get("protein_gene_name")
    }


def _v2_genes_with_sequence(v2: dict) -> set:
    return {
        p["protein_gene_name"]
        for p in v2.get("all_proteins", [])
        if p.get("protein_gene_name") and p.get("protein_sequence")
    }


# ── Test class ────────────────────────────────────────────────────────────────


@pytest.mark.parity
@pytest.mark.slow
@pytest.mark.django_db
class TestExportParity:
    """
    Download content parity: 2.0 search result data must match legacy download files.

    Legacy download routes are POST-only (no search_term in URL path).  The
    production DownloadController receives pre-built JSON from the frontend and
    reformats it — so we POST the legacy search result to get the legacy download.
    """

    @pytest.fixture(autouse=True)
    def _setup(self):
        self.client = APIClient()

    # ── Interaction CSV ───────────────────────────────────────────────────────

    @pytest.mark.parametrize("q", EXPORT_QUERIES)
    def test_interaction_csv_gene_pairs(self, q):
        """
        Legacy interaction CSV cols 4+5 are gene names.
        2.0 search result all_interactions must contain the same gene pairs.
        """
        legacy = _fetch_legacy(q)
        text = _post_legacy_download(
            "/download/interaction_csv/", _legacy_payload_interactions(legacy)
        )
        v2 = _v2_search(self.client, q)
        _skip_if_empty(v2, q)

        legacy_pairs = _parse_interaction_csv_pairs(text)
        v2_pairs = _v2_interaction_pairs(v2)

        only_legacy = legacy_pairs - v2_pairs
        only_v2 = v2_pairs - legacy_pairs
        assert not only_legacy and not only_v2, (
            f"Interaction gene pairs mismatch for '{q}'.\n"
            f"  Only in legacy ({len(only_legacy)}): "
            f"{sorted(str(p) for p in only_legacy)[:10]}\n"
            f"  Only in 2.0   ({len(only_v2)}): "
            f"{sorted(str(p) for p in only_v2)[:10]}"
        )

    # ── Interactor CSV ────────────────────────────────────────────────────────

    @pytest.mark.parametrize("q", EXPORT_QUERIES)
    def test_interactor_csv_gene_names(self, q):
        """
        Legacy interactor CSV col 0 is the gene name.
        2.0 all_proteins must contain the same set of gene names.
        """
        legacy = _fetch_legacy(q)
        text = _post_legacy_download(
            "/download/interactor_csv/", _legacy_payload_proteins(legacy)
        )
        v2 = _v2_search(self.client, q)
        _skip_if_empty(v2, q)

        legacy_genes = _parse_interactor_csv_genes(text)
        v2_genes = _v2_gene_names(v2)

        assert legacy_genes == v2_genes, (
            f"Interactor gene names mismatch for '{q}'.\n"
            f"  Only in legacy: {sorted(legacy_genes - v2_genes)}\n"
            f"  Only in 2.0:   {sorted(v2_genes - legacy_genes)}"
        )

    # ── FASTA ─────────────────────────────────────────────────────────────────

    @pytest.mark.parametrize("q", EXPORT_QUERIES)
    def test_fasta_gene_names(self, q):
        """
        Legacy FASTA header: >Gene Name:BRCA1,UniProt ID:...,... (non-standard format).
        2.0 proteins with a sequence must match the same gene set.
        """
        legacy = _fetch_legacy(q)
        text = _post_legacy_download(
            "/download/multi_fasta/", _legacy_payload_proteins(legacy)
        )
        v2 = _v2_search(self.client, q)
        _skip_if_empty(v2, q)

        legacy_genes = _parse_fasta_genes(text)
        v2_genes = _v2_genes_with_sequence(v2)

        assert legacy_genes == v2_genes, (
            f"FASTA gene names mismatch for '{q}'.\n"
            f"  Only in legacy: {sorted(legacy_genes - v2_genes)}\n"
            f"  Only in 2.0:   {sorted(v2_genes - legacy_genes)}"
        )

    # ── PSI-MI TAB ────────────────────────────────────────────────────────────

    @pytest.mark.parametrize("q", EXPORT_QUERIES)
    def test_psimitab_gene_pairs(self, q):
        """
        Legacy PSI-MI TAB col[4]/col[5] are gene names (no namespace prefix).
        2.0 all_interactions must contain the same gene pairs.
        """
        legacy = _fetch_legacy(q)
        text = _post_legacy_download(
            "/download/interaction_psi_mitab/", _legacy_payload_interactions(legacy)
        )
        v2 = _v2_search(self.client, q)
        _skip_if_empty(v2, q)

        legacy_pairs = _parse_psimitab_pairs(text)
        v2_pairs = _v2_interaction_pairs(v2)

        only_legacy = legacy_pairs - v2_pairs
        only_v2 = v2_pairs - legacy_pairs
        assert not only_legacy and not only_v2, (
            f"PSI-MI TAB gene pairs mismatch for '{q}'.\n"
            f"  Only in legacy ({len(only_legacy)}): "
            f"{sorted(str(p) for p in only_legacy)[:10]}\n"
            f"  Only in 2.0   ({len(only_v2)}): "
            f"{sorted(str(p) for p in only_v2)[:10]}"
        )
