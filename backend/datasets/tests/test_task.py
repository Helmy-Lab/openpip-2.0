"""Unit tests for import_dataset_task."""

from unittest.mock import patch

import pytest

from django.test import override_settings

from datasets.tasks import import_dataset_task

# The task refreshes dataset counts after every import.
pytestmark = pytest.mark.django_db


def _make_batch_result(
    proteins=2,
    interactions=5,
    skipped=0,
    errors=None,
    new_protein_ids=None,
    new_organism_ids=None,
):
    return {
        "proteins_created": proteins,
        "interactions_created": interactions,
        "interactions_skipped": skipped,
        "errors": errors or [],
        "new_protein_ids": new_protein_ids or [],
        "new_organism_ids": new_organism_ids or [],
    }


EAGER = override_settings(
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
    CELERY_RESULT_BACKEND="cache+memory://",
)


@EAGER
def test_task_empty_lines_returns_zeros_without_calling_parser():
    with patch("datasets.tasks.process_line_batch") as mock_plb:
        result = import_dataset_task.apply(args=[[], "TestDS", "published", None])
        data = result.get()
    mock_plb.assert_not_called()
    assert data["proteins_created"] == 0
    assert data["interactions_created"] == 0
    assert data["progress"] == 100
    assert data["stage"] == "done"


@EAGER
def test_task_accumulates_totals_across_batches():
    lines = [f"line{i}" for i in range(10)]
    with patch("datasets.tasks.process_line_batch") as mock_plb, patch(
        "datasets.tasks.enrich_proteins_from_uniprot", return_value=(0, False)
    ), patch(
        "datasets.tasks.enrich_proteins_from_ensembl", return_value=(0, False)
    ), patch(
        "datasets.tasks.enrich_organisms_from_ncbi", return_value=(0, False)
    ):
        mock_plb.return_value = _make_batch_result(proteins=3, interactions=4)
        result = import_dataset_task.apply(args=[lines, "TestDS", "published", None])
        data = result.get()

    assert mock_plb.call_count == 1
    assert data["proteins_created"] == 3
    assert data["interactions_created"] == 4
    assert data["progress"] == 100
    assert data["stage"] == "done"


@EAGER
def test_task_accumulates_across_multiple_batches():
    lines = [f"line{i}" for i in range(10)]
    with patch("datasets.tasks.process_line_batch") as mock_plb, patch(
        "datasets.tasks.BATCH_SIZE", 3
    ), patch(
        "datasets.tasks.enrich_proteins_from_uniprot", return_value=(0, False)
    ), patch(
        "datasets.tasks.enrich_proteins_from_ensembl", return_value=(0, False)
    ), patch(
        "datasets.tasks.enrich_organisms_from_ncbi", return_value=(0, False)
    ):
        mock_plb.return_value = _make_batch_result(proteins=1, interactions=2)
        result = import_dataset_task.apply(args=[lines, "TestDS", "published", None])
        data = result.get()

    assert mock_plb.call_count == 4
    assert data["proteins_created"] == 4
    assert data["interactions_created"] == 8
    assert data["progress"] == 100


@EAGER
def test_task_collects_errors_from_all_batches():
    lines = [f"line{i}" for i in range(6)]
    with patch("datasets.tasks.process_line_batch") as mock_plb, patch(
        "datasets.tasks.BATCH_SIZE", 3
    ), patch(
        "datasets.tasks.enrich_proteins_from_uniprot", return_value=(0, False)
    ), patch(
        "datasets.tasks.enrich_proteins_from_ensembl", return_value=(0, False)
    ), patch(
        "datasets.tasks.enrich_organisms_from_ncbi", return_value=(0, False)
    ):
        mock_plb.return_value = _make_batch_result(errors=[{"row": 1, "reason": "bad"}])
        result = import_dataset_task.apply(args=[lines, "TestDS", "published", None])
        data = result.get()

    assert len(data["errors"]) == 2


@EAGER
def test_task_passes_category_id_to_parser():
    lines = ["line1"]
    with patch("datasets.tasks.process_line_batch") as mock_plb, patch(
        "datasets.tasks.enrich_proteins_from_uniprot", return_value=(0, False)
    ), patch(
        "datasets.tasks.enrich_proteins_from_ensembl", return_value=(0, False)
    ), patch(
        "datasets.tasks.enrich_organisms_from_ncbi", return_value=(0, False)
    ):
        mock_plb.return_value = _make_batch_result()
        import_dataset_task.apply(args=[lines, "TestDS", "published", 42])

    mock_plb.assert_called_once()
    assert mock_plb.call_args[0][3] == 42


@EAGER
def test_task_calls_all_three_enrichment_functions():
    lines = ["line1"]
    with patch("datasets.tasks.process_line_batch") as mock_plb, patch(
        "datasets.tasks.enrich_proteins_from_uniprot", return_value=(2, False)
    ) as mock_uni, patch(
        "datasets.tasks.enrich_proteins_from_ensembl", return_value=(1, False)
    ) as mock_ens, patch(
        "datasets.tasks.enrich_organisms_from_ncbi", return_value=(1, False)
    ) as mock_ncbi:
        mock_plb.return_value = {
            "proteins_created": 2,
            "interactions_created": 1,
            "interactions_skipped": 0,
            "errors": [],
            "new_protein_ids": [10, 11],
            "new_organism_ids": [5],
        }
        import_dataset_task.apply(args=[lines, "TestDS", "published", None])

    mock_uni.assert_called_once_with([10, 11])
    mock_ens.assert_called_once_with([10, 11])
    mock_ncbi.assert_called_once_with([5])


@EAGER
def test_task_batch_update_state_includes_stage_parsing():
    lines = [f"line{i}" for i in range(6)]
    with patch("datasets.tasks.process_line_batch") as mock_plb, patch(
        "datasets.tasks.BATCH_SIZE", 3
    ), patch(
        "datasets.tasks.enrich_proteins_from_uniprot", return_value=(0, False)
    ), patch(
        "datasets.tasks.enrich_proteins_from_ensembl", return_value=(0, False)
    ), patch(
        "datasets.tasks.enrich_organisms_from_ncbi", return_value=(0, False)
    ):
        mock_plb.return_value = _make_batch_result()
        with patch.object(import_dataset_task, "update_state") as mock_us:
            import_dataset_task.apply(args=[lines, "TestDS", "published", None])

    # First 2 calls are batch progress; all should have stage="parsing"
    batch_calls = [
        c for c in mock_us.call_args_list if c.kwargs["meta"].get("stage") == "parsing"
    ]
    assert len(batch_calls) == 2


@EAGER
def test_task_emits_enrichment_stage_states():
    """update_state is called with each enrichment stage name."""
    lines = ["line1"]
    with patch("datasets.tasks.process_line_batch") as mock_plb, patch(
        "datasets.tasks.enrich_proteins_from_uniprot", return_value=(0, False)
    ), patch(
        "datasets.tasks.enrich_proteins_from_ensembl", return_value=(0, False)
    ), patch(
        "datasets.tasks.enrich_organisms_from_ncbi", return_value=(0, False)
    ):
        mock_plb.return_value = _make_batch_result()
        with patch.object(import_dataset_task, "update_state") as mock_us:
            import_dataset_task.apply(args=[lines, "TestDS", "published", None])

    stages_emitted = [c.kwargs["meta"]["stage"] for c in mock_us.call_args_list]
    assert "enriching_uniprot" in stages_emitted
    assert "enriching_ensembl" in stages_emitted
    assert "enriching_organisms" in stages_emitted


@EAGER
def test_task_emits_warn_stage_when_enrichment_has_error():
    lines = ["line1"]
    with patch("datasets.tasks.process_line_batch") as mock_plb, patch(
        "datasets.tasks.enrich_proteins_from_uniprot", return_value=(0, True)
    ), patch(
        "datasets.tasks.enrich_proteins_from_ensembl", return_value=(0, False)
    ), patch(
        "datasets.tasks.enrich_organisms_from_ncbi", return_value=(0, False)
    ):
        mock_plb.return_value = _make_batch_result()
        with patch.object(import_dataset_task, "update_state") as mock_us:
            import_dataset_task.apply(args=[lines, "TestDS", "published", None])

    stages_emitted = [c.kwargs["meta"]["stage"] for c in mock_us.call_args_list]
    assert "enriching_uniprot_warn" in stages_emitted


@EAGER
def test_task_refreshes_dataset_interaction_counts():
    """The sync upload views refresh counts; the async path used to leave them
    stale, so a dataset credited by an overlap showed its old number."""
    from datasets.models import Dataset

    lines = ["uniprotkb:P00001\tuniprotkb:P00002", "uniprotkb:P00003\tuniprotkb:P00004"]
    with patch(
        "datasets.tasks.enrich_proteins_from_uniprot", return_value=(0, False)
    ), patch(
        "datasets.tasks.enrich_proteins_from_ensembl", return_value=(0, False)
    ), patch(
        "datasets.tasks.enrich_organisms_from_ncbi", return_value=(0, False)
    ):
        import_dataset_task.apply(args=[lines, "AsyncDS", "published", None]).get()

    assert str(Dataset.objects.get(name="AsyncDS").number_of_interactions) == "2"
