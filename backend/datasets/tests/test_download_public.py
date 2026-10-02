"""Tests for dataset download endpoints — verify they are public (no auth required)."""

import pytest
from datasets.tests.factories import DatasetFactory
from interactions.tests.factories import InteractionFactory, InteractionDatasetFactory


@pytest.fixture(autouse=True)
def media_root(settings, tmp_path):
    """The archive is cached under MEDIA_ROOT; keep it out of the repo."""
    settings.MEDIA_ROOT = tmp_path
    return tmp_path


@pytest.mark.django_db
def test_dataset_file_download_requires_no_auth(api_client):
    """Legacy behavior: dataset file downloads are public, no login needed."""
    # Non-existent dataset returns 404, not 403
    response = api_client.get("/api/datasets/999/download")
    assert response.status_code == 404


@pytest.mark.django_db
def test_dataset_file_download_works_for_anonymous_user(api_client):
    """Verify anonymous user can download a real dataset file."""
    ds = DatasetFactory(name="Test Dataset")
    response = api_client.get(f"/api/datasets/{ds.id}/download")
    assert response.status_code == 200


@pytest.mark.django_db
def test_dataset_archive_download_requires_no_auth(api_client):
    """Legacy behavior: dataset archive download is public, no login needed."""
    response = api_client.get("/api/datasets/download/")
    assert response.status_code == 200


@pytest.mark.django_db
def test_dataset_file_download_with_interactions(api_client):
    """Verify file download works with actual interaction data."""
    ds = DatasetFactory(name="Test Dataset", pubmed_id="12345")
    interaction = InteractionFactory()
    InteractionDatasetFactory(dataset=ds, interaction=interaction)

    response = api_client.get(f"/api/datasets/{ds.id}/download?fmt=tab")
    assert response.status_code == 200
    content = b"".join(response.streaming_content)
    # Should contain tab header
    assert b"ID(s) interactor A" in content


@pytest.mark.django_db
def test_dataset_file_download_csv_format(api_client):
    """Verify CSV format download works without auth."""
    ds = DatasetFactory(name="Test Dataset")
    response = api_client.get(f"/api/datasets/{ds.id}/download?fmt=csv")
    assert response.status_code == 200


@pytest.mark.django_db
def test_dataset_file_download_sif_format(api_client):
    """Verify SIF format download works without auth."""
    ds = DatasetFactory(name="Test Dataset")
    response = api_client.get(f"/api/datasets/{ds.id}/download?fmt=sif")
    assert response.status_code == 200


@pytest.mark.django_db
def test_dataset_file_download_leaves_out_removed_interactions(api_client):
    ds = DatasetFactory(name="Test Dataset")
    InteractionDatasetFactory(dataset=ds, interaction=InteractionFactory())
    InteractionDatasetFactory(dataset=ds, interaction=InteractionFactory(removed="1"))

    response = api_client.get(f"/api/datasets/{ds.id}/download?fmt=sif")
    lines = b"".join(response.streaming_content).decode().strip().splitlines()
    assert len(lines) == 1


@pytest.mark.django_db
def test_archive_is_built_once_and_rebuilt_after_a_dataset_edit(
    api_client, auth_client, monkeypatch
):
    from datasets.views import DatasetArchiveDownloadView

    ds = DatasetFactory(name="Cached")
    builds = []
    real = DatasetArchiveDownloadView._write_archive
    monkeypatch.setattr(
        DatasetArchiveDownloadView,
        "_write_archive",
        lambda self, f: builds.append(1) or real(self, f),
    )

    first = b"".join(api_client.get("/api/datasets/download/").streaming_content)
    b"".join(api_client.get("/api/datasets/download/").streaming_content)
    assert len(builds) == 1

    auth_client.patch(f"/api/datasets/{ds.id}", {"title": "New"}, format="json")
    again = b"".join(api_client.get("/api/datasets/download/").streaming_content)
    assert len(builds) == 2
    assert first[:2] == again[:2] == b"PK"


@pytest.mark.django_db
def test_import_invalidates_the_cached_archive(api_client, media_root):
    from datasets.views import _refresh_dataset_counts

    b"".join(api_client.get("/api/datasets/download/").streaming_content)
    assert (media_root / "cache" / "datasets.zip").exists()
    _refresh_dataset_counts()
    assert not (media_root / "cache" / "datasets.zip").exists()
