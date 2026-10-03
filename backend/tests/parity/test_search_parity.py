"""
Parity tests: search endpoint.

Compares GET /api/search?q=...&filter=... against the legacy
POST /search_results_interactions endpoint of the legacy portal (LEGACY_BASE).

Run with:
    pytest -m parity --no-header -q

Both systems must be live and the 2.0 DB must contain migrated data.
Tests skip gracefully when either precondition is unmet.
"""

import pytest
import requests as http

from rest_framework.test import APIClient

from .conftest import (
    fetch_legacy_search,
    gene_names,
    interaction_ids,
    split_summary,
)

# ── Representative search cases ─────────────────────────────────────────────
# (search_term, filter_parameter)
# Chosen to cover: single gene, multi-gene, all three filter modes, no-result.
SEARCH_CASES = [
    ("BRCA1", "None"),
    ("TP53", "None"),
    ("BRCA1,BRCA2", "None"),
    ("BRCA1", "query_interactor"),
    ("BAD,BAK1,BMF,MCL1", "query_query"),
    ("COA7", "None"),
    ("NONEXISTENT_GENE_XYZ123", "None"),
]


def _v2_search(client: APIClient, search_term: str, filter_parameter: str) -> dict:
    resp = client.get("/api/search", {"q": search_term, "filter": filter_parameter})
    assert (
        resp.status_code == 200
    ), f"2.0 returned {resp.status_code} for '{search_term}'"
    return resp.json()


def _legacy(search_term: str, filter_parameter: str) -> dict | None:
    """Fetch from legacy; return None (triggering skip) on any network error."""
    try:
        return fetch_legacy_search(search_term, filter_parameter)
    except (http.RequestException, ValueError) as exc:
        pytest.skip(f"Legacy server unreachable ({exc})")


def _skip_if_empty(v2_result: dict, legacy_result: dict, search_term: str) -> None:
    """Skip test when 2.0 DB has no data but legacy does — migration not run yet."""
    if not v2_result.get("all_proteins") and legacy_result.get("all_proteins"):
        pytest.skip(
            f"2.0 DB has no data for '{search_term}' — run data migration first"
        )


# ── Test class ───────────────────────────────────────────────────────────────


@pytest.mark.parity
@pytest.mark.slow
@pytest.mark.django_db
class TestSearchParity:
    """Search result parity: 2.0 must match legacy for the same query."""

    @pytest.fixture(autouse=True)
    def _setup(self):
        self.client = APIClient()

    # ── Protein set ──────────────────────────────────────────────────────────

    @pytest.mark.parametrize("search_term,filter_param", SEARCH_CASES)
    def test_protein_gene_names_match(self, search_term, filter_param):
        legacy = _legacy(search_term, filter_param)
        v2 = _v2_search(self.client, search_term, filter_param)
        _skip_if_empty(v2, legacy, search_term)

        legacy_genes = gene_names(legacy)
        v2_genes = gene_names(v2)

        assert v2_genes == legacy_genes, (
            f"Protein mismatch for q='{search_term}' filter={filter_param}\n"
            f"  only in legacy: {sorted(legacy_genes - v2_genes)}\n"
            f"  only in 2.0:    {sorted(v2_genes - legacy_genes)}"
        )

    # ── Interaction set ──────────────────────────────────────────────────────

    @pytest.mark.parametrize("search_term,filter_param", SEARCH_CASES)
    def test_interaction_ids_match(self, search_term, filter_param):
        legacy = _legacy(search_term, filter_param)
        v2 = _v2_search(self.client, search_term, filter_param)
        _skip_if_empty(v2, legacy, search_term)

        legacy_ids = interaction_ids(legacy)
        v2_ids = interaction_ids(v2)

        assert v2_ids == legacy_ids, (
            f"Interaction ID mismatch for q='{search_term}' filter={filter_param}\n"
            f"  only in legacy: {sorted(legacy_ids - v2_ids)[:20]}\n"
            f"  only in 2.0:    {sorted(v2_ids - legacy_ids)[:20]}\n"
            f"  counts: legacy={len(legacy_ids)}, 2.0={len(v2_ids)}"
        )

    # ── Query protein array ───────────────────────────────────────────────────

    @pytest.mark.parametrize("search_term,filter_param", SEARCH_CASES)
    def test_query_protein_id_array_matches(self, search_term, filter_param):
        legacy = _legacy(search_term, filter_param)
        v2 = _v2_search(self.client, search_term, filter_param)
        _skip_if_empty(v2, legacy, search_term)

        legacy_qids = set(legacy.get("query_protein_id_array", []))
        v2_qids = set(v2.get("query_protein_id_array", []))

        assert v2_qids == legacy_qids, (
            f"query_protein_id_array mismatch for q='{search_term}' filter={filter_param}: "
            f"legacy={sorted(legacy_qids)}, 2.0={sorted(v2_qids)}"
        )

    # ── Found / unfound summaries ─────────────────────────────────────────────

    @pytest.mark.parametrize("search_term,filter_param", SEARCH_CASES)
    def test_found_unfound_summaries_match(self, search_term, filter_param):
        legacy = _legacy(search_term, filter_param)
        v2 = _v2_search(self.client, search_term, filter_param)
        _skip_if_empty(v2, legacy, search_term)

        legacy_found = split_summary(legacy.get("found_protein_summary", ""))
        v2_found = split_summary(v2.get("found_protein_summary", ""))
        legacy_unfound = split_summary(legacy.get("unfound_protein_summary", ""))
        v2_unfound = split_summary(v2.get("unfound_protein_summary", ""))

        assert v2_found == legacy_found, (
            f"found_protein_summary mismatch for q='{search_term}': "
            f"legacy={sorted(legacy_found)}, 2.0={sorted(v2_found)}"
        )
        assert v2_unfound == legacy_unfound, (
            f"unfound_protein_summary mismatch for q='{search_term}': "
            f"legacy={sorted(legacy_unfound)}, 2.0={sorted(v2_unfound)}"
        )

    # ── Response shape ────────────────────────────────────────────────────────

    @pytest.mark.parametrize("search_term,filter_param", [("BRCA1", "None")])
    def test_response_shape_present(self, search_term, filter_param):
        """Verify 2.0 returns all top-level keys the legacy API returns."""
        v2 = _v2_search(self.client, search_term, filter_param)
        required_keys = {
            "all_proteins",
            "all_interactions",
            "domains",
            "complexes",
            "query_protein_id_array",
            "search_term",
            "found_protein_summary",
            "unfound_protein_summary",
        }
        missing = required_keys - v2.keys()
        assert not missing, f"2.0 response missing keys: {missing}"

    @pytest.mark.parametrize("search_term,filter_param", [("BRCA1", "None")])
    def test_protein_node_shape(self, search_term, filter_param):
        """Each protein node must carry the legacy field set."""
        v2 = _v2_search(self.client, search_term, filter_param)
        _skip_if_empty(v2, {"all_proteins": ["x"]}, search_term)

        required = {
            "protein_id",
            "protein_uniprot_id",
            "protein_ensembl_id",
            "protein_entrez_id",
            "protein_gene_name",
            "protein_protein_name",
            "protein_description",
            "protein_sequence",
            "number_of_interactions_in_database",
            "annotation_array",
        }
        for node in v2["all_proteins"]:
            missing = required - node.keys()
            assert (
                not missing
            ), f"Protein node missing keys: {missing} in {node.get('protein_gene_name')}"

    @pytest.mark.parametrize("search_term,filter_param", [("BRCA1", "None")])
    def test_interaction_edge_shape(self, search_term, filter_param):
        """Each interaction edge must carry the legacy field set."""
        v2 = _v2_search(self.client, search_term, filter_param)
        _skip_if_empty(v2, {"all_proteins": ["x"]}, search_term)

        required = {
            "interaction_id",
            "interactor_A",
            "interactor_B",
            "score",
            "annotation_array",
            "experiment_array",
            "dataset_array",
            "interaction_category_array",
        }
        for edge in v2["all_interactions"]:
            missing = required - edge.keys()
            assert not missing, f"Interaction edge missing keys: {missing}"
