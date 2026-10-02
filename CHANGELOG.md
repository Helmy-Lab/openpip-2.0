# Changelog

All notable changes to openPIP 2.0. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

No version has been tagged yet. Everything below is in development towards
**2.0.0**, the first release of the rebuilt platform.

## [Unreleased]

### Added

**Searching and exploring**

- Search by one or more identifiers, separated by commas, spaces or new lines,
  with gene-name autocomplete on the home and search pages.
- Typed phrases in the home page search, with tissue-name suggestions.
- Interactive network (Cytoscape.js) with confidence, evidence-category,
  tissue (several at once, combined as in the original openPIP) and annotation
  filters, a choice of layouts, highlighting, and a canvas background setting.
- Protein and interaction detail panels with links to external databases
  (including BioGRID, KEGG and UniProt), and a 3D structure viewer showing the
  AlphaFold model (with model confidence) or a PDB structure.
- Term enrichment, subcellular location and tissue expression tabs.
- A browsable, filterable list of every protein.
- Network exports for everyone, including PNG and JPG images and FASTA
  sequences.

**Saving and sharing**

- Saved networks, and saved views that re-run their search on the current data.
- Sharing saved views with colleagues, with notes, a discussion thread and
  in-portal notifications.
- Public links that open a saved view without logging in.
- User profiles with optional details, an avatar, and a public profile page.
- Account recovery through security questions set at registration. openPIP
  sends no email.

**Data**

- Background dataset import (Celery and Redis) with a progress view.
- PSI-MI TAB and simple CSV uploads. Uploads keep detection methods,
  interaction types, participant roles, organisms, annotations and the
  negative flag.
- Automatic enrichment of new proteins from UniProt and Ensembl, and of new
  organisms from NCBI Taxonomy.
- A citation and an About-page entry for every dataset, with lookup by PubMed
  ID or DOI.
- A command to link existing proteins to their organisms from UniProt.

**Programmatic access**

- A JSON REST API, with a generated OpenAPI schema and Swagger UI.
- A PSICQUIC service: PSI-MI TAB 2.5, 2.6, 2.7 and 2.8, MIQL with boolean
  operators and the `id`, `idA`, `idB`, `taxidA`, `taxidB`, `species`, `pubid` and
  `pubauth` fields, ROGID/RIGID checksums, and `formats`/`version` endpoints.
- Rate limits on the public API and PSICQUIC.

**Administration**

- An admin panel for site identity, appearance and network colours, page
  content, example searches, interaction categories, announcements,
  supplementary files and datasets.
- Every piece of interface text can be changed through a site-text registry.
- Administrators can grant and revoke admin access.
- The browser tab and installed-app branding follow the site settings.
- Options to turn off tissue-expression and subcellular-location annotations
  for organisms that have none.

**Documentation**

- This documentation site, served at `/v2/docs/`, with an operator guide and a
  complete API reference that tests keep in step with the code.

### Fixed

From the October 2026 audit (see `docs/BUGS.md` for details):

- Production refuses to start with the default secret key, which could be
  used to sign administrator tokens.
- Avatar uploads can no longer be used to serve HTML from the site.
- An empty search returns no results instead of the whole database.
- Uploaded interactions that already exist are credited to every dataset they
  appear in.
- Networks with long gene lists can be saved.
- Public media paths can no longer reach private uploads.
- Registration enforces the 8-character password minimum. Login handles
  passwords the same way registration does.
- A password reset signs the account out everywhere.
- Long share and comment notifications no longer fail.
- A demoted administrator loses the admin interface at the next token
  refresh, and deactivated accounts can no longer refresh their tokens.
- Search summaries are shown as text, not interpreted as HTML.
- Interaction categories sort by number.
- Invalid upload parameters return clear errors instead of server errors.
- Dataset downloads leave out removed interactions.
- PSICQUIC pages come in a stable order, and `maxResults` is capped at 2,500.
- The all-datasets download is built once and cached instead of being rebuilt
  on every request.

### Known issues

Open issues are tracked in `docs/BUGS.md`. Two need attention before
release: the production compose file leaves the database and Redis ports
published (BUG-020), and security-question answers can be guessed without a
rate limit by signed-in users (BUG-032).
