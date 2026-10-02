# Browsing proteins

**Proteins** in the top menu lists every protein in the portal. Pick one to see
its full record. The address `…/proteins/<identifier>` opens a protein
directly.

## The list

- **Search proteins…** matches part of a gene name, protein name or
  identifier. An exact gene-name match comes first.
- **Sort** by gene name (A→Z or Z→A), or by most or fewest interactions.
- **Filters**:
    - **Has interactions**
    - **Has UniProt accession**: the proteins for which a 3D model can be
      looked up.
    - **Has sequence**
    - **Include unnamed entries**: proteins with no gene name are hidden
      unless you tick this.
- The list loads more rows as you scroll. Press <kbd>/</kbd> to jump to the
  search box, <kbd>↑</kbd>/<kbd>↓</kbd> to move, <kbd>Enter</kbd> to open, and
  <kbd>Esc</kbd> to clear the search.

## A protein's record

- **View interaction network →** opens a search for this protein.
- **Interactions, residues, molecular weight and isoelectric point.** Weight
  and isoelectric point are calculated from the sequence.
- **3D structure**: the AlphaFold model, with its model confidence (pLDDT) and
  predicted aligned error (PAE) plot, or an experimental structure from the
  PDB. You can spin and reset the model, save a PNG snapshot, and download the
  structure as PDB or mmCIF, or the PAE data as JSON. Structures come from the
  AlphaFold Database and RCSB PDB, so they need an internet connection.
- **Top interactors**: the partners linked to this protein by the most
  interaction records. Click one to open it.
- **Annotations**, **tissue expression** (top 10 tissues) and **subcellular
  location**, where the portal has them.
- **Sequence**, with **Copy FASTA**, **Download FASTA**, the amino-acid
  composition, and **BLAST at NCBI ↗**.
- **Identifiers** and links to **external databases**: NCBI Gene, UniProt, the
  Human Protein Atlas, Ensembl, GeneCards and STRING.
- **Export this record** as JSON (every field, plus the calculated values) or
  as TSV.
