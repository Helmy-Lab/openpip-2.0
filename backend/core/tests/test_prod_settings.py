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
