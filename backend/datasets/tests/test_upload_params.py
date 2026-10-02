import pytest

from datasets.views import as_bool


@pytest.mark.parametrize("raw", ["abc", "1.5", "99999"])
@pytest.mark.django_db
def test_upload_rows_rejects_bad_category_id(auth_client, raw):
    response = auth_client.post(
        "/api/datasets/upload-rows",
        {"dataset_name": "D", "lines": ["x"], "category_id": raw},
        format="json",
    )
    assert response.status_code == 400
    assert "category_id" in response.json()


def test_as_bool_reads_form_strings():
    assert [as_bool(v) for v in ["false", "0", "", False, None]] == [False] * 5
    assert [as_bool(v) for v in ["true", "True", "1", True]] == [True] * 4


@pytest.mark.django_db
def test_check_proteins_counts_what_the_import_will_match(auth_client):
    from proteins.models import Identifier, Protein, ProteinIdentifier

    tp53 = Protein.objects.create(gene_name="TP53", uniprot_id="P04637")
    ident = Identifier.objects.create(identifier="MDM2", naming_convention="gene_name")
    ProteinIdentifier.objects.create(protein=tp53, identifier=ident)

    response = auth_client.post(
        "/api/datasets/check-proteins",
        # different case; one known only from the protein's own column
        {"identifiers": ["uniprotkb:p04637", "mdm2", "uniprotkb:Q99999"]},
        format="json",
    )
    assert response.json() == {"existing": 2}
