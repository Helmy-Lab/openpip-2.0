> **Superseded.** This working note is out of date in places and is not part of
> the published documentation. For current, verified behaviour see the
> documentation site (`docs/`, built with `mkdocs.yml`): upload formats and behaviour in `docs/operator-guide/data-formats.md`.

# Data Pipeline — Current State & Improvement Plan

openPIP stores protein–protein interaction data sourced from PSI-MI TAB files.
This document describes what the current pipeline captures, what it misses, and
the concrete improvements planned for Phase 2.

---

## 1. The data model

```
Protein ←── ProteinIdentifier ──→ Identifier
    │
    ├──→ AnnotationProtein ──→ Annotation   (type: subcellular_location,
    ├──→ ProteinOrganism  ──→ Organism             tissue_expression, …)
    └──→ domain / complex / isoform tables

Interaction (interactor_A, interactor_B, score, removed)
    │
    ├──→ InteractionDataset ──→ Dataset
    │                              (name, pubmed_id, author, year,
    │                               interaction_status, description)
    ├──→ InteractionInteractionCategory ──→ InteractionCategory
    │                                         (category_name, order, color)
    ├──→ AnnotationInteraction ──→ Annotation   (type: experiment,
    │                                                   litbm_interaction, …)
    └──→ InteractionSupportInformation (value) ──→ SupportInformation
                                                    (name, description)
```

`Annotation.identifier` is a legacy dual-purpose field:
- For **protein** annotations: stores the protein's Ensembl ID (e.g. `ENSG00000000003`)
- For **interaction** annotations: stores the interaction PK as a string (e.g. `64880`)

Both `AnnotationInteraction` (FK-based) and `Annotation.identifier` (string-based)
are populated for interaction annotations — the legacy schema has both paths.
The search service (`search_service.py`) queries interaction annotations via
`Annotation.objects.filter(identifier__in=interaction_ids)`, bypassing
`AnnotationInteraction`. New uploads must write to **both** for parity.

---

## 2. PSI-MI TAB 2.7 — columns the format provides

| Col | Content | Example |
|-----|---------|---------|
| 0 | ID interactor A | `uniprotkb:Q5JRA6-2` |
| 1 | ID interactor B | `uniprotkb:P14373` |
| 2 | Alt ID(s) A | `intact:EBI-10244342` |
| 3 | Alt ID(s) B | `intact:EBI-719493\|uniprotkb:A2BE15\|…` |
| 4 | Aliases A | `uniprotkb:MIA3(gene name)\|psi-mi:MIA3(display_short)\|…` |
| 5 | Aliases B | `uniprotkb:TRIM27(gene name)\|…` |
| 6 | Detection method | `psi-mi:"MI:1112"(two hybrid prey pooling approach)` |
| 7 | Publication author | `Rolland et al. (2014)` |
| 8 | Publication ID | `imex:IM-23318\|pubmed:25416956` |
| 9 | Taxon A | `taxid:9606(human)` |
| 10 | Taxon B | `taxid:9606(human)` |
| 11 | Interaction type | `psi-mi:"MI:0915"(physical association)` |
| 12 | Source database | `psi-mi:"MI:0469"(IntAct)` |
| 13 | Interaction ID | `intact:EBI-10244357` |
| 14 | Confidence value | `intact-miscore:0.56` |
| 22 | Xref(s) A | `intact:EBI-…(isoform-parent)\|entrezgene/locuslink:375056(identity)` |
| 23 | Xref(s) B | `go:"GO:0004842"(ubiquitin-protein transferase)\|ensembl:ENSG…\|interpro:…` |
| 24 | Interaction Xref(s) | usually `-` |
| 25 | Annotation(s) interactor A | `Gene Expression:None;Protein Expression:1;Disorder:0.346;…` |
| 26 | Annotation(s) interactor B | same format (or `-`) |
| 27 | Interaction annotation(s) | `figure legend:supp table 2G\|curation depth:imex curation` |

---

## 3. What the current parser does

**File:** `backend/datasets/upload_parser.py`

```
Reads: col 0, col 1 only
Creates: Protein, Identifier, ProteinIdentifier, Interaction
Skips: everything else
```

### Steps today

1. Strip prefix (`uniprotkb:Q5JRA6-2` → `Q5JRA6-2`).
2. Detect naming convention (uniprotkb / ensembl / entrez / gene_name).
3. Look up `Identifier` by iexact → resolve existing `Protein`, or create new.
4. Check if interaction already exists (symmetric dedup).
5. Create `Interaction(interactor_A, interactor_B, removed='0')`.
6. Return `{created, skipped, errors}`.

### Known bug in current dedup check

`_is_new_interaction` does not filter `removed='0'`. A soft-deleted interaction
(removed='1') will block re-upload of the same protein pair — the pair is
skipped as "already exists" even though it was removed.

### What is **not** captured

| Missing | Impact |
|---------|--------|
| Score (col 14) | `interaction.score` stays NULL for all uploaded rows |
| Dataset info (cols 7–8) | No `Dataset` created; no `InteractionDataset` link |
| Detection method (col 6) | Experiment type lost |
| Interaction annotations (col 27) | Curation info, figure references lost |
| Support information (cols 25–26) | Disorder score, peptide conservation, GO scores lost |
| Protein xrefs (cols 22–23) | External accession IDs (IntAct, entrezgene) not indexed |
| Protein aliases (cols 4–5) | Alternate gene symbols not added to `Identifier` |
| Taxon (cols 9–10) | `Organism` / `ProteinOrganism` never populated via upload |
| Interaction category | Uploaded interactions have no category; invisible in filtered views |
| `Protein.number_of_interactions_in_database` | Not recounted after upload |
| `Dataset.number_of_interactions` | Not set on the created Dataset row |

### Safety gaps

| Gap | Risk |
|-----|------|
| No DB transaction wrapping | Partial upload on crash leaves dirty state |
| No file-size limit | Large files block the web worker |
| No dry-run / preview mode | No way to check counts before committing |
| No rollback on dataset delete | Deleting a Dataset cascades through InteractionDataset but leaves Interaction rows intact and dataset-less |
| Generic `except Exception` swallows all errors | Silent data corruption possible |

---

## 4. Planned improvements (Phase 2)

### 4.1 Parser — capture all meaningful columns

**Priority fields (directly map to existing schema):**

| Col | Field | Destination |
|-----|-------|-------------|
| 14 | Confidence value | `Interaction.score` (strip prefix, store numeric string) |
| 7+8 | Author + PubMed ID | `Dataset` (find-or-create by pubmed_id) → `InteractionDataset` |
| 6 | Detection method | `Annotation(type_name='experiment', identifier=str(interaction.pk))` + `AnnotationInteraction` |
| 27 | Interaction annotation(s) | One `Annotation` per `key:value` pair, `identifier=str(interaction.pk)` + `AnnotationInteraction` |
| 25+26 | Annotation(s) interactor A/B | `SupportInformation` + `InteractionSupportInformation` per semicolon-delimited `key:value` entry |
| 4+5 | Gene name aliases | Additional `Identifier` rows → `ProteinIdentifier` |
| 22+23 | Xref(s) A/B (IntAct, entrezgene accessions) | Additional `Identifier` rows where applicable |
| 9+10 | Taxon ID | `Organism` find-or-create → `ProteinOrganism` |

> **Interaction annotation storage:** the legacy schema writes interaction annotations
> to BOTH `Annotation` (with `identifier=str(interaction.pk)`) AND `AnnotationInteraction`
> (FK link). The search service queries via `Annotation.identifier` directly; new uploads
> must write to both for parity.
>
> **Protein annotations** (`subcellular_location`, `tissue_expression`, `tissue_specificity`)
> come from external enrichment sources (Human Protein Atlas), not from PSI-MI TAB columns.
> They are populated separately and are out of scope for the upload parser.

**Post-upload housekeeping:**
- Recount `Protein.number_of_interactions_in_database` for all touched proteins.
- Set `Dataset.number_of_interactions` (a `CharField`) to `str(created_count)`.

### 4.2 Safety

- Wrap entire parse in a DB transaction; rollback on any unhandled error.
- File size limit (configurable; suggested default 200 MB).
- Dry-run mode: parse without writing, return preview counts.
- Per-row error collection with row number and raw content.
- Structured error response: `{created, skipped, errors: [{row, reason}]}`.

### 4.3 Upload UX (frontend)

- Multi-step form:
  1. **Select file** — drag-and-drop or browse, shows filename + size.
  2. **Dataset metadata** — name, interaction category, interaction status.
     (Auto-populated from file if PubMed/author found in col 7–8.)
  3. **Dry-run preview** — shows `{proteins_new, proteins_existing, interactions_new, interactions_skipped, errors[:10]}`.
  4. **Confirm & ingest** — progress indicator (polling or SSE for large files).
  5. **Result summary** — final counts, download error log if any.
- Ingest runs async (Celery) for files > 10 K interactions; synchronous below.

### 4.4 File Manager

Currently a placeholder. When implemented:

- Directory browser for `MEDIA_ROOT/uploads/` — list files, sizes, dates.
- Dropzone upload for FASTA, TAB, SIF, CSV files.
- Delete with confirmation.
- File type validation server-side (magic bytes, not just extension).
- Link uploaded files to `DataFile` records for download page.

### 4.5 CSV upload format (Phase 2)

Support a simplified CSV input as an alternative to full PSI-MI TAB:

```
gene_a,gene_b,score,pubmed_id,detection_method
BRCA1,TP53,0.8,12345678,two hybrid
```

- Column names in header row.
- Missing optional columns filled with NULL.
- Same parser pipeline underneath (resolve identifiers, dedup, create).

---

## 5. What is NOT changing (parity constraint)

- Table names and column names are frozen. No renames.
- The `Annotation.annotation` blob format (JSON-like strings) stays as-is.
  Splitting into a proper JSONB column is a post-Phase-2 schema migration.
- `interaction.removed` stays `'0'`/`'1'` strings. `interaction.score` stays a
  `CharField` (e.g. `"0.56"`). Neither is converted to a proper boolean/float.
- The `InteractionCategory` assignment during upload is admin-defined, not
  derived from the file — the upload form lets the admin pick it.
