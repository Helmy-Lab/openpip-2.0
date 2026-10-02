# backend/psicquic/tests/test_views.py
import pytest
from proteins.models import Protein, Organism, ProteinOrganism
from interactions.models import Interaction, InteractionDataset
from datasets.models import Dataset
from psicquic.views import SUPPORTED_FORMATS, SERVICE_VERSION, PsicquicThrottle


@pytest.fixture
def sample_interactions(db):
    org = Organism.objects.create(name="Homo sapiens", taxonomy_id="9606")
    p1 = Protein.objects.create(gene_name="BRCA1", uniprot_id="P38398")
    p2 = Protein.objects.create(gene_name="TP53", uniprot_id="P04637")
    ProteinOrganism.objects.create(protein=p1, organism=org)
    ProteinOrganism.objects.create(protein=p2, organism=org)
    ds = Dataset.objects.create(name="DS1", pubmed_id="99999", author="Bar et al.")
    interaction = Interaction.objects.create(
        interactor_A=p1, interactor_B=p2, score="0.95"
    )
    InteractionDataset.objects.create(interaction=interaction, dataset=ds)
    return interaction


@pytest.mark.django_db
def test_psicquic_returns_tab25(client, sample_interactions):
    response = client.get("/psicquic/rest/query?q=BRCA1&format=tab25")
    assert response.status_code == 200
    assert response["Content-Type"] == "text/plain; charset=utf-8"
    content = response.content.decode()
    assert content.startswith("#ID(s) interactor A")
    assert "uniprotkb:P38398" in content
    assert "uniprotkb:P04637" in content


@pytest.mark.django_db
def test_psicquic_returns_json(client, sample_interactions):
    response = client.get("/psicquic/rest/query?q=BRCA1&format=json")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["interactor_a"]["uniprot_id"] == "P38398"


@pytest.mark.django_db
def test_psicquic_no_results(client, sample_interactions):
    response = client.get("/psicquic/rest/query?q=NONEXISTENT99&format=tab25")
    assert response.status_code == 200
    lines = response.content.decode().strip().split("\n")
    assert len(lines) == 1  # header only


@pytest.mark.django_db
def test_psicquic_pagination(client, sample_interactions):
    response = client.get(
        "/psicquic/rest/query?q=BRCA1&format=tab25&firstResult=0&maxResults=1"
    )
    assert response.status_code == 200


@pytest.mark.django_db
def test_psicquic_count_endpoint(client, sample_interactions):
    response = client.get("/psicquic/rest/query/count?q=BRCA1")
    assert response.status_code == 200
    assert response.content.decode().strip() == "1"


@pytest.mark.django_db
def test_psicquic_requires_no_auth(client, sample_interactions):
    """PSICQUIC endpoint must be public — no auth required."""
    response = client.get("/psicquic/rest/query?q=BRCA1&format=tab25")
    assert response.status_code != 401
    assert response.status_code != 403


@pytest.mark.django_db
def test_psicquic_rejects_an_unsupported_format(client, sample_interactions):
    # Used to fall through and answer with TAB text, so a caller asking for XML
    # got tab-separated data it would then fail to parse.
    response = client.get("/psicquic/rest/query?q=BRCA1&format=xml25")
    assert response.status_code == 406
    body = response.content.decode()
    assert "xml25" in body
    assert "tab25" in body  # tells the caller what it can ask for instead


@pytest.mark.django_db
def test_psicquic_count_format_matches_the_count_endpoint(client, sample_interactions):
    via_format = client.get("/psicquic/rest/query?q=BRCA1&format=count")
    via_endpoint = client.get("/psicquic/rest/query/count?q=BRCA1")
    assert via_format.status_code == 200
    assert via_format.content == via_endpoint.content == b"1"


@pytest.mark.django_db
def test_psicquic_formats_lists_what_the_query_view_accepts(client):
    response = client.get("/psicquic/rest/formats")
    assert response.status_code == 200
    listed = response.content.decode().split()
    assert listed == list(SUPPORTED_FORMATS)
    # The registry validates a service against this list, so it must not drift
    # from what the query view actually answers.
    for fmt in listed:
        assert client.get(f"/psicquic/rest/query?q=*&format={fmt}").status_code == 200


@pytest.mark.django_db
def test_psicquic_version_reports_this_services_own_version(client):
    # Not a spec level: the EBI registry's 34 services report mutually
    # inconsistent values (1.5.3, 1.3.3, 1.3.14), so the field is per-service.
    response = client.get("/psicquic/rest/version")
    assert response.status_code == 200
    assert response.content.decode().strip() == SERVICE_VERSION


@pytest.mark.django_db
def test_psicquic_default_format_is_still_tab25(client, sample_interactions):
    response = client.get("/psicquic/rest/query?q=BRCA1")
    assert response.status_code == 200
    assert response.content.decode().startswith("#ID(s) interactor A")


@pytest.mark.django_db
def test_psicquic_rejects_non_numeric_paging(client, sample_interactions):
    # int() on a query param used to raise ValueError -> 500.
    response = client.get("/psicquic/rest/query?q=BRCA1&maxResults=all")
    assert response.status_code == 400


@pytest.mark.django_db
def test_psicquic_throttles_a_hammering_client(
    client, sample_interactions, monkeypatch
):
    # These endpoints are unauthenticated and return bulk data, so an unbounded
    # loop against them is the cheapest way to hurt the site.
    from django.core.cache import cache

    cache.clear()
    # THROTTLE_RATES is read into a class attribute at import time, so patching
    # settings at runtime would not reach it.
    monkeypatch.setattr(PsicquicThrottle, "THROTTLE_RATES", {"psicquic": "3/min"})
    codes = [client.get("/psicquic/rest/query?q=BRCA1").status_code for _ in range(5)]
    assert codes[:3] == [200, 200, 200]
    assert codes[3:] == [429, 429]
    cache.clear()


@pytest.mark.django_db
def test_psicquic_format_param_is_not_drf_content_negotiation(
    client, sample_interactions
):
    # DRF reads ?format= as a renderer override and 404s when it finds none.
    # PSICQUIC owns this parameter, so the view must see it, not DRF.
    assert client.get("/psicquic/rest/query?q=BRCA1&format=tab25").status_code == 200
    assert client.get("/psicquic/rest/query?q=BRCA1&format=json").status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize("fmt,width", [("tab25", 15), ("tab26", 36), ("tab27", 42)])
def test_psicquic_serves_each_tab_version(client, sample_interactions, fmt, width):
    response = client.get(f"/psicquic/rest/query?q=BRCA1&format={fmt}")
    assert response.status_code == 200
    rows = response.content.decode().strip().split("\n")
    assert all(row.count("\t") == width - 1 for row in rows)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "query",
    [
        'detmethod:"two hybrid"',
        "type:MI:0407",
        "pbioroleA:bait",
        "stc:1",
    ],
)
def test_unsupported_miql_is_refused_not_answered_with_zero(
    client, sample_interactions, query
):
    """The bug this guards is a wrong answer, not a missing feature.

    These queries used to fall through to a plain-text search, match nothing,
    and return 0 with a 200 — telling a federating client that openPIP holds no
    human interactions and no two-hybrid data, when it holds tens of thousands
    of both.
    """
    response = client.get("/psicquic/rest/query", {"q": query, "format": "count"})
    assert response.status_code == 400
    assert response.content.decode().strip() != "0"


@pytest.mark.django_db
def test_the_count_endpoint_refuses_them_too(client, sample_interactions):
    response = client.get("/psicquic/rest/query/count", {"q": "pbioroleA:bait"})
    assert response.status_code == 400


@pytest.mark.django_db
def test_supported_queries_still_answer(client, sample_interactions):
    for query in ["BRCA1", "idA:BRCA1", "id:P38398", "taxidA:9606", "*"]:
        response = client.get("/psicquic/rest/query", {"q": query, "format": "count"})
        assert response.status_code == 200, query


@pytest.mark.django_db
def test_every_advertised_field_is_actually_answerable(client, sample_interactions):
    """SUPPORTED_FIELDS must not disagree with the parser.

    Adding `species` to the list while leaving its branch below the
    unsupported-field guard produced exactly that: a field advertised in the
    error message and then rejected by it. This checks the two cannot drift.
    """
    from psicquic.miql import SUPPORTED_FIELDS

    for field in SUPPORTED_FIELDS:
        value = {"taxidA": "9606", "taxidB": "9606", "species": "9606"}.get(
            field, "12345678" if field == "pubid" else "BRCA1"
        )
        response = client.get(
            "/psicquic/rest/query", {"q": f"{field}:{value}", "format": "count"}
        )
        assert response.status_code == 200, f"{field} is advertised but refused"


@pytest.mark.django_db
def test_species_now_answers_instead_of_refusing(client, sample_interactions):
    response = client.get(
        "/psicquic/rest/query", {"q": "species:9606", "format": "count"}
    )
    assert response.status_code == 200
    assert response.content.decode().strip() == "1"


@pytest.mark.django_db
def test_psicquic_pages_are_ordered_and_disjoint(client, sample_interactions):
    from psicquic.miql import parse_miql

    a, b = sample_interactions.interactor_A, sample_interactions.interactor_B
    for _ in range(4):
        Interaction.objects.create(interactor_A=a, interactor_B=b, score="0.5")
    assert parse_miql("*").ordered and parse_miql("BRCA1").ordered

    ids = []
    for first in range(0, 5, 2):
        page = client.get(
            f"/psicquic/rest/query?q=*&format=json&firstResult={first}&maxResults=2"
        )
        ids += [row["interaction_id"] for row in page.json()]
    assert ids == sorted(Interaction.objects.values_list("pk", flat=True))


@pytest.mark.django_db
def test_psicquic_refuses_max_results_over_the_cap(client, sample_interactions):
    from psicquic.views import MAX_RESULTS

    ok = client.get(f"/psicquic/rest/query?q=*&maxResults={MAX_RESULTS}")
    too_many = client.get(f"/psicquic/rest/query?q=*&maxResults={MAX_RESULTS + 1}")
    assert ok.status_code == 200 and too_many.status_code == 400


@pytest.mark.django_db
def test_psicquic_throttles_signed_in_callers_too(
    client, sample_interactions, regular_user, monkeypatch
):
    from django.core.cache import cache

    cache.clear()
    monkeypatch.setattr(PsicquicThrottle, "THROTTLE_RATES", {"psicquic": "2/min"})
    from rest_framework_simplejwt.tokens import RefreshToken

    token = RefreshToken.for_user(regular_user).access_token
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {token}"
    codes = [client.get("/psicquic/rest/query?q=BRCA1").status_code for _ in range(3)]
    assert codes == [200, 200, 429]
    cache.clear()
