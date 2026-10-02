# API endpoint catalog (moved)

The endpoint catalog that lived here was out of date: it listed routes that
do not exist and missed most that do.

The API reference is now part of the documentation site, in
[`docs/developer/api/`](developer/api/index.md), with PSICQUIC in
[`docs/developer/psicquic.md`](developer/psicquic.md). A backend test
(`core/tests/test_docs_contract.py`) fails if an endpoint is added, renamed or
removed without updating that reference.
