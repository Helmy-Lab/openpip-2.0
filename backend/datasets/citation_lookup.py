"""Citation metadata lookup by PubMed ID or DOI.

Proxied through the backend rather than fetched from the browser: NCBI blocks
cross-origin requests, and an API key (when one is configured) has no business
being in frontend JavaScript.

Both lookups return the same dict shape, matching the Dataset citation fields
so a caller can hand the result straight to DatasetWriteSerializer:

    {"pubmed_id", "doi", "title", "journal", "year", "author", "url"}
"""

import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

EUTILS_SUMMARY = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
CROSSREF_WORKS = "https://api.crossref.org/works"
PUBMED_URL = "https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
DOI_URL = "https://doi.org/{doi}"
TIMEOUT = 15


class CitationLookupError(Exception):
    """The upstream service failed, or the identifier matched nothing."""


def _first_author(names: list[str]) -> str | None:
    """Render an author list the way the legacy dataset rows did: 'Rual et al.'"""
    if not names:
        return None
    first = names[0]
    return f"{first} et al." if len(names) > 1 else first


def fetch_by_pubmed_id(pmid: str) -> dict:
    """Look up citation metadata for a PubMed ID via NCBI E-utilities."""
    params = {"db": "pubmed", "id": pmid, "retmode": "json"}
    api_key = getattr(settings, "NCBI_API_KEY", None)
    if api_key:
        params["api_key"] = api_key

    try:
        resp = requests.get(EUTILS_SUMMARY, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        payload = resp.json()
    except requests.RequestException as exc:
        logger.warning("PubMed lookup failed for %s: %s", pmid, exc)
        raise CitationLookupError("PubMed is unavailable right now.") from exc
    except ValueError as exc:
        raise CitationLookupError("PubMed returned an unreadable response.") from exc

    record = payload.get("result", {}).get(pmid)
    if not record or "error" in record:
        raise CitationLookupError(f"No PubMed record found for {pmid}.")

    # pubdate is free text: "2014 Nov 20", "2020", "2009 Jan-Feb".
    pubdate = (record.get("pubdate") or "").strip()
    year = pubdate[:4] if pubdate[:4].isdigit() else None

    doi = None
    for article_id in record.get("articleids", []):
        if article_id.get("idtype") == "doi":
            doi = article_id.get("value")
            break

    return {
        "pubmed_id": pmid,
        "doi": doi,
        "title": (record.get("title") or "").rstrip(".") or None,
        "journal": record.get("fulljournalname") or record.get("source") or None,
        "year": year,
        "author": _first_author(
            [a["name"] for a in record.get("authors", []) if a.get("name")]
        ),
        "url": PUBMED_URL.format(pmid=pmid),
    }


def fetch_by_doi(doi: str) -> dict:
    """Look up citation metadata for a DOI via Crossref.

    This is the path for preprints — bioRxiv entries have a DOI long before
    they have a PubMed ID, and some never get one.
    """
    try:
        resp = requests.get(
            f"{CROSSREF_WORKS}/{doi}",
            timeout=TIMEOUT,
            # Crossref asks clients to identify themselves; this names the
            # project rather than any one deployment.
            headers={
                "User-Agent": "openPIP/2.0 (+https://github.com/Helmy-Lab/openpip-2.0)"
            },
        )
        if resp.status_code == 404:
            raise CitationLookupError(f"No Crossref record found for {doi}.")
        resp.raise_for_status()
        payload = resp.json()
    except requests.RequestException as exc:
        logger.warning("Crossref lookup failed for %s: %s", doi, exc)
        raise CitationLookupError("Crossref is unavailable right now.") from exc
    except ValueError as exc:
        raise CitationLookupError("Crossref returned an unreadable response.") from exc

    work = payload.get("message") or {}
    if not work:
        raise CitationLookupError(f"No Crossref record found for {doi}.")

    titles = work.get("title") or []
    containers = work.get("container-title") or []

    # Crossref reports a date as nested parts: {"date-parts": [[2020, 4, 8]]}.
    date_parts = (work.get("published") or {}).get("date-parts") or [[]]
    year = str(date_parts[0][0]) if date_parts[0] else None

    authors = [
        a["family"]
        for a in work.get("author") or []
        if isinstance(a, dict) and a.get("family")
    ]

    return {
        "pubmed_id": None,
        "doi": work.get("DOI") or doi,
        "title": (titles[0].rstrip(".") if titles else None),
        "journal": containers[0] if containers else work.get("publisher"),
        "year": year,
        "author": _first_author(authors),
        "url": work.get("URL") or DOI_URL.format(doi=doi),
    }
