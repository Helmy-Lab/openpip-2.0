# PSICQUIC service

openPIP serves its interactions through
[PSICQUIC](https://psicquic.github.io/), the standard web service shared by
IntAct, BioGRID, MINT and other interaction databases. Tools that already
query those services can query an openPIP portal with the same requests: a
query in MIQL (Molecular Interaction Query Language), results in PSI-MI TAB.

On the reference deployment the service is at:

```text
https://openpip.usask.ca/v2/psicquic/rest/
```

All requests are `GET`, need no authentication, and are limited to 60 per
minute per IP address, or per account for logged-in callers. Paths have no trailing slash.

## Endpoints

### GET /psicquic/rest/query

Search interactions.

| Parameter | Default | Notes |
|---|---|---|
| `q` | `*` | A MIQL query (below). `*` returns everything. |
| `format` | `tab25` | `tab25`, `tab26`, `tab27`, `tab28`, `count` or `json`. Case-insensitive. |
| `firstResult` | `0` | Index of the first result to return, for paging. |
| `maxResults` | `200` | How many results to return, at most **2,500**. |

Results come in a fixed order, by interaction ID, so paging with
`firstResult` neither skips nor repeats interactions. Interactions marked
removed are never returned.

```bash
curl 'https://openpip.usask.ca/v2/psicquic/rest/query?q=id:TP53%20AND%20id:MDM2&maxResults=1'
```

**PSI-MI TAB formats** (`tab25` to `tab28`) are tab-separated text, one
interaction per line, after a `#` header line naming the columns. `tab25` has
15 columns, `tab26` 36, `tab27` 42 and `tab28` 46. Each version adds columns to
the previous one. The first 15 columns of the row above, from the reference
deployment:

| # | Column | Value |
|---|---|---|
| 1 | ID(s) interactor A | `uniprotkb:Q00987-11` |
| 2 | ID(s) interactor B | `uniprotkb:P04637` |
| 3 | Alt. ID(s) interactor A | `entrez:4193\|ensembl:ENSG00000135679\|gene_name:MDM2\|...` |
| 4 | Alt. ID(s) interactor B | `entrez:7157\|ensembl:ENSG00000141510\|gene_name:TP53\|...` |
| 5 | Alias(es) interactor A | `psi-mi:MDM2(gene name)\|psi-mi:E3 ubiquitin-protein ligase Mdm2(protein full name)` |
| 6 | Alias(es) interactor B | `psi-mi:TP53(gene name)\|psi-mi:Cellular tumor antigen p53(protein full name)` |
| 7 | Interaction detection method(s) | `psi-mi:"MI:0004"(affinity chromatography technology)\|psi-mi:"MI:0018"(two hybrid)\|...` |
| 8 | Publication 1st author(s) | `Rolland-2014` |
| 9 | Publication Identifier(s) | `pubmed:25416956\|doi:10.1016/j.cell.2014.10.050` |
| 10 | Taxid interactor A | `taxid:9606(Homo sapiens)` |
| 11 | Taxid interactor B | `taxid:9606(Homo sapiens)` |
| 12 | Interaction type(s) | `psi-mi:"MI:0914"(association)\|psi-mi:"MI:0915"(physical association)` |
| 13 | Source database(s) | `openPIP:openPIP` |
| 14 | Interaction identifier(s) | `openPIP:64197` |
| 15 | Confidence value(s) | `-` (no score recorded) |

A protein with no UniProt accession is identified as `openPIP:<database id>`
in columns 1–2. A confidence score appears as `openPIP:<score>`. Column 36
(`tab26` and wider) is `true` for a negative interaction, meaning one reported
not to occur, and `false` otherwise. Other columns with nothing to report
contain `-`.

**`count`** returns just the number of matching interactions, ignoring paging,
as plain text:

```text
1
```

**`json`** is an openPIP addition for browser code:

```json
[{"interactor_a": {"uniprot_id": "Q00987-11", "gene_name": "MDM2"},
  "interactor_b": {"uniprot_id": "P04637", "gene_name": "TP53"},
  "score": null, "interaction_id": 64197}]
```

### GET /psicquic/rest/query/count

The number of interactions matching `q`, as plain text. The same as
`format=count`.

### GET /psicquic/rest/formats

The supported formats, one per line:

```text
tab25
tab26
tab27
tab28
count
json
```

### GET /psicquic/rest/version

The service version, as plain text: `2.0.0`.

## MIQL queries

| Query | Matches interactions where |
|---|---|
| `TP53` or `"TP53"` | either interactor matches `TP53` |
| `id:TP53` | either interactor matches |
| `idA:TP53` | interactor A matches |
| `idB:TP53` | interactor B matches |
| `species:9606` | either interactor is from NCBI taxon 9606 |
| `taxidA:9606`, `taxidB:9606` | interactor A, or B, is from that taxon |
| `pubid:25416956` | a source dataset has this PubMed ID |
| `pubauth:Rolland` | a source dataset's author contains this text |
| `*` | everything |

An identifier matches a protein's gene name, UniProt accession or Entrez ID,
or any identifier recorded for it, ignoring capitalisation. Field names also
ignore capitalisation.

Combine terms with `AND`, `OR`, `NOT` and parentheses. Terms side by side mean
`AND`. `NOT` binds tightest, then `AND`, then `OR`.

```text
id:TP53 AND id:MDM2
idA:BRCA1 AND NOT species:10090
(pubid:25416956 OR pubid:32296183) AND id:TP53
```

!!! note "Which side is A?"
    Interactor A and B are stored in the order the source data gave them. The
    same pair can be stored either way round, so `idA:TP53 AND idB:MDM2` can
    find nothing where `id:TP53 AND id:MDM2` finds the interaction. Use `id:`
    unless you need a particular side.

There is no wildcard or range syntax: `BRC*` looks for a protein literally
named `BRC*`.

### Unsupported fields

These standard MIQL fields are **refused** rather than answered with zero, so
that a client querying many services can tell "openPIP cannot answer this"
from "openPIP has none": `detmethod`, `type`, `pbiorole`, `ptype`, `pmethod`,
`stc`, `ftype`, and any other field not listed above.

## Errors

Errors are plain text, not JSON.

| Status | When | Body |
|---|---|---|
| 400 | Unsupported field | `Unsupported query field: detmethod. Supported fields: idA, idB, id, taxidA, taxidB, species, pubid, pubauth.` |
| 400 | Malformed query | e.g. `Unbalanced parentheses in query.` or `Could not parse query near: ...` |
| 400 | Bad paging | `firstResult and maxResults must be integers`, `... must not be negative`, or `maxResults must be at most 2500` |
| 406 | Unsupported format | `Unsupported format: xml25. Supported formats: tab25, tab26, tab27, tab28, count, json` |
| 429 | Rate limit | JSON: `{"detail": "Request was throttled. Expected available in N seconds."}` |

## Downloading everything

To fetch every interaction, page through `q=*`, 2,500 at a time, using
`firstResult` and the total from `/query/count`. At 60 requests per minute,
about 123,000 interactions take roughly a minute. For a whole dataset in one
file, the [dataset download](api/datasets.md#get-apidatasetspkdownload) is
simpler.
