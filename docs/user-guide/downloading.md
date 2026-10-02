# Downloading data

Everything in a portal can be downloaded without an account.

## Whole datasets

The **Downloads** page lists every dataset with its year, description and
citation. Each has three download buttons:

| Button | Contents |
|---|---|
| **.tab** | Tab-separated. Opens with `#` lines naming the dataset and the publication to cite, then four columns: interactor A, interactor B (each `uniprotkb:<accession>`, or the gene name), `score:<value>`, and `pubmed:<id>`. This is not full PSI-MI TAB. |
| **.sif** | `<gene A>	interacts	<gene B>` per line, for Cytoscape. |
| **.csv** | Columns `gene_a, gene_b, uniprot_a, uniprot_b, score, dataset`. |

Only the **.tab** file carries the citation. If you use the others, record the
dataset's citation from the Downloads page.

**Supplementary files**, such as sequence files the portal's team has
published, are listed underneath.

For standard PSI-MI TAB with all columns, or to fetch data from a script, use
the [PSICQUIC service](../developer/psicquic.md) or the
[REST API](../developer/api/datasets.md).

## The results of a search

Open **Download** beside the network. Files contain **what the network
shows**: your filters apply, and proteins you removed are left out.

| Option | File |
|---|---|
| **SIF** | `<gene A> pp <gene B>` per interaction. |
| **Interactions CSV** | One row per interaction: UniProt, gene and Ensembl IDs of both proteins, whether each is one you searched for (`query` or `non_query`), score, category, and dataset authors. |
| **Interactors CSV** | One row per protein: gene name, UniProt, Ensembl and Entrez IDs, and interaction count. |
| **FASTA** | The proteins' sequences. Proteins without a stored sequence are skipped. |
| **PSI-MI** | Tab-separated, 42 columns in the PSI-MI TAB 2.7 layout, with identifiers, gene names, publication and score filled in, and `-` elsewhere. |
| **Network image (PNG)** / **(JPG)** | The network as drawn, at twice screen resolution, on the network's background colour. |
| **All datasets (ZIP)** | Every dataset in the portal as `.tab` files in one ZIP archive, whatever you searched for. |

Files are named after the format and the date and time, such as
`openPIP_download_SIF_October_2_2026_1432.sif`.
