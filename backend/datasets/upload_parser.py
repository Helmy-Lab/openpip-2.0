"""PSI-MI TAB 2.7 parser — mirrors legacy DataController::insertAction behavior."""

import csv
import io
import re

from django.db import transaction
from django.db.models import Q
from django.db.models.functions import Lower

from datasets.models import Dataset
from interactions.models import (
    AnnotationInteraction,
    Interaction,
    InteractionDataset,
    InteractionParticipant,
    InteractionInteractionCategory,
    InteractionSupportInformation,
    SupportInformation,
)
from proteins.models import (
    Annotation,
    Identifier,
    Organism,
    Protein,
    ProteinIdentifier,
    ProteinOrganism,
)

_MAX_ERRORS = 50

_CSV_EXTENSIONS = {".csv"}
_TAB_EXTENSIONS = {".tab", ".tsv", ".txt"}


def detect_format(filename: str, file_bytes: bytes) -> str:
    """Return 'csv' or 'tab' based on file extension, falling back to content sniff."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if f".{ext}" in _CSV_EXTENSIONS:
        return "csv"
    if f".{ext}" in _TAB_EXTENSIONS:
        return "tab"
    # Content sniff: if the first non-empty line has commas but no tabs → CSV
    first_line = file_bytes.split(b"\n")[0].decode("utf-8", errors="replace")
    if "," in first_line and "\t" not in first_line:
        return "csv"
    return "tab"


# psi-mi:"MI:1112"(two hybrid prey pooling approach)
_PSIMI_LABEL_RE = re.compile(r'psi-mi:"[^"]*"\(([^)]+)\)', re.IGNORECASE)
# The accession out of the same cell: psi-mi:"MI:0496"(bait) -> 0496
_PSIMI_CODE_RE = re.compile(r'psi-mi:"MI:(\d+)"', re.IGNORECASE)
# taxid:9606(human)
_TAXID_RE = re.compile(r"taxid:(\d+)\(([^)]+)\)")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_naming_convention(identifier: str) -> str:
    lower = identifier.lower()
    if lower.startswith("uniprotkb:") or lower.startswith("uniprot:"):
        return "uniprotkb"
    if lower.startswith("ensembl:"):
        return "ensembl"
    if lower.startswith("entrez gene:") or lower.startswith("entrez:"):
        return "entrez"
    return "gene_name"


def _strip_prefix(identifier: str) -> str:
    if ":" in identifier:
        return identifier.split(":", 1)[1].strip()
    return identifier.strip()


# Which Protein column holds an identifier of each naming convention.
_PROTEIN_COLUMN = {
    "uniprotkb": "uniprot_id",
    "ensembl": "ensembl_id",
    "entrez": "entrez_id",
    "gene_name": "gene_name",
}


def known_identifiers(identifiers) -> set[str]:
    """The given identifiers (prefixes already stripped) that an upload would
    match to an existing protein, lower-cased.

    Mirrors _protein_handler: case-insensitive, and checking the protein's own
    columns as well as the identifier table, so an upload preview counts what
    the import will actually find.
    """
    wanted = {i.strip().lower() for i in identifiers if i and i.strip()}
    if not wanted:
        return set()
    found = set(
        Identifier.objects.annotate(key=Lower("identifier"))
        .filter(key__in=wanted)
        .values_list("key", flat=True)
    )
    for column in _PROTEIN_COLUMN.values():
        missing = wanted - found
        if not missing:
            break
        found |= set(
            Protein.objects.annotate(key=Lower(column))
            .filter(key__in=missing)
            .values_list("key", flat=True)
        )
    return found


def _protein_handler(raw_id: str) -> tuple[Protein, bool]:
    """Resolve or create a Protein from a raw PSI-MI identifier string.

    Returns (protein, created). The identifier table is tried first, then the
    protein's own column for that kind of identifier: the original openPIP
    kept UniProt accessions on the protein row, not in the identifier table,
    so skipping the column made an upload in UniProt IDs create a second, empty
    protein beside every existing one (BUG-034).
    """
    clean_id = _strip_prefix(raw_id)
    naming_convention = _get_naming_convention(raw_id)

    identifier_obj = Identifier.objects.filter(identifier__iexact=clean_id).first()
    if identifier_obj:
        link = ProteinIdentifier.objects.filter(identifier=identifier_obj).first()
        if link:
            return link.protein, False

    column = _PROTEIN_COLUMN[naming_convention]
    protein = (
        Protein.objects.filter(**{f"{column}__iexact": clean_id}).order_by("id").first()
    )
    created = protein is None
    if created:
        protein = Protein.objects.create(
            uniprot_id=clean_id if naming_convention == "uniprotkb" else None,
            gene_name=clean_id if naming_convention == "gene_name" else None,
        )
    if identifier_obj is None:
        identifier_obj = Identifier.objects.create(
            identifier=clean_id,
            naming_convention=naming_convention,
        )
    ProteinIdentifier.objects.create(protein=protein, identifier=identifier_obj)
    return protein, created


def _existing_interaction(protein_a: Protein, protein_b: Protein):
    """The active interaction for this pair in either orientation, or None.

    Matched as (A, B) or (B, A): testing each side against [a, b] also matched
    an a-a self-interaction, so a-b was taken for a duplicate and never created.
    """
    return Interaction.objects.filter(
        Q(interactor_A=protein_a, interactor_B=protein_b)
        | Q(interactor_A=protein_b, interactor_B=protein_a),
        removed="0",
    ).first()


def _credit_dataset(interaction: Interaction, dataset) -> bool:
    """Link an existing interaction to this upload's dataset as well (legacy
    parity). True when the link is new, i.e. this dataset's evidence is too."""
    if dataset is None:
        return False
    return InteractionDataset.objects.get_or_create(
        interaction=interaction, dataset=dataset
    )[1]


def _add_category(interaction: Interaction, category_id: int | None) -> None:
    """Put the interaction in the upload's category, once. Applied to reused
    interactions as well as new ones, as legacy did (DataController.php)."""
    if category_id is not None:
        InteractionInteractionCategory.objects.get_or_create(
            interaction=interaction, interaction_category_id=category_id
        )


def _parse_psimi_label(raw: str) -> str | None:
    """Extract human-readable label from psi-mi:"MI:XXXX"(label) notation."""
    if not raw or raw.strip() == "-":
        return None
    m = _PSIMI_LABEL_RE.search(raw)
    return m.group(1).strip() if m else None


def _parse_taxon(raw: str) -> tuple[str, str] | None:
    """Return (taxonomy_id, name) from the first taxid token, or None."""
    if not raw or raw.strip() == "-":
        return None
    first_token = raw.split("|")[0].strip()
    m = _TAXID_RE.match(first_token)
    if m:
        return m.group(1), m.group(2)
    return None


def _parse_pubmed_id(pub_id_col: str) -> str | None:
    """Extract pubmed:NNNN from the publication identifier column."""
    if not pub_id_col or pub_id_col.strip() == "-":
        return None
    for token in pub_id_col.split("|"):
        token = token.strip()
        if token.lower().startswith("pubmed:"):
            return token.split(":", 1)[1].strip()
    return None


def _safe_col(row: list[str], idx: int) -> str:
    """Return stripped column value or empty string if index out of range."""
    if idx < len(row):
        return row[idx].strip()
    return ""


def _add_gene_name_aliases(protein: Protein, alias_col: str) -> None:
    """Parse alias column; add gene name identifiers not yet linked to protein."""
    if not alias_col or alias_col == "-":
        return
    for token in alias_col.split("|"):
        token = token.strip()
        if not token:
            continue
        # Match tokens like uniprotkb:SOMENAME(gene name)
        if "(gene name)" not in token.lower():
            continue
        # Strip trailing (gene name) qualifier
        name_part = re.sub(r"\([^)]*\)\s*$", "", token).strip()
        clean_name = _strip_prefix(name_part)
        if not clean_name:
            continue
        # Check if this identifier already exists and is linked to this protein
        existing = Identifier.objects.filter(identifier__iexact=clean_name).first()
        if existing:
            if ProteinIdentifier.objects.filter(
                protein=protein, identifier=existing
            ).exists():
                continue
            # Identifier exists but not linked to this protein — link it
            ProteinIdentifier.objects.create(protein=protein, identifier=existing)
        else:
            new_id = Identifier.objects.create(
                identifier=clean_name, naming_convention="gene_name"
            )
            ProteinIdentifier.objects.create(protein=protein, identifier=new_id)
        # Also update protein.gene_name if not set
        if not protein.gene_name:
            protein.gene_name = clean_name
            protein.save(update_fields=["gene_name"])


def _handle_taxon(protein: Protein, taxon_col: str) -> int | None:
    """Find-or-create Organism, link to protein, return organism.id if newly created."""
    parsed = _parse_taxon(taxon_col)
    if not parsed:
        return None
    taxonomy_id, name = parsed
    existing = Organism.objects.filter(taxonomy_id=taxonomy_id).first()
    if existing:
        ProteinOrganism.objects.get_or_create(protein=protein, organism=existing)
        return None
    organism, created = Organism.objects.get_or_create(
        taxonomy_id=taxonomy_id,
        defaults={"name": name},
    )
    ProteinOrganism.objects.get_or_create(protein=protein, organism=organism)
    return organism.id if created else None


def _handle_dataset(
    interaction: Interaction,
    author_col: str,
    pub_id_col: str,
    dataset_name: str,
    interaction_status: str,
) -> None:
    """Find-or-create Dataset by pubmed_id and link to interaction."""
    pubmed_id = _parse_pubmed_id(pub_id_col)
    if not pubmed_id:
        return
    dataset, _ = Dataset.objects.get_or_create(
        pubmed_id=pubmed_id,
        defaults={
            "name": dataset_name,
            "author": author_col.strip() if author_col and author_col != "-" else None,
            "interaction_status": interaction_status,
        },
    )
    InteractionDataset.objects.get_or_create(interaction=interaction, dataset=dataset)


def _parse_psimi_code(raw: str) -> str | None:
    """Extract the bare accession from psi-mi:"MI:0496"(bait) notation."""
    if not raw or raw.strip() == "-":
        return None
    match = _PSIMI_CODE_RE.search(raw)
    return match.group(1) if match else None


def _clean_cell(raw: str) -> str | None:
    """A free-text MITAB cell, or None when the file said nothing."""
    value = (raw or "").strip()
    return value or None if value != "-" else None


def _is_header_row(row: list[str]) -> bool:
    """True for a header line, which MITAB marks with a leading '#'.

    Row 0 used to be skipped unconditionally. Our own export writes a '#'
    header so that looked fine, but PSICQUIC services return MITAB with no
    header at all — so uploading a file fetched from IntAct silently lost its
    first interaction. Identifier cells are "db:id"; a header cell such as
    "ID(s) interactor A" has no colon, which separates the two cases without
    assuming a position.

    A missing colon alone is not enough, though: a bare gene name ("TP53") has
    none either, and treating it as a header dropped the row without a word.
    Header cells are column titles, so they hold a space or a bracket; neither
    an identifier nor a gene name ever does.
    """
    if not row or not row[0]:
        return False
    first = row[0].strip()
    if first.startswith("#"):
        return True
    return ":" not in first and any(c in first for c in " ()")


def _parse_negative(raw: str) -> bool:
    """MITAB column 36. True only when the file says so.

    A negative interaction is a reported non-interaction — an experiment that
    looked and found nothing. This column was not read at all while the
    formatter emitted a hardcoded "false", so an uploaded negative result came
    back out as a positive claim, which is worse than losing it.

    Anything that is not an explicit true reads as positive, matching MITAB:
    a row that says nothing about this column is a positive finding.
    """
    return (raw or "").strip().lower() in {"true", "yes", "1"}


def _handle_participants(interaction: Interaction, protein_a, protein_b, row) -> None:
    """Record each side's role from MITAB columns 17-22, 37-44.

    These columns were read and thrown away before InteractionParticipant
    existed, so an upload lost exactly the experimental detail openPIP exists to
    surface. Absent values stay NULL rather than being defaulted, so "the file
    did not say" stays distinguishable from a recorded MI:0499 unspecified role.

    The upload wizard shows admins which columns are read, in
    PSIMI_COLS_SPEC in frontend/src/features/admin/AdminDataPage.tsx. Teaching
    this function a new column means changing that list too: an admin told a
    column is ignored will not bother to include it, so a stale entry there
    quietly costs real data.
    """
    sides = (
        (InteractionParticipant.SIDE_A, protein_a, 16, 18, 20, 40, 42, 36, 38),
        (InteractionParticipant.SIDE_B, protein_b, 17, 19, 21, 41, 43, 37, 39),
    )
    for side, protein, bio, exp, itype, ident, effect, feat, stoich in sides:
        InteractionParticipant.objects.update_or_create(
            interaction=interaction,
            side=side,
            defaults={
                "protein": protein,
                "biological_role": _parse_psimi_code(_safe_col(row, bio)),
                "experimental_role": _parse_psimi_code(_safe_col(row, exp)),
                "interactor_type": _parse_psimi_code(_safe_col(row, itype)),
                "identification_method": _parse_psimi_code(_safe_col(row, ident)),
                "biological_effect": _parse_psimi_code(_safe_col(row, effect)),
                "features": _clean_cell(_safe_col(row, feat)),
                "stoichiometry": _clean_cell(_safe_col(row, stoich)),
            },
        )


def _handle_detection_method(interaction: Interaction, method_col: str) -> None:
    """Store detection method label as Annotation (type_name='experiment')."""
    label = _parse_psimi_label(method_col)
    if not label:
        return
    ann = Annotation.objects.create(
        type_name="experiment",
        annotation=label,
        identifier=str(interaction.pk),
    )
    AnnotationInteraction.objects.create(interaction=interaction, annotation=ann)


def _handle_interaction_annotations(interaction: Interaction, ann_col: str) -> None:
    """Parse col 27 pipe-separated key:value pairs into Annotation rows."""
    if not ann_col or ann_col.strip() == "-":
        return
    for token in ann_col.split("|"):
        token = token.strip()
        if not token or ":" not in token:
            continue
        key, value = token.split(":", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        ann = Annotation.objects.create(
            type_name=key,
            annotation=value,
            identifier=str(interaction.pk),
        )
        AnnotationInteraction.objects.create(interaction=interaction, annotation=ann)


def _handle_support_info(interaction: Interaction, support_col: str) -> None:
    """Parse cols 25/26 semicolon-separated Key:Value pairs into SupportInformation rows."""
    if not support_col or support_col.strip() == "-":
        return
    for token in support_col.split(";"):
        token = token.strip()
        if not token or ":" not in token:
            continue
        key, value = token.split(":", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        si, _ = SupportInformation.objects.get_or_create(name=key)
        InteractionSupportInformation.objects.create(
            interaction=interaction,
            support_information=si,
            value=value,
        )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def process_line_batch(
    lines: list[str],
    dataset_name: str,
    interaction_status: str = "published",
    category_id: int | None = None,
) -> dict:
    """
    Ingest a pre-parsed batch of raw TSV data lines (no header).
    Reuses parse_and_ingest by prepending a '#' header so the
    row-0 skip logic works correctly.
    Each batch is committed atomically; batches are not atomic to each other.
    """
    file_bytes = ("#\n" + "\n".join(lines)).encode("utf-8")
    return parse_and_ingest(
        file_bytes,
        dataset_name=dataset_name,
        interaction_status=interaction_status,
        category_id=category_id,
        dry_run=False,
    )


def fast_preview(file_bytes: bytes) -> dict:
    """
    Cheap preview: parse the file without writing anything to the database.
    Collects all unique protein identifiers, then does two bulk DB queries
    (existing / new) instead of one query per row.

    Returns the same shape as parse_and_ingest so the frontend type is shared.
    interactions_skipped is 0 (full dedup requires DB writes; not worth it for preview).
    """
    text = file_bytes.decode("utf-8", errors="replace")
    reader = csv.reader(io.StringIO(text), delimiter="\t")

    seen_pairs: set[tuple[str, str]] = set()
    all_raw_ids: list[str] = []
    total_rows = 0
    errors: list[dict] = []

    for row_num, row in enumerate(reader):
        if _is_header_row(row):
            continue
        if not row or len(row) < 2:
            continue

        raw_a = _safe_col(row, 0)
        raw_b = _safe_col(row, 1)
        if not raw_a or not raw_b:
            continue

        total_rows += 1
        key = (min(raw_a, raw_b), max(raw_a, raw_b))
        if key not in seen_pairs:
            seen_pairs.add(key)
            all_raw_ids.append(raw_a)
            if raw_a != raw_b:
                all_raw_ids.append(raw_b)

    unique_ids = {_strip_prefix(r).lower() for r in all_raw_ids}

    existing_lower = known_identifiers(unique_ids)

    proteins_existing = sum(1 for uid in unique_ids if uid in existing_lower)
    proteins_created = len(unique_ids) - proteins_existing

    return {
        "dry_run": True,
        "rows_sampled": None,
        "proteins_created": proteins_created,
        "proteins_existing": proteins_existing,
        "interactions_created": total_rows,
        "interactions_skipped": 0,
        "errors": errors,
    }


def parse_and_ingest(
    file_bytes: bytes,
    dataset_name: str,
    interaction_status: str = "published",
    category_id: int | None = None,
    dry_run: bool = False,
) -> dict:
    """
    Parse PSI-MI TAB 2.7 file bytes and ingest interactions.

    In dry_run mode the entire operation is wrapped in an atomic block that
    is explicitly rolled back before returning — so counts are accurate but
    nothing is written to the database. Dry-run is capped at _DRY_RUN_MAX_ROWS
    data rows to keep preview fast; rows_sampled in the response reflects this.

    Returns::

        {
            "dry_run": bool,
            "rows_sampled": int | None,   # None means full file was processed
            "proteins_created": int,
            "proteins_existing": int,
            "interactions_created": int,
            "interactions_skipped": int,
            "errors": [{"row": int, "reason": str}],
        }
    """
    proteins_created = 0
    proteins_existing = 0
    interactions_created = 0
    interactions_skipped = 0
    errors: list[dict] = []
    new_protein_ids: list[int] = []
    new_organism_ids: list[int] = []

    text = file_bytes.decode("utf-8", errors="replace")
    reader = csv.reader(io.StringIO(text), delimiter="\t")

    def _run() -> None:
        nonlocal proteins_created, proteins_existing, interactions_created
        nonlocal interactions_skipped

        # Create/find the dataset by name once — not per-row via pubmed_id
        named_dataset = None
        if dataset_name:
            named_dataset, _ = Dataset.objects.get_or_create(
                name=dataset_name,
                defaults={"interaction_status": interaction_status},
            )

        for row_num, row in enumerate(reader):
            # Skip header row (row 0 or first row where col 0 starts with #)
            if _is_header_row(row):
                continue
            if not row:
                continue
            if len(row) < 2:
                continue

            raw_a = _safe_col(row, 0)
            raw_b = _safe_col(row, 1)
            if not raw_a or not raw_b:
                continue

            sid = transaction.savepoint()
            try:
                # ── Proteins ────────────────────────────────────────────────
                protein_a, created_a = _protein_handler(raw_a)
                if created_a:
                    proteins_created += 1
                    if protein_a.id not in new_protein_ids:
                        new_protein_ids.append(protein_a.id)
                else:
                    proteins_existing += 1

                if raw_a == raw_b:
                    protein_b = protein_a
                else:
                    protein_b, created_b = _protein_handler(raw_b)
                    if created_b:
                        proteins_created += 1
                        if protein_b.id not in new_protein_ids:
                            new_protein_ids.append(protein_b.id)
                    else:
                        proteins_existing += 1

                # ── Aliases (cols 4+5) ──────────────────────────────────────
                _add_gene_name_aliases(protein_a, _safe_col(row, 4))
                if protein_b is not protein_a:
                    _add_gene_name_aliases(protein_b, _safe_col(row, 5))

                # ── Taxon (cols 9+10) ──────────────────────────────────────
                org_id = _handle_taxon(protein_a, _safe_col(row, 9))
                if org_id is not None and org_id not in new_organism_ids:
                    new_organism_ids.append(org_id)
                if protein_b is not protein_a:
                    org_id = _handle_taxon(protein_b, _safe_col(row, 10))
                    if org_id is not None and org_id not in new_organism_ids:
                        new_organism_ids.append(org_id)

                # ── Dedup ──────────────────────────────────────────────────
                # An overlap still credits this dataset and brings its evidence
                # along. The score is left alone: it came with the dataset that
                # created the interaction.
                existing = _existing_interaction(protein_a, protein_b)
                if existing:
                    if _credit_dataset(existing, named_dataset):
                        _handle_detection_method(existing, _safe_col(row, 6))
                        _handle_interaction_annotations(existing, _safe_col(row, 27))
                    _add_category(existing, category_id)
                    transaction.savepoint_commit(sid)
                    interactions_skipped += 1
                    continue

                # ── Score (col 14) ─────────────────────────────────────────
                score_raw = _safe_col(row, 14)
                score = None
                if score_raw and score_raw != "-":
                    first = score_raw.split("|")[0].strip()
                    raw_score = _strip_prefix(first)
                    score = raw_score[:10] if raw_score else None

                # ── Create Interaction ─────────────────────────────────────
                interaction = Interaction.objects.create(
                    interactor_A=protein_a,
                    interactor_B=protein_b,
                    score=score,
                    negative=_parse_negative(_safe_col(row, 35)),
                    # Column 12. Stored so the depositor's statement about their
                    # own experiment outranks the type openPIP would infer.
                    interaction_type=_parse_psimi_code(_safe_col(row, 11)),
                    removed="0",
                )
                interactions_created += 1

                # ── Dataset ────────────────────────────────────────────────
                if named_dataset:
                    InteractionDataset.objects.get_or_create(
                        interaction=interaction, dataset=named_dataset
                    )

                # ── Detection method (col 6) ───────────────────────────────
                _handle_detection_method(interaction, _safe_col(row, 6))
                _handle_participants(interaction, protein_a, protein_b, row)

                # ── Interaction annotations (col 27) ───────────────────────
                _handle_interaction_annotations(interaction, _safe_col(row, 27))

                # ── Support information (cols 25+26) ───────────────────────
                _handle_support_info(interaction, _safe_col(row, 25))
                if protein_b is not protein_a:
                    _handle_support_info(interaction, _safe_col(row, 26))

                # ── Category ───────────────────────────────────────────────
                _add_category(interaction, category_id)

                transaction.savepoint_commit(sid)

            except Exception as exc:  # noqa: BLE001
                transaction.savepoint_rollback(sid)
                if len(errors) < _MAX_ERRORS:
                    errors.append({"row": row_num, "reason": str(exc)})

    with transaction.atomic():
        _run()
        if dry_run:
            transaction.set_rollback(True)

    return {
        "dry_run": dry_run,
        "rows_sampled": None,
        "proteins_created": proteins_created,
        "proteins_existing": proteins_existing,
        "interactions_created": interactions_created,
        "interactions_skipped": interactions_skipped,
        "errors": errors,
        "new_protein_ids": [] if dry_run else new_protein_ids,
        "new_organism_ids": [] if dry_run else new_organism_ids,
    }


def parse_and_ingest_csv(
    file_bytes: bytes,
    dataset_name: str,
    interaction_status: str = "published",
    category_id: int | None = None,
    dry_run: bool = False,
) -> dict:
    """
    Parse a simple CSV interaction file and ingest interactions.

    Expected format (header required):
        protein_a,protein_b[,score]

    Header names are matched case-insensitively; other columns are ignored.

    Protein identifiers follow the same convention as PSI-MI TAB
    (e.g. ``uniprotkb:P12345`` or a bare gene name).
    Returns the same shape as parse_and_ingest().
    """
    proteins_created = 0
    proteins_existing = 0
    interactions_created = 0
    interactions_skipped = 0
    errors: list[dict] = []
    new_protein_ids: list[int] = []

    text = file_bytes.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    # The upload wizard accepts "Protein_A"; match it here too, or the file
    # passes that check and then loads nothing.
    if reader.fieldnames:
        reader.fieldnames = [name.strip().lower() for name in reader.fieldnames]

    def _run() -> None:
        nonlocal proteins_created, proteins_existing, interactions_created
        nonlocal interactions_skipped

        named_dataset = None
        if dataset_name:
            named_dataset, _ = Dataset.objects.get_or_create(
                name=dataset_name,
                defaults={"interaction_status": interaction_status},
            )

        for row_num, row in enumerate(reader, start=1):
            raw_a = (row.get("protein_a") or "").strip()
            raw_b = (row.get("protein_b") or "").strip()
            if not raw_a or not raw_b:
                continue

            sid = transaction.savepoint()
            try:
                protein_a, created_a = _protein_handler(raw_a)
                if created_a:
                    proteins_created += 1
                    if protein_a.id not in new_protein_ids:
                        new_protein_ids.append(protein_a.id)
                else:
                    proteins_existing += 1

                if raw_a == raw_b:
                    protein_b = protein_a
                else:
                    protein_b, created_b = _protein_handler(raw_b)
                    if created_b:
                        proteins_created += 1
                        if protein_b.id not in new_protein_ids:
                            new_protein_ids.append(protein_b.id)
                    else:
                        proteins_existing += 1

                existing = _existing_interaction(protein_a, protein_b)
                if existing:
                    _credit_dataset(existing, named_dataset)
                    _add_category(existing, category_id)
                    transaction.savepoint_commit(sid)
                    interactions_skipped += 1
                    continue

                score_raw = (row.get("score") or "").strip()
                score = score_raw[:10] if score_raw else None

                interaction = Interaction.objects.create(
                    interactor_A=protein_a,
                    interactor_B=protein_b,
                    score=score,
                    removed="0",
                )

                if named_dataset:
                    InteractionDataset.objects.get_or_create(
                        interaction=interaction, dataset=named_dataset
                    )
                _add_category(interaction, category_id)

                transaction.savepoint_commit(sid)
                interactions_created += 1

            except Exception as exc:  # noqa: BLE001
                transaction.savepoint_rollback(sid)
                if len(errors) < _MAX_ERRORS:
                    errors.append({"row": row_num, "reason": str(exc)})

    with transaction.atomic():
        _run()
        if dry_run:
            transaction.set_rollback(True)

    return {
        "dry_run": dry_run,
        "rows_sampled": None,
        "proteins_created": proteins_created,
        "proteins_existing": proteins_existing,
        "interactions_created": interactions_created,
        "interactions_skipped": interactions_skipped,
        "errors": errors,
        "new_protein_ids": [] if dry_run else new_protein_ids,
        "new_organism_ids": [],
    }
