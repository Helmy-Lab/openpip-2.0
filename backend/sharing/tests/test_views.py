import pytest

from core.models import User
from sharing.models import Comment, Notification, SavedView, Share


@pytest.fixture
def other_user(db):
    return User.objects.create_user("colleague", "colleague@example.com", "pass12345")


@pytest.fixture
def saved_view(regular_user):
    return SavedView.objects.create(
        user=regular_user,
        name="MAPK cluster",
        query="MAPK1",
        state={"scoreFilter": 0.4, "selectedLayout": "cose"},
    )


def bearer(api_client, user):
    from rest_framework_simplejwt.tokens import RefreshToken

    api_client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}"
    )
    return api_client


@pytest.mark.django_db
def test_saved_view_round_trips_its_state(user_auth_client):
    state = {"scoreFilter": 0.6, "tissueFilter": ["liver"], "selectedLayout": "grid"}
    created = user_auth_client.post(
        "/api/saved-views/",
        {"name": "Liver view", "query": "TP53", "state": state},
        format="json",
    )
    assert created.status_code == 201
    assert created.json()["state"] == state

    listed = user_auth_client.get("/api/saved-views/")
    assert [v["name"] for v in listed.json()] == ["Liver view"]


@pytest.mark.django_db
def test_saved_views_are_private(user_auth_client, other_user, saved_view):
    assert len(user_auth_client.get("/api/saved-views/").json()) == 1
    bearer(user_auth_client, other_user)
    assert user_auth_client.get("/api/saved-views/").json() == []


@pytest.mark.django_db
def test_sharing_notifies_the_recipient(user_auth_client, other_user, saved_view):
    response = user_auth_client.post(
        "/api/shares/",
        {
            "saved_view": saved_view.pk,
            "recipient": other_user.username,
            "note": "Look at the liver cluster",
        },
        format="json",
    )
    assert response.status_code == 201
    body = response.json()
    assert body["note"] == "Look at the liver cluster"
    assert body["saved_view"]["state"] == saved_view.state
    assert body["recipient"]["username"] == "colleague"

    note = Notification.objects.get(user=other_user)
    assert "MAPK cluster" in note.text
    assert note.link == f"/shared/{body['id']}"
    assert note.read is False


@pytest.mark.django_db
def test_undiscoverable_user_looks_like_no_user(
    user_auth_client, other_user, saved_view
):
    other_user.discoverable = False
    other_user.save(update_fields=["discoverable"])
    response = user_auth_client.post(
        "/api/shares/",
        {"saved_view": saved_view.pk, "recipient": other_user.username},
        format="json",
    )
    assert response.status_code == 400
    # Byte-for-byte the answer for a username nobody holds, so the endpoint
    # cannot be used to discover that this account exists.
    missing = user_auth_client.post(
        "/api/shares/",
        {"saved_view": saved_view.pk, "recipient": "ghost"},
        format="json",
    )
    assert response.json() == missing.json()


@pytest.mark.django_db
def test_cannot_share_someone_elses_view(user_auth_client, other_user, saved_view):
    bearer(user_auth_client, other_user)
    response = user_auth_client.post(
        "/api/shares/",
        {"saved_view": saved_view.pk, "recipient": "testuser"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_recipient_sees_share_and_revoking_removes_it(
    user_auth_client, regular_user, other_user, saved_view
):
    share = Share.objects.create(
        saved_view=saved_view, sender=regular_user, recipient=other_user
    )
    bearer(user_auth_client, other_user)
    assert [s["id"] for s in user_auth_client.get("/api/shares/").json()] == [share.pk]
    assert user_auth_client.get(f"/api/shares/{share.pk}/").status_code == 200

    bearer(user_auth_client, regular_user)
    assert user_auth_client.get("/api/shares/?direction=sent").json()[0]["id"] == (
        share.pk
    )
    assert user_auth_client.delete(f"/api/shares/{share.pk}/").status_code == 204

    bearer(user_auth_client, other_user)
    assert user_auth_client.get(f"/api/shares/{share.pk}/").status_code == 404


@pytest.mark.django_db
def test_outsider_cannot_read_a_share(
    user_auth_client, regular_user, other_user, saved_view
):
    share = Share.objects.create(
        saved_view=saved_view, sender=regular_user, recipient=other_user
    )
    outsider = User.objects.create_user("outsider", "out@example.com", "pass12345")
    bearer(user_auth_client, outsider)
    assert user_auth_client.get(f"/api/shares/{share.pk}/").status_code == 404
    assert user_auth_client.get(f"/api/shares/{share.pk}/comments").status_code == 404


@pytest.mark.django_db
def test_comment_notifies_only_the_other_party(
    user_auth_client, regular_user, other_user, saved_view
):
    share = Share.objects.create(
        saved_view=saved_view, sender=regular_user, recipient=other_user
    )
    Notification.objects.all().delete()
    response = user_auth_client.post(
        f"/api/shares/{share.pk}/comments",
        {"body": "The liver edges look wrong"},
        format="json",
    )
    assert response.status_code == 201
    assert response.json()["author"]["username"] == "testuser"
    assert [n.user for n in Notification.objects.all()] == [other_user]

    bearer(user_auth_client, other_user)
    listed = user_auth_client.get(f"/api/shares/{share.pk}/comments").json()
    assert [c["body"] for c in listed] == ["The liver edges look wrong"]


@pytest.mark.django_db
def test_empty_comment_rejected(user_auth_client, regular_user, other_user, saved_view):
    share = Share.objects.create(
        saved_view=saved_view, sender=regular_user, recipient=other_user
    )
    response = user_auth_client.post(
        f"/api/shares/{share.pk}/comments", {"body": "   "}, format="json"
    )
    assert response.status_code == 400
    assert Comment.objects.count() == 0


@pytest.mark.django_db
def test_author_can_edit_their_own_comment(
    user_auth_client, regular_user, other_user, saved_view
):
    share = Share.objects.create(
        saved_view=saved_view, sender=regular_user, recipient=other_user
    )
    comment = Comment.objects.create(share=share, author=regular_user, body="frist")
    assert not user_auth_client.get(f"/api/shares/{share.pk}/comments").json()[0][
        "edited"
    ]

    response = user_auth_client.patch(
        f"/api/shares/{share.pk}/comments/{comment.pk}",
        {"body": "first"},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["body"] == "first"
    assert response.json()["edited"] is True
    comment.refresh_from_db()
    assert comment.body == "first"


@pytest.mark.django_db
def test_other_party_cannot_edit_a_comment(
    user_auth_client, regular_user, other_user, saved_view
):
    share = Share.objects.create(
        saved_view=saved_view, sender=regular_user, recipient=other_user
    )
    comment = Comment.objects.create(share=share, author=regular_user, body="mine")
    bearer(user_auth_client, other_user)
    response = user_auth_client.patch(
        f"/api/shares/{share.pk}/comments/{comment.pk}",
        {"body": "not yours"},
        format="json",
    )
    assert response.status_code == 404
    comment.refresh_from_db()
    assert comment.body == "mine"


@pytest.mark.django_db
def test_edited_comment_cannot_be_emptied(
    user_auth_client, regular_user, other_user, saved_view
):
    share = Share.objects.create(
        saved_view=saved_view, sender=regular_user, recipient=other_user
    )
    comment = Comment.objects.create(share=share, author=regular_user, body="mine")
    response = user_auth_client.patch(
        f"/api/shares/{share.pk}/comments/{comment.pk}", {"body": " "}, format="json"
    )
    assert response.status_code == 400
    comment.refresh_from_db()
    assert comment.body == "mine"


@pytest.mark.django_db
def test_deleting_a_share_takes_its_comments(
    user_auth_client, regular_user, other_user, saved_view
):
    share = Share.objects.create(
        saved_view=saved_view, sender=regular_user, recipient=other_user
    )
    Comment.objects.create(share=share, author=regular_user, body="hi")
    user_auth_client.delete(f"/api/shares/{share.pk}/")
    assert Comment.objects.count() == 0


@pytest.mark.django_db
def test_notifications_listed_and_marked_read(user_auth_client, regular_user):
    note = Notification.objects.create(
        user=regular_user, text="someone shared a network", link="/shared/1"
    )
    listed = user_auth_client.get("/api/notifications/").json()
    assert [n["read"] for n in listed] == [False]

    patched = user_auth_client.patch(
        f"/api/notifications/{note.pk}/", {"read": True}, format="json"
    )
    assert patched.status_code == 200
    note.refresh_from_db()
    assert note.read is True


@pytest.mark.django_db
def test_notifications_are_private(user_auth_client, regular_user, other_user):
    Notification.objects.create(user=regular_user, text="mine", link="")
    bearer(user_auth_client, other_user)
    assert user_auth_client.get("/api/notifications/").json() == []


@pytest.mark.django_db
def test_sharing_requires_login(api_client, saved_view, other_user):
    response = api_client.post(
        "/api/shares/",
        {"saved_view": saved_view.pk, "recipient": other_user.username},
        format="json",
    )
    assert response.status_code == 401


@pytest.mark.django_db
def test_clearing_notifications_leaves_other_users_alone(
    user_auth_client, regular_user, other_user
):
    Notification.objects.create(user=regular_user, text="mine", link="")
    Notification.objects.create(user=other_user, text="theirs", link="")

    response = user_auth_client.post("/api/notifications/clear/")

    assert response.status_code == 204
    assert [n.user for n in Notification.objects.all()] == [other_user]


@pytest.mark.django_db
def test_marking_all_read_leaves_other_users_alone(
    user_auth_client, regular_user, other_user
):
    mine = Notification.objects.create(user=regular_user, text="mine", link="")
    theirs = Notification.objects.create(user=other_user, text="theirs", link="")

    response = user_auth_client.post("/api/notifications/mark-all-read/")

    assert response.status_code == 204
    mine.refresh_from_db()
    theirs.refresh_from_db()
    assert mine.read is True
    assert theirs.read is False
    assert Notification.objects.count() == 2


@pytest.mark.django_db
def test_owner_can_keep_notes_on_a_saved_view(user_auth_client, saved_view):
    response = user_auth_client.patch(
        f"/api/saved-views/{saved_view.pk}/",
        {"note": "Check the liver cluster again"},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["note"] == "Check the liver cluster again"
    saved_view.refresh_from_db()
    assert saved_view.note == "Check the liver cluster again"


@pytest.mark.django_db
def test_share_recipient_does_not_see_owner_note_or_token(
    user_auth_client, other_user, saved_view
):
    saved_view.note = "private"
    saved_view.public_token = "tok"
    saved_view.save()
    user_auth_client.post(
        "/api/shares/",
        {"saved_view": saved_view.pk, "recipient": other_user.username},
        format="json",
    )
    bearer(user_auth_client, other_user)
    nested = user_auth_client.get("/api/shares/").json()[0]["saved_view"]
    assert "note" not in nested and "public_token" not in nested


@pytest.mark.django_db
def test_public_link_opens_without_login_until_revoked(user_auth_client, saved_view):
    from rest_framework.test import APIClient

    # A separate client: the api_client fixture is the same object that
    # user_auth_client put credentials on.
    anonymous = APIClient()
    saved_view.note = "private"
    saved_view.save()
    minted = user_auth_client.post(f"/api/saved-views/{saved_view.pk}/public-link/")
    assert minted.status_code == 200
    token = minted.json()["public_token"]
    assert len(token) >= 40
    # Minting again keeps the same link rather than breaking the one sent out.
    again = user_auth_client.post(f"/api/saved-views/{saved_view.pk}/public-link/")
    assert again.json()["public_token"] == token

    public = anonymous.get(f"/api/public-views/{token}")
    assert public.status_code == 200
    assert public.json() == {
        "name": "MAPK cluster",
        "query": "MAPK1",
        "state": {"scoreFilter": 0.4, "selectedLayout": "cose"},
    }

    user_auth_client.delete(f"/api/saved-views/{saved_view.pk}/public-link/")
    assert anonymous.get(f"/api/public-views/{token}").status_code == 404


@pytest.mark.django_db
def test_only_the_owner_can_mint_a_public_link(
    user_auth_client, other_user, saved_view
):
    bearer(user_auth_client, other_user)
    response = user_auth_client.post(f"/api/saved-views/{saved_view.pk}/public-link/")
    assert response.status_code == 404
    saved_view.refresh_from_db()
    assert saved_view.public_token is None


@pytest.mark.django_db
def test_public_token_is_not_writable(user_auth_client, saved_view):
    user_auth_client.patch(
        f"/api/saved-views/{saved_view.pk}/",
        {"public_token": "chosen"},
        format="json",
    )
    saved_view.refresh_from_db()
    assert saved_view.public_token is None


@pytest.mark.django_db
def test_long_names_are_cut_to_fit_the_notification(
    user_auth_client, regular_user, other_user, saved_view
):
    regular_user.first_name = "N" * 150
    regular_user.save()
    saved_view.name = "V" * 200
    saved_view.save()
    response = user_auth_client.post(
        "/api/shares/",
        {"saved_view": saved_view.pk, "recipient": other_user.username},
        format="json",
    )
    assert response.status_code == 201
    text = Notification.objects.get(user=other_user).text
    assert len(text) == 300 and text.endswith("…")
