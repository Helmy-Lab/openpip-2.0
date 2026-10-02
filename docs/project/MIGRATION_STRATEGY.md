# Migration Strategy

## Approach: Parity First

openPIP 2.0 is a phased migration, not a greenfield rewrite.

### Phase 1 — Functional parity (weeks 3–17)

- Every feature in legacy openPIP exists in 2.0.
- Same searches return same results.
- Same uploads accept the same files.
- Same exports produce the same outputs.
- Same admin settings configure the same things.
- Database schema is a 1:1 translation (same tables, columns, relationships).
  Only MySQL→Postgres type/syntax differences allowed.
- UX/UI may be modernized (React, responsive, dark mode) but WHAT the UI
  does is preserved.
- "Done" = full end-to-end demo where every legacy user flow works in 2.0.

### Phase 2 — Enhancements (weeks 18–22 or post-GSoC)

- CSV upload format
- Real-time validation feedback
- Async import pipeline with progress (SSE/WebSocket)
- UniProt metadata enrichment
- GO term enrichment analysis
- Any other proposal items not required for parity

### Hard rule

Do not add features absent from legacy openPIP during Phase 1. If a feature
seems missing or improvable, flag it for Phase 2. Resist the urge to
"modernize while migrating" beyond UI presentation.

## Parity verification protocol

Phase 1 changes must be verifiable against legacy behavior.

1. Pick a flow (e.g., search for `BRCA1`).
2. Run it against legacy openPIP at openpip.usask.ca.
3. Run the equivalent flow against the 2.0 instance.
4. Compare results: same proteins, same interactions, same scores, same
   network shape.

Differences must be either:
(a) explicitly approved as Phase 2 changes, or
(b) bug fixes in legacy behavior — requires PR justification.

Parity tests live in `tests/parity/` and run as integration tests against
both stacks.

## Working with legacy code

Legacy is the spec for Phase 1. When asked about legacy behavior, READ the
legacy code rather than guessing. Useful entry points:

- `~/openPIP/src/AppBundle/Controller/` — 27 PHP controllers, the behavior
  to be replicated in Django.
- `~/openPIP/data-upload/uploader.py` — original Python uploader.
  Phase 1 backend must match its parsing rules. Reference copy at
  `migration/legacy-uploader-reference/`.
- `~/openPIP/Docker OpenPIP package/docker-compose.yml` — original Docker
  setup. Reference copy at `migration/legacy-docker-reference/`.
- `~/openPIP/app/Resources/views/` — Twig templates. Each maps to a React
  component with equivalent behavior.

## Migration workflow (week 3)

1. Load legacy schema into a temporary MySQL or run against a Docker
   MySQL 8.0 instance for inspection.
2. Run `python manage.py inspectdb > legacy_models.py` to auto-generate
   Django models from the legacy schema.
3. Hand-clean the auto-generated models: rename model classes to PascalCase
   while preserving DB table names via `Meta.db_table`, add `Meta` classes,
   fix M2M `through` tables. Do NOT rename underlying tables or columns.
4. Generate Django migrations against the cleaned models.
5. Verify migrations apply cleanly to a fresh Postgres database.
