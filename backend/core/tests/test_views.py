import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth.hashers import make_password
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from core.models import User


@pytest.mark.django_db
def test_login_returns_tokens_and_is_admin(api_client):
    User.objects.create_superuser("admin", "admin@example.com", "password123")
    response = api_client.post(
        "/api/auth/login",
        {"username": "admin", "password": "password123"},
        format="json",
    )
    assert response.status_code == 200
    data = response.json()
    assert "access" in data
    assert "refresh" in data
    assert data["is_admin"] is True


@pytest.mark.django_db
def test_login_invalid_credentials(api_client):
    response = api_client.post(
        "/api/auth/login", {"username": "nobody", "password": "wrong"}, format="json"
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


@pytest.mark.django_db
def test_register_creates_user(api_client):
    response = api_client.post(
        "/api/auth/register",
        {
            "username": "newuser",
            "email": "new@example.com",
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
    assert User.objects.filter(username="newuser").exists()


@pytest.mark.django_db
def test_register_rejects_duplicate_questions(api_client):
    response = api_client.post(
        "/api/auth/register",
        {
            "username": "dupq",
            "email": "dupq@example.com",
            "password": "pass1234",
            "security_questions": [
                {"question": "First pet?", "answer": "Rex"},
                {"question": "First pet?", "answer": "Rex"},
                {"question": "First pet?", "answer": "Rex"},
            ],
        },
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_register_requires_three_questions(api_client):
    response = api_client.post(
        "/api/auth/register",
        {"username": "noq", "email": "noq@example.com", "password": "pass1234"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_register_duplicate_username(api_client):
    User.objects.create_user("existing", "e@example.com", "pass")
    response = api_client.post(
        "/api/auth/register",
        {"username": "existing", "email": "other@example.com", "password": "pass1234"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_me_returns_user_info(user_auth_client, regular_user):
    response = user_auth_client.get("/api/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == regular_user.username
    assert "is_admin" in data


@pytest.mark.django_db
def test_me_patch_updates_optional_details(user_auth_client, regular_user):
    response = user_auth_client.patch(
        "/api/auth/me",
        {"name": "Ada Lovelace", "affiliation": "UofT", "bio": "Networks."},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Ada Lovelace"
    regular_user.refresh_from_db()
    assert regular_user.first_name == "Ada Lovelace"
    assert regular_user.affiliation == "UofT"
    # An omitted field is left alone, an empty one clears.
    response = user_auth_client.patch(
        "/api/auth/me", {"affiliation": ""}, format="json"
    )
    assert response.json()["affiliation"] == ""
    assert response.json()["bio"] == "Networks."


@pytest.mark.django_db
def test_me_patch_rejects_bad_website(user_auth_client):
    response = user_auth_client.patch(
        "/api/auth/me", {"website": "not a url"}, format="json"
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_me_patch_rejects_non_image_avatar(user_auth_client):
    upload = SimpleUploadedFile("x.txt", b"not an image", content_type="text/plain")
    response = user_auth_client.patch(
        "/api/auth/me", {"avatar": upload}, format="multipart"
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_me_patch_stores_avatar(user_auth_client, regular_user):
    upload = SimpleUploadedFile("a.png", b"\x89PNG fake", content_type="image/png")
    response = user_auth_client.patch(
        "/api/auth/me", {"avatar": upload}, format="multipart"
    )
    assert response.status_code == 200
    assert response.json()["avatar"].endswith(".png")
    regular_user.refresh_from_db()
    assert regular_user.avatar
    regular_user.avatar.delete(save=True)


@pytest.mark.django_db
def test_me_patch_avatar_ignores_client_filename(user_auth_client, regular_user):
    # Media is served by extension: keeping "evil.html" would serve it as HTML.
    upload = SimpleUploadedFile("evil.html", b"<script>", content_type="image/png")
    response = user_auth_client.patch(
        "/api/auth/me", {"avatar": upload}, format="multipart"
    )
    assert response.status_code == 200
    assert response.json()["avatar"].endswith(".png")
    assert "evil" not in response.json()["avatar"]
    regular_user.refresh_from_db()
    regular_user.avatar.delete(save=True)


@pytest.mark.django_db
def test_me_requires_auth(api_client):
    response = api_client.get("/api/auth/me")
    assert response.status_code == 401


@pytest.mark.django_db
def test_password_reset_confirm_success(api_client):
    user = User.objects.create_user("resetme", "me@example.com", "oldpass123")
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = PasswordResetTokenGenerator().make_token(user)
    response = api_client.post(
        "/api/auth/password-reset-confirm",
        {"uid": uid, "token": token, "password": "newpass456"},
        format="json",
    )
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.check_password("newpass456")


@pytest.mark.django_db
def test_password_reset_confirm_invalid_token(api_client):
    user = User.objects.create_user("badtoken", "bad@example.com", "oldpass123")
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    response = api_client.post(
        "/api/auth/password-reset-confirm",
        {"uid": uid, "token": "invalid-token", "password": "newpass456"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_password_reset_confirm_short_password(api_client):
    user = User.objects.create_user("shortpw", "short@example.com", "oldpass123")
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = PasswordResetTokenGenerator().make_token(user)
    response = api_client.post(
        "/api/auth/password-reset-confirm",
        {"uid": uid, "token": token, "password": "short"},
        format="json",
    )
    assert response.status_code == 400


@pytest.fixture
def question_user():
    user = User.objects.create_user("qa", "qa@example.com", "oldpass123")
    user.security_questions = [
        {"question": "First pet?", "answer": make_password("rex")},
        {"question": "Birth city?", "answer": make_password("regina")},
        {"question": "First school?", "answer": make_password("elm")},
    ]
    user.save()
    return user


@pytest.mark.django_db
def test_security_question_returned(api_client, question_user):
    response = api_client.post(
        "/api/auth/security-question", {"email": "QA@example.com"}, format="json"
    )
    assert response.status_code == 200
    assert response.data["questions"] == ["First pet?", "Birth city?", "First school?"]


@pytest.mark.django_db
def test_security_question_unknown_email(api_client):
    response = api_client.post(
        "/api/auth/security-question", {"email": "nobody@example.com"}, format="json"
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_security_answer_correct_returns_reset_token(api_client, question_user):
    response = api_client.post(
        "/api/auth/security-answer",
        {"email": "qa@example.com", "answers": ["  REX ", "Regina", "elm"]},
        format="json",
    )
    assert response.status_code == 200
    confirm = api_client.post(
        "/api/auth/password-reset-confirm",
        {
            "uid": response.data["uid"],
            "token": response.data["token"],
            "password": "newpass456",
        },
        format="json",
    )
    assert confirm.status_code == 200
    question_user.refresh_from_db()
    assert question_user.check_password("newpass456")


@pytest.mark.django_db
def test_security_answer_one_wrong_is_rejected(api_client, question_user):
    """Two of three right is still a failure."""
    response = api_client.post(
        "/api/auth/security-answer",
        {"email": "qa@example.com", "answers": ["rex", "regina", "fluffy"]},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_security_answer_too_few_answers(api_client, question_user):
    response = api_client.post(
        "/api/auth/security-answer",
        {"email": "qa@example.com", "answers": ["rex"]},
        format="json",
    )
    assert response.status_code == 400


def _register(api_client, username, email):
    return api_client.post(
        "/api/auth/register",
        {
            "username": username,
            "email": email,
            "password": "pass1234",
            "security_questions": [
                {"question": "First pet?", "answer": "Rex"},
                {"question": "Birth city?", "answer": "Regina"},
                {"question": "First school?", "answer": "Elm"},
            ],
        },
        format="json",
    )


@pytest.mark.django_db
def test_register_rejects_duplicate_email_ignoring_case(api_client):
    assert _register(api_client, "first", "shared@example.com").status_code == 201
    response = _register(api_client, "second", "SHARED@example.com")
    assert response.status_code == 400
    assert response.json()["detail"] == "Email already registered."
    assert not User.objects.filter(username="second").exists()


@pytest.mark.django_db
def test_blank_emails_do_not_collide(db):
    """Accounts predating registration-time email all hold "" — the unique
    constraint has to let them."""
    User.objects.create_user("old_one", "", "pass12345")
    User.objects.create_user("old_two", "", "pass12345")
    assert User.objects.filter(email="").count() == 2


@pytest.mark.django_db
def test_user_search_matches_name_lab_and_exact_email(user_auth_client):
    User.objects.create_user(
        "hleung",
        "hleung@example.com",
        "pass12345",
        first_name="Helen Leung",
        affiliation="Helmy Lab",
    )
    User.objects.create_user("unrelated", "nobody@example.com", "pass12345")

    def usernames(q):
        return [
            u["username"]
            for u in user_auth_client.get(f"/api/users/search?q={q}").json()
        ]

    assert usernames("helen") == ["hleung"]
    assert usernames("helmy lab") == ["hleung"]
    assert usernames("hleung@example.com") == ["hleung"]
    # Partial email would make this an address-harvesting endpoint.
    assert usernames("hleung@exa") == []
    # Below two characters everyone would match.
    assert usernames("h") == []


@pytest.mark.django_db
def test_user_search_excludes_self_and_undiscoverable(user_auth_client, regular_user):
    hidden = User.objects.create_user(
        "hidden", "hidden@example.com", "pass12345", first_name="Hidden Person"
    )
    hidden.discoverable = False
    hidden.save(update_fields=["discoverable"])
    regular_user.first_name = "Hidden Twin"
    regular_user.save(update_fields=["first_name"])

    found = user_auth_client.get("/api/users/search?q=hidden").json()
    assert found == []


@pytest.mark.django_db
def test_public_profile_visible_even_when_undiscoverable(user_auth_client):
    person = User.objects.create_user(
        "gbader",
        "gbader@example.com",
        "pass12345",
        first_name="Gary Bader",
        affiliation="University of Toronto",
    )
    person.discoverable = False
    person.position = "Professor"
    person.save(update_fields=["discoverable", "position"])

    response = user_auth_client.get("/api/users/gbader")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Gary Bader"
    assert body["affiliation"] == "University of Toronto"
    assert body["position"] == "Professor"
    assert body["joined"]
    # The card never carries an email address.
    assert "email" not in body


@pytest.mark.django_db
def test_public_profile_unknown_user(user_auth_client):
    assert user_auth_client.get("/api/users/ghost").status_code == 404


@pytest.mark.django_db
def test_user_search_requires_login(api_client):
    assert api_client.get("/api/users/search?q=helen").status_code == 401


@pytest.mark.django_db
def test_discoverable_toggles_from_the_profile(user_auth_client):
    assert user_auth_client.get("/api/auth/me").json()["discoverable"] is True
    response = user_auth_client.patch(
        "/api/auth/me", {"discoverable": False}, format="json"
    )
    assert response.status_code == 200
    assert response.json()["discoverable"] is False
