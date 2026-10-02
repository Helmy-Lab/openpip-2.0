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
