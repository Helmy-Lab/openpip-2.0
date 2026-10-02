> **Superseded.** This working note is out of date in places and is not part of
> the published documentation. For current, verified behaviour see the
> documentation site (`docs/`, built with `mkdocs.yml`): the CLI and SDK are shelved and unmaintained (`cli/src/openpip/sdk.py`); use the REST API in `docs/developer/api/`.

# openPIP CLI — User Manual

The openPIP CLI (`openpip`) is a Python package that gives you two things in one:

- **A command-line tool** — search proteins, download data, export networks, manage the server
- **A Python SDK** — `from openpip import OpenPIP` for use in scripts and Jupyter notebooks

---

## Installation

```bash
# From inside the openpip-2.0 repo
pip install -e cli/

# Install Playwright browser for Cytoscape.js graph rendering (one time)
playwright install chromium
```

---

## First run

The first time you run `openpip`, a setup wizard asks two questions:

```
$ openpip

  Welcome to openPIP CLI!

  Server URL [https://openpip.usask.ca]:
  Choose your default interface:
    1. TUI  — interactive terminal UI
    2. Rich — formatted output (scriptable)
  Interface [1]:
```

**Server URL** — press Enter to use the public instance at `openpip.usask.ca/v2`, or type `http://localhost:8001` if you are running your own local instance.

**Interface** — choose TUI for an interactive experience, or Rich if you want to pipe output into scripts.

If you enter a `localhost` URL, the wizard also offers to store admin credentials so `openpip upload` works without prompting every time.

Config is saved to `~/.openpip/config.yaml`.

---

## Changing settings later

```bash
openpip config show                      # view current settings
openpip config set interface rich        # switch to Rich output mode
openpip config set interface tui         # switch back to TUI
openpip config set url http://localhost:8001   # point at local instance
```

---

## CLI reference

### Search

```bash
openpip search BRCA1
openpip search P38398           # by UniProt ID
openpip search "TP53"
```

Prints a Rich table of matching proteins with gene name, UniProt ID, and interaction count.

---

### Protein detail

```bash
openpip protein 1               # by database ID
```

Prints a panel with full protein info — UniProt ID, Ensembl ID, Entrez ID, description, and interaction count.

---

### Interactions

```bash
openpip interactions 1          # all interactions for protein with ID 1
```

Prints a table of interactions with interactor names and confidence scores.

---

### Network view and export

```bash
# View network in terminal (table of top 50 edges)
openpip network 1

# Export as image (Cytoscape.js render via Playwright, falls back to matplotlib)
openpip network 1 --export graph.png
openpip network 1 --export graph.svg
openpip network 1 --export graph.pdf

# Force matplotlib renderer (lighter, no browser needed)
openpip network 1 --export graph.png --renderer matplotlib

# Export as data file (open in Cytoscape Desktop, Gephi, networkx, etc.)
openpip network 1 --export network.json        # Cytoscape.js JSON
openpip network 1 --export network.graphml     # Cytoscape Desktop / Gephi
openpip network 1 --export edges.tsv           # edge list (source, target, weight)
```

Format is detected automatically from the file extension.

---

### Datasets

```bash
openpip datasets                # list all available datasets
```

---

### Download

```bash
openpip download 1              # download dataset 1 to ./dataset_1.tab
openpip download 1 -o my_data.tab   # specify output path
```

Downloads are public — no login required.

---

### Upload (admin only)

```bash
openpip upload mydata.tab --name "My PPI Dataset"
```

If your config has no stored token, you will be prompted for username and password inline. Only admin accounts can upload.

---

### PSICQUIC queries

The PSICQUIC interface is the standard PPI query protocol used by BioGRID, IntAct, and other databases. Any script written to query those databases works with openPIP using the same syntax.

```bash
# Plain text — searches gene name or UniProt ID
openpip psicquic BRCA1

# MIQL prefixes
openpip psicquic "idA:P38398"           # by interactor A UniProt ID
openpip psicquic "idB:P04637"           # by interactor B
openpip psicquic "id:P38398"            # either interactor
openpip psicquic "taxidA:9606"          # by taxon (Homo sapiens)
openpip psicquic "*"                    # all interactions

# Output formats
openpip psicquic BRCA1                  # default: PSI-MI TAB 2.5 (tab-separated)
openpip psicquic BRCA1 --format json    # JSON
openpip psicquic BRCA1 --max-results 50 # limit results

# Redirect to file
openpip psicquic BRCA1 > brca1_interactions.tab
```

The PSICQUIC endpoint is also directly callable from any website or script:

```bash
curl "https://openpip.usask.ca/psicquic/rest/query?q=BRCA1&format=tab25"
```

---

### Server management (for developers running a local instance)

Run these from inside the `openpip-2.0/` directory so the docker-compose.yml is found automatically.

```bash
openpip server start            # docker compose up -d
openpip server stop             # docker compose stop (preserves containers)
openpip server status           # docker compose ps
openpip server logs             # tail backend logs
openpip server logs frontend    # tail a specific service
openpip server logs -f          # follow (live tail)
openpip server build            # rebuild images after code changes

openpip db migrate              # apply pending Django migrations
```

---

## Python SDK

Use the SDK in scripts, Jupyter notebooks, or any Python code.

### Basic usage

```python
from openpip import OpenPIP

# Connect to public instance (uses config from ~/.openpip/config.yaml)
client = OpenPIP()

# Or specify explicitly
client = OpenPIP(url="https://openpip.usask.ca")
client = OpenPIP(url="http://localhost:8001")       # local instance
```

### Search proteins

```python
results = client.search("BRCA1")       # returns list of Protein objects
print(results[0].gene_name)            # "BRCA1"
print(results[0].uniprot_id)           # "P38398"
print(results[0].number_of_interactions_in_database)

# Get a pandas DataFrame directly
df = client.search("BRCA1", as_dataframe=True)
print(df.columns)   # gene_name, uniprot_id, ensembl_id, ...
```

### Protein detail

```python
protein = client.protein(1)
print(protein.gene_name)
print(protein.description)
```

### Interactions

```python
interactions = client.interactions(1)
for i in interactions:
    print(i.interactor_A.gene_name, "—", i.interactor_B.gene_name, i.score)

# As DataFrame
df = client.interactions(1, as_dataframe=True)
# columns: interactor_a, interactor_b, score, interaction_id
```

### Network data

```python
network = client.network(1)
print(len(network.nodes), "nodes")
print(len(network.edges), "edges")

# Node data (Cytoscape.js format)
for node in network.nodes:
    print(node.data["label"], node.data.get("uniprot_id"))

# Edge data
for edge in network.edges:
    print(edge.data["source"], "->", edge.data["target"], edge.data.get("weight"))
```

### Export network

```python
from pathlib import Path

# Image (Playwright/Cytoscape.js render, falls back to matplotlib)
out = client.export_network(1, "network.png")
out = client.export_network(1, "network.svg")

# Data formats
out = client.export_network(1, "network.json")     # Cytoscape.js JSON
out = client.export_network(1, "network.graphml")  # Cytoscape Desktop / Gephi
out = client.export_network(1, "edges.tsv")        # edge list
```

### Datasets

```python
datasets = client.datasets()
for d in datasets:
    print(d.id, d.name, d.author, d.year, d.number_of_interactions)

df = client.datasets(as_dataframe=True)
```

### Download a dataset file

```python
path = client.download(1)                      # saves to ./dataset_1.tab
path = client.download(1, path="my_data.tab")  # custom path
```

### PSICQUIC query

```python
# Returns PSI-MI TAB 2.5 text
tab_text = client.psicquic("BRCA1")
tab_text = client.psicquic("idA:P38398")
tab_text = client.psicquic("taxidA:9606", max_results=500)

# Parse it
for line in tab_text.split("\n"):
    if not line.startswith("#"):
        cols = line.split("\t")
        print(cols[0], cols[1], cols[14])   # interactor A, B, score

# JSON format
data = client.psicquic("BRCA1", format="json")
# data is a list of dicts with interactor_a, interactor_b, score, interaction_id
```

### Upload (admin only)

```python
# If running a local instance with stored credentials
client = OpenPIP(url="http://localhost:8001", username="admin", password="secret")
result = client.upload("mydata.tab", name="My PPI Dataset")
```

### Use as a context manager

```python
with OpenPIP() as client:
    proteins = client.search("TP53")
    df = client.interactions(proteins[0].id, as_dataframe=True)
# connection closed automatically
```

---

## External API access (for websites and scripts)

No installation needed. Any website can call openPIP directly:

```javascript
// JavaScript — works from any website, no SDK needed
const response = await fetch("https://openpip.usask.ca/api/search/?q=BRCA1");
const data = await response.json();
```

```python
# Python — raw requests, no SDK needed
import requests
r = requests.get("https://openpip.usask.ca/api/search/", params={"q": "BRCA1"})
proteins = r.json()["results"]
```

Interactive API documentation (try endpoints in the browser):
**https://openpip.usask.ca/api/docs/**

---

## Config file reference

Location: `~/.openpip/config.yaml`

```yaml
url: https://openpip.usask.ca   # server to connect to
interface: tui                   # tui or rich
username: null                   # admin username (local instances)
token: null                      # stored JWT token
refresh_token: null
```

---

## Export format reference

| Extension | Type | Opens in |
|---|---|---|
| `.png` | Rendered graph image | Any image viewer |
| `.svg` | Scalable vector image | Browser, Inkscape, Illustrator |
| `.pdf` | PDF document | Any PDF viewer |
| `.json` | Cytoscape.js JSON | Cytoscape.js web apps |
| `.graphml` | GraphML data | Cytoscape Desktop, Gephi, yEd |
| `.tsv` / `.tab` | Edge list | Excel, R igraph, networkx |

---

## PSICQUIC query syntax reference

| Query | Matches |
|---|---|
| `BRCA1` | Any interaction where either protein has gene name or UniProt ID matching BRCA1 |
| `P38398` | Same — plain UniProt ID |
| `idA:P38398` | Interactions where interactor A is P38398 |
| `idB:P04637` | Interactions where interactor B is P04637 |
| `id:P38398` | Interactions where either interactor is P38398 |
| `taxidA:9606` | Interactions where interactor A is Homo sapiens (NCBI taxon 9606) |
| `taxidB:9606` | Interactions where interactor B is Homo sapiens |
| `*` | All interactions |
