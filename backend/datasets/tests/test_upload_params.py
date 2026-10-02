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
