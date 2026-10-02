# Data Model

Legacy openPIP has 38 tables (verified against `migration/legacy-schema/openpip.sql`).
The Django models must mirror this structure: same table names, same column
names, same relationships. Authoritative source: `migration/legacy-schema/dev10.0_huri.sql`
(143MB, gitignored). See `migration/legacy-schema/PROVENANCE.md` for context.

## Core entities

- **Protein**: gene_name, uniprot_id, ensembl_id, entrez_id, sequence
- **Interaction**: interactor_a, interactor_b (FK to Protein), score,
  datasets (M2M), categories (M2M)
- **Dataset**: name, description, publication info
- **Organism**: name, taxonomy_id
- **Domain**: protein domains (M2M with Protein)
- **Annotation**: GO terms, functional annotations
- **InteractionCategory**: published, validated, verified, literature
- **AdminSettings**: portal customization (single row, ~30 fields)

## Many-to-many relationships

- Protein ↔ Organism
- Interaction ↔ Dataset
- Interaction ↔ InteractionCategory
- Protein ↔ Domain
- Protein ↔ Annotation

## MySQL → PostgreSQL type translation

| Legacy MySQL | Django field | Postgres type |
|---|---|---|
| `int(11) AUTO_INCREMENT` | `BigAutoField` / `AutoField` | `bigserial` / `serial` |
| `tinyint(1)` | `BooleanField` | `boolean` |
| `varchar(N)` | `CharField(max_length=N)` | `varchar(N)` |
| `text` | `TextField` | `text` |
| `longtext` | `TextField` | `text` |
| `datetime` | `DateTimeField` | `timestamp` |
| `enum(...)` | `CharField` with `choices` | `varchar` + check constraint |
| Collation `utf8_unicode_ci` | (none needed) | UTF-8 default |

## Naming conventions

Legacy uses snake_case for tables and columns. **Preserve these exactly.**
Django model classes are PascalCase; map them to legacy snake_case tables via
`class Meta: db_table = 'legacy_table_name'` where the auto-generated default
would not match.

## Schema mutation rules (Phase 1)

- 1:1 translation only.
- Adding indexes for performance is allowed if Postgres needs them where
  MySQL didn't.
- Renaming tables or columns is NOT allowed.
- Dropping columns is NOT allowed.
- Splitting tables is NOT allowed.

Schema improvements happen in Phase 2, not Phase 1.
