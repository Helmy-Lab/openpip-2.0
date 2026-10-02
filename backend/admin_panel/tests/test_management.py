import pytest
from io import StringIO
from unittest.mock import patch
from django.core.management import call_command

from admin_panel.models import AdminSettings


@pytest.mark.django_db
def test_ensure_initial_data_skips_when_settings_exist():
    AdminSettings.objects.create(title="openPIP")
    out = StringIO()
    call_command("ensure_initial_data", stdout=out)
    assert "skipping" in out.getvalue().lower()


@pytest.mark.django_db
def test_ensure_initial_data_loads_fixture_when_empty():
    assert AdminSettings.objects.count() == 0
    out = StringIO()
    # The command calls loaddata internally; just verify it runs without error
    # and the success message is printed.
    with patch(
        "admin_panel.management.commands.ensure_initial_data.call_command"
    ) as mock_cc:
        call_command("ensure_initial_data", stdout=out)
    mock_cc.assert_called_once_with(
        "loaddata", "admin_panel/fixtures/initial_data.json", verbosity=0
    )
    assert "loaded" in out.getvalue().lower()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "public_url, expected",
    [("https://openpip.example.org/lab", "https://openpip.example.org/lab/"), ("", "")],
)
def test_first_run_site_url_follows_public_url(settings, public_url, expected):
    settings.PUBLIC_URL = public_url
    call_command("ensure_initial_data", stdout=StringIO())
    assert AdminSettings.objects.get().url == expected
