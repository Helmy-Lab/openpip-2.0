# Data file formats

Interaction data enters a portal as a file uploaded in **Admin → Datasets**. The
upload runs in the background, and a progress bar follows it. This page
describes which files are accepted and exactly what openPIP takes from each
column.

Two formats are accepted:

| Format | File names | Use it when |
|---|---|---|
| [PSI-MI TAB](#psi-mi-tab) | `.tab`, `.tsv`, `.txt` | Your data comes from an interaction database or a PSICQUIC service, or you want to keep detection methods, organisms, roles and annotations. |
| [Simple CSV](#simple-csv) | `.csv` | You have a plain list of interacting pairs, optionally with scores. |

A file with any other name is treated as CSV if its first line contains commas
and no tabs, and as PSI-MI TAB otherwise. Files must be UTF-8 text. Invalid
bytes are replaced rather than rejected, so check names with accents or
unusual characters after an import.

## How every upload behaves

These rules apply to both formats.

**Datasets are found by name.** Uploading under a dataset name that already
exists adds the interactions to that dataset. A new name creates a new dataset.

**Proteins are matched by identifier.** Each interactor's identifier, with any
`database:` prefix removed, is looked up in the portal's identifier table,
ignoring capitalisation. If it is not there, openPIP looks for a protein that
already carries it in the matching field: UniProt accession, Ensembl ID,
Entrez ID or gene name, depending on the prefix. If it finds one, it records
the identifier against that protein. Only when neither lookup finds anything
is a new protein created:

| Prefix | Recorded as | New protein gets |
|---|---|---|
| `uniprotkb:` or `uniprot:` | UniProt accession | its UniProt accession |
| `ensembl:` | Ensembl ID | no name or accession yet |
| `entrez gene:` or `entrez:` | Entrez ID | no name or accession yet |
| anything else, or no prefix | gene name | its gene name |

After the interactions are stored, new proteins with a UniProt accession are
filled in from UniProt: name, gene name, sequence, description, Ensembl and
Entrez IDs, organism, and PDB and InterPro cross-references. Only empty fields
are filled. New proteins identified only by an Ensembl or Entrez ID are not
looked up, so prefer UniProt accessions (or gene names) in column 1 and 2.

Isoform suffixes are kept. `Q00987-11` and `Q00987` are different identifiers.

**Existing interactions are reused.** If the pair already has an interaction,
in either order, no new interaction is created. The existing one is credited
to your dataset as well, and from PSI-MI TAB it also gains your file's
detection method and interaction annotations. Its score, type, roles and
categories are not changed. These rows are reported as *skipped*.

**A self-interaction** is a row whose two identifiers are identical. It is
stored once, with the same protein on both sides.

**Bad rows do not stop the import.** Each row is stored or rejected on its own.
The progress view lists up to 50 errors per batch of 300 rows, with the row
number and the reason.

**Category.** The upload form lets you choose one
[interaction category](../developer/api/administration.md#interaction-categories)
for the file. It is applied to the interactions the upload **creates**, and
only for PSI-MI TAB. Interactions that already existed keep their categories,
and CSV uploads get no category. A category cannot be changed afterwards
except by re-uploading.

## PSI-MI TAB

The tab-separated format defined by the
[HUPO Proteomics Standards Initiative](https://psicquic.github.io/MITAB27Format.html),
used by IntAct, BioGRID and PSICQUIC services. Versions 2.5 to 2.8 are
accepted. Rows can have any number of columns from 2 upwards. Missing columns
are treated as empty, so a 15-column 2.5 file loads as well as a 46-column 2.8
file.

**Header lines** are skipped: any line starting with `#`, and a line whose
first cell has no `:` but does contain a space or bracket, such as
`ID(s) interactor A`. Data rows may use bare gene names (`TP53`) or prefixed
identifiers (`uniprotkb:P04637`).

### What each column does

Columns are numbered from 1, as in the PSI-MI specification. `-` means
"nothing" in any column.

| # | Column | What openPIP does with it |
|---|---|---|
| 1 | ID(s) interactor A | **Required.** Finds or creates protein A (see above). |
| 2 | ID(s) interactor B | **Required.** Finds or creates protein B. |
| 3–4 | Alt. ID(s) | Ignored. UniProt enrichment supplies these instead. |
| 5–6 | Alias(es) | Entries marked `(gene name)`, e.g. `uniprotkb:TP53(gene name)`, are added as gene-name identifiers, and set the protein's gene name if it has none. Other aliases are ignored. |
| 7 | Interaction detection method(s) | The label of the **first** method, e.g. `two hybrid` from `psi-mi:"MI:0018"(two hybrid)`, is recorded as the interaction's experiment. Later methods in the same cell are ignored. |
| 8 | Publication 1st author(s) | Ignored. Citations belong to the dataset; set them in the upload form. |
| 9 | Publication identifier(s) | Ignored, as column 8. |
| 10–11 | Taxid interactor A / B | `taxid:9606(Homo sapiens)` links the protein to that organism, creating it if needed. The name in brackets is required: `taxid:9606` alone is ignored. Only the first entry is read. |
| 12 | Interaction type(s) | The MI code, e.g. `MI:0915` from `psi-mi:"MI:0915"(physical association)`, is stored and shown in PSICQUIC output. |
| 13–14 | Source database(s), Interaction identifier(s) | Ignored. |
| 15 | Confidence value(s) | The first value, with any `name:` prefix removed, becomes the interaction's score: `intact-miscore:0.56` gives `0.56`. Up to 10 characters are kept. |
| 16 | Expansion method(s) | Ignored. |
| 17–18 | Biological role(s) A / B | MI code stored. |
| 19–20 | Experimental role(s) A / B | MI code stored. |
| 21–22 | Type(s) interactor A / B | MI code stored. |
| 23–25 | Xref(s) | Ignored. |
| 26–27 | Annotation(s) interactor A / B | `key:value` pairs separated by `;` are stored as supporting information for the interaction. |
| 28 | Interaction annotation(s) | `key:value` pairs separated by `\|` are stored as interaction annotations and returned by the API. |
| 29–35 | Host, parameters, dates, checksums | Ignored. openPIP computes its own checksums for PSICQUIC output. |
| 36 | Negative | `true`, `yes` or `1` marks a **negative** result: the pair was tested and found **not** to interact. Anything else, including an empty or missing column, means a positive interaction. |
| 37–38 | Feature(s) A / B | Stored as text. |
| 39–40 | Stoichiometry A / B | Stored as text. |
| 41–42 | Identification method A / B | MI code stored. |
| 43–44 | Biological effect A / B | MI code stored. |
| 45–46 | Causal regulatory mechanism, causal statement | Ignored. |

Values from columns 12 and 17–46 appear again when the interaction is served
through [PSICQUIC](../developer/psicquic.md). Columns 12 and 17–46 are read
only for interactions the upload creates, not for ones it reuses.

### Example

A minimal two-column file:

```text
#ID(s) interactor A	ID(s) interactor B
uniprotkb:P04637	uniprotkb:Q00987
uniprotkb:P04637	uniprotkb:Q13547
```

A file exported by a PSICQUIC service, such as IntAct, can be uploaded as it
is.

## Simple CSV

A comma-separated file with a header row naming its columns:

```csv
protein_a,protein_b,score
TP53,MDM2,0.91
uniprotkb:P04637,uniprotkb:Q13547,
BRCA1,BARD1,0.75
```

| Column | Notes |
|---|---|
| `protein_a`, `protein_b` | **Required.** Identifiers, with or without a `database:` prefix. Bare gene names work here. |
| `score` | Optional. Up to 10 characters are kept. |

Header names ignore capitalisation and surrounding spaces, so `Protein_A`
works. Any other columns are ignored: CSV uploads record no detection method, organism, type or negative
flag. Use PSI-MI TAB for those.

## After the upload

- Dataset and protein interaction counts update when the import finishes.
- Add or correct the dataset's citation and About-page text at any time in
  **Admin → Datasets**. You can look a citation up by PubMed ID or DOI.
- New data appears in search straight away. The all-datasets download archive
  is rebuilt the first time someone requests it.
