"""Tests for FileListView, FileDetailView, FileDownloadView, PublicFileListView."""

import os
import tempfile

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from datasets.models import UploadFiles

# ── helpers ──────────────────────────────────────────────────────────────────


def _make_file_record(tmp_path=None, name="test.tab", show=True) -> UploadFiles:
    """Create an UploadFiles record backed by a real temp file."""
    if tmp_path is None:
        tmp = tempfile.NamedTemporaryFile(suffix=name, delete=False)
        tmp.write(b"col1\tcol2\nA\tB\n")
        tmp.flush()
        path = tmp.name
    else:
        path = os.path.join(tmp_path, name)
        with open(path, "wb") as f:
            f.write(b"col1\tcol2\nA\tB\n")

    return UploadFiles.objects.create(
        file_name=name,
        file_path=path,
        file_size=16,
        show=show,
    )


# ── FileListView GET ──────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_list_files_returns_all(auth_client, tmp_path):
    _make_file_record(tmp_path, name="a.tab")
    _make_file_record(tmp_path, name="b.tsv")
    response = auth_client.get("/api/files")
    assert response.status_code == 200
    assert len(response.data) == 2


@pytest.mark.django_db
def test_list_files_blocked_for_anonymous(api_client):
    response = api_client.get("/api/files")
    assert response.status_code == 401


@pytest.mark.django_db
def test_list_files_blocked_for_non_admin(user_auth_client):
    response = user_auth_client.get("/api/files")
    assert response.status_code == 403


# ── FileListView POST (upload) ────────────────────────────────────────────────


@pytest.mark.django_db
def test_upload_valid_tab_file_creates_record(auth_client, tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    f = SimpleUploadedFile(
        "sample.tab", b"col1\tcol2\nA\tB\n", content_type="text/plain"
    )
    response = auth_client.post("/api/files", {"file": f}, format="multipart")
    assert response.status_code == 201
    assert UploadFiles.objects.filter(file_name="sample.tab").exists()


@pytest.mark.django_db
def test_upload_rejects_invalid_extension(auth_client):
    f = SimpleUploadedFile("script.py", b"print('hi')", content_type="text/plain")
    response = auth_client.post("/api/files", {"file": f}, format="multipart")
    assert response.status_code == 400
    assert "not allowed" in response.data["detail"]


@pytest.mark.django_db
def test_upload_returns_409_on_collision(auth_client, tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    _make_file_record(tmp_path, name="existing.tab")
    f = SimpleUploadedFile("existing.tab", b"data", content_type="text/plain")
    response = auth_client.post("/api/files", {"file": f}, format="multipart")
    assert response.status_code == 409
    assert response.data["detail"] == "collision"


@pytest.mark.django_db
def test_upload_force_adds_prefix_on_collision(auth_client, tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    _make_file_record(tmp_path, name="existing.tab")
    f = SimpleUploadedFile("existing.tab", b"data", content_type="text/plain")
    response = auth_client.post(
        "/api/files", {"file": f, "force": "true"}, format="multipart"
    )
    assert response.status_code == 201
    # Two records with the same display name are OK; disk file gets a prefix
    assert UploadFiles.objects.filter(file_name="existing.tab").count() == 2


@pytest.mark.django_db
def test_upload_no_file_returns_400(auth_client):
    response = auth_client.post("/api/files", {}, format="multipart")
    assert response.status_code == 400


# ── FileDetailView PATCH / DELETE ─────────────────────────────────────────────


@pytest.mark.django_db
def test_patch_toggles_visibility(auth_client, tmp_path):
    record = _make_file_record(tmp_path, show=True)
    response = auth_client.patch(
        f"/api/files/{record.pk}", {"show": False}, format="json"
    )
    assert response.status_code == 200
    record.refresh_from_db()
    assert record.show is False


@pytest.mark.django_db
def test_patch_unknown_id_returns_404(auth_client):
    response = auth_client.patch("/api/files/99999", {"show": False}, format="json")
    assert response.status_code == 404


@pytest.mark.django_db
def test_delete_removes_record_and_file(auth_client, tmp_path):
    record = _make_file_record(tmp_path)
    path = record.file_path
    assert os.path.exists(path)
    response = auth_client.delete(f"/api/files/{record.pk}")
    assert response.status_code == 204
    assert not UploadFiles.objects.filter(pk=record.pk).exists()
    assert not os.path.exists(path)


@pytest.mark.django_db
def test_delete_unknown_id_returns_404(auth_client):
    response = auth_client.delete("/api/files/99999")
    assert response.status_code == 404


# ── FileDownloadView ──────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_download_returns_file_contents(auth_client, tmp_path):
    record = _make_file_record(tmp_path)
    response = auth_client.get(f"/api/files/{record.pk}/download")
    assert response.status_code == 200
    assert b"col1" in b"".join(response.streaming_content)


@pytest.mark.django_db
def test_download_public_file_allowed_for_anonymous(api_client, tmp_path):
    record = _make_file_record(tmp_path)
    response = api_client.get(f"/api/files/{record.pk}/download")
    assert response.status_code == 200
    assert b"col1" in b"".join(response.streaming_content)


@pytest.mark.django_db
def test_download_hidden_file_blocked_for_anonymous(api_client, tmp_path):
    record = _make_file_record(tmp_path, show=False)
    response = api_client.get(f"/api/files/{record.pk}/download")
    assert response.status_code == 403


@pytest.mark.django_db
def test_download_hidden_file_blocked_for_non_staff(user_auth_client, tmp_path):
    record = _make_file_record(tmp_path, show=False)
    response = user_auth_client.get(f"/api/files/{record.pk}/download")
    assert response.status_code == 403


@pytest.mark.django_db
def test_download_hidden_file_allowed_for_admin(auth_client, tmp_path):
    record = _make_file_record(tmp_path, show=False)
    response = auth_client.get(f"/api/files/{record.pk}/download")
    assert response.status_code == 200


@pytest.mark.django_db
def test_download_missing_file_returns_404(auth_client, tmp_path):
    record = _make_file_record(tmp_path)
    os.remove(record.file_path)
    response = auth_client.get(f"/api/files/{record.pk}/download")
    assert response.status_code == 404


# ── PublicFileListView ────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_public_list_returns_only_visible_files(user_auth_client, tmp_path):
    _make_file_record(tmp_path, name="visible.tab", show=True)
    _make_file_record(tmp_path, name="hidden.tab", show=False)
    response = user_auth_client.get("/api/files/public")
    assert response.status_code == 200
    names = [f["file_name"] for f in response.data]
    assert "visible.tab" in names
    assert "hidden.tab" not in names


@pytest.mark.django_db
def test_public_list_allowed_for_anonymous(api_client, tmp_path):
    _make_file_record(tmp_path, name="visible.tab", show=True)
    _make_file_record(tmp_path, name="hidden.tab", show=False)
    response = api_client.get("/api/files/public")
    assert response.status_code == 200
    names = [f["file_name"] for f in response.data]
    assert "visible.tab" in names
    assert "hidden.tab" not in names


@pytest.mark.django_db
def test_patch_reads_string_false_as_false(auth_client, tmp_path):
    record = _make_file_record(tmp_path, show=True)
    response = auth_client.patch(
        f"/api/files/{record.pk}", {"show": "false"}, format="multipart"
    )
    assert response.status_code == 200
    record.refresh_from_db()
    assert record.show is False
