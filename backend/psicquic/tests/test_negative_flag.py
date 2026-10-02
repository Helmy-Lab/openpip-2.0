"""MITAB column 36: a reported non-interaction must not come back out positive."""

import pytest

from datasets.upload_parser import parse_and_ingest
from interactions.models import Interaction
from psicquic.mitab import format_interaction

HEADER = "#" + "\t".join(f"c{i}" for i in range(46))


def _file(negative_cell: str, a: str = "P38398", b: str = "P51587") -> bytes:
    cells = ["-"] * 46
    cells[0], cells[1] = f"uniprotkb:{a}", f"uniprotkb:{b}"
    cells[35] = negative_cell
    return (HEADER + "\n" + "\t".join(cells) + "\n").encode()


@pytest.mark.django_db
def test_a_negative_interaction_stays_negative():
    # The bug: the column was never read and the formatter hardcoded "false",
    # so uploading a reported non-interaction re-published it as a positive
    # claim — the opposite of what the depositor said.
    parse_and_ingest(_file("true"), dataset_name="Negatives")
    interaction = Interaction.objects.get()

    assert interaction.negative is True
    assert format_interaction(interaction, "tab28").split("\t")[35] == "true"


@pytest.mark.django_db
@pytest.mark.parametrize("cell", ["false", "-", "", "FALSE", "no"])
def test_anything_but_an_explicit_true_is_positive(cell):
    # MITAB has no "unstated" here: a row saying nothing is a positive finding.
    parse_and_ingest(_file(cell), dataset_name="Positives")
    interaction = Interaction.objects.get()

    assert interaction.negative is False
    assert format_interaction(interaction, "tab28").split("\t")[35] == "false"


@pytest.mark.django_db
@pytest.mark.parametrize("cell", ["true", "TRUE", "True", "yes", "1"])
def test_the_spellings_a_real_file_might_use(cell):
    parse_and_ingest(_file(cell), dataset_name="Negatives")
    assert Interaction.objects.get().negative is True


@pytest.mark.django_db
def test_a_short_file_that_stops_before_column_36_is_positive():
    # A TAB 2.5 file has 15 columns; the flag is absent, not false-by-omission
    # of a column that exists.
    row = "\t".join(["uniprotkb:P38398", "uniprotkb:P51587"] + ["-"] * 13)
    parse_and_ingest((HEADER + "\n" + row + "\n").encode(), dataset_name="Short")
    interaction = Interaction.objects.get()

    assert interaction.negative is False
    assert format_interaction(interaction, "tab25").split("\t") != []
