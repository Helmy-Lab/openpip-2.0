# Searching and exploring networks

## Starting a search

Type one or more proteins into the search box on the home page, or the
**Query** box beside the results, then press **Search** or <kbd>Enter</kbd>.

- **What to type:** gene names such as `TP53` work on every portal. Other
  identifiers, such as Ensembl gene IDs, work where the portal's data records
  them. Capitalisation does not matter, but a term must match a whole
  identifier: `TP5` finds nothing.
- **Several proteins:** separate them with commas, spaces or new lines, for
  example `BAD, BCL2L1, BAK1`. <kbd>Shift</kbd>+<kbd>Enter</kbd> adds a new
  line instead of searching.
- **Suggestions** appear after two characters. Use <kbd>↑</kbd>/<kbd>↓</kbd>
  and <kbd>Enter</kbd> to pick one, or <kbd>Esc</kbd> to close the list.
- **Example searches** below the box run a ready-made search chosen by the
  portal's administrator.

The address of the results page is `…/search/<your terms>`, so you can
bookmark a search or send it to someone.

### Typing a phrase

The home page box also understands short phrases, such as:

- `BCL2 in liver`
- `TP53 and MDM2 with high confidence`
- `what binds CDK2 in testis`

From a phrase, openPIP picks out the proteins, any **tissues** you name (which
become the tissue filter), and **confidence** wording. *High confidence*,
*confident* or *reliable* mean a score of at least 0.5. *Score above 0.7*
sets that exact threshold. A line under the box shows what will be searched
and which filters will apply. Words it recognises but cannot act on, such as
*two-hybrid* or *bait*, are listed after "Cannot filter by". Only the home page
box reads phrases. The Query box beside the results takes a plain list of
proteins.

### Found and not found

Beside the results, **Found** lists the terms that matched and **Not found**
the ones that did not. If nothing matched, the network area says so. Check
the spelling, or try the protein's gene name.

## The results page

The page has three parts: the controls, the network, and the result tables
underneath. The administrator chooses whether the controls sit in a column
on the left or in a row of headings above the network. In the row layout,
each heading opens its panel when you point at it or click it.

Drag the bar between the network and the tables to resize them. Click the bar
to reset it, or use ▲/▼ to make the network short or tall. **Fullscreen**, at
the top left of the network, gives it the whole screen.

### Filters

Filters change what the network, the tables and your downloads show.

| Filter | What it does |
|---|---|
| **Min. confidence score** | Hides interactions scored below the slider (0–1). Interactions with no score count as 0, so they disappear as soon as the slider is above 0. |
| **Interaction sources** | One checkbox per interaction category in the results, such as Published or Literature. Untick a category to hide its interactions. |
| **Filter mode** | **No Filter** shows every interaction among the proteins found, including between partners. **Query-Query** keeps only interactions between proteins you searched for. **Query-Interactor** keeps interactions with at least one protein you searched for. |
| **Tissue expression** | Keeps only proteins expressed in **every** tissue you tick. Only tissues with expression data for these results are listed. **All tissues** clears the selection. |

Two switches in the tissue panel change how proteins are drawn:
**Show tissue expression** sizes each protein by its expression level, and
**Reflect tissue specificity** colours it by how specific that expression is.
While either switch is on, you can select only one tissue.

Filters stay set when you start a new search.

### The network

- **Proteins** you searched for are drawn in the query colour, and their
  partners in the interactor colour. Point at a protein to see its name.
- **Interactions** are coloured by their highest interaction category. The
  legend at the top right shows what each colour means.
- **Layout** (bottom right) offers *Force-directed (Cola)*, the default,
  *Force-directed (CoSE)*, *Concentric*, *Circle* and *Grid*. The same menu
  sets the network's background colour for you alone. Your browser remembers
  it.
- Scroll to zoom, and drag the background to move around.

**Click a protein** to open its panel:

- **3D Structure** shows the AlphaFold model, coloured by model confidence, or
  an experimental structure from the PDB when one exists.
- **Actions**: *Search … for <gene>* starts a new search for that protein
  alone. *Remove <gene> From Network* hides it and its interactions from this view,
  from **Save Network** and from your downloads. The tables below still list
  it.
- **Links** go to NCBI Gene, the Human Protein Atlas, Ensembl, GeneCards and
  UniProt. You also see the protein's interaction counts and description.

**Click an interaction** to see its confidence score, the datasets it comes
from (with links to their publications), experimental details, and the
literature that reports it.

**Open in Cytoscape** (the small network icon, bottom right) sends the network
to Cytoscape running on your own computer. Cytoscape must be open, with its
REST interface on the default port.

### Result tables

| Tab | Contents |
|---|---|
| **Interactions** | One row per interaction: both proteins (linked to NCBI Gene), score, category and datasets. Click a column heading to sort. 25 rows per page. |
| **Interactors** | One row per protein: gene name, UniProt and Ensembl IDs, whether you searched for it, and its interaction count. |
| **Molecular Function**, **Biological Process**, **Cellular Component**, **Reactome**, **CORUM**, **KEGG** | Enrichment of the proteins in the network, calculated by [g:Profiler](https://biit.cs.ut.ee/gprofiler/) with a false-discovery-rate threshold of 0.05. The top 50 terms are shown. |
| **Subcellular Location** | Where the proteins are found in the cell, from the Human Protein Atlas. |
| **Tissue Expression** | Which proteins are expressed in each tissue, from GTEx. |
| **Protein Info** | Everything about the protein you last clicked: identifiers, interaction counts, description, annotations, top tissues, sequence (with **Copy FASTA**) and 3D structure. |

**Click a row** in an enrichment, location or tissue table to highlight its
proteins in the network. Click it again to clear the highlight.

The enrichment tables are calculated by g:Profiler, an outside service, so
they need an internet connection. A portal can turn off the location and
tissue tabs if its organism has no such data.

## External tools

**External links** sends the proteins in the network to g:Profiler, Reactome,
GeneMANIA, Pathway Commons, DAVID, STRING, cBioPortal, Complex Portal,
Drugst.One or Genelist. Links to IntAct, BioGRID, KEGG and UniProt use only
the proteins you searched for.

## Keeping and sharing a search

See [Accounts, saving and sharing](accounts.md). Downloads are covered in
[Downloading data](downloading.md).
