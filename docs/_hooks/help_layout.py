"""MkDocs hook: lay out the user and admin guides as a help page.

Each page gets a banner and a row of tabs, one per page in its guide, in place
of the sidebars. Every ## section becomes a card that opens on click, and every
### inside it a smaller one. A card's one-line description comes from its
heading: ## Title { data-desc="..." }.
"""

import re

from mkdocs.utils import get_relative_url

SUBTITLES = {
    "user-guide/": "Search, explore and download protein–protein interaction data.",
    "admin-guide/": "Load the portal's data, write its pages and set its look.",
}


def _guide(page):
    return next((g for g in SUBTITLES if page.file.src_uri.startswith(g)), None)


def _fold(html, tag):
    """Wrap each <tag> heading and what follows it in a <details> card."""
    parts = re.split(rf"(?=<{tag}[ >])", html)
    out = [parts[0]]
    for part in parts[1:]:
        head, body = part.split(f"</{tag}>", 1)
        desc = re.search(r' data-desc="([^"]*)"', head)
        if desc:
            head += f'</{tag}><p class="help-desc">{desc[1]}</p>'
        else:
            head += f"</{tag}>"
        if tag == "h2":
            body = _fold(body, "h3")
        out.append(
            f'<details class="help-card help-{tag}"><summary>{head}</summary>'
            f'<div class="help-body">{body}</div></details>'
        )
    return "".join(out)


def on_page_markdown(markdown, page, config, files):
    if _guide(page):
        page.meta.setdefault("hide", ["navigation", "toc"])
    return markdown


def on_page_content(html, page, config, files):
    guide = _guide(page)
    if not guide:
        return html
    tabs = "".join(
        f'<a class="help-tab{" active" if p is page else ""}" '
        f'href="{get_relative_url(p.url, page.url)}">{p.title}</a>'
        for p in page.parent.children
        if p.is_page
    )
    banner = (
        f'<div class="help-header"><p class="help-title">{page.parent.title}</p>'
        f'<p class="help-subtitle">{SUBTITLES[guide]}</p></div>'
        f'<nav class="help-tabs">{tabs}</nav>'
    )
    if "<h2" in html:
        html = html.replace(
            "<h2", '<p class="help-hint">Click a section to expand it.</p><h2', 1
        )
    return banner + _fold(html, "h2")
