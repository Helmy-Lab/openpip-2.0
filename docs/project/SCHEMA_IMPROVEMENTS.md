# Schema Improvement Proposals — Phase 2

This document catalogues every structural inefficiency in the current Phase 1
schema, explains why it exists (it was a direct translation of the legacy MySQL),
and proposes the correct Phase 2 fix. Nothing here should be acted on until
Phase 1 parity is confirmed and Dr. Helmy signs off.

---

## Overview of the current schema

| Table | Rows | Size | Notes |
|---|---|---|---|
| `annotation` | 196,212 | **125 MB** | Biggest problem in the DB |
| `annotation_interaction` | 127,851 | 16 MB | Join table |
| `protein` | 11,600 | 13 MB | Core entity |
| `interaction_dataset` | 85,580 | 9.5 MB | Join table |
| `interaction` | 76,563 | 8.7 MB | Core entity |
| `interaction_interaction_category` | 77,426 | 7.9 MB | Join table |
| `identifier` | 23,200 | 3.8 MB | Parallel to protein |
| `annotation_protein` | 29,165 | 3.7 MB | Join table |

---

## Issue 1 — `annotation` stores JSON blobs as VARCHAR(5000) [Critical]

**Current:**
```python
class Annotation(models.Model):
    annotation = models.CharField(max_length=5000, null=True)  # raw JSON string
    identifier  = models.CharField(max_length=100, null=True)  # Ensembl ID — not a FK
    annotation_type = models.IntegerField(null=True)           # bare integer, not a FK
    type_name   = models.CharField(max_length=100, null=True)  # duplicates annotation_type.type
```

**What the data actually looks like:**
```
type_name='subcellular_location'  → annotation = '{"cytosol":"approved","nucleus":"","...}'
type_name='tissue_expression'     → annotation = '{"liver":"high","kidney":"low","..."}'
type_name='experiment'            → annotation = 'Y2H'
type_name='litbm_interaction'     → annotation = 'pubmed:12345678'
```

**Problems:**
- 125 MB table because JSON is stored as raw text — not queryable, not indexable
- `identifier` is a raw Ensembl ID string, not a FK to `protein` — impossible to join efficiently
- `annotation_type` is a bare `int` with no FK constraint — referential integrity is unenforced
- `type_name` is a denormalized copy of `annotation_type.type` — gets out of sync
- Each annotation type has a completely different JSON shape — no schema enforcement

**Proposed fix:**
```python
# Split into typed tables — one per annotation category
class SubcellularLocationAnnotation(models.Model):
    protein   = models.ForeignKey(Protein, on_delete=models.CASCADE)
    location  = models.CharField(max_length=100)   # e.g. "cytosol"
    status    = models.CharField(max_length=50)    # e.g. "approved", "enhanced"

class TissueExpressionAnnotation(models.Model):
    protein = models.ForeignKey(Protein, on_delete=models.CASCADE)
    tissue  = models.CharField(max_length=100)
    level   = models.CharField(max_length=50)      # e.g. "high", "low", "not detected"

class ExperimentAnnotation(models.Model):
    interaction = models.ForeignKey(Interaction, on_delete=models.CASCADE)
    method      = models.CharField(max_length=200)  # e.g. "Y2H", "Co-IP"

class LiteratureAnnotation(models.Model):
    interaction = models.ForeignKey(Interaction, on_delete=models.CASCADE)
    pubmed_id   = models.CharField(max_length=20)
```

**Impact:** Estimated 70–80% size reduction, full queryability (filter by tissue,
method, location), real FK constraints.

---

## Issue 2 — `interaction.score` and `interaction.removed` are stored as strings [High]

**Current:**
```python
score   = models.CharField(max_length=10, null=True)  # '0.90827039' or None
removed = models.CharField(max_length=10, default='0') # '0' or '1'
```

**What the data actually contains:**
- `score`: 27,767 rows have `NULL`, the rest have decimal strings like `'0.90827039'`
- `removed`: only ever `'0'` in the live data (all `removed='1'` records were deleted in legacy)

**Problems:**
- Every search query does `filter(removed='0')` — string comparison instead of boolean index
- Score must be `CAST`ed every time it's used for comparison or ordering
- `NULL` score and string score have different semantics that callers must handle manually

**Proposed fix:**
```python
score   = models.FloatField(null=True)
removed = models.BooleanField(default=False, db_index=True)
```

**Impact:** Faster filter on `removed`, score comparisons work natively, field
types communicate intent clearly.

---

## Issue 3 — `InteractionCategory` booleans stored as strings [Medium]

**Current:**
```python
selected_by_default       = models.CharField(max_length=10, null=True)  # '1' or '0'
include_in_home_page_count = models.CharField(max_length=10, null=True) # '1' or '0'
order                     = models.CharField(max_length=200, null=True) # '1', '2', '3', '4'
```

**Proposed fix:**
```python
selected_by_default        = models.BooleanField(default=True)
include_in_home_page_count = models.BooleanField(default=True)
order                      = models.PositiveSmallIntegerField(default=1)
```

---

## Issue 4 — `Protein` identifier fields are denormalized [Medium]

**Current:**
```python
class Protein(models.Model):
    gene_name   = models.CharField(max_length=100, null=True)  # duplicated in Identifier table
    uniprot_id  = models.CharField(max_length=100, null=True)  # duplicated in Identifier table
    ensembl_id  = models.CharField(max_length=100, null=True)  # duplicated in Identifier table
    entrez_id   = models.CharField(max_length=100, null=True)  # duplicated in Identifier table
```

The same values are stored twice — once in `protein.*_id` columns and again in
the `identifier` / `protein_identifier` tables. This means search uses the
`identifier` table (correct, supports case-insensitive lookup), but the protein
card displays `protein.gene_name` (convenient shortcut). They can drift.

**Proposed fix (two options):**

Option A — Keep the shortcut columns, add a DB constraint:
```sql
-- Enforce that protein.gene_name always matches its primary identifier
-- via a trigger or application-level check on write
```

Option B — Drop the shortcut columns, always join through `identifier`:
```python
# Remove gene_name, uniprot_id, ensembl_id, entrez_id from Protein
# Add a computed property that queries the identifier table
@property
def primary_identifier(self):
    return self.protein_identifiers.filter(
        identifier__naming_convention='gene_name'
    ).first()
```

Option B is cleaner but requires updating all serializers and the search service.

---

## Issue 5 — `Annotation` has no FK to `Protein` [Medium]

**Current:**
```python
class Annotation(models.Model):
    identifier = models.CharField(max_length=100, null=True)  # raw Ensembl ID string
```

`annotation_protein` is the join table that links annotations to proteins, but
`annotation.identifier` also stores the protein's Ensembl ID as a raw string.
These two mechanisms serve the same purpose and can get out of sync.

The search service currently queries `Annotation.objects.filter(identifier__in=interaction_ids)` —
meaning it joins on interaction IDs stored in the `identifier` column, which is
confusing because `identifier` sometimes contains protein Ensembl IDs and
sometimes interaction IDs.

**Proposed fix:**
```python
class Annotation(models.Model):
    annotation      = models.TextField(null=True)
    annotation_type = models.ForeignKey(AnnotationType, on_delete=models.SET_NULL, null=True)
    # Remove raw 'identifier' field entirely — use annotation_protein / annotation_interaction
    # join tables exclusively
```

---

## Issue 6 — `AdminSettings` is a singleton table [Low]

**Current:** Always `pk=1`. Any code that needs settings does
`AdminSettings.objects.filter(pk=1).first()`.

**Proposed fix:**
```python
# Use Django's sites framework or a proper singleton pattern
class AdminSettings(models.Model):
    class Meta:
        # Enforce singleton at the DB level
        constraints = [
            models.CheckConstraint(check=models.Q(id=1), name='singleton_admin_settings')
        ]
```

Or simply use a `django-solo` singleton model, which adds a `get_solo()` class
method and enforces the constraint automatically.

---

## Issue 7 — Missing indexes on hot query paths [High]

The search algorithm runs several queries that have no supporting index:

| Query | Missing index |
|---|---|
| `Interaction.filter(removed='0')` | `interaction(removed)` |
| `Interaction.filter(interactor_A_id__in=..., interactor_B_id__in=...)` | Composite `(interactor_A, interactor_B)` |
| `Identifier.filter(identifier__iexact=q)` | `identifier(identifier text_pattern_ops)` |
| `AnnotationProtein.filter(protein_id__in=...)` | `annotation_protein(protein_id)` |
| `InteractionDataset.filter(interaction_id__in=...)` | `interaction_dataset(interaction_id)` |

**Proposed fix** (can be added without schema changes — just new migrations):
```python
class Interaction(models.Model):
    class Meta:
        indexes = [
            models.Index(fields=['removed']),
            models.Index(fields=['interactor_A', 'interactor_B']),
            models.Index(fields=['interactor_B', 'interactor_A']),  # reverse for B-side queries
        ]

class Identifier(models.Model):
    class Meta:
        indexes = [
            models.Index(fields=['identifier']),  # already has db_index=True — add text_pattern_ops via RunSQL
        ]
```

**This one can be done in Phase 1 as a pure performance migration — no data changes.**

---

## Issue 8 — `number_of_interactions_in_database` is a stale counter [Low]

**Current:**
```python
class Protein(models.Model):
    number_of_interactions_in_database = models.IntegerField(null=True)
```

This is a cached count that was computed when data was loaded into the legacy DB.
It does not update when interactions are added via the upload endpoint.

**Proposed fix:** Remove the field and compute on demand:
```python
# In serializer or view
count = Interaction.objects.filter(
    Q(interactor_A=protein) | Q(interactor_B=protein), removed=False
).count()
```

Or keep it but add a signal/trigger to recompute on `Interaction` save/delete.

---

## Summary — Priority order for Phase 2

| Priority | Issue | Effort | Impact |
|---|---|---|---|
| 1 | Add missing indexes (Issue 7) | Low — pure migrations, no data change | High — immediate query speedup |
| 2 | `interaction.score` → FloatField, `removed` → BooleanField (Issue 2) | Medium — migration + data transform | High — cleaner queries |
| 3 | Split `annotation` JSON blobs into typed tables (Issue 1) | High — new tables + re-migration | Very high — 125 MB → ~25 MB, queryable |
| 4 | `InteractionCategory` booleans/order types (Issue 3) | Low | Low |
| 5 | Singleton pattern for `AdminSettings` (Issue 6) | Low | Low |
| 6 | Remove `Annotation.identifier` raw field (Issue 5) | Medium | Medium |
| 7 | Consolidate protein identifier denormalization (Issue 4) | High | Medium |
| 8 | Remove stale `number_of_interactions_in_database` (Issue 8) | Low | Low |

**Immediate win with zero risk:** Issue 7 (missing indexes) can be added right
now as a pure `migrations.AddIndex` — no data changes, no parity risk, measurable
speedup on every search query.
