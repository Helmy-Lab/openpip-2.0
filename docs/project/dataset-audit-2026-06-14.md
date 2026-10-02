# Dataset Audit — 2026-06-14

Findings from a live database inspection of `openpip-2.0`.

---

## Summary

| Dataset | Issue | Severity |
|---|---|---|
| HuRI | 45,816 interactions in DB have no dataset link — invisible, undeletable, uncounted | **Critical** |
| HI-III | `pubmed_id = 'HI-III'` — dataset name stored in the PubMed ID field | **Medium** |
| Test-Space | `interaction_status` is an empty string | **Low** |

---

## Issue 1 — HuRI: 45,816 orphaned interactions

### What happened

The `HuRI.tsv` file was imported and created 45,816 new rows in the `interaction`
table, but **zero `interaction_dataset` links** were written tying those interactions
to the HuRI dataset record (`id = 15`).

### Evidence

```sql
SELECT COUNT(*) FROM interaction_dataset WHERE dataset_id = 15;
-- → 0

SELECT COUNT(*) FROM interaction WHERE id > 76563;
-- → 45,816  (valid scores, avg 0.81, range 0.60–0.96)

SELECT number_of_interactions FROM dataset WHERE id = 15;
-- → NULL
```

### What it breaks

- Admin UI shows "—" for HuRI's interaction count
- The 45,816 interactions are invisible to any dataset-scoped query or download
- They cannot be deleted through the "Delete dataset" button (nothing is linked to it)
- **Re-uploading will not fix it** — the dedup check already ran; all 45,816 rows
  will be skipped as duplicates, so links will never be created automatically

### Why it happened

The HuRI dataset row (`id = 15`) was likely registered via the wizard UI, but the
file was then imported through a separate script or migration that skipped the
`InteractionDataset.objects.get_or_create(...)` call — or ran with a blank
`dataset_name`, causing `named_dataset` to be `None` and the link step to be skipped
entirely.

### Fix

```sql
INSERT INTO interaction_dataset (interaction_id, dataset_id)
SELECT id, 15 FROM interaction WHERE id > 76563
ON CONFLICT DO NOTHING;

UPDATE dataset SET number_of_interactions = '45816' WHERE id = 15;
```

---

## Issue 2 — HI-III: dataset name stored in `pubmed_id`

### What happened

`pubmed_id = 'HI-III'` — the dataset's own name was entered in the PubMed ID field
instead of a real accession number (or `NULL`). HI-III is an unpublished dataset, so
there is no PubMed ID.

### Evidence

```sql
SELECT pubmed_id FROM dataset WHERE id = 8;
-- → HI-III
```

### What it breaks

Any feature that constructs a PubMed URL will produce a broken link:
`https://pubmed.ncbi.nlm.nih.gov/HI-III/`

### Fix

```sql
UPDATE dataset SET pubmed_id = NULL WHERE id = 8;
```

---

## Issue 3 — Test-Space: empty `interaction_status`

### What happened

`interaction_status = ''` (empty string — not `NULL`, not a valid status value).

### Evidence

```sql
SELECT interaction_status FROM dataset WHERE id = 2;
-- → (empty string)
```

### What it breaks

- The status chip in the admin UI renders blank
- Any filter or query checking for `'published'` or `'validated'` silently excludes
  Test-Space

### Fix

Update to whichever status best describes Test-Space:

```sql
UPDATE dataset SET interaction_status = 'validated' WHERE id = 2;
-- options: published | validated | verified | literature
```

---

## Current state of all datasets

| id | Name | Year | Status | PubMed ID | Author | Interactions (stored) | Interactions (actual links) |
|---|---|---|---|---|---|---|---|
| 1 | Lit-BM | — | published | — | — | 13,441 | 13,441 ✓ |
| 2 | Test-Space | — | *(empty)* ⚠ | — | — | 1,159 | 1,159 ✓ |
| 3 | HI-I-05 | 2005 | published | 16189514 | Rual et al. | 2,709 | 2,709 ✓ |
| 4 | Venkatesan-09 | 2009 | published | 19060904 | Venkatesan et al. | 193 | 193 ✓ |
| 5 | Yu-11 | 2011 | published | 21516116 | Yu et al. | 1,169 | 1,169 ✓ |
| 6 | HI-II-14 | 2014 | published | 25416956 | Rolland et al. | 13,633 | 13,633 ✓ |
| 7 | Yang-16 | 2016 | published | 26871637 | Yang et al. | 728 | 728 ✓ |
| 8 | HI-III | — | validated | *HI-III* ⚠ | — | 52,548 | 52,548 ✓ |
| 15 | HuRI | — | published | — | — | *(NULL)* ⚠ | 0 ⚠ |

**Overall DB state:** 122,379 total interactions · 19,868 proteins · 85,580 dataset links
