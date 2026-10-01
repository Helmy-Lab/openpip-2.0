import pytest


@pytest.fixture
def media(tmp_path, settings):
    """A MEDIA_ROOT holding one file in each of the three directories."""
    settings.MEDIA_ROOT = tmp_path
    for directory in ("avatars", "logos", "uploads"):
        (tmp_path / directory).mkdir()
        (tmp_path / directory / "f.png").write_bytes(b"\x89PNG")
    return tmp_path


@pytest.mark.parametrize("directory", ["avatars", "logos"])
def test_public_media_is_served(api_client, media, settings, directory):
    """Pages reference these by URL, so they must be served with DEBUG off."""
    settings.DEBUG = False
    response = api_client.get(f"/media/{directory}/f.png")
    assert response.status_code == 200


def test_uploads_are_not_served(api_client, media, settings):
    """Dataset uploads stay behind the authenticated download endpoint."""
    settings.DEBUG = False
    response = api_client.get("/media/uploads/f.png")
    assert response.status_code == 404


@pytest.mark.parametrize("directory", ["avatars", "logos"])
def test_public_media_cannot_climb_into_uploads(api_client, media, settings, directory):
    settings.DEBUG = False
    response = api_client.get(f"/media/{directory}/../uploads/f.png")
    assert response.status_code == 404
