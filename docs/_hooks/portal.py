"""MkDocs hook: point the documentation's examples at this deployment.

Pages write {{ portal_url }} wherever an example needs a portal's address. A
build with PUBLIC_URL set (every deployment's frontend image) shows its own
address, so commands can be copied as they are. Without it, as when the
repository is read or built elsewhere, the examples use the reference portal,
which answers them for real.
"""

import os

REFERENCE_PORTAL = "https://openpip.usask.ca"


def on_config(config):
    public = os.environ.get("PUBLIC_URL", "").strip().rstrip("/")
    config["extra"]["portal_url"] = public or REFERENCE_PORTAL
    if public:
        config["site_url"] = f"{public}/docs/"
    return config


def on_page_markdown(markdown, page, config, files):
    return markdown.replace("{{ portal_url }}", config["extra"]["portal_url"])
