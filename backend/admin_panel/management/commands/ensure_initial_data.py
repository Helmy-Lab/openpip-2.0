from django.conf import settings
from django.core.management.base import BaseCommand
from django.core.management import call_command

from admin_panel.models import AdminSettings


class Command(BaseCommand):
    help = "Load initial_data.json only when no AdminSettings row exists yet"

    def handle(self, *args, **options):
        if AdminSettings.objects.exists():
            self.stdout.write(
                "AdminSettings already populated — skipping fixture load."
            )
            return
        self.stdout.write("No settings found — loading initial_data.json ...")
        call_command("loaddata", "admin_panel/fixtures/initial_data.json", verbosity=0)
        # The Site URL drives the API page's examples; start it at this
        # deployment's own address rather than a fixed one.
        if settings.PUBLIC_URL:
            AdminSettings.objects.update(url=f"{settings.PUBLIC_URL}/")
        self.stdout.write(self.style.SUCCESS("Initial data loaded."))
