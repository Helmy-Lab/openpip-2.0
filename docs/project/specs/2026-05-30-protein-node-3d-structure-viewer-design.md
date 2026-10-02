# Design: Interactive 3D Protein Structure Viewer in Node Popup

**Date:** 2026-05-30
**Branch:** phase-3
**Scope:** Add an interactive 3D structure viewer to the `NodeInfoPanel` popup that appears when clicking a protein node in the network graph.

---

## Overview

When a user clicks a protein node in the Cytoscape network, a popup (`NodeInfoPanel`) appears showing gene name, links, and interaction counts. This design adds a collapsible "3D Structure" section to that popup, powered by Mol* (molstar), showing the AlphaFold predicted structure by default with a toggle to the best available experimental PDB structure.

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Viewer library | Mol* (`molstar`) | Gold standard; used by RCSB and AlphaFold themselves |
| Default structure source | AlphaFold EBI | Always available for any UniProt ID; predictable URL |
| Fallback source | RCSB PDB (best-ranked experimental) | More biologically meaningful when available |
| Bundle strategy | Dynamic `import('molstar')` | Keeps ~15 MB out of the initial bundle |
| Trigger | Collapsible section, toggle on demand | Keeps popup fast; viewer loads last |
| Fetch strategy | Eager on node click, lazy render | PDB check and Mol* chunk in-flight before user expands |

---

## New Files

### `frontend/src/features/search/network/StructureViewer.tsx`

A React component that wraps Mol*.

**Props:**
```ts
interface StructureViewerProps {
  uniprotId: string
  source: 'alphafold' | 'pdb'
  pdbId: string | null
}
```

**Behaviour:**
- On mount: dynamically imports `molstar`, initialises a `PluginUIContext` in a `div` ref, loads the appropriate structure.
- AlphaFold URL: `https://alphafold.ebi.ac.uk/files/AF-{uniprotId}-F1-model_v4.cif` (format: `mmcif`)
- PDB URL: `https://files.rcsb.org/download/{pdbId}.cif` (format: `mmcif`)
- On `source` prop change: clears the current structure, loads the new one.
- On unmount: calls `plugin.dispose()` to release WebGL context.
- Canvas height: 180px, full width of popup (approx 240px usable).

**Error states:**
- Structure 404 / fetch error → renders `"Structure not available"` message inside the viewer area.
- Mol* dynamic import fails → renders `"Could not load viewer"` with a direct external link.

**External link:** A small `↗ View on AlphaFold` / `↗ View on RCSB PDB` anchor rendered below the canvas, switching automatically with `source`.

---

### `frontend/src/features/search/network/useStructureAvailability.ts`

A TanStack Query hook that checks RCSB for experimental structures.

**Signature:**
```ts
function useStructureAvailability(uniprotId: string): {
  pdbId: string | null
  loading: boolean
  error: boolean
}
```

**API call:** RCSB search endpoint:
```
POST https://search.rcsb.org/rcsbsearch/v2/query
```
Query: find all PDB entries where `rcsb_polymer_entity_container_identifiers.uniprot_ids` contains `{uniprotId}`, return type `entry`, sorted by resolution ascending, limit 1.

**Returns:** The top PDB entry ID (e.g. `"2OCJ"`), or `null` if none found.

**TanStack Query config:**
- `staleTime`: 86400000 (24 h) — PDB mappings are stable.
- `retry`: 1
- On network error: returns `{ pdbId: null, loading: false, error: true }`.

---

## Modified Files

### `frontend/src/features/search/SearchResultsPage.tsx` — `NodeInfoPanel`

**New state inside `NodeInfoPanel`:**
```ts
const [viewerOpen, setViewerOpen] = useState(false)
const [structureSource, setStructureSource] = useState<'alphafold' | 'pdb'>('alphafold')
```

**`useStructureAvailability` called at mount** (unconditionally, so the fetch fires as soon as the popup opens — before the user expands the section).

**Mol* dynamic import pre-kicked** in a `useEffect` at mount:
```ts
useEffect(() => { import('molstar') }, [])
```

**New section in JSX** — inserted between the header and the Actions section:

```
[Collapsible row: "⬡ 3D Structure  ▼"]
  └─ [AlphaFold | PDB] tab strip
     └─ <StructureViewer ... />
        └─ "↗ View on AlphaFold / RCSB"
```

**AlphaFold/PDB tab strip behaviour:**
- Both tabs always rendered.
- PDB tab: disabled + `cursor: not-allowed` + `opacity: 0.4` when `pdbId === null`.
- PDB tab: `title="No PDB structure available for this protein"` when disabled (native browser tooltip).
- Active tab: highlighted with `--accent` background.

---

## Data Flow

```
handleNodeClick(protein)
  → setSelectedProtein(protein)
  → NodeInfoPanel mounts
      → useStructureAvailability fires (TanStack Query, background)
      → import('molstar') fires (dynamic import, background)
  → user expands "3D Structure" section
      → setViewerOpen(true)
      → StructureViewer mounts
          → Mol* initialises in div ref
          → loads AlphaFold CIF
  → RCSB result arrives
      → PDB tab enabled/disabled accordingly
  → user clicks PDB tab (if enabled)
      → setStructureSource('pdb')
      → StructureViewer swaps structure to RCSB CIF
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| AlphaFold CIF 404 | `"Structure not available"` message + `↗ View on AlphaFold` link |
| RCSB lookup network error | PDB tab disabled with tooltip `"Could not check PDB availability"` |
| Mol* dynamic import fails | `"Could not load viewer"` message + direct external link |
| `protein_uniprot_id` is empty string | 3D Structure section hidden entirely |

---

## Out of Scope

- Showing multiple PDB structures (only the best-ranked one is used).
- Structure viewer on the full Protein Detail page (separate feature).
- Any backend changes — all API calls go directly to AlphaFold EBI and RCSB from the browser.
- PDB structure selection UI (user cannot pick from multiple entries in this popup).
