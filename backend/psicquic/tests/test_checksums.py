"""ROGID/RIGID pinned to real values from IntAct's live service.

These are not values we chose. They are what IntAct publishes for the Xenopus
BRCA1/BARD1 interaction, so the assertions check interoperability with another
database rather than self-consistency with our own reasoning.
"""

import pytest

from interactions.models import Interaction
from proteins.models import Organism, Protein, ProteinOrganism
from psicquic.checksums import rigid, rogid
from psicquic.mitab import format_interaction

# UniProt Q90X96 / Q90X95, Xenopus laevis (taxid 8355).
INTACT_ROGID_A = "qTAy1sxHTW+SKIMXLD7bs12UlJ08355"
INTACT_ROGID_B = "Gmo+4H4eIXSGCDVPd4KAylEi6Go8355"
INTACT_RIGID = "qzJI0Tw7dNsnOu+stz8R6cFNYGY"


def test_rigid_matches_intacts_published_value():
    assert rigid(INTACT_ROGID_A, INTACT_ROGID_B) == INTACT_RIGID


def test_rigid_does_not_depend_on_argument_order():
    # A-B and B-A are the same interaction, so they must checksum the same.
    assert rigid(INTACT_ROGID_A, INTACT_ROGID_B) == rigid(
        INTACT_ROGID_B, INTACT_ROGID_A
    )


def test_rogid_appends_the_taxid_so_organisms_do_not_collide():
    # The same sequence in two organisms is two different molecules.
    assert rogid("MDLSAL", "9606") != rogid("MDLSAL", "10090")
    assert rogid("MDLSAL", "9606").endswith("9606")


def test_rogid_ignores_whitespace_and_case_in_the_sequence():
    assert rogid("MDLSAL", "9606") == rogid("mdl sal\n", "9606")


@pytest.mark.parametrize(
    "sequence,taxid",
    [(None, "9606"), ("", "9606"), ("MDLSAL", None), ("MDLSAL", ""), ("  ", "9606")],
)
def test_rogid_returns_none_rather_than_a_value_it_cannot_justify(sequence, taxid):
    assert rogid(sequence, taxid) is None


def test_rigid_returns_none_when_a_participant_has_no_rogid():
    assert rigid(None, INTACT_ROGID_B) is None
    assert rigid(INTACT_ROGID_A, None) is None


@pytest.mark.django_db
def test_checksum_columns_are_dash_without_a_sequence():
    # Roughly half of openPIP's proteins have no sequence; those must not get a
    # checksum computed from nothing.
    organism = Organism.objects.create(name="human", taxonomy_id="9606")
    a = Protein.objects.create(gene_name="A", uniprot_id="P1")
    b = Protein.objects.create(gene_name="B", uniprot_id="P2")
    for protein in (a, b):
        ProteinOrganism.objects.create(protein=protein, organism=organism)
    interaction = Interaction.objects.create(interactor_A=a, interactor_B=b)

    cols = format_interaction(interaction, "tab27").split("\t")
    assert cols[32] == "-" and cols[33] == "-" and cols[34] == "-"


@pytest.mark.django_db
def test_checksum_columns_are_emitted_when_the_inputs_exist():
    organism = Organism.objects.create(name="human", taxonomy_id="9606")
    a = Protein.objects.create(gene_name="A", uniprot_id="P1", sequence="MDLSAL")
    b = Protein.objects.create(gene_name="B", uniprot_id="P2", sequence="MKWVTF")
    for protein in (a, b):
        ProteinOrganism.objects.create(protein=protein, organism=organism)
    interaction = Interaction.objects.create(interactor_A=a, interactor_B=b)

    cols = format_interaction(interaction, "tab27").split("\t")
    assert cols[32].startswith("rogid:") and cols[32].endswith("9606")
    assert cols[34].startswith("rigid:")
    # The interaction checksum is derived from the two participant checksums.
    expected = rigid(rogid("MDLSAL", "9606"), rogid("MKWVTF", "9606"))
    assert cols[34] == f"rigid:{expected}"
