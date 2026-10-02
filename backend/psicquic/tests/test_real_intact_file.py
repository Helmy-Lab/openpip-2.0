"""Ingest a real PSI-MI TAB 2.8 file from IntAct.

Interoperability is a claim about other people's files, not our own. This
fixture is five rows pulled from IntAct's live PSICQUIC service
(query brca1, format=tab28) — a real provider's output, with the quoting,
multi-value cells and unfamiliar CV terms that a hand-written fixture
never has.
"""

from pathlib import Path

import pytest

from datasets.upload_parser import parse_and_ingest
from interactions.models import Interaction, InteractionParticipant
from psicquic.mitab import format_interaction

FIXTURE = Path(__file__).parent / "fixtures" / "intact_tab28_sample.tsv"


@pytest.fixture
def ingested(db):
    parse_and_ingest(FIXTURE.read_bytes(), dataset_name="IntAct sample")
    return Interaction.objects.all()


def test_the_fixture_really_is_46_column_tab28():
    rows = [r for r in FIXTURE.read_text().splitlines() if r and not r.startswith("#")]
    assert rows, "fixture is empty"
    assert all(len(r.split("\t")) == 46 for r in rows)


@pytest.mark.django_db
def test_the_first_row_is_not_swallowed_as_a_header(ingested):
    """The regression this fixture exists for.

    The parser skipped row 0 unconditionally. Our own export writes a '#'
    header so nothing looked wrong, but PSICQUIC returns MITAB with no header
    line, so uploading a file from IntAct silently dropped its first
    interaction. Row 1 of the fixture is Q90X96-Q90X95.
    """
    pairs = {
        frozenset([i.interactor_A.uniprot_id, i.interactor_B.uniprot_id])
        for i in ingested
    }
    assert frozenset(["Q90X96", "Q90X95"]) in pairs


@pytest.mark.django_db
def test_reciprocal_rows_collapse_to_one_interaction(ingested):
    # The file lists Q90X96/Q90X95 and Q90X95/Q90X96 as separate experiments.
    # openPIP stores a physical interaction once, undirected, so 5 rows become
    # 3 pairs. The later row is skipped whole — its own detection method and
    # roles are not merged in, which is a fidelity limit of dedup, not a bug.
    assert ingested.count() == 3


@pytest.mark.django_db
def test_experimental_roles_are_captured_from_a_real_file(ingested):
    # IntAct states bait/prey in columns 19/20; before InteractionParticipant
    # these were read past and dropped.
    roles = set(
        InteractionParticipant.objects.exclude(experimental_role=None).values_list(
            "experimental_role", flat=True
        )
    )
    assert {"0496", "0498"} & roles, f"no bait/prey captured, got {roles}"


@pytest.mark.django_db
def test_roles_survive_the_round_trip(ingested):
    interaction = ingested.first()
    cols = format_interaction(interaction, "tab28").split("\t")
    assert cols[20] == 'psi-mi:"MI:0326"(protein)'  # 21 interactor type
    assert cols[18].startswith('psi-mi:"MI:0'), cols[18]  # 19 experimental role


@pytest.mark.django_db
def test_quoted_multi_value_cells_do_not_break_the_parser(ingested):
    # IntAct's taxon cell is taxid:8355(xenla)|taxid:8355("Xenopus laevis (...)")
    # — quotes, parentheses and a pipe in one field. A hand-written fixture
    # would not have caught a quoting mistake; this one would.
    assert ingested.exists()
    for interaction in ingested:
        assert len(format_interaction(interaction, "tab28").split("\t")) == 46


@pytest.mark.django_db
def test_participants_stay_aligned_with_their_sides(ingested):
    # A reciprocal row names the same two proteins with A and B swapped. If it
    # were applied on top of the existing interaction it would silently invert
    # every bait and prey.
    for interaction in ingested:
        for participant in interaction.participants.all():
            expected = (
                interaction.interactor_A_id
                if participant.side == "A"
                else interaction.interactor_B_id
            )
            assert participant.protein_id == expected
