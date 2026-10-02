import csv
import io
import logging
import os
import tempfile
import time
import zipfile
from pathlib import Path

from celery.result import AsyncResult

from django.conf import settings
from django.db.models import Count, OuterRef, Subquery
from django.http import FileResponse, Http404, StreamingHttpResponse
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView

from interactions.models import Interaction, InteractionCategory, InteractionDataset
from proteins.models import Identifier
from .models import Dataset
from .citation_lookup import CitationLookupError, fetch_by_doi, fetch_by_pubmed_id
from .serializers import (
    ABOUT_FIELDS,
    CITATION_FIELDS,
    PUBMED_RE,
    DatasetSerializer,
    DatasetWriteSerializer,
    format_citation,
)
from .upload_parser import (
    parse_and_ingest,
    fast_preview,
    process_line_batch,
    detect_format,
)
from .tasks import import_dataset_task

logger = logging.getLogger(__name__)


def as_bool(value) -> bool:
    """Multipart sends "false" as a string, which bool() reads as True."""
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _category_id(data) -> int | None:
    raw = data.get("category_id")
    if raw in (None, ""):
        return None
    try:
        category_id = int(raw)
    except (TypeError, ValueError):
        raise ValidationError({"category_id": "Must be a category id."})
    # The link is a deferred foreign key, so a missing category would only
    # fail when the whole import commits.
    if not InteractionCategory.objects.filter(pk=category_id).exists():
        raise ValidationError({"category_id": "No such category."})
    return category_id


def _reference_url(dataset) -> str | None:
    """Where a reader should be sent for the dataset's source publication."""
    if dataset.doi:
        return f"https://doi.org/{dataset.doi}"
    if dataset.pubmed_id:
        return f"https://pubmed.ncbi.nlm.nih.gov/{dataset.pubmed_id}/"
    return dataset.url or None


def _citation_header(dataset) -> list[str]:
    """Comment lines naming the source publication of an exported dataset."""
    reference = format_citation(dataset)
    lines = [f"# openPIP dataset: {dataset.name}\n"]
    if reference:
        lines.append(f"# Please cite: {reference}\n")
        url = _reference_url(dataset)
        if url:
            lines.append(f"# {url}\n")
    else:
        lines.append("# Unpublished dataset — please cite openPIP.\n")
    return lines


def _apply_dataset_metadata(dataset_name: str, data) -> dict | None:
    """Write any citation / About fields sent with an upload onto the dataset.

    The parser creates the Dataset by name, so this runs afterwards and updates
    that row. Returns validation errors, or None when there was nothing to do.
    """
    payload = {
        field: data[field]
        for field in (*CITATION_FIELDS, *ABOUT_FIELDS)
        if field in data and data[field] not in ("", None)
    }
    if not payload:
        return None

    dataset = Dataset.objects.filter(name=dataset_name).first()
    if not dataset:
        return None

    serializer = DatasetWriteSerializer(dataset, data=payload, partial=True)
    if not serializer.is_valid():
        return serializer.errors
    serializer.save()
    return None


def _archive_path() -> Path:
    # Under MEDIA_ROOT for the persistent volume; not one of the public media
    # folders, so it is only reachable through DatasetArchiveDownloadView.
    return Path(settings.MEDIA_ROOT) / "cache" / "datasets.zip"


def _invalidate_archive() -> None:
    _archive_path().unlink(missing_ok=True)


def _refresh_dataset_counts() -> None:
    """Update number_of_interactions for all datasets from InteractionDataset records."""
    # Every import and dataset delete ends here, so it doubles as the point
    # where the cached all-datasets zip goes stale.
    _invalidate_archive()
    Dataset.objects.update(
        number_of_interactions=Subquery(
            InteractionDataset.objects.filter(dataset_id=OuterRef("pk"))
            .values("dataset_id")
            .annotate(c=Count("id"))
            .values("c")
        )
    )


class DatasetListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        datasets = Dataset.objects.all().order_by("id")
        return Response(DatasetSerializer(datasets, many=True).data)


class DatasetFileDownloadView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        dataset = Dataset.objects.filter(pk=pk).first()
        if not dataset:
            raise Http404

        fmt = request.query_params.get("fmt", "tab").lower()
        if fmt not in ("tab", "sif", "csv"):
            fmt = "tab"

        rows = (
            InteractionDataset.objects.filter(dataset_id=pk, interaction__removed="0")
            .select_related(
                "interaction__interactor_A",
                "interaction__interactor_B",
            )
            .only(
                "interaction__score",
                "interaction__interactor_A__uniprot_id",
                "interaction__interactor_A__gene_name",
                "interaction__interactor_B__uniprot_id",
                "interaction__interactor_B__gene_name",
            )
        )

        safe_name = dataset.name.replace(" ", "_") if dataset.name else f"dataset_{pk}"

        if fmt == "tab":
            content_type = "text/tab-separated-values"
            filename = f"{safe_name}.tab"
            body = self._generate_tab(rows, dataset)
        elif fmt == "sif":
            content_type = "text/plain"
            filename = f"{safe_name}.sif"
            body = self._generate_sif(rows)
        else:
            content_type = "text/csv"
            filename = f"{safe_name}.csv"
            body = self._generate_csv(rows, dataset)

        response = StreamingHttpResponse(body, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    def _generate_tab(self, rows, dataset):
        # "#" comments are legal in PSI-MI TAB and are skipped by our own upload
        # parser, so an exported file still re-imports cleanly.
        yield from _citation_header(dataset)
        header = (
            "#ID(s) interactor A\tID(s) interactor B\t"
            "Confidence value(s)\tPublication identifier(s)\n"
        )
        yield header
        pubmed = f"pubmed:{dataset.pubmed_id}" if dataset.pubmed_id else "-"
        for id_row in rows:
            ix = id_row.interaction
            a = ix.interactor_A
            b = ix.interactor_B
            uid_a = f"uniprotkb:{a.uniprot_id}" if a.uniprot_id else a.gene_name or "-"
            uid_b = f"uniprotkb:{b.uniprot_id}" if b.uniprot_id else b.gene_name or "-"
            score = f"score:{ix.score}" if ix.score else "-"
            yield f"{uid_a}\t{uid_b}\t{score}\t{pubmed}\n"

    def _generate_sif(self, rows):
        for id_row in rows:
            ix = id_row.interaction
            a = ix.interactor_A
            b = ix.interactor_B
            name_a = a.gene_name or a.uniprot_id or str(a.pk)
            name_b = b.gene_name or b.uniprot_id or str(b.pk)
            yield f"{name_a}\tinteracts\t{name_b}\n"

    def _generate_csv(self, rows, dataset):
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            ["gene_a", "gene_b", "uniprot_a", "uniprot_b", "score", "dataset"]
        )
        yield buf.getvalue()
        for id_row in rows:
            ix = id_row.interaction
            a = ix.interactor_A
            b = ix.interactor_B
            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow(
                [
                    a.gene_name or "",
                    b.gene_name or "",
                    a.uniprot_id or "",
                    b.uniprot_id or "",
                    ix.score or "",
                    dataset.name or "",
                ]
            )
            yield buf.getvalue()


class DatasetArchiveDownloadView(APIView):
    permission_classes = [AllowAny]

    # Built once and served from disk until data changes, rather than
    # rebuilding every dataset in memory per anonymous request.
    # ponytail: a change landing mid-build can leave that build's stale zip in
    # place until the next import or edit; version the cache if that matters.
    def get(self, request):
        path = _archive_path()
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".zip.tmp")
            try:
                with os.fdopen(fd, "wb") as f:
                    self._write_archive(f)
                os.replace(tmp, path)  # atomic: no reader sees a half-written zip
            except BaseException:
                os.unlink(tmp)
                raise
        return FileResponse(
            path.open("rb"), as_attachment=True, filename="datasets.zip"
        )

    def _write_archive(self, f) -> None:
        datasets = Dataset.objects.all()
        with zipfile.ZipFile(f, "w", zipfile.ZIP_DEFLATED) as zf:
            for ds in datasets:
                rows = (
                    InteractionDataset.objects.filter(
                        dataset=ds, interaction__removed="0"
                    )
                    .select_related(
                        "interaction__interactor_A", "interaction__interactor_B"
                    )
                    .only(
                        "interaction__score",
                        "interaction__interactor_A__uniprot_id",
                        "interaction__interactor_A__gene_name",
                        "interaction__interactor_B__uniprot_id",
                        "interaction__interactor_B__gene_name",
                    )
                )
                safe_name = ds.name.replace(" ", "_") if ds.name else f"dataset_{ds.id}"
                pubmed = f"pubmed:{ds.pubmed_id}" if ds.pubmed_id else "-"
                lines = [
                    *_citation_header(ds),
                    "#ID(s) interactor A\tID(s) interactor B\t"
                    "Confidence value(s)\tPublication identifier(s)\n",
                ]
                for id_row in rows:
                    ix = id_row.interaction
                    a = ix.interactor_A
                    b = ix.interactor_B
                    uid_a = (
                        f"uniprotkb:{a.uniprot_id}"
                        if a.uniprot_id
                        else a.gene_name or "-"
                    )
                    uid_b = (
                        f"uniprotkb:{b.uniprot_id}"
                        if b.uniprot_id
                        else b.gene_name or "-"
                    )
                    score = f"score:{ix.score}" if ix.score else "-"
                    lines.append(f"{uid_a}\t{uid_b}\t{score}\t{pubmed}\n")
                zf.writestr(f"{safe_name}.tab", "".join(lines))


class UploadView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response(
                {"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST
            )
        file_bytes = uploaded_file.read()
        result = parse_and_ingest(file_bytes, dataset_name="")
        return Response(result)


class ProteinCheckView(APIView):
    """Batch lookup: given a list of raw PSI-MI identifiers, return how many exist in the DB."""

    permission_classes = [IsAdminUser]

    def post(self, request):
        raw_ids = request.data.get("identifiers", [])
        if not isinstance(raw_ids, list) or not raw_ids:
            return Response({"existing": 0})

        clean_ids = [
            (r.split(":", 1)[1].strip() if ":" in r else r.strip()) for r in raw_ids
        ]
        t0 = time.monotonic()
        existing = Identifier.objects.filter(identifier__in=clean_ids).count()
        elapsed = (time.monotonic() - t0) * 1000
        logger.debug(
            "check-proteins: %d queried → %d existing, %d new  (%.1f ms)",
            len(clean_ids),
            existing,
            len(clean_ids) - existing,
            elapsed,
        )
        return Response({"existing": existing})


class DatasetPreviewView(APIView):
    """Dry-run parse: returns counts without writing anything to the database."""

    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser]

    def post(self, request):
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response(
                {"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST
            )
        if not request.data.get("dataset_name", "").strip():
            return Response(
                {"detail": "dataset_name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file_bytes = uploaded_file.read()
        result = fast_preview(file_bytes)
        return Response(result, status=status.HTTP_200_OK)


class DatasetUploadView(APIView):
    """Full ingest: parses and writes all rows to the database."""

    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser]

    def post(self, request):
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response(
                {"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST
            )
        dataset_name = request.data.get("dataset_name", "").strip()
        if not dataset_name:
            return Response(
                {"detail": "dataset_name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        interaction_status = request.data.get("interaction_status", "published")
        category_id = _category_id(request.data)

        file_bytes = uploaded_file.read()
        result = parse_and_ingest(
            file_bytes,
            dataset_name=dataset_name,
            interaction_status=interaction_status,
            category_id=category_id,
            dry_run=False,
        )
        errors = _apply_dataset_metadata(dataset_name, request.data)
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)
        _refresh_dataset_counts()
        logger.debug("upload complete — refreshed dataset interaction counts")
        return Response(result, status=status.HTTP_201_CREATED)


class DatasetUploadRowsView(APIView):
    """Batched ingest: accepts pre-parsed TSV lines as JSON for progress-bar imports."""

    permission_classes = [IsAdminUser]

    def post(self, request):
        lines = request.data.get("lines", [])
        dataset_name = request.data.get("dataset_name", "").strip()
        if not dataset_name:
            return Response(
                {"detail": "dataset_name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not isinstance(lines, list) or not lines:
            return Response(
                {"detail": "lines must be a non-empty list."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        interaction_status = request.data.get("interaction_status", "published")
        category_id = _category_id(request.data)
        is_last_batch = as_bool(request.data.get("is_last_batch", False))

        t0 = time.monotonic()
        result = process_line_batch(
            lines, dataset_name, interaction_status, category_id
        )
        elapsed = (time.monotonic() - t0) * 1000

        logger.debug(
            "upload-rows: %d lines → %d interactions created, %d skipped, %d errors  (%.0f ms)%s",
            len(lines),
            result["interactions_created"],
            result["interactions_skipped"],
            len(result["errors"]),
            elapsed,
            "  [last batch — refreshing counts]" if is_last_batch else "",
        )
        if result["errors"]:
            logger.warning(
                "upload-rows first error (row %d): %s",
                result["errors"][0]["row"],
                result["errors"][0]["reason"],
            )

        if is_last_batch:
            _apply_dataset_metadata(dataset_name, request.data)
            _refresh_dataset_counts()

        return Response(result, status=status.HTTP_201_CREATED)


class DatasetDetailView(APIView):
    """Read, edit, or delete a single dataset.

    PATCH is how citation details and About-page copy get onto datasets that
    were imported before either existed — the upload wizard can only ever
    capture them for new imports.
    """

    permission_classes = [IsAdminUser]

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return super().get_permissions()

    def get(self, request, pk):
        dataset = Dataset.objects.filter(pk=pk).first()
        if not dataset:
            raise Http404
        return Response(DatasetSerializer(dataset).data)

    def patch(self, request, pk):
        dataset = Dataset.objects.filter(pk=pk).first()
        if not dataset:
            raise Http404

        serializer = DatasetWriteSerializer(dataset, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        _invalidate_archive()  # each file carries its dataset's citation header

        logger.debug(
            "dataset %d updated — fields: %s", pk, ", ".join(sorted(request.data))
        )
        return Response(DatasetSerializer(dataset).data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        from django.db import transaction as db_transaction

        dataset = Dataset.objects.filter(pk=pk).first()
        if not dataset:
            raise Http404

        with db_transaction.atomic():
            # Collect interaction IDs linked only to this dataset before deleting
            orphan_ids = list(
                InteractionDataset.objects.filter(dataset_id=pk)
                .values_list("interaction_id", flat=True)
                .difference(
                    InteractionDataset.objects.filter(dataset_id=pk)
                    .values("interaction_id")
                    .filter(
                        interaction_id__in=InteractionDataset.objects.exclude(
                            dataset_id=pk
                        ).values("interaction_id")
                    )
                )
            )
            dataset.delete()  # cascades InteractionDataset rows
            orphaned_deleted = Interaction.objects.filter(pk__in=orphan_ids).delete()[0]
            _refresh_dataset_counts()

        logger.debug(
            "dataset %d deleted — %d orphaned interactions removed",
            pk,
            orphaned_deleted,
        )
        return Response(
            {"orphaned_interactions_deleted": orphaned_deleted},
            status=status.HTTP_200_OK,
        )


class CitationLookupView(APIView):
    """Resolve a PubMed ID or DOI into citation fields for the admin to accept.

    Purely a convenience for the edit form — nothing is written here, so the
    admin always sees what will be saved before it is saved.
    """

    permission_classes = [IsAdminUser]

    def get(self, request):
        pmid = (request.query_params.get("pubmed_id") or "").strip()
        doi = (request.query_params.get("doi") or "").strip()

        if not pmid and not doi:
            return Response(
                {"detail": "Provide either pubmed_id or doi."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            if pmid:
                if not PUBMED_RE.match(pmid):
                    return Response(
                        {"detail": "A PubMed ID must be digits only, e.g. 25416956."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                result = fetch_by_pubmed_id(pmid)
            else:
                result = fetch_by_doi(doi)
        except CitationLookupError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response(result, status=status.HTTP_200_OK)


class AsyncImportView(APIView):
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser]

    def post(self, request):
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response(
                {"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST
            )

        dataset_name = request.data.get("dataset_name", "").strip()
        if not dataset_name:
            return Response(
                {"detail": "dataset_name required."}, status=status.HTTP_400_BAD_REQUEST
            )

        interaction_status = request.data.get("interaction_status", "published")
        category_id = _category_id(request.data)

        file_bytes = file_obj.read()
        fmt = detect_format(file_obj.name or "", file_bytes)
        text = file_bytes.decode("utf-8", errors="replace")

        if fmt == "csv":
            lines = [line for line in text.splitlines() if line.strip()]
        else:
            lines = [
                line
                for line in text.splitlines()
                if line.strip() and not line.startswith("#")
            ]

        # Create the dataset up front so citation details can be validated and
        # stored before the import is handed to Celery — a bad PMID should fail
        # the request, not surface as a mystery halfway through a long import.
        # The task's own get_or_create then finds this row rather than making one.
        Dataset.objects.get_or_create(
            name=dataset_name, defaults={"interaction_status": interaction_status}
        )
        errors = _apply_dataset_metadata(dataset_name, request.data)
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        task = import_dataset_task.delay(
            lines, dataset_name, interaction_status, category_id, fmt=fmt
        )
        return Response({"task_id": task.id}, status=status.HTTP_202_ACCEPTED)


class AsyncImportStatusView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, task_id: str):
        result = AsyncResult(task_id)
        state = result.state

        if state == "SUCCESS":
            data = result.result or {}
        elif state == "FAILURE":
            data = {"error": str(result.info)}
        elif state in ("PROGRESS", "STARTED"):
            data = result.info or {}
        else:
            data = {}

        return Response(
            {
                "task_id": task_id,
                "status": state,
                "stage": data.get("stage", None),
                "progress": data.get("progress", 0),
                "proteins_created": data.get("proteins_created", 0),
                "interactions_created": data.get("interactions_created", 0),
                "interactions_skipped": data.get("interactions_skipped", 0),
                "errors": data.get("errors", []),
            }
        )
