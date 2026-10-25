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


def _fly_entry(accession, name, synonyms=(), reviewed=True):
    kind = "reviewed (Swiss-Prot)" if reviewed else "unreviewed (TrEMBL)"
    return {
        "primaryAccession": accession,
        "entryType": f"UniProtKB {kind}",
        "genes": [
            {
                "geneName": {"value": name},
                "synonyms": [{"value": s} for s in synonyms],
            }
        ],
    }


def test_resolve_by_gene_prefers_primary_name_then_reviewed(monkeypatch):
    from proteins import uniprot

    results = [
        _fly_entry("Q_SYN", "Other", synonyms=["Act42A"]),
        _fly_entry("Q_TREMBL", "Act42A", reviewed=False),
        _fly_entry("P_SPROT", "Act42A"),
        _fly_entry("Q_ALIAS", "Hsp70", synonyms=["to"]),
    ]

    class Resp:
        def raise_for_status(self):
            pass

        def json(self):
            return {"results": results}

    calls = []
    monkeypatch.setattr(
        uniprot.requests,
        "get",
        lambda url, params, timeout: calls.append(params) or Resp(),
    )
    found = uniprot.resolve_accessions_by_gene(["Act42A", "to", "CR4575"], "7227")

    assert found == {"Act42A": "P_SPROT", "to": "Q_ALIAS"}
    assert "organism_id:7227" in calls[0]["query"]


@pytest.mark.django_db
def test_gene_name_only_protein_is_enriched_when_its_organism_is_known(monkeypatch):
    # FlyBI: bare gene symbols + taxid:7227 previously got no UniProt data at all.
    from proteins.models import ProteinOrganism

    fly = Organism.objects.create(name="fly", taxonomy_id="7227")
    protein = Protein.objects.create(gene_name="Act42A")
    ProteinOrganism.objects.create(protein=protein, organism=fly)
    orphan = Protein.objects.create(gene_name="Act42A")  # no organism: ambiguous

    monkeypatch.setattr(
        "proteins.uniprot.resolve_accessions_by_gene",
        lambda names, taxid: {"Act42A": "P10987"} if taxid == "7227" else {},
    )
    entry = {**_entry("P10987"), "sequence": {"value": "MCDEEV"}}
    monkeypatch.setattr(
        "proteins.uniprot.fetch_uniprot_data", lambda a: {"P10987": entry}
    )
    enrich_proteins_from_uniprot([protein.id, orphan.id])

    protein.refresh_from_db()
    orphan.refresh_from_db()
    assert protein.uniprot_id == "P10987"
    assert protein.sequence == "MCDEEV"
    assert not orphan.uniprot_id
