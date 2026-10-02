# Datasets, downloads and uploads

A **dataset** is one published interaction map, such as an interactome screen
or a literature curation, loaded into the portal. Every interaction belongs to
at least one dataset. Reading datasets and downloading them is public.
Changing them requires an administrator account.

The upload file formats are described in
[Data file formats](../../operator-guide/data-formats.md).

## Reading datasets

### GET /api/datasets

Every dataset, ordered by ID. No authentication, no pagination.

A dataset from the reference deployment:

```json
{
  "id": 1,
  "dataset_reference": "25416956",
  "dataset_author": "Rolland T et al.",
  "year": "2014",
  "description": null,
  "interaction_status": "published",
  "name": "Lit-BM",
  "citation": "Rolland T et al. (2014). A proteome-scale map of the human interactome network. Cell.",
  "number_of_interactions": "13441",
  "pubmed_id": "25416956",
  "author": "Rolland T et al.",
  "title": "A proteome-scale map of the human interactome network",
  "journal": "Cell",
  "doi": "10.1016/j.cell.2014.10.050",
  "url": "https://pubmed.ncbi.nlm.nih.gov/25416956/",
  "publication_status": "published",
  "about_heading": "",
  "about_body": "",
  "show_on_about": true,
  "about_order": 0
}
```

| Key | Contents |
|---|---|
| `name` | The dataset's name, unique in practice. Uploading again under the same name adds to the existing dataset. |
| `citation` | A ready-formatted reference, `Author (Year). Title. Journal.`, built from whichever parts are set. `null` when none are. |
| `number_of_interactions` | Interactions linked to the dataset, **as a string**. Recounted after every import and delete. The count includes interactions marked removed. |
| `interaction_status` | A free-text label chosen at upload, such as `published`. It is descriptive only: search does not filter or colour by it. |
| `publication_status` | `published`, `preprint` or `unpublished`. |
| `about_heading`, `about_body`, `show_on_about`, `about_order` | The dataset's section on the portal's About page. The heading falls back to the dataset name when empty. |
| `dataset_reference`, `dataset_author` | Older names for `pubmed_id` (or `""`) and `author` (or `"Unpublished Dataset"`), kept for compatibility with the original openPIP. |

### GET /api/datasets/{pk}

One dataset, in the same shape. No authentication.

| Status | Body |
|---|---|
| 404 | `{"detail": "Not found."}` |

## Downloading

### GET /api/datasets/{pk}/download

The dataset's interactions as a file attachment, generated from the database.
No authentication. Interactions marked removed are left out.

| Parameter | Notes |
|---|---|
| `fmt` | `tab` (default), `sif` or `csv`. Any other value gives `tab`. |

**`tab`**: tab-separated, four columns, opening with `#` comment lines that
cite the dataset's publication:

```text
# openPIP dataset: Lit-BM
# Please cite: Rolland T et al. (2014). A proteome-scale map of the human interactome network. Cell.
# https://doi.org/10.1016/j.cell.2014.10.050
#ID(s) interactor A	ID(s) interactor B	Confidence value(s)	Publication identifier(s)
uniprotkb:P23511-2	uniprotkb:Q13952-2	score:0.90908535	pubmed:25416956
```

Each interactor is written as `uniprotkb:<accession>`, or its gene name when it
has no accession. The confidence column is `score:<value>`, or `-` when there
is none.

This is not standard PSI-MI TAB. In PSI-MI TAB, columns 3 and 4 hold
alternative identifiers, but here they hold the score and publication. If you
upload the file to a portal again, the interactions load (columns 1 and 2) but
their scores do not. For standard PSI-MI TAB (15 to 46 columns), use the
[PSICQUIC service](../psicquic.md).

**`sif`**: one `<A>	interacts	<B>` line per interaction, for Cytoscape. Each
protein is named by its gene name, else its UniProt accession, else its
database ID. No header, no citation.

**`csv`**: columns `gene_a,gene_b,uniprot_a,uniprot_b,score,dataset`. No
citation.

!!! note
    No format marks negative interactions (reported non-interactions). They are
    exported like positive ones. Use PSICQUIC (column 36) if you need the flag.

| Status | Body |
|---|---|
| 404 | `{"detail": "Not found."}` |

### GET /api/datasets/download/

Every dataset in one ZIP file, `datasets.zip`, holding one `<name>.tab` file
per dataset in the `tab` format above (spaces in names become `_`). No
authentication. The server builds the archive once and reuses it until data
changes.

### GET /api/files/public

Additional files an administrator has published on the Downloads page, newest
first. No authentication.

```json
[{"id": 3, "file_name": "HuRI_isoforms.fasta", "file_size": 1048576,
  "show": true, "uploaded_at": "2026-09-02T10:15:00Z"}]
```

### GET /api/files/{pk}/download

Download one of those files. No authentication for published files. Files an
administrator has hidden can only be downloaded by administrators.

| Status | Body |
|---|---|
| 403 | `{"detail": "Not found."}`: the file is hidden. |
| 404 | No such file. |

## Managing datasets

Everything below requires an administrator account.

### PATCH /api/datasets/{pk}

Edit a dataset's description, status, citation or About-page section. Send
only the fields to change. An empty string clears a field.

| Field | Validation |
|---|---|
| `description` | Up to 1,000 characters. |
| `interaction_status` | Up to 100 characters. |
| `pubmed_id` | Digits only, up to 8. |
| `doi` | Must look like `10.1038/s41586-020-2188-x`. A pasted `https://doi.org/...` or `doi:` prefix is removed. |
| `author` | Up to 100 characters. |
| `year` | Four digits. |
| `title`, `journal` | Up to 500 and 300 characters. |
| `url` | A URL. |
| `publication_status` | `published`, `preprint` or `unpublished`. |
| `about_heading` | Up to 200 characters. |
| `about_body` | Free text. |
| `show_on_about` | Boolean. |
| `about_order` | Integer. Lower numbers come first on the About page. |

The dataset's `name` cannot be changed. Returns the updated dataset.

| Status | Body |
|---|---|
| 400 | Field errors, e.g. `{"pubmed_id": ["A PubMed ID must be digits only, e.g. 25416956."]}` |
| 404 | `{"detail": "Not found."}` |

### DELETE /api/datasets/{pk}

Delete a dataset, together with every interaction that belongs to no other
dataset. Interactions shared with another dataset stay. This cannot be undone.

```json
{"orphaned_interactions_deleted": 1520}
```

Proteins are never deleted, even when no interactions remain.

### GET /api/datasets/citation-lookup

Look up a publication to fill in a dataset's citation. Nothing is saved.

| Parameter | Notes |
|---|---|
| `pubmed_id` | Looked up in NCBI PubMed. |
| `doi` | Used when `pubmed_id` is not given. Looked up in Crossref. |

```json
{"pubmed_id": "25416956", "doi": "10.1016/j.cell.2014.10.050",
 "title": "A proteome-scale map of the human interactome network",
 "journal": "Cell", "year": "2014", "author": "Rolland T et al.",
 "url": "https://pubmed.ncbi.nlm.nih.gov/25416956/"}
```

| Status | Body (`detail`) |
|---|---|
| 400 | `Provide either pubmed_id or doi.` |
| 400 | `A PubMed ID must be digits only, e.g. 25416956.` |
| 502 | The external service failed or did not know the identifier. |

## Uploading interactions

The portal's upload wizard uses `import-async`: the file is processed in the
background while the wizard polls for progress. The other upload endpoints are
older routes that the web interface does not use.

### POST /api/datasets/import-async

Start a background import. Multipart form data.

| Field | Notes |
|---|---|
| `file` | Required. PSI-MI TAB (`.tab`, `.tsv`, `.txt`) or simple CSV (`.csv`). Other extensions are recognised by content. |
| `dataset_name` | Required. An existing name adds to that dataset. |
| `interaction_status` | Label for a new dataset. Default `published`. |
| `category_id` | Optional ID of an [interaction category](administration.md#interaction-categories) to give new interactions (PSI-MI TAB only). |
| citation and About fields | Optional, as for `PATCH /api/datasets/{pk}`. Validated before the import starts. |

Returns `202 {"task_id": "..."}`. Needs the Celery worker to be running.

| Status | Body |
|---|---|
| 400 | `{"detail": "No file provided."}` or `{"detail": "dataset_name required."}` |
| 400 | `{"category_id": "Must be a category id."}` or `{"category_id": "No such category."}` |
| 400 | Citation field errors. |

### GET /api/datasets/import-async/{task_id}

Progress of a background import.

```json
{
  "task_id": "1f0c...",
  "status": "PROGRESS",
  "stage": "parsing",
  "progress": 40,
  "proteins_created": 12,
  "interactions_created": 830,
  "interactions_skipped": 4,
  "errors": []
}
```

| Key | Contents |
|---|---|
| `status` | `PENDING` (queued or unknown), `STARTED`, `PROGRESS`, `SUCCESS` or `FAILURE`. |
| `stage` | `parsing`, then `enriching_uniprot`, `enriching_ensembl`, `enriching_organisms` (each with a `_warn` variant if that external service failed), then `done`. |
| `progress` | 0–100. |
| `interactions_skipped` | Rows whose interaction already existed. The existing interaction is credited to this dataset as well. |
| `errors` | Up to 50 `{"row": n, "reason": "..."}` entries per batch of 300 rows. |

After the interactions are stored, new proteins are filled in from UniProt and
Ensembl, and new organisms from NCBI Taxonomy. These steps need outbound
internet access. Status is kept for one hour after the import ends. After
that, `status` reads `PENDING`.

### POST /api/datasets/check-proteins

Count how many of a list of identifiers the portal already knows. The upload
wizard uses this for its preview.

```json
{"identifiers": ["uniprotkb:P04637", "TP53", "Q00987"]}
```

```json
{"existing": 2}
```

A `prefix:` is stripped from each identifier before matching. Matching is
case-sensitive here, unlike during the import itself, so the count can be
lower than what the import will find.

### POST /api/datasets/preview

Estimate what uploading a PSI-MI TAB file would do, without saving anything.
Multipart form data with `file` and `dataset_name` (required but not used).
Returns the same keys as an import result (`proteins_created`,
`proteins_existing`, `interactions_created`, ...), with `dry_run: true`.
`interactions_created` is the number of data rows, and `interactions_skipped`
is always 0.

### POST /api/datasets/upload

Import a PSI-MI TAB file during the request, with no background job and no
UniProt enrichment. Same fields as `import-async`, except that CSV is not
recognised. Returns 201 with the import result:

```json
{
  "dry_run": false,
  "rows_sampled": null,
  "proteins_created": 12,
  "proteins_existing": 1648,
  "interactions_created": 830,
  "interactions_skipped": 4,
  "errors": [],
  "new_protein_ids": [20511, 20512],
  "new_organism_ids": []
}
```

If the citation fields fail validation, the response is 400. The interactions
have already been stored by then.

### POST /api/datasets/upload-rows

Import PSI-MI TAB lines sent as JSON, one batch per request.

| Field | Notes |
|---|---|
| `lines` | Required, non-empty list of tab-separated lines. |
| `dataset_name` | Required. |
| `interaction_status`, `category_id` | As for `import-async`. |
| `is_last_batch` | Send `true` on the final batch: only then are citation fields applied and dataset counts refreshed. |

Each request stores its batch independently. Returns 201 with the import
result.

### POST /api/upload/

The oldest upload route. Multipart field `file`, PSI-MI TAB only. It links the
interactions to **no dataset**, so they do not appear in dataset counts or
downloads. Use `import-async` instead.

## Managing published files

Files on the Downloads page other than the generated dataset downloads, such
as sequence files or supplementary tables. Administrator only.

### GET /api/files

Every uploaded file, published or hidden, newest first. Same object shape as
`GET /api/files/public`.

### POST /api/files

Upload a file. Multipart form data.

| Field | Notes |
|---|---|
| `file` | Required. `.fasta`, `.fa`, `.tab`, `.tsv`, `.sif` or `.csv`, up to 500 MB, and valid UTF-8 text. |
| `force` | `true` to keep both files when one with the same name exists. |

New files are published straight away. Returns 201 with the file object.

| Status | Body |
|---|---|
| 400 | `{"detail": "No file provided."}`, the size limit, a disallowed extension, or `File does not appear to be valid UTF-8 text.` |
| 409 | `{"detail": "collision", "file_name": "..."}`: a file with this name exists. Resend with `force`. |

### PATCH /api/files/{pk}

Publish or hide a file: `{"show": false}`.

### DELETE /api/files/{pk}

Delete the file from disk and from the list. Returns 204.
