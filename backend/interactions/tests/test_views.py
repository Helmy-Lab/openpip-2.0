import pytest
from proteins.tests.factories import (
    ProteinFactory,
    IdentifierFactory,
    ProteinIdentifierFactory,
)
from interactions.tests.factories import (
    InteractionFactory,
    InteractionCategoryFactory,
    InteractionInteractionCategoryFactory,
)
from datasets.tests.factories import DatasetFactory


def _make_protein_with_identifier(gene_name, uniprot_id="P00001"):
    protein = ProteinFactory(gene_name=gene_name, uniprot_id=uniprot_id)
    identifier = IdentifierFactory(identifier=gene_name, naming_convention="gene_name")
    ProteinIdentifierFactory(protein=protein, identifier=identifier)
    return protein


@pytest.mark.django_db
def test_search_returns_search_result_shape(api_client):
    _make_protein_with_identifier("BAD", "Q92934")
    response = api_client.get("/api/search?q=BAD")
    assert response.status_code == 200
    data = response.json()
    assert "all_proteins" in data
    assert "all_interactions" in data
    assert "query_protein_id_array" in data
    assert "found_protein_summary" in data
    assert "unfound_protein_summary" in data


@pytest.mark.django_db
def test_search_finds_proteins_case_insensitive(api_client):
    _make_protein_with_identifier("BRCA1")
    response = api_client.get("/api/search?q=brca1")
    assert response.status_code == 200
    data = response.json()
    assert len(data["all_proteins"]) >= 1
    gene_names = [p["protein_gene_name"] for p in data["all_proteins"]]
    assert "BRCA1" in gene_names


@pytest.mark.django_db
def test_search_found_unfound_summary(api_client):
    _make_protein_with_identifier("BAD")
    response = api_client.get("/api/search?q=BAD,NOTFOUND")
    assert response.status_code == 200
    data = response.json()
    assert data["found_protein_summary"] == "BAD"
    assert data["unfound_protein_summary"] == "NOTFOUND"


@pytest.mark.django_db
def test_search_returns_interactions(api_client):
    p1 = _make_protein_with_identifier("BAD", "Q92934")
    p2 = _make_protein_with_identifier("BCL2L1", "Q07817")
    cat = InteractionCategoryFactory(category_name="Published", order="1")
    dataset = DatasetFactory(
        name="HuRI",
        pubmed_id="24153252",
        author="Rolland et al.(2014)",
        year="2014",
        interaction_status="Published",
    )
    ix = InteractionFactory(interactor_A=p1, interactor_B=p2, removed="0", score="0.82")
    InteractionInteractionCategoryFactory(interaction=ix, interaction_category=cat)

    from interactions.models import InteractionDataset

    InteractionDataset.objects.create(interaction=ix, dataset=dataset)

    response = api_client.get("/api/search?q=BAD,BCL2L1")
    assert response.status_code == 200
    data = response.json()
    assert len(data["all_interactions"]) == 1
    ix_data = data["all_interactions"][0]
    assert ix_data["interactor_A"]["protein_gene_name"] in ("BAD", "BCL2L1")
    assert ix_data["score"] == 0.82
    assert len(ix_data["dataset_array"]) == 1
    assert ix_data["dataset_array"][0]["name"] == "HuRI"
    assert (
        ix_data["interaction_category_array"]["highest_category_status"] == "Published"
    )


@pytest.mark.django_db
def test_search_excludes_removed_interactions(api_client):
    p1 = _make_protein_with_identifier("BAD")
    p2 = _make_protein_with_identifier("BCL2L1")
    InteractionFactory(interactor_A=p1, interactor_B=p2, removed="1")
    response = api_client.get("/api/search?q=BAD,BCL2L1")
    assert response.status_code == 200
    assert len(response.json()["all_interactions"]) == 0


@pytest.mark.django_db
def test_search_interactors_endpoint(api_client):
    p1 = _make_protein_with_identifier("BAD")
    p2 = _make_protein_with_identifier("BCL2L1")
    InteractionFactory(interactor_A=p1, interactor_B=p2, removed="0")
    response = api_client.post(
        "/api/search/interactors",
        {
            "searchTerm": "BAD,BCL2L1",
            "filterParameter": "query_query",
            "searchTermArray": ["BAD", "BCL2L1"],
            "queryIdArray": [p1.id, p2.id],
        },
        format="json",
    )
    assert response.status_code == 200
    data = response.json()
    assert "all_proteins" in data
    assert "all_interactions" in data


@pytest.mark.django_db
def test_search_query_protein_is_last_in_all_proteins(api_client):
    """Query proteins must be last so Cytoscape renders them on top."""
    p_query = _make_protein_with_identifier("BAD")
    p_interactor = ProteinFactory(gene_name="INTERACTOR")
    InteractionFactory(interactor_A=p_query, interactor_B=p_interactor, removed="0")

    response = api_client.get("/api/search?q=BAD")
    data = response.json()
    protein_ids = [p["protein_id"] for p in data["all_proteins"]]
    assert protein_ids[-1] == p_query.id


@pytest.mark.django_db
def test_categories_endpoint_returns_all_categories(api_client):
    InteractionCategoryFactory(category_name="Published", order="1")
    InteractionCategoryFactory(category_name="Validated", order="2")
    response = api_client.get("/api/interactions/categories")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["category_name"] == "Published"
    assert data[0]["order"] == "1"
    assert "id" in data[0]


@pytest.mark.django_db
def test_categories_endpoint_is_public(api_client):
    InteractionCategoryFactory(category_name="HI-Union", order="3")
    response = api_client.get("/api/interactions/categories")
    assert response.status_code == 200
    assert len(response.json()) == 1


# ── Filter mode tests ────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_search_filter_query_query_only_returns_query_query_edges(api_client):
    """filter=query_query: only interactions between the queried proteins."""
    q1 = _make_protein_with_identifier("BAD")
    q2 = _make_protein_with_identifier("BCL2L1")
    p_other = ProteinFactory(gene_name="OUTSIDER")
    # interaction between the two query proteins — should appear
    ix_qq = InteractionFactory(interactor_A=q1, interactor_B=q2, removed="0")
    # interaction between query and outsider — should NOT appear
    InteractionFactory(interactor_A=q1, interactor_B=p_other, removed="0")

    response = api_client.get("/api/search?q=BAD,BCL2L1&filter=query_query")
    assert response.status_code == 200
    data = response.json()
    ids = {ix["interaction_id"] for ix in data["all_interactions"]}
    assert ids == {ix_qq.id}


@pytest.mark.django_db
def test_search_filter_query_interactor_only_returns_edges_touching_query(api_client):
    """filter=query_interactor: only edges where at least one endpoint is a query protein."""
    q = _make_protein_with_identifier("BAD")
    p_a = ProteinFactory(gene_name="INTERACTOR_A")
    p_b = ProteinFactory(gene_name="INTERACTOR_B")
    # query ↔ interactor_A — should appear
    ix_qa = InteractionFactory(interactor_A=q, interactor_B=p_a, removed="0")
    # interactor_A ↔ interactor_B — should NOT appear (neither is query)
    InteractionFactory(interactor_A=p_a, interactor_B=p_b, removed="0")

    response = api_client.get("/api/search?q=BAD&filter=query_interactor")
    assert response.status_code == 200
    data = response.json()
    ids = {ix["interaction_id"] for ix in data["all_interactions"]}
    assert ids == {ix_qa.id}


@pytest.mark.django_db
def test_search_unrecognised_gene_returns_empty_structure(api_client):
    response = api_client.get("/api/search?q=DOESNOTEXIST999")
    assert response.status_code == 200
    data = response.json()
    assert data["all_proteins"] == []
    assert data["all_interactions"] == []
    assert data["query_protein_id_array"] == []
    assert "DOESNOTEXIST999" in data["unfound_protein_summary"]


@pytest.mark.django_db
def test_search_multi_gene_returns_all_query_proteins(api_client):
    _make_protein_with_identifier("BAD")
    _make_protein_with_identifier("BCL2L1")
    _make_protein_with_identifier("BMF")

    response = api_client.get("/api/search?q=BAD,BCL2L1,BMF")
    assert response.status_code == 200
    data = response.json()
    gene_names = {p["protein_gene_name"] for p in data["all_proteins"]}
    assert {"BAD", "BCL2L1", "BMF"}.issubset(gene_names)
    assert len(data["query_protein_id_array"]) == 3


# ── Edge ordering ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_search_multi_query_edges_before_query_edges_before_interactor_edges(
    api_client,
):
    """
    Output ordering: multi-query edges → query edges → interactor-only edges.
    Cytoscape renders last elements on top; query proteins must be last in nodes.
    """
    q1 = _make_protein_with_identifier("BAD")
    q2 = _make_protein_with_identifier("BCL2L1")
    p_other = ProteinFactory(gene_name="BYSTANDER")
    # multi-query edge (both endpoints are query proteins)
    ix_multi = InteractionFactory(interactor_A=q1, interactor_B=q2, removed="0")
    # query edge (one endpoint is query)
    ix_query = InteractionFactory(interactor_A=q1, interactor_B=p_other, removed="0")

    response = api_client.get("/api/search?q=BAD,BCL2L1")
    data = response.json()
    ids = [ix["interaction_id"] for ix in data["all_interactions"]]
    assert ids.index(ix_multi.id) < ids.index(ix_query.id)


# ── HomeNetworkView ──────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_home_network_returns_expected_shape(api_client):
    p = _make_protein_with_identifier("BRCA1")
    p.number_of_interactions_in_database = 5
    p.save()

    response = api_client.get("/api/home/network")
    assert response.status_code == 200
    data = response.json()
    assert "all_proteins" in data
    assert "all_interactions" in data
    assert "query_protein_id_array" in data


@pytest.mark.django_db
def test_home_network_empty_db_returns_empty_result(api_client):
    """No proteins → returns all-empty structure, not a 500."""
    response = api_client.get("/api/home/network")
    assert response.status_code == 200
    data = response.json()
    assert data["all_proteins"] == []
    assert data["all_interactions"] == []


@pytest.mark.django_db
def test_categories_sort_by_number_not_text(api_client):
    for name, order in [("Ten", "10"), ("Two", "2"), ("Blank", None), ("One", "1")]:
        InteractionCategoryFactory(category_name=name, order=order)
    names = [
        c["category_name"]
        for c in api_client.get("/api/interactions/categories").json()
    ]
    assert names == ["One", "Two", "Ten", "Blank"]
