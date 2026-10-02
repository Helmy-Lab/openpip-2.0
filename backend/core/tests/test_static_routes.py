import pytest


@pytest.fixture
def static_root(settings, tmp_path):
    (tmp_path / "admin" / "css").mkdir(parents=True)
    (tmp_path / "admin" / "css" / "base.css").write_text("body {}")
    settings.STATIC_ROOT = tmp_path
    settings.DEBUG = False
    return tmp_path


def test_static_files_are_served_with_debug_off(client, static_root):
    response = client.get("/static/admin/css/base.css")
    assert response.status_code == 200
    assert b"".join(response.streaming_content) == b"body {}"


def test_static_paths_cannot_leave_static_root(client, static_root):
    (static_root.parent / "secret.txt").write_text("private")
    for path in ("/static/../secret.txt", "/static/%2e%2e/secret.txt"):
        response = client.get(path)
        assert response.status_code in (400, 404), path


def test_static_url_carries_the_script_prefix(settings):
    from django.templatetags.static import static
    from django.urls import set_script_prefix

    set_script_prefix("/v2/")
    try:
        assert static("admin/css/base.css") == "/v2/static/admin/css/base.css"
    finally:
        set_script_prefix("/")


@pytest.mark.django_db
def test_django_admin_login_page_loads(client, settings):
    settings.DEBUG = False
    settings.ALLOWED_HOSTS = ["testserver"]
    assert client.get("/django-admin/login/").status_code == 200
