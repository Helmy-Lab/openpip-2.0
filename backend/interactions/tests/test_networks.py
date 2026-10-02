import pytest
from core.models import UserInteractionNetwork
from interactions.models import (
    InteractionNetwork,
    InteractionInteractionNetworks,
)
from interactions.tests.factories import InteractionFactory
from proteins.tests.factories import (
    IdentifierFactory,
    ProteinFactory,
    ProteinIdentifierFactory,
)


def _make_protein(gene_name: str):
    p = ProteinFactory(gene_name=gene_name)
    id_ = IdentifierFactory(identifier=gene_name, naming_convention="gene_name")
    ProteinIdentifierFactory(protein=p, identifier=id_)
    return p


# ── Save (POST /networks) ─────────────────────────────────────────────────────


@pytest.mark.django_db
def test_save_network_creates_db_rows(user_auth_client, regular_user):
    p1 = _make_protein("TP53")
    p2 = _make_protein("MDM2")
    ix = InteractionFactory(interactor_A=p1, interactor_B=p2, removed="0")

    resp = user_auth_client.post(
        "/api/networks",
        {
            "name": "Test Network",
            "query": "TP53",
            "score_parameter": "0.50",
            "category_array": "Published",
            "tissue_expression_array": "",
            "interaction_ids": [ix.id],
        },
        format="json",
    )

    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Network"
    assert data["interaction_count"] == 1
    assert InteractionNetwork.objects.count() == 1
    assert InteractionInteractionNetworks.objects.count() == 1
    assert UserInteractionNetwork.objects.filter(user=regular_user).count() == 1


@pytest.mark.django_db
def test_save_network_keeps_a_long_query(user_auth_client):
    """~40 genes overflow the legacy 100-char query column; save must still work
    and hand the whole query back."""
    p1 = _make_protein("TP53")
    p2 = _make_protein("MDM2")
    ix = InteractionFactory(interactor_A=p1, interactor_B=p2, removed="0")
    query = ", ".join(["TP53", "MDM2"] * 20)

    resp = user_auth_client.post(
        "/api/networks",
        {"name": "Long", "query": query, "interaction_ids": [ix.id]},
        format="json",
    )
    assert resp.status_code == 201

    network_id = resp.json()["id"]
    assert user_auth_client.get(f"/api/networks/{network_id}").json()["query"] == query
    listed = user_auth_client.get("/api/networks").json()
    assert listed[0]["query"] == query


@pytest.mark.django_db
def test_save_network_requires_auth(api_client):
    resp = api_client.post(
        "/api/networks",
        {
            "name": "Test",
            "query": "TP53",
            "score_parameter": "0.0",
            "category_array": "",
            "tissue_expression_array": "",
            "interaction_ids": [1],
        },
        format="json",
    )
    assert resp.status_code == 401


@pytest.mark.django_db
def test_save_network_rejects_empty_interaction_ids(user_auth_client):
    resp = user_auth_client.post(
        "/api/networks",
        {
            "name": "Test",
            "query": "TP53",
            "score_parameter": "0.0",
            "category_array": "",
            "tissue_expression_array": "",
            "interaction_ids": [],
        },
        format="json",
    )
    assert resp.status_code == 400


# ── List (GET /networks) ──────────────────────────────────────────────────────


@pytest.mark.django_db
def test_list_networks_returns_only_own(user_auth_client, regular_user, admin_user):
    my_net = InteractionNetwork.objects.create(name="My Net", query="TP53")
    UserInteractionNetwork.objects.create(user=regular_user, interaction_network=my_net)
    other_net = InteractionNetwork.objects.create(name="Other Net", query="BRCA1")
    UserInteractionNetwork.objects.create(
        user=admin_user, interaction_network=other_net
    )

    resp = user_auth_client.get("/api/networks")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "My Net"
    assert "interaction_count" in data[0]
    assert "created_at" in data[0]


@pytest.mark.django_db
def test_list_networks_requires_auth(api_client):
    resp = api_client.get("/api/networks")
    assert resp.status_code == 401


# ── Load (GET /networks/<pk>) ─────────────────────────────────────────────────


@pytest.mark.django_db
def test_load_network_returns_result_shape(user_auth_client, regular_user):
    p1 = _make_protein("TP53")
    p2 = _make_protein("MDM2")
    ix = InteractionFactory(interactor_A=p1, interactor_B=p2, removed="0")

    network = InteractionNetwork.objects.create(
        name="My Net", query="TP53", tissue_expression_array="liver,lung"
    )
    InteractionInteractionNetworks.objects.create(
        interaction_network=network, interaction=ix
    )
    UserInteractionNetwork.objects.create(
        user=regular_user, interaction_network=network
    )

    resp = user_auth_client.get(f"/api/networks/{network.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "My Net"
    assert data["tissue_expression_array"] == "liver,lung"
    assert data["query"] == "TP53"
    assert "all_proteins" in data
    assert "all_interactions" in data
    assert "query_protein_id_array" in data
    assert len(data["all_interactions"]) == 1
    assert len(data["all_proteins"]) == 2


@pytest.mark.django_db
def test_load_network_403_for_non_owner(user_auth_client, admin_user):
    network = InteractionNetwork.objects.create(name="Admin Net", query="TP53")
    UserInteractionNetwork.objects.create(user=admin_user, interaction_network=network)

    resp = user_auth_client.get(f"/api/networks/{network.id}")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_load_network_404_for_missing(user_auth_client):
    resp = user_auth_client.get("/api/networks/99999")
    assert resp.status_code == 404


# ── Delete (DELETE /networks/<pk>) ───────────────────────────────────────────


@pytest.mark.django_db
def test_delete_network_removes_all_rows(user_auth_client, regular_user):
    p1 = _make_protein("TP53")
    p2 = _make_protein("MDM2")
    ix = InteractionFactory(interactor_A=p1, interactor_B=p2, removed="0")
    network = InteractionNetwork.objects.create(name="My Net", query="TP53")
    InteractionInteractionNetworks.objects.create(
        interaction_network=network, interaction=ix
    )
    UserInteractionNetwork.objects.create(
        user=regular_user, interaction_network=network
    )

    resp = user_auth_client.delete(f"/api/networks/{network.id}")
    assert resp.status_code == 204
    assert InteractionNetwork.objects.count() == 0
    assert InteractionInteractionNetworks.objects.count() == 0
    assert UserInteractionNetwork.objects.count() == 0


@pytest.mark.django_db
def test_delete_network_403_for_non_owner(user_auth_client, admin_user):
    network = InteractionNetwork.objects.create(name="Admin Net", query="TP53")
    UserInteractionNetwork.objects.create(user=admin_user, interaction_network=network)

    resp = user_auth_client.delete(f"/api/networks/{network.id}")
    assert resp.status_code == 403
