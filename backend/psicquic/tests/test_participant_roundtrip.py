"""Import must not discard what export emits."""

import pytest

from datasets.upload_parser import parse_and_ingest
from interactions.models import Interaction, InteractionParticipant
from psicquic.mitab import format_interaction

HEADER = "#" + "\t".join(f"c{i}" for i in range(46))


def _row(**overrides) -> str:
    cells = ["-"] * 46
    cells[0] = "uniprotkb:P38398"
    cells[1] = "uniprotkb:P51587"
    cells[4] = "psi-mi:BRCA1(gene name)"
    cells[5] = "psi-mi:BRCA2(gene name)"
    cells[6] = 'psi-mi:"MI:0018"(two hybrid)'
    cells[9] = "taxid:9606(human)"
    cells[10] = "taxid:9606(human)"
    for idx, value in overrides.items():
        cells[int(idx)] = value
    return "\t".join(cells)


def _upload(row: str):
    parse_and_ingest((HEADER + "\n" + row + "\n").encode(), dataset_name="RoundTrip")
    return Interaction.objects.get()


@pytest.mark.django_db
def test_experimental_roles_survive_an_upload():
    # Before InteractionParticipant these columns were read past and dropped.
    interaction = _upload(
        _row(**{"18": 'psi-mi:"MI:0496"(bait)', "19": 'psi-mi:"MI:0498"(prey)'})
    )
    participants = {p.side: p for p in interaction.participants.all()}
    assert participants["A"].experimental_role == "0496"
    assert participants["B"].experimental_role == "0498"

    cols = format_interaction(interaction, "tab27").split("\t")
    assert cols[18] == 'psi-mi:"MI:0496"(bait)'
    assert cols[19] == 'psi-mi:"MI:0498"(prey)'


@pytest.mark.django_db
def test_free_text_columns_survive_an_upload():
    interaction = _upload(_row(**{"36": "binding-associated region:1-50", "38": "2"}))
    cols = format_interaction(interaction, "tab27").split("\t")
    assert cols[36] == "binding-associated region:1-50"
    assert cols[38] == "2"


@pytest.mark.django_db
def test_causal_columns_survive_an_upload():
    # openPIP generates no causal data, but it must not destroy uploaded causal
    # data either — that is the difference between "we hold none" and "we lose it".
    interaction = _upload(_row(**{"42": 'psi-mi:"MI:2240"(down regulates)'}))
    cols = format_interaction(interaction, "tab28").split("\t")
    assert cols[42] == 'psi-mi:"MI:2240"'  # code kept; label unknown to us


@pytest.mark.django_db
def test_absent_columns_stay_null_not_defaulted():
    # "the file did not say" must stay distinguishable from a recorded
    # MI:0499 unspecified role.
    interaction = _upload(_row())
    participant = interaction.participants.get(side=InteractionParticipant.SIDE_A)
    assert participant.biological_role is None
    assert participant.experimental_role is None
    # The export still falls back to a sensible cell rather than a blank.
    cols = format_interaction(interaction, "tab27").split("\t")
    assert cols[16] == 'psi-mi:"MI:0499"(unspecified role)'


@pytest.mark.django_db
def test_participants_point_at_the_right_side():
    interaction = _upload(_row())
    participants = {p.side: p for p in interaction.participants.all()}
    assert participants["A"].protein_id == interaction.interactor_A_id
    assert participants["B"].protein_id == interaction.interactor_B_id


@pytest.mark.django_db
def test_a_stated_interaction_type_beats_our_inference():
    # The depositor describes their own experiment. openPIP reading the evidence
    # differently would overwrite their claim with ours — the same rule taxonomy
    # follows, where a taxon in the file beats the UniProt lookup.
    interaction = _upload(_row(**{"11": 'psi-mi:"MI:0407"(direct interaction)'}))
    assert interaction.interaction_type == "0407"

    cols = format_interaction(interaction, "tab27").split("\t")
    assert cols[11] == 'psi-mi:"MI:0407"(direct interaction)'


@pytest.mark.django_db
def test_an_unstated_type_is_left_to_the_inference_path():
    # Nothing stated and no Y2H constructs to reason from, so "-" is the honest
    # answer. The inference itself is covered by the Y2H tests in test_mitab.
    interaction = _upload(_row())
    assert interaction.interaction_type is None
    assert format_interaction(interaction, "tab27").split("\t")[11] == "-"


@pytest.mark.django_db
def test_a_stated_type_we_have_no_label_for_still_round_trips():
    interaction = _upload(_row(**{"11": 'psi-mi:"MI:9999"(some new term)'}))
    cols = format_interaction(interaction, "tab27").split("\t")
    assert cols[11] == 'psi-mi:"MI:9999"'
