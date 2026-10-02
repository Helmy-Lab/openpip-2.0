"""Enrichment must record what UniProt states, and nothing else."""

import pytest

from proteins.models import Identifier, Organism, Protein, ProteinIdentifier
from proteins.uniprot import enrich_proteins_from_uniprot, extract_xrefs


def _entry(accession="P38398"):
    return {
        "primaryAccession": accession,
        "organism": {"taxonId": 9606, "scientificName": "Homo sapiens"},
        "uniProtKBCrossReferences": [
            {"database": "RefSeq", "id": "NP_009225.1"},
            {"database": "PDB", "id": "1JM7"},
            {"database": "InterPro", "id": "IPR001357"},
            {"database": "GO", "id": "GO:0005515"},  # deliberately not stored
        ],
    }


def test_extract_xrefs_keeps_only_the_declared_databases():
    # RefSeq and GO are in the entry but deliberately not collected.
    assert extract_xrefs(_entry()) == [("pdb", "1JM7"), ("interpro", "IPR001357")]


def test_extract_xrefs_on_an_entry_without_any():
    assert extract_xrefs({"primaryAccession": "P1"}) == []


@pytest.mark.django_db
def test_enrichment_links_the_organism_uniprot_states(monkeypatch):
    # A file that omits columns 10/11 previously left taxonomy empty forever.
    protein = Protein.objects.create(gene_name="BRCA1", uniprot_id="P38398")
    monkeypatch.setattr(
        "proteins.uniprot.fetch_uniprot_data", lambda a: {"P38398": _entry()}
    )
    enrich_proteins_from_uniprot([protein.id])

    organism = Organism.objects.get(taxonomy_id="9606")
    assert organism.scientific_name == "Homo sapiens"
    assert protein.protein_organisms.count() == 1


@pytest.mark.django_db
def test_enrichment_does_not_override_an_organism_from_the_file(monkeypatch):
    # The depositor's statement wins over the third-party lookup.
    from proteins.models import ProteinOrganism

    protein = Protein.objects.create(gene_name="BRCA1", uniprot_id="P38398")
    stated = Organism.objects.create(name="from file", taxonomy_id="10090")
    ProteinOrganism.objects.create(protein=protein, organism=stated)

    monkeypatch.setattr(
        "proteins.uniprot.fetch_uniprot_data", lambda a: {"P38398": _entry()}
    )
    enrich_proteins_from_uniprot([protein.id])

    assert list(protein.protein_organisms.all())[0].organism_id == stated.id


@pytest.mark.django_db
def test_enrichment_stores_cross_references(monkeypatch):
    protein = Protein.objects.create(gene_name="BRCA1", uniprot_id="P38398")
    monkeypatch.setattr(
        "proteins.uniprot.fetch_uniprot_data", lambda a: {"P38398": _entry()}
    )
    enrich_proteins_from_uniprot([protein.id])

    stored = {
        (pi.identifier.naming_convention, pi.identifier.identifier)
        for pi in protein.protein_identifiers.select_related("identifier")
    }
    assert ("pdb", "1JM7") in stored
    assert ("interpro", "IPR001357") in stored
    assert not any(c in {"go", "refseq"} for c, _ in stored), "not requested"


@pytest.mark.django_db
def test_enrichment_is_idempotent(monkeypatch):
    protein = Protein.objects.create(gene_name="BRCA1", uniprot_id="P38398")
    monkeypatch.setattr(
        "proteins.uniprot.fetch_uniprot_data", lambda a: {"P38398": _entry()}
    )
    enrich_proteins_from_uniprot([protein.id])
    enrich_proteins_from_uniprot([protein.id])

    assert ProteinIdentifier.objects.filter(protein=protein).count() == 2
    assert Identifier.objects.filter(naming_convention="pdb").count() == 1
    assert protein.protein_organisms.count() == 1
