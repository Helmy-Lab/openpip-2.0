"""UniProt REST API client and protein enrichment helper."""

import logging
import re

import requests

logger = logging.getLogger(__name__)

UNIPROT_SEARCH = "https://rest.uniprot.org/uniprotkb/search"
UNIPROT_FIELDS = (
    "accession,gene_names,protein_name,sequence,cc_function,"
    "xref_ensembl,xref_geneid,organism_name,organism_id,"
    "xref_pdb,xref_interpro"
)

# UniProt cross-reference databases worth storing, and how MITAB should treat
# each. "id" databases name the same molecule and belong in the alternative
# identifier columns (3/4); "xref" databases point at other resources and belong
# in the cross-reference columns (23/24).
#
# GO, Reactome and RefSeq are deliberately not fetched. All are verifiable; the
# objection is signal, not correctness. A protein carries dozens of GO and
# Reactome entries and the portal already surfaces both via g:Profiler
# enrichment. RefSeq returns isoform-level accessions — BRCA1 has 33 — which
# would swell the alternative-identifier column from two entries to thirty-five
# while saying nothing Ensembl and Entrez do not already say.
XREF_DATABASES = {
    "PDB": ("pdb", "xref"),
    "InterPro": ("interpro", "xref"),
}
ALT_ID_CONVENTIONS = {"ensembl", "gene_name", "uniprotkb", "entrez"}
BATCH_SIZE = 50
TIMEOUT = 30


def base_accession(uniprot_id: str) -> str:
    """Drop a UniProt isoform suffix: Q07817-1 -> Q07817.

    UniProt does not index isoforms as searchable entries, so `accession:Q07817-1`
    matches nothing and the row is silently absent from the response — the API
    still returns 200, just with fewer results. Over half of openPIP's
    accessions carry a suffix, so querying them raw loses half the data without
    raising anything.

    The frontend has the same helper in features/search/network/uniprot.ts,
    where AlphaFold and RCSB need the identical normalisation.
    """
    return re.sub(r"-\d+$", "", uniprot_id or "")


def fetch_uniprot_data(accessions: list[str]) -> dict[str, dict]:
    """Fetch UniProt entries for a list of accessions.

    Accepts raw accessions — isoform suffixes are stripped and duplicates
    collapsed before querying. Returns {base accession: entry}, so look up with
    base_accession(protein.uniprot_id) rather than the stored value.
    """
    wanted = sorted({base_accession(acc) for acc in accessions if acc})
    if not wanted:
        return {}

    entries: dict[str, dict] = {}
    for start in range(0, len(wanted), BATCH_SIZE):
        batch = wanted[start : start + BATCH_SIZE]
        params = {
            "query": " OR ".join(f"accession:{acc}" for acc in batch),
            "format": "json",
            "fields": UNIPROT_FIELDS,
            "size": len(batch),
        }
        resp = requests.get(UNIPROT_SEARCH, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        for entry in resp.json().get("results", []):
            if "primaryAccession" in entry:
                entries[entry["primaryAccession"]] = entry
    return entries


def _extract_protein_name(entry: dict) -> str:
    try:
        return entry["proteinDescription"]["recommendedName"]["fullName"]["value"]
    except (KeyError, TypeError):
        pass
    try:
        return entry["proteinDescription"]["submissionNames"][0]["fullName"]["value"]
    except (KeyError, TypeError, IndexError):
        return ""


def _extract_gene_name(entry: dict) -> str:
    try:
        return entry["genes"][0]["geneName"]["value"]
    except (KeyError, TypeError, IndexError):
        return ""


def _extract_sequence(entry: dict) -> str:
    try:
        return entry["sequence"]["value"]
    except (KeyError, TypeError):
        return ""


def _extract_description(entry: dict) -> str:
    for comment in entry.get("comments", []):
        if comment.get("commentType") == "FUNCTION":
            texts = comment.get("texts", [])
            if texts:
                return texts[0].get("value", "")
    return ""


def _extract_ensembl_id(entry: dict) -> str:
    """Return Ensembl gene ID (no version suffix) from UniProt cross-references."""
    for xref in entry.get("uniProtKBCrossReferences", []):
        if xref.get("database") == "Ensembl":
            for prop in xref.get("properties", []):
                if prop.get("key") == "GeneId":
                    gene_id = prop["value"]
                    return gene_id.rsplit(".", 1)[0] if "." in gene_id else gene_id
    return ""


def _extract_entrez_id(entry: dict) -> str:
    """Return Entrez Gene ID from UniProt cross-references."""
    for xref in entry.get("uniProtKBCrossReferences", []):
        if xref.get("database") == "GeneID":
            return xref.get("id", "")
    return ""


def extract_taxon(entry: dict) -> tuple[str, str] | None:
    """Return (taxonomy_id, scientific_name) from a UniProt entry, or None."""
    organism = entry.get("organism") or {}
    taxon_id = organism.get("taxonId")
    if not taxon_id:
        return None
    return str(taxon_id), organism.get("scientificName") or ""


def extract_xrefs(entry: dict) -> list[tuple[str, str]]:
    """Return [(naming_convention, identifier)] for the cross-references we keep.

    Every value is UniProt's own curated cross-reference for that accession —
    recorded, not inferred, so it can be checked against the entry.
    """
    found = []
    for xref in entry.get("uniProtKBCrossReferences", []):
        mapping = XREF_DATABASES.get(xref.get("database"))
        identifier = xref.get("id")
        if mapping and identifier:
            found.append((mapping[0], identifier))
    return found


def _store_xrefs(protein, entry) -> int:
    """Attach UniProt cross-references as Identifier rows. Adds only."""
    from proteins.models import Identifier, ProteinIdentifier

    added = 0
    existing = {
        (pi.identifier.naming_convention, pi.identifier.identifier)
        for pi in protein.protein_identifiers.select_related("identifier")
        if pi.identifier
    }
    for convention, value in extract_xrefs(entry):
        if (convention, value) in existing:
            continue
        identifier, _ = Identifier.objects.get_or_create(
            identifier=value, naming_convention=convention
        )
        ProteinIdentifier.objects.get_or_create(protein=protein, identifier=identifier)
        existing.add((convention, value))
        added += 1
    return added


def _store_taxon(protein, entry) -> bool:
    """Link the protein to its organism, creating the Organism if needed.

    Previously taxonomy came only from the uploaded file's columns 10/11, so a
    file that omitted them left the protein with no organism and MITAB columns
    10/11 empty. UniProt states the organism for the accession, which is a
    recorded fact about that entry rather than an inference.
    """
    from proteins.models import Organism, ProteinOrganism

    if protein.protein_organisms.exists():
        return False
    taxon = extract_taxon(entry)
    if not taxon:
        return False
    taxonomy_id, scientific_name = taxon
    organism = Organism.objects.filter(taxonomy_id=taxonomy_id).first()
    if organism is None:
        organism = Organism.objects.create(
            taxonomy_id=taxonomy_id,
            name=scientific_name,
            scientific_name=scientific_name,
        )
    elif scientific_name and not organism.scientific_name:
        organism.scientific_name = scientific_name
        organism.save(update_fields=["scientific_name"])
    ProteinOrganism.objects.get_or_create(protein=protein, organism=organism)
    return True


def enrich_proteins_from_uniprot(protein_ids: list[int]) -> tuple[int, bool]:
    """
    Fetch UniProt metadata for proteins with a known uniprot_id and fill in
    any fields that are currently null/empty.  Only fills — never overwrites.
    Returns (count_updated, had_error).
    """
    from proteins.models import Protein

    proteins = list(
        Protein.objects.filter(id__in=protein_ids)
        .exclude(uniprot_id__isnull=True)
        .exclude(uniprot_id="")
    )
    if not proteins:
        return 0, False

    accessions = [p.uniprot_id for p in proteins]
    try:
        uniprot_data = fetch_uniprot_data(accessions)
    except Exception:
        logger.warning("UniProt enrichment failed — skipping", exc_info=True)
        return 0, True

    updated = 0
    for protein in proteins:
        # Keyed by base accession: an isoform-suffixed uniprot_id would never
        # have matched, which silently skipped half the proteins.
        entry = uniprot_data.get(base_accession(protein.uniprot_id))
        if not entry:
            continue

        changed = False
        if not protein.protein_name:
            name = _extract_protein_name(entry)
            if name:
                protein.protein_name = name
                changed = True
        if not protein.gene_name:
            gene = _extract_gene_name(entry)
            if gene:
                protein.gene_name = gene
                changed = True
        if not protein.sequence:
            seq = _extract_sequence(entry)
            if seq:
                protein.sequence = seq
                changed = True
        if not protein.description:
            desc = _extract_description(entry)
            if desc:
                protein.description = desc
                changed = True
        if not protein.ensembl_id:
            eid = _extract_ensembl_id(entry)
            if eid:
                protein.ensembl_id = eid
                changed = True
        if not protein.entrez_id:
            tid = _extract_entrez_id(entry)
            if tid:
                protein.entrez_id = tid
                changed = True

        # Related rows rather than fields on the protein, so they are saved
        # regardless of whether any scalar field changed.
        if _store_taxon(protein, entry):
            changed = True
        if _store_xrefs(protein, entry):
            changed = True

        if changed:
            protein.save(
                update_fields=[
                    "protein_name",
                    "gene_name",
                    "sequence",
                    "description",
                    "ensembl_id",
                    "entrez_id",
                ]
            )
            updated += 1

    return updated, False
