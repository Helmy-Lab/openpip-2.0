import os
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]


def _import_prod(secret_key: str) -> subprocess.CompletedProcess:
    # A fresh interpreter: settings modules execute once per process.
    env = {**os.environ, "SECRET_KEY": secret_key}
    return subprocess.run(
        [sys.executable, "-c", "import openpip.settings.prod"],
        cwd=BACKEND,
        env=env,
        capture_output=True,
        text=True,
    )


def test_prod_refuses_default_secret_key():
    result = _import_prod("django-insecure-dev-key-change-in-production")
    assert result.returncode != 0
    assert "SECRET_KEY" in result.stderr


def test_prod_accepts_real_secret_key():
    assert _import_prod("x" * 50).returncode == 0


def test_rate_limits_trust_only_the_proxy_set_address(settings):
    from django.test import RequestFactory
    from rest_framework.request import Request

    from core.throttling import SecurityAnswerThrottle

    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, "NUM_PROXIES": 1}
    raw = RequestFactory().get(
        "/", HTTP_X_FORWARDED_FOR="6.6.6.6, 203.0.113.9", REMOTE_ADDR="172.18.0.5"
    )
    assert SecurityAnswerThrottle().get_ident(Request(raw)) == "203.0.113.9"


def test_production_settings_set_one_trusted_proxy():
    env = {**os.environ, "SECRET_KEY": "x" * 50}
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import openpip.settings.prod as p; print(p.REST_FRAMEWORK['NUM_PROXIES'])",
        ],
        cwd=BACKEND,
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.stdout.strip() == "1"


def _prod_value(expr: str, **env_vars) -> str:
    # Set, not removed: settings also read the repository's .env, which on a
    # real deployment holds these, and an empty value means "derive".
    unset = {"PUBLIC_URL": "", "ALLOWED_HOSTS": "", "CSRF_TRUSTED_ORIGINS": ""}
    env = {**os.environ, **unset, "SECRET_KEY": "x" * 50, **env_vars}
    return subprocess.run(
        [
            sys.executable,
            "-c",
            f"import openpip.settings.prod as p; print(repr({expr}))",
        ],
        cwd=BACKEND,
        env=env,
        capture_output=True,
        text=True,
    ).stdout.strip()


def test_without_public_url_production_is_a_local_http_install():
    assert _prod_value("p.FORCE_SCRIPT_NAME") == "''"
    assert _prod_value("p.SECURE_SSL_REDIRECT") == "False"
    assert _prod_value("p.ALLOWED_HOSTS") == "['localhost', '127.0.0.1']"


def test_public_url_sets_prefix_hosts_origins_and_https():
    url = {"PUBLIC_URL": "https://openpip.example.org/lab/"}
    assert _prod_value("p.FORCE_SCRIPT_NAME", **url) == "'/lab'"
    assert _prod_value("p.SECURE_SSL_REDIRECT", **url) == "True"
    assert _prod_value("p.SESSION_COOKIE_SECURE", **url) == "True"
    assert "openpip.example.org" in _prod_value("p.ALLOWED_HOSTS", **url)
    assert (
        _prod_value("p.CSRF_TRUSTED_ORIGINS", **url)
        == "['https://openpip.example.org']"
    )


def test_explicit_hosts_override_and_http_public_url_skips_https():
    env = {"PUBLIC_URL": "http://pip.lab.local", "ALLOWED_HOSTS": "pip.lab.local"}
    assert _prod_value("p.ALLOWED_HOSTS", **env) == "['pip.lab.local']"
    assert _prod_value("p.SECURE_SSL_REDIRECT", **env) == "False"
