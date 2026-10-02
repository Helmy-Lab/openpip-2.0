from celery import shared_task

from proteins.ensembl import enrich_proteins_from_ensembl
from proteins.ncbi import enrich_organisms_from_ncbi
from proteins.uniprot import enrich_proteins_from_uniprot
from .upload_parser import process_line_batch, parse_and_ingest_csv

BATCH_SIZE = 300


@shared_task(bind=True)
def import_dataset_task(
    self,
    lines: list[str],
    dataset_name: str,
    interaction_status: str,
    category_id: int | None,
    fmt: str = "tab",
) -> dict:
    """
    Process a dataset import asynchronously.
    Supports PSI-MI TAB (fmt='tab') and simple CSV (fmt='csv').
    Splits TAB files into batches; CSV is processed in one pass.
    Enriches newly created proteins and organisms from external APIs after ingestion.
    Returns the final totals dict on SUCCESS.
    """
    if not lines:
        return {
            "progress": 100,
            "proteins_created": 0,
            "interactions_created": 0,
            "interactions_skipped": 0,
            "errors": [],
            "stage": "done",
        }

    if fmt == "csv":
        self.update_state(state="PROGRESS", meta={"progress": 0, "stage": "parsing"})
        file_bytes = "\n".join(lines).encode("utf-8")
        result = parse_and_ingest_csv(
            file_bytes, dataset_name, interaction_status, category_id
        )
        base = {
            "progress": 100,
            "proteins_created": result["proteins_created"],
            "interactions_created": result["interactions_created"],
            "interactions_skipped": result["interactions_skipped"],
            "errors": result["errors"],
        }
        new_protein_ids = result.get("new_protein_ids", [])
        new_organism_ids = result.get("new_organism_ids", [])
        _refresh_counts()
        _run_enrichment(self, base, new_protein_ids, new_organism_ids)
        return {**base, "stage": "done"}

    # TAB: batch processing with per-batch progress updates
    batches = [lines[i : i + BATCH_SIZE] for i in range(0, len(lines), BATCH_SIZE)]
    totals = {
        "proteins_created": 0,
        "interactions_created": 0,
        "interactions_skipped": 0,
        "errors": [],
    }
    all_new_protein_ids: list[int] = []
    all_new_organism_ids: list[int] = []

    for i, batch in enumerate(batches):
        result = process_line_batch(
            batch, dataset_name, interaction_status, category_id
        )
        totals["proteins_created"] += result.get("proteins_created", 0)
        totals["interactions_created"] += result.get("interactions_created", 0)
        totals["interactions_skipped"] += result.get("interactions_skipped", 0)
        if result.get("errors"):
            totals["errors"].extend(result["errors"])
        all_new_protein_ids.extend(result.get("new_protein_ids", []))
        all_new_organism_ids.extend(result.get("new_organism_ids", []))

        progress = round(((i + 1) / len(batches)) * 100)
        self.update_state(
            state="PROGRESS",
            meta={**totals, "progress": progress, "stage": "parsing"},
        )

    base = {**totals, "progress": 100}
    _refresh_counts()
    _run_enrichment(self, base, all_new_protein_ids, all_new_organism_ids)
    return {**base, "stage": "done"}


def _refresh_counts() -> None:
    # Imported here: views imports this module, so a top-level import is circular.
    from .views import _refresh_dataset_counts

    _refresh_dataset_counts()


def _run_enrichment(
    task,
    base: dict,
    new_protein_ids: list[int],
    new_organism_ids: list[int],
) -> None:
    """Emit stage states and call all three enrichment functions."""
    task.update_state(state="PROGRESS", meta={**base, "stage": "enriching_uniprot"})
    _, uniprot_err = enrich_proteins_from_uniprot(new_protein_ids)
    if uniprot_err:
        task.update_state(
            state="PROGRESS", meta={**base, "stage": "enriching_uniprot_warn"}
        )

    task.update_state(state="PROGRESS", meta={**base, "stage": "enriching_ensembl"})
    _, ensembl_err = enrich_proteins_from_ensembl(new_protein_ids)
    if ensembl_err:
        task.update_state(
            state="PROGRESS", meta={**base, "stage": "enriching_ensembl_warn"}
        )

    task.update_state(state="PROGRESS", meta={**base, "stage": "enriching_organisms"})
    _, ncbi_err = enrich_organisms_from_ncbi(new_organism_ids)
    if ncbi_err:
        task.update_state(
            state="PROGRESS", meta={**base, "stage": "enriching_organisms_warn"}
        )
