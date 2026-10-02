"""Tests for dataset download endpoints — verify they are public (no auth required)."""

import pytest
from datasets.tests.factories import DatasetFactory
from interactions.tests.factories import InteractionFactory, InteractionDatasetFactory


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
