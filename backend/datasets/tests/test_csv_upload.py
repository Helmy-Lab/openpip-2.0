"""TDD tests for CSV upload format support."""

import pytest
from proteins.tests.factories import (
    ProteinFactory,
    IdentifierFactory,
    ProteinIdentifierFactory,
)
from interactions.models import Interaction

MINIMAL_CSV = b"protein_a,protein_b\nuniprotkb:P12345,uniprotkb:P67890\n"

FULL_CSV = (
    b"protein_a,protein_b,score,pubmed_id\n"
    b"uniprotkb:P12345,uniprotkb:P67890,0.82,32000001\n"
    b"uniprotkb:P11111,uniprotkb:P22222,0.60,\n"
)

GENE_CSV = b"protein_a,protein_b\nBRCA1,TP53\n"


# ── detect_format ─────────────────────────────────────────────────────────────


def test_detect_format_tab_file():
    from datasets.upload_parser import detect_format

    assert detect_format("data.tab", b"col1\tcol2\n") == "tab"


def test_detect_format_tsv_file():
    from datasets.upload_parser import detect_format

    assert detect_format("data.tsv", b"col1\tcol2\n") == "tab"


def test_detect_format_csv_by_extension():
    from datasets.upload_parser import detect_format

    assert detect_format("data.csv", b"protein_a,protein_b\n") == "csv"


def test_detect_format_csv_by_content_when_no_extension():
    from datasets.upload_parser import detect_format

    assert detect_format("data.dat", b"protein_a,protein_b\nP1,P2\n") == "csv"


# ── parse_and_ingest_csv ──────────────────────────────────────────────────────


@pytest.mark.django_db
def test_csv_creates_proteins_and_interaction():
    from datasets.upload_parser import parse_and_ingest_csv

    result = parse_and_ingest_csv(
        MINIMAL_CSV, dataset_name="TestDS", interaction_status="published"
    )

    assert result["proteins_created"] == 2
    assert result["interactions_created"] == 1
    assert result["errors"] == []


@pytest.mark.django_db
def test_csv_uses_score_when_provided():
    from datasets.upload_parser import parse_and_ingest_csv

    parse_and_ingest_csv(
        FULL_CSV, dataset_name="TestDS", interaction_status="published"
    )

    ix = Interaction.objects.filter(removed="0").first()
    assert ix is not None
    assert ix.score == "0.82"


@pytest.mark.django_db
def test_csv_accepts_gene_name_identifiers():
    from datasets.upload_parser import parse_and_ingest_csv

    result = parse_and_ingest_csv(
        GENE_CSV, dataset_name="TestDS", interaction_status="published"
    )

    assert result["proteins_created"] == 2
    assert result["interactions_created"] == 1


@pytest.mark.django_db
def test_csv_dry_run_creates_nothing():
    from datasets.upload_parser import parse_and_ingest_csv

    result = parse_and_ingest_csv(
        MINIMAL_CSV, dataset_name="TestDS", interaction_status="published", dry_run=True
    )

    assert result["dry_run"] is True
    assert Interaction.objects.count() == 0


@pytest.mark.django_db
def test_csv_counts_existing_proteins():
    from datasets.upload_parser import parse_and_ingest_csv

    p = ProteinFactory(uniprot_id="P12345")
    ident = IdentifierFactory(identifier="P12345", naming_convention="uniprotkb")
    ProteinIdentifierFactory(protein=p, identifier=ident)

    result = parse_and_ingest_csv(
        MINIMAL_CSV, dataset_name="TestDS", interaction_status="published"
    )

    assert result["proteins_existing"] == 1
    assert result["proteins_created"] == 1


@pytest.mark.django_db
def test_csv_skips_rows_missing_required_columns():
    from datasets.upload_parser import parse_and_ingest_csv

    bad_csv = b"protein_a,protein_b\nuniprotkb:P12345,\n"
    result = parse_and_ingest_csv(
        bad_csv, dataset_name="TestDS", interaction_status="published"
    )

    assert result["interactions_created"] == 0


@pytest.mark.django_db
def test_csv_returns_new_protein_ids():
    from datasets.upload_parser import parse_and_ingest_csv

    result = parse_and_ingest_csv(
        MINIMAL_CSV, dataset_name="TestDS", interaction_status="published"
    )

    assert len(result["new_protein_ids"]) == 2


# ── task integration — fmt parameter ─────────────────────────────────────────


@pytest.mark.django_db
def test_task_accepts_fmt_parameter():
    """import_dataset_task should accept a fmt kwarg without error."""
    from unittest.mock import patch
    from django.test import override_settings
    from datasets.tasks import import_dataset_task

    settings_override = override_settings(
        CELERY_TASK_ALWAYS_EAGER=True,
        CELERY_TASK_EAGER_PROPAGATES=True,
        CELERY_RESULT_BACKEND="cache+memory://",
    )
    with settings_override:
        with (
            patch("datasets.tasks.process_line_batch") as mock_plb,
            patch(
                "datasets.tasks.enrich_proteins_from_uniprot", return_value=(0, False)
            ),
            patch(
                "datasets.tasks.enrich_proteins_from_ensembl", return_value=(0, False)
            ),
            patch("datasets.tasks.enrich_organisms_from_ncbi", return_value=(0, False)),
        ):
            mock_plb.return_value = {
                "proteins_created": 0,
                "interactions_created": 0,
                "interactions_skipped": 0,
                "errors": [],
                "new_protein_ids": [],
            }
            result = import_dataset_task.apply(
                args=[["line1"], "DS", "published", None],
                kwargs={"fmt": "tab"},
            )
    assert result.get()["progress"] == 100


@pytest.mark.django_db
def test_async_import_view_detects_csv_format(auth_client):
    """AsyncImportView passes fmt=csv to the task when a .csv file is uploaded."""
    from unittest.mock import patch, MagicMock
    from django.core.files.uploadedfile import SimpleUploadedFile

    csv_file = SimpleUploadedFile(
        "data.csv",
        b"protein_a,protein_b\nuniprotkb:P12345,uniprotkb:P67890\n",
        content_type="text/csv",
    )
    with patch("datasets.views.import_dataset_task.delay") as mock_delay:
        mock_delay.return_value = MagicMock(id="task-csv-1")
        response = auth_client.post(
            "/api/datasets/import-async",
            {
                "file": csv_file,
                "dataset_name": "TestDS",
                "interaction_status": "published",
            },
            format="multipart",
        )

    assert response.status_code == 202
    call_kwargs = mock_delay.call_args[1] if mock_delay.call_args[1] else {}
    call_args = mock_delay.call_args[0]
    # fmt should be passed — either as positional arg index 4 or kwarg
    assert "csv" in str(call_args) or call_kwargs.get("fmt") == "csv"


@pytest.mark.django_db
def test_csv_header_names_ignore_case_and_spaces():
    from datasets.upload_parser import parse_and_ingest_csv

    result = parse_and_ingest_csv(b"Protein_A, PROTEIN_B ,Score\nTP53,MDM2,0.9\n", "DS")
    assert result["interactions_created"] == 1
