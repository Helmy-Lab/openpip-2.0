import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from admin_panel.models import AdminSettings, Announcement, SiteText

User = get_user_model()


@pytest.mark.django_db
def test_get_settings_returns_camel_case(api_client):
    AdminSettings.objects.create(
        pk=1,
        title="My Portal",
        short_title="MP",
        main_color_scheme="#ff0000",
        header_color_scheme="#ffffff",
        logo_color_scheme="#000000",
        button_color_scheme="#ff0000",
        query_node_color="#ff0000",
        interactor_node_color="#0000ff",
        published_edge_color="#00ff00",
        validated_edge_color="#0000ff",
        verified_edge_color="#ff0000",
        literature_edge_color="#ff9900",
        url="http://localhost",
        version="2.0",
    )
    response = api_client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "My Portal"
    assert data["shortTitle"] == "MP"
    assert data["mainColorScheme"] == "#ff0000"
    assert "main_color_scheme" not in data


@pytest.mark.django_db
def test_patch_settings_requires_admin(api_client, user_auth_client):
    AdminSettings.objects.create(pk=1, title="Old Title")
    response = user_auth_client.patch(
        "/api/settings", {"title": "New Title"}, format="json"
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_patch_settings_as_admin(auth_client):
    AdminSettings.objects.create(pk=1, title="Old Title")
    response = auth_client.patch("/api/settings", {"title": "New Title"}, format="json")
    assert response.status_code == 200
    assert response.json()["title"] == "New Title"


@pytest.mark.django_db
def test_patch_settings_stores_per_page_nav_style(auth_client):
    AdminSettings.objects.create(pk=1, nav_style="solid")
    response = auth_client.patch(
        "/api/settings",
        {"navStyleOverrides": "home:gradient,search:light"},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["navStyleOverrides"] == "home:gradient,search:light"


@pytest.mark.django_db
def test_patch_settings_stores_canvas_background_color(auth_client):
    AdminSettings.objects.create(pk=1)
    response = auth_client.patch(
        "/api/settings", {"canvasBackgroundColor": "#0f172a"}, format="json"
    )
    assert response.status_code == 200
    assert response.json()["canvasBackgroundColor"] == "#0f172a"
    assert AdminSettings.objects.get(pk=1).canvas_background_color == "#0f172a"


@pytest.mark.django_db
def test_get_announcements_returns_home_page_announcements(api_client):
    Announcement.objects.create(title="Shown", text="Hello", show_on_home_page=True)
    Announcement.objects.create(title="Hidden", text="World", show_on_home_page=False)
    response = api_client.get("/api/announcements")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Shown"
    assert "showOnHomePage" in data[0]


# ── Admin announcement endpoint tests ──────────────────────────────────────


@pytest.mark.django_db
def test_admin_list_announcements_returns_all(auth_client):
    """Admin GET /api/admin/announcements returns all announcements regardless of show/show_on_home_page."""
    Announcement.objects.create(
        title="Visible", text="v", show=True, show_on_home_page=True
    )
    Announcement.objects.create(
        title="Hidden", text="h", show=False, show_on_home_page=False
    )
    response = auth_client.get("/api/admin/announcements")
    assert response.status_code == 200
    data = response.json()
    titles = {a["title"] for a in data}
    assert titles == {"Visible", "Hidden"}
    # show field is present
    assert "show" in data[0]


@pytest.mark.django_db
def test_admin_list_announcements_blocked_for_non_admin(user_auth_client):
    """Regular user cannot access admin announcement list."""
    response = user_auth_client.get("/api/admin/announcements")
    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_list_announcements_blocked_for_anonymous(api_client):
    """Unauthenticated request is rejected."""
    response = api_client.get("/api/admin/announcements")
    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_admin_create_announcement(auth_client):
    """Admin can create an announcement."""
    payload = {
        "title": "New Release",
        "text": "<p>Version 2.0 is live.</p>",
        "date": timezone.now().isoformat(),
        "show": True,
        "showOnHomePage": True,
    }
    response = auth_client.post("/api/admin/announcements", payload, format="json")
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "New Release"
    assert data["show"] is True
    assert Announcement.objects.count() == 1


@pytest.mark.django_db
def test_admin_create_announcement_requires_title(auth_client):
    """Creating an announcement without a title returns 400."""
    payload = {"text": "No title here", "show": True, "showOnHomePage": False}
    response = auth_client.post("/api/admin/announcements", payload, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_admin_create_announcement_requires_text(auth_client):
    """Creating an announcement without text returns 400."""
    payload = {"title": "No text", "show": True, "showOnHomePage": False}
    response = auth_client.post("/api/admin/announcements", payload, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_admin_create_blocked_for_non_admin(user_auth_client):
    """Regular user cannot create an announcement."""
    payload = {"title": "Bad", "text": "Actor", "show": True, "showOnHomePage": False}
    response = user_auth_client.post("/api/admin/announcements", payload, format="json")
    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_patch_announcement_soft_delete(auth_client):
    """PATCH show=False hides an announcement (soft delete)."""
    ann = Announcement.objects.create(title="Live", text="content", show=True)
    response = auth_client.patch(
        f"/api/admin/announcements/{ann.pk}", {"show": False}, format="json"
    )
    assert response.status_code == 200
    ann.refresh_from_db()
    assert ann.show is False


@pytest.mark.django_db
def test_admin_patch_announcement_restore(auth_client):
    """PATCH show=True restores a hidden announcement."""
    ann = Announcement.objects.create(title="Old", text="content", show=False)
    response = auth_client.patch(
        f"/api/admin/announcements/{ann.pk}", {"show": True}, format="json"
    )
    assert response.status_code == 200
    ann.refresh_from_db()
    assert ann.show is True


@pytest.mark.django_db
def test_admin_patch_blocked_for_non_admin(user_auth_client):
    """Regular user cannot patch an announcement."""
    ann = Announcement.objects.create(title="X", text="y", show=True)
    response = user_auth_client.patch(
        f"/api/admin/announcements/{ann.pk}", {"show": False}, format="json"
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_patch_nonexistent_returns_404(auth_client):
    """PATCH on a non-existent announcement returns 404."""
    response = auth_client.patch(
        "/api/admin/announcements/99999", {"show": False}, format="json"
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_admin_hard_delete_announcement(auth_client):
    """DELETE permanently removes an announcement."""
    ann = Announcement.objects.create(title="Gone", text="bye", show=False)
    response = auth_client.delete(f"/api/admin/announcements/{ann.pk}")
    assert response.status_code == 204
    assert not Announcement.objects.filter(pk=ann.pk).exists()


@pytest.mark.django_db
def test_admin_hard_delete_blocked_for_non_admin(user_auth_client):
    """Regular user cannot hard-delete an announcement."""
    ann = Announcement.objects.create(title="Safe", text="text", show=False)
    response = user_auth_client.delete(f"/api/admin/announcements/{ann.pk}")
    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_hard_delete_nonexistent_returns_404(auth_client):
    """DELETE on a non-existent announcement returns 404."""
    response = auth_client.delete("/api/admin/announcements/99999")
    assert response.status_code == 404


@pytest.mark.django_db
def test_admin_list_ordered_by_date_desc(auth_client):
    """Admin list returns announcements newest-first."""
    a1 = Announcement.objects.create(
        title="Old", text="old", date="2024-01-01T00:00:00Z"
    )
    a2 = Announcement.objects.create(
        title="New", text="new", date="2025-06-01T00:00:00Z"
    )
    response = auth_client.get("/api/admin/announcements")
    assert response.status_code == 200
    data = response.json()
    assert data[0]["title"] == a2.title
    assert data[1]["title"] == a1.title


# ── End admin announcement endpoint tests ──────────────────────────────────


@pytest.mark.django_db
def test_get_counts(api_client):
    from proteins.models import Protein
    from interactions.models import Interaction

    p1 = Protein.objects.create(gene_name="A")
    p2 = Protein.objects.create(gene_name="B")
    Interaction.objects.create(interactor_A=p1, interactor_B=p2, removed="0")
    Interaction.objects.create(interactor_A=p1, interactor_B=p2, removed="1")
    response = api_client.get("/api/counts")
    assert response.status_code == 200
    data = response.json()
    assert data["proteins"] == 2
    assert data["interactions"] == 1


@pytest.mark.django_db
def test_get_counts_includes_datasets_key(api_client):
    from datasets.models import Dataset

    Dataset.objects.create(name="HuRI", pubmed_id="12345")
    response = api_client.get("/api/counts")
    assert response.status_code == 200
    data = response.json()
    assert "datasets" in data
    assert data["datasets"] == 1


@pytest.mark.django_db
def test_get_settings_returns_empty_dict_when_unseeded(api_client):
    response = api_client.get("/api/settings")
    assert response.status_code == 200
    assert response.json() == {}


@pytest.mark.django_db
def test_patch_settings_unauthenticated_returns_401(api_client):
    AdminSettings.objects.create(pk=1, title="T")
    response = api_client.patch("/api/settings", {"title": "X"}, format="json")
    assert response.status_code in (401, 403)


# ── Logo upload ────────────────────────────────────────────────────────────


def _png_file(name="logo.png"):
    # Minimal 1×1 PNG bytes
    data = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
        b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00"
        b"\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18"
        b"\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    return SimpleUploadedFile(name, data, content_type="image/png")


@pytest.mark.django_db
def test_logo_upload_valid_png(auth_client):
    AdminSettings.objects.create(pk=1, title="T")
    response = auth_client.post(
        "/api/settings/logo", {"logo": _png_file()}, format="multipart"
    )
    assert response.status_code == 200
    assert response.json().get("logoUrl") is not None


@pytest.mark.django_db
def test_logo_upload_invalid_type_returns_400(auth_client):
    AdminSettings.objects.create(pk=1, title="T")
    bad_file = SimpleUploadedFile("doc.txt", b"hello", content_type="text/plain")
    response = auth_client.post(
        "/api/settings/logo", {"logo": bad_file}, format="multipart"
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_logo_upload_requires_admin(user_auth_client):
    AdminSettings.objects.create(pk=1, title="T")
    response = user_auth_client.post(
        "/api/settings/logo", {"logo": _png_file()}, format="multipart"
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_logo_upload_no_file_returns_400(auth_client):
    AdminSettings.objects.create(pk=1, title="T")
    response = auth_client.post("/api/settings/logo", {}, format="multipart")
    assert response.status_code == 400


@pytest.mark.django_db
def test_logo_delete_removes_logo(auth_client):
    settings = AdminSettings.objects.create(pk=1, title="T")
    # upload first
    auth_client.post("/api/settings/logo", {"logo": _png_file()}, format="multipart")
    response = auth_client.delete("/api/settings/logo")
    assert response.status_code == 200
    settings.refresh_from_db()
    assert not settings.logo


@pytest.mark.django_db
def test_logo_delete_requires_admin(user_auth_client):
    AdminSettings.objects.create(pk=1, title="T")
    response = user_auth_client.delete("/api/settings/logo")
    assert response.status_code == 403


# ── New AdminSettings field tests ─────────────────────────────────────────


@pytest.mark.django_db
def test_get_settings_exposes_about_and_content_fields(api_client):
    AdminSettings.objects.create(
        pk=1,
        about="<p>About text</p>",
        faq="<p>FAQ text</p>",
        contact="<p>Contact text</p>",
        download="<p>Download text</p>",
        show_downloads=True,
        show_download_all=False,
    )
    response = api_client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    assert data["about"] == "<p>About text</p>"
    assert data["faq"] == "<p>FAQ text</p>"
    assert data["contact"] == "<p>Contact text</p>"
    assert data["download"] == "<p>Download text</p>"
    assert data["showDownloads"] is True
    assert data["showDownloadAll"] is False


@pytest.mark.django_db
def test_get_settings_exposes_example_fields(api_client):
    AdminSettings.objects.create(
        pk=1,
        example_1="BAD\nBAK1\nMCL1",
        example_1_type="query-query",
        example_2="BAD\nBAK1",
        example_2_type="query-interactor",
        example_3="BAD",
        example_3_type="None",
    )
    response = api_client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    assert data["example1"] == "BAD\nBAK1\nMCL1"
    assert data["example1Type"] == "query-query"
    assert data["example2Type"] == "query-interactor"
    assert data["example3Type"] == "None"


@pytest.mark.django_db
def test_patch_settings_updates_example_type(auth_client):
    AdminSettings.objects.create(pk=1)
    response = auth_client.patch(
        "/api/settings",
        {"example1": "BAD\nBAK1", "example1Type": "query-query"},
        format="json",
    )
    assert response.status_code == 200
    data = response.json()
    assert data["example1"] == "BAD\nBAK1"
    assert data["example1Type"] == "query-query"


# ── InteractionCategory endpoint tests ────────────────────────────────────


@pytest.mark.django_db
def test_list_interaction_categories_is_public(api_client):
    from interactions.models import InteractionCategory

    settings_obj, _ = AdminSettings.objects.get_or_create(pk=1)
    InteractionCategory.objects.create(
        admin_settings=settings_obj,
        category_name="Literature",
        order="1",
        color_scheme="#0ea5e9",
        description="Curated literature interactions",
    )
    response = api_client.get("/api/interaction-categories")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    lit = next(d for d in data if d["categoryName"] == "Literature")
    assert lit["colorScheme"] == "#0ea5e9"


@pytest.mark.django_db
def test_create_interaction_category_requires_admin(api_client):
    response = api_client.post(
        "/api/interaction-categories",
        {"categoryName": "HI-Union", "order": "3"},
        format="json",
    )
    assert response.status_code == 401


@pytest.mark.django_db
def test_create_interaction_category_as_admin(auth_client):
    AdminSettings.objects.get_or_create(pk=1)
    response = auth_client.post(
        "/api/interaction-categories",
        {
            "categoryName": "HI-Union",
            "order": "3",
            "colorScheme": "#7c3aed",
            "description": "High-quality binary interactions",
        },
        format="json",
    )
    assert response.status_code == 201
    data = response.json()
    assert data["categoryName"] == "HI-Union"
    assert "id" in data


@pytest.mark.django_db
def test_patch_interaction_category(auth_client):
    from interactions.models import InteractionCategory

    settings_obj, _ = AdminSettings.objects.get_or_create(pk=1)
    cat = InteractionCategory.objects.create(
        admin_settings=settings_obj,
        category_name="Literature",
        order="1",
        color_scheme="#0ea5e9",
    )
    response = auth_client.patch(
        f"/api/interaction-categories/{cat.pk}",
        {"colorScheme": "#ff0000"},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["colorScheme"] == "#ff0000"


@pytest.mark.django_db
def test_delete_interaction_category(auth_client):
    from interactions.models import InteractionCategory

    settings_obj, _ = AdminSettings.objects.get_or_create(pk=1)
    cat = InteractionCategory.objects.create(
        admin_settings=settings_obj, category_name="ToDelete", order="1"
    )
    response = auth_client.delete(f"/api/interaction-categories/{cat.pk}")
    assert response.status_code == 204
    assert not InteractionCategory.objects.filter(pk=cat.pk).exists()


# ─────────────────────────────────────────────────────────
# Site text overrides
# ─────────────────────────────────────────────────────────
@pytest.mark.django_db
def test_get_site_text_returns_only_overrides(api_client):
    SiteText.objects.create(key="home.hero.headline", value="Custom headline")
    response = api_client.get("/api/settings/text")
    assert response.status_code == 200
    data = response.json()
    assert data["locale"] == "en"
    assert data["text"] == {"home.hero.headline": "Custom headline"}


@pytest.mark.django_db
def test_get_site_text_is_empty_when_nothing_overridden(api_client):
    response = api_client.get("/api/settings/text")
    assert response.status_code == 200
    assert response.json()["text"] == {}


@pytest.mark.django_db
def test_get_site_text_filters_by_locale(api_client):
    SiteText.objects.create(key="nav.home", locale="en", value="Home")
    SiteText.objects.create(key="nav.home", locale="fr", value="Accueil")
    assert api_client.get("/api/settings/text").json()["text"] == {"nav.home": "Home"}
    fr = api_client.get("/api/settings/text?locale=fr").json()
    assert fr["locale"] == "fr"
    assert fr["text"] == {"nav.home": "Accueil"}


@pytest.mark.django_db
def test_get_site_text_rejects_bad_locale(api_client):
    response = api_client.get("/api/settings/text?locale=not-a-locale-at-all")
    assert response.status_code == 400


@pytest.mark.django_db
def test_put_site_text_requires_admin(user_auth_client):
    response = user_auth_client.put(
        "/api/settings/text",
        {"entries": [{"key": "nav.home", "value": "Start"}]},
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_put_site_text_upserts_as_admin(auth_client):
    response = auth_client.put(
        "/api/settings/text",
        {"entries": [{"key": "nav.home", "value": "Start"}]},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["text"] == {"nav.home": "Start"}

    # Second write to the same key updates rather than duplicating.
    response = auth_client.put(
        "/api/settings/text",
        {"entries": [{"key": "nav.home", "value": "Beginning"}]},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["text"] == {"nav.home": "Beginning"}
    assert SiteText.objects.filter(key="nav.home", locale="en").count() == 1


@pytest.mark.django_db
def test_put_site_text_null_value_clears_override(auth_client):
    SiteText.objects.create(key="nav.home", value="Start")
    response = auth_client.put(
        "/api/settings/text",
        {"entries": [{"key": "nav.home", "value": None}]},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["text"] == {}
    assert not SiteText.objects.filter(key="nav.home").exists()


@pytest.mark.django_db
def test_put_site_text_blank_value_is_kept_as_override(auth_client):
    """Blanking a label is a deliberate choice, distinct from clearing it."""
    response = auth_client.put(
        "/api/settings/text",
        {"entries": [{"key": "nav.home", "value": ""}]},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["text"] == {"nav.home": ""}
    assert SiteText.objects.filter(key="nav.home").exists()


@pytest.mark.django_db
def test_put_site_text_writes_to_requested_locale(auth_client):
    response = auth_client.put(
        "/api/settings/text?locale=fr",
        {"entries": [{"key": "nav.home", "value": "Accueil"}]},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["locale"] == "fr"
    assert SiteText.objects.get(key="nav.home").locale == "fr"


@pytest.mark.django_db
def test_put_site_text_rejects_non_list_payload(auth_client):
    response = auth_client.put("/api/settings/text", {"entries": {}}, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_put_site_text_rejects_blank_key(auth_client):
    response = auth_client.put(
        "/api/settings/text",
        {"entries": [{"key": "   ", "value": "x"}]},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_put_site_text_preserves_multiline_html(auth_client):
    html = "<h3>Title</h3>\n<p>Body with  spacing</p>\n"
    response = auth_client.put(
        "/api/settings/text",
        {"entries": [{"key": "about.intro", "value": html}]},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["text"]["about.intro"] == html


# ── Granting admin access to an existing account ───────────────────────


@pytest.mark.django_db
def test_list_users_returns_admins_first(auth_client, regular_user):
    response = auth_client.get("/api/admin/users")
    assert response.status_code == 200
    data = response.json()
    usernames = [u["username"] for u in data]
    assert usernames == ["admin", regular_user.username]
    assert data[0]["isAdmin"] is True
    assert data[0]["isSuperuser"] is True
    assert data[1]["isAdmin"] is False


@pytest.mark.django_db
def test_list_users_filters_by_search(auth_client, regular_user):
    response = auth_client.get("/api/admin/users?search=testus")
    assert response.status_code == 200
    assert [u["username"] for u in response.json()] == [regular_user.username]


@pytest.mark.django_db
def test_list_users_blocked_for_non_admin(user_auth_client):
    assert user_auth_client.get("/api/admin/users").status_code == 403


@pytest.mark.django_db
def test_list_users_blocked_for_anonymous(api_client):
    assert api_client.get("/api/admin/users").status_code == 401


@pytest.mark.django_db
def test_grant_admin_promotes_existing_user(auth_client, regular_user):
    assert regular_user.is_staff is False
    response = auth_client.patch(
        f"/api/admin/users/{regular_user.pk}", {"isAdmin": True}, format="json"
    )
    assert response.status_code == 200
    assert response.json()["isAdmin"] is True

    regular_user.refresh_from_db()
    assert regular_user.is_staff is True
    # Promotion must not disturb the account's existing credentials.
    assert regular_user.check_password("testpass123")


@pytest.mark.django_db
def test_promoted_user_can_reach_admin_endpoints(auth_client, api_client, regular_user):
    auth_client.patch(
        f"/api/admin/users/{regular_user.pk}", {"isAdmin": True}, format="json"
    )
    login = api_client.post(
        "/api/auth/login",
        {"username": regular_user.username, "password": "testpass123"},
        format="json",
    )
    assert login.status_code == 200
    assert login.json()["is_admin"] is True

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.json()['access']}")
    assert api_client.get("/api/admin/announcements").status_code == 200


@pytest.mark.django_db
def test_grant_admin_is_idempotent(auth_client, admin_user):
    response = auth_client.patch(
        f"/api/admin/users/{admin_user.pk}", {"isAdmin": True}, format="json"
    )
    assert response.status_code == 200
    assert response.json()["isAdmin"] is True


@pytest.mark.django_db
def test_revoke_admin_demotes_existing_admin(auth_client, regular_user):
    regular_user.is_staff = True
    regular_user.save(update_fields=["is_staff"])

    response = auth_client.patch(
        f"/api/admin/users/{regular_user.pk}", {"isAdmin": False}, format="json"
    )
    assert response.status_code == 200
    assert response.json()["isAdmin"] is False

    regular_user.refresh_from_db()
    assert regular_user.is_staff is False
    # Revoking admin access must not disable the account itself.
    assert regular_user.is_active is True
    assert regular_user.check_password("testpass123")


@pytest.mark.django_db
def test_revoked_user_loses_admin_endpoint_access(
    auth_client, api_client, regular_user
):
    regular_user.is_staff = True
    regular_user.save(update_fields=["is_staff"])
    auth_client.patch(
        f"/api/admin/users/{regular_user.pk}", {"isAdmin": False}, format="json"
    )

    login = api_client.post(
        "/api/auth/login",
        {"username": regular_user.username, "password": "testpass123"},
        format="json",
    )
    assert login.status_code == 200
    assert login.json()["is_admin"] is False

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.json()['access']}")
    assert api_client.get("/api/admin/announcements").status_code == 403


@pytest.mark.django_db
def test_revoke_admin_is_idempotent(auth_client, regular_user):
    response = auth_client.patch(
        f"/api/admin/users/{regular_user.pk}", {"isAdmin": False}, format="json"
    )
    assert response.status_code == 200
    assert response.json()["isAdmin"] is False


@pytest.mark.django_db
def test_cannot_revoke_own_admin_access(auth_client, admin_user):
    """The sole remaining admin can therefore never drop the last set of keys."""
    response = auth_client.patch(
        f"/api/admin/users/{admin_user.pk}", {"isAdmin": False}, format="json"
    )
    assert response.status_code == 400
    admin_user.refresh_from_db()
    assert admin_user.is_staff is True


@pytest.mark.django_db
def test_cannot_revoke_a_superuser(auth_client, admin_user):
    """is_staff also gates /django-admin/, so this would close the fallback."""
    other = User.objects.create_superuser("root", "root@example.com", "rootpass123")
    response = auth_client.patch(
        f"/api/admin/users/{other.pk}", {"isAdmin": False}, format="json"
    )
    assert response.status_code == 400
    other.refresh_from_db()
    assert other.is_staff is True


@pytest.mark.django_db
def test_set_admin_rejects_non_boolean(auth_client, regular_user):
    response = auth_client.patch(
        f"/api/admin/users/{regular_user.pk}", {"isAdmin": "yes"}, format="json"
    )
    assert response.status_code == 400
    regular_user.refresh_from_db()
    assert regular_user.is_staff is False


@pytest.mark.django_db
def test_revoke_admin_rejects_non_admin(user_auth_client, regular_user):
    response = user_auth_client.patch(
        f"/api/admin/users/{regular_user.pk}", {"isAdmin": False}, format="json"
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_grant_admin_rejects_non_admin(user_auth_client, regular_user):
    response = user_auth_client.patch(
        f"/api/admin/users/{regular_user.pk}", {"isAdmin": True}, format="json"
    )
    assert response.status_code == 403
    regular_user.refresh_from_db()
    assert regular_user.is_staff is False


@pytest.mark.django_db
def test_grant_admin_rejects_anonymous(api_client, regular_user):
    response = api_client.patch(
        f"/api/admin/users/{regular_user.pk}", {"isAdmin": True}, format="json"
    )
    assert response.status_code == 401
    regular_user.refresh_from_db()
    assert regular_user.is_staff is False


@pytest.mark.django_db
def test_grant_admin_unknown_user_returns_404(auth_client):
    response = auth_client.patch(
        "/api/admin/users/99999", {"isAdmin": True}, format="json"
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_public_register_never_grants_admin(api_client):
    """Guards the hole the promotion flow exists to avoid."""
    response = api_client.post(
        "/api/auth/register",
        {
            "username": "plain",
            "email": "plain@example.com",
            "password": "pass1234",
            "security_questions": [
                {"question": "First pet?", "answer": "Rex"},
                {"question": "Birth city?", "answer": "Regina"},
                {"question": "First school?", "answer": "Elm"},
            ],
        },
        format="json",
    )
    assert response.status_code == 201
    user = User.objects.get(username="plain")
    assert user.is_staff is False
    assert user.is_superuser is False
