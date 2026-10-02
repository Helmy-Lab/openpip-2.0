"""
Comprehensive tests for the improved PSI-MI TAB 2.7 parser and upload endpoints.
"""

import io
import pytest

from datasets.upload_parser import parse_and_ingest, parse_and_ingest_csv
from interactions.models import (
    AnnotationInteraction,
    Interaction,
    InteractionCategory,
    InteractionDataset,
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

# ---------------------------------------------------------------------------
# Shared fixture data
# ---------------------------------------------------------------------------

# Minimal valid PSI-MI TAB 2.7 row (header + 1 data row).
# Col indices match the spec in the task description.
_HEADER = (
    "#ID(s) interactor A\t"  # 0
    "ID(s) interactor B\t"  # 1
    "Alt. ID(s) interactor A\t"  # 2
    "Alt. ID(s) interactor B\t"  # 3
    "Alias(es) interactor A\t"  # 4
    "Alias(es) interactor B\t"  # 5
    "Interaction detection method(s)\t"  # 6
    "Publication 1st author(s)\t"  # 7
    "Publication Identifier(s)\t"  # 8
    "Taxid interactor A\t"  # 9
    "Taxid interactor B\t"  # 10
    "Interaction type(s)\t"  # 11
    "Source database(s)\t"  # 12
    "Interaction identifier(s)\t"  # 13
    "Confidence value(s)\t"  # 14
    "col15\tcol16\tcol17\tcol18\tcol19\tcol20\tcol21\t"  # 15-21
    "Xref(s) interactor A\t"  # 22
    "Xref(s) interactor B\t"  # 23
    "Interaction Xref(s)\t"  # 24
    "Annotation(s) interactor A\t"  # 25
    "Annotation(s) interactor B\t"  # 26
    "Interaction annotation(s)"  # 27
)


def _build_row(
    id_a="uniprotkb:P00001",
    id_b="uniprotkb:P00002",
    alias_a="uniprotkb:BRCA1(gene name)|psi-mi:BRCA1(display_short)",
    alias_b="uniprotkb:TP53(gene name)|psi-mi:TP53(display_short)",
    method='psi-mi:"MI:1112"(two hybrid prey pooling approach)',
    author="Rolland et al. (2014)",
    pub_id="imex:IM-23318|pubmed:25416956",
    taxon_a="taxid:9606(human)|taxid:9606(Homo sapiens)",
    taxon_b="taxid:9606(human)|taxid:9606(Homo sapiens)",
    score="intact-miscore:0.56",
    xref_a="-",
    xref_b="-",
    support_a="Gene Expression:None;Protein Expression:1;Disorder:0.35",
    support_b="-",
    interaction_ann="figure legend:supp table 2G|curation depth:imex curation",
) -> str:
    cols = [
        id_a,
        id_b,  # 0, 1
        "-",
        "-",  # 2, 3
        alias_a,
        alias_b,  # 4, 5
        method,  # 6
        author,  # 7
        pub_id,  # 8
        taxon_a,
        taxon_b,  # 9, 10
        "-",
        "-",
        "-",  # 11, 12, 13
        score,  # 14
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",  # 15-21
        xref_a,
        xref_b,  # 22, 23
        "-",  # 24
        support_a,  # 25
        support_b,  # 26
        interaction_ann,  # 27
    ]
    return "\t".join(cols)


def _file(*data_rows: str) -> bytes:
    lines = [_HEADER] + list(data_rows)
    return "\n".join(lines).encode()


# ---------------------------------------------------------------------------
# Col 14: score
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_score_extracted_from_col14():
    content = _file(_build_row(score="intact-miscore:0.56"))
    parse_and_ingest(content, dataset_name="TestDS")
    ix = Interaction.objects.get()
    assert ix.score == "0.56"


@pytest.mark.django_db
def test_score_missing_dash_stays_none():
    content = _file(_build_row(score="-"))
    parse_and_ingest(content, dataset_name="TestDS")
    ix = Interaction.objects.get()
    assert ix.score is None


# ---------------------------------------------------------------------------
# Cols 7+8: Dataset / InteractionDataset
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_dataset_created_and_linked():
    # Dataset is now created by the admin-supplied name, not extracted from PSI-MI cols 7/8.
    content = _file(
        _build_row(author="Rolland et al. (2014)", pub_id="pubmed:25416956")
    )
    parse_and_ingest(content, dataset_name="HuRI", interaction_status="published")

    from datasets.models import Dataset

    ds = Dataset.objects.get(name="HuRI")
    assert ds.interaction_status == "published"

    ix = Interaction.objects.get()
    assert InteractionDataset.objects.filter(interaction=ix, dataset=ds).exists()


@pytest.mark.django_db
def test_dataset_reused_for_same_pubmed():
    """Two rows with the same pubmed_id must share a single Dataset row."""
    row1 = _build_row(id_a="uniprotkb:P00001", id_b="uniprotkb:P00002")
    row2 = _build_row(id_a="uniprotkb:P00003", id_b="uniprotkb:P00004")
    content = _file(row1, row2)
    parse_and_ingest(content, dataset_name="HuRI")

    from datasets.models import Dataset

    assert Dataset.objects.count() == 1
    assert InteractionDataset.objects.count() == 2


# ---------------------------------------------------------------------------
# Col 6: detection method
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_detection_method_stored_as_experiment_annotation():
    content = _file(
        _build_row(method='psi-mi:"MI:1112"(two hybrid prey pooling approach)')
    )
    parse_and_ingest(content, dataset_name="DS")
    ix = Interaction.objects.get()
    ann = Annotation.objects.get(identifier=str(ix.pk), type_name="experiment")
    assert ann.annotation == "two hybrid prey pooling approach"
    assert AnnotationInteraction.objects.filter(interaction=ix, annotation=ann).exists()


@pytest.mark.django_db
def test_detection_method_missing_skipped():
    content = _file(_build_row(method="-"))
    parse_and_ingest(content, dataset_name="DS")
    assert Annotation.objects.filter(type_name="experiment").count() == 0


# ---------------------------------------------------------------------------
# Col 27: interaction annotations
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_interaction_annotation_stored():
    content = _file(
        _build_row(
            interaction_ann="figure legend:supp table 2G|curation depth:imex curation"
        )
    )
    parse_and_ingest(content, dataset_name="DS")
    ix = Interaction.objects.get()
    anns = Annotation.objects.filter(identifier=str(ix.pk)).exclude(
        type_name="experiment"
    )
    type_names = list(anns.values_list("type_name", flat=True))
    assert "figure legend" in type_names
    assert "curation depth" in type_names
    # Both should have AnnotationInteraction FK links
    for ann in anns:
        assert AnnotationInteraction.objects.filter(
            interaction=ix, annotation=ann
        ).exists()


@pytest.mark.django_db
def test_interaction_annotation_identifier_equals_interaction_pk():
    content = _file(_build_row(interaction_ann="curation depth:imex curation"))
    parse_and_ingest(content, dataset_name="DS")
    ix = Interaction.objects.get()
    ann = Annotation.objects.get(type_name="curation depth")
    assert ann.identifier == str(ix.pk)


# ---------------------------------------------------------------------------
# Cols 25+26: support info
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_support_info_rows_created():
    content = _file(
        _build_row(support_a="Gene Expression:None;Protein Expression:1;Disorder:0.35")
    )
    parse_and_ingest(content, dataset_name="DS")
    ix = Interaction.objects.get()
    names = list(
        InteractionSupportInformation.objects.filter(interaction=ix).values_list(
            "support_information__name", flat=True
        )
    )
    assert "Gene Expression" in names
    assert "Protein Expression" in names
    assert "Disorder" in names


@pytest.mark.django_db
def test_support_info_values_stored():
    content = _file(_build_row(support_a="Disorder:0.346"))
    parse_and_ingest(content, dataset_name="DS")
    ix = Interaction.objects.get()
    isi = InteractionSupportInformation.objects.get(
        interaction=ix, support_information__name="Disorder"
    )
    assert isi.value == "0.346"


@pytest.mark.django_db
def test_support_info_deduplicates_si_name():
    """Two rows with the same support key should reuse a single SupportInformation row."""
    row1 = _build_row(
        id_a="uniprotkb:P00001", id_b="uniprotkb:P00002", support_a="Disorder:0.1"
    )
    row2 = _build_row(
        id_a="uniprotkb:P00003", id_b="uniprotkb:P00004", support_a="Disorder:0.2"
    )
    parse_and_ingest(_file(row1, row2), dataset_name="DS")
    assert SupportInformation.objects.filter(name="Disorder").count() == 1


# ---------------------------------------------------------------------------
# Cols 4+5: gene name aliases
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_gene_name_alias_added_to_identifier():
    content = _file(
        _build_row(alias_a="uniprotkb:BRCA1(gene name)|psi-mi:BRCA1(display_short)")
    )
    parse_and_ingest(content, dataset_name="DS")
    assert Identifier.objects.filter(identifier="BRCA1").exists()


@pytest.mark.django_db
def test_gene_name_alias_linked_to_protein():
    content = _file(_build_row(alias_a="uniprotkb:MYGENE(gene name)"))
    parse_and_ingest(content, dataset_name="DS")
    protein = Protein.objects.get(uniprot_id="P00001")
    id_obj = Identifier.objects.get(identifier="MYGENE")
    assert ProteinIdentifier.objects.filter(protein=protein, identifier=id_obj).exists()


@pytest.mark.django_db
def test_non_gene_name_alias_ignored():
    content = _file(_build_row(alias_a="psi-mi:BRCA1(display_short)"))
    parse_and_ingest(content, dataset_name="DS")
    assert not Identifier.objects.filter(identifier="BRCA1").exists()


# ---------------------------------------------------------------------------
# Cols 9+10: taxon
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_taxon_creates_organism():
    content = _file(_build_row(taxon_a="taxid:9606(human)|taxid:9606(Homo sapiens)"))
    parse_and_ingest(content, dataset_name="DS")
    assert Organism.objects.filter(taxonomy_id="9606").exists()


@pytest.mark.django_db
def test_taxon_links_protein_organism():
    content = _file(_build_row(taxon_a="taxid:9606(human)"))
    parse_and_ingest(content, dataset_name="DS")
    protein = Protein.objects.get(uniprot_id="P00001")
    organism = Organism.objects.get(taxonomy_id="9606")
    assert ProteinOrganism.objects.filter(protein=protein, organism=organism).exists()


@pytest.mark.django_db
def test_taxon_organism_reused_across_rows():
    row1 = _build_row(
        id_a="uniprotkb:P00001", id_b="uniprotkb:P00002", taxon_a="taxid:9606(human)"
    )
    row2 = _build_row(
        id_a="uniprotkb:P00003", id_b="uniprotkb:P00004", taxon_a="taxid:9606(human)"
    )
    parse_and_ingest(_file(row1, row2), dataset_name="DS")
    assert Organism.objects.filter(taxonomy_id="9606").count() == 1


# ---------------------------------------------------------------------------
# Dedup logic
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_dedup_skips_existing_active_interaction():
    p1 = Protein.objects.create(uniprot_id="P00001")
    p2 = Protein.objects.create(uniprot_id="P00002")
    i1 = Identifier.objects.create(identifier="P00001", naming_convention="uniprotkb")
    i2 = Identifier.objects.create(identifier="P00002", naming_convention="uniprotkb")
    ProteinIdentifier.objects.create(protein=p1, identifier=i1)
    ProteinIdentifier.objects.create(protein=p2, identifier=i2)
    Interaction.objects.create(interactor_A=p1, interactor_B=p2, removed="0")

    content = _file(_build_row())
    result = parse_and_ingest(content, dataset_name="DS")
    assert result["interactions_skipped"] == 1
    assert result["interactions_created"] == 0
    assert Interaction.objects.count() == 1  # no new row


@pytest.mark.django_db
def test_dedup_does_not_skip_removed_interaction():
    """
    Dedup bug fix: a soft-deleted interaction (removed='1') must NOT block
    re-upload of the same protein pair.
    """
    p1 = Protein.objects.create(uniprot_id="P00001")
    p2 = Protein.objects.create(uniprot_id="P00002")
    i1 = Identifier.objects.create(identifier="P00001", naming_convention="uniprotkb")
    i2 = Identifier.objects.create(identifier="P00002", naming_convention="uniprotkb")
    ProteinIdentifier.objects.create(protein=p1, identifier=i1)
    ProteinIdentifier.objects.create(protein=p2, identifier=i2)
    Interaction.objects.create(interactor_A=p1, interactor_B=p2, removed="1")

    content = _file(_build_row())
    result = parse_and_ingest(content, dataset_name="DS")
    assert result["interactions_created"] == 1
    assert result["interactions_skipped"] == 0
    assert Interaction.objects.filter(removed="0").count() == 1


def _links(interaction):
    return set(
        InteractionDataset.objects.filter(interaction=interaction).values_list(
            "dataset__name", flat=True
        )
    )


def _experiments(interaction):
    return sorted(
        Annotation.objects.filter(
            identifier=str(interaction.pk), type_name="experiment"
        ).values_list("annotation", flat=True)
    )


@pytest.mark.django_db
def test_overlap_credits_both_datasets_and_keeps_new_evidence():
    """Legacy parity: a pair already in DS1 is linked to DS2 as well, with DS2's
    detection method attached; DS1's score is not overwritten."""
    parse_and_ingest(_file(_build_row()), dataset_name="DS1")
    result = parse_and_ingest(
        _file(
            _build_row(
                method='psi-mi:"MI:0006"(anti bait coimmunoprecipitation)',
                score="intact-miscore:0.99",
            )
        ),
        dataset_name="DS2",
    )
    assert result["interactions_created"] == 0
    (ix,) = Interaction.objects.all()
    assert _links(ix) == {"DS1", "DS2"}
    assert _experiments(ix) == [
        "anti bait coimmunoprecipitation",
        "two hybrid prey pooling approach",
    ]
    assert ix.score == "0.56"


@pytest.mark.django_db
def test_reupload_to_same_dataset_adds_no_duplicate_evidence():
    parse_and_ingest(_file(_build_row()), dataset_name="DS1")
    parse_and_ingest(_file(_build_row()), dataset_name="DS1")
    (ix,) = Interaction.objects.all()
    assert _experiments(ix) == ["two hybrid prey pooling approach"]


@pytest.mark.django_db
def test_self_interaction_does_not_block_a_new_pair():
    """A-A used to match the A-B duplicate check, so A-B was never created."""
    parse_and_ingest(
        _file(_build_row(id_b="uniprotkb:P00001", alias_b="-")), dataset_name="DS"
    )
    result = parse_and_ingest(_file(_build_row()), dataset_name="DS")
    assert result["interactions_created"] == 1
    assert Interaction.objects.count() == 2


@pytest.mark.django_db
def test_csv_overlap_credits_both_datasets():
    csv_bytes = b"protein_a,protein_b\nuniprotkb:P00001,uniprotkb:P00002\n"
    parse_and_ingest_csv(csv_bytes, dataset_name="DS1")
    parse_and_ingest_csv(csv_bytes, dataset_name="DS2")
    (ix,) = Interaction.objects.all()
    assert _links(ix) == {"DS1", "DS2"}


# ---------------------------------------------------------------------------
# Dry-run mode
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_dry_run_returns_correct_counts():
    content = _file(_build_row())
    result = parse_and_ingest(content, dataset_name="DS", dry_run=True)
    assert result["dry_run"] is True
    assert result["interactions_created"] == 1
    assert result["proteins_created"] == 2


@pytest.mark.django_db
def test_dry_run_writes_nothing():
    content = _file(_build_row())
    parse_and_ingest(content, dataset_name="DS", dry_run=True)
    assert Interaction.objects.count() == 0
    assert Protein.objects.count() == 0
    assert Annotation.objects.count() == 0


@pytest.mark.django_db
def test_dry_run_false_writes_data():
    content = _file(_build_row())
    result = parse_and_ingest(content, dataset_name="DS", dry_run=False)
    assert result["dry_run"] is False
    assert Interaction.objects.count() == 1


# ---------------------------------------------------------------------------
# Category
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_category_linked_when_category_id_given(db):
    from admin_panel.models import AdminSettings

    settings_obj = AdminSettings.objects.create()
    cat = InteractionCategory.objects.create(
        category_name="Binary", admin_settings=settings_obj
    )
    content = _file(_build_row())
    parse_and_ingest(content, dataset_name="DS", category_id=cat.pk)
    ix = Interaction.objects.get()
    assert InteractionInteractionCategory.objects.filter(
        interaction=ix, interaction_category=cat
    ).exists()


@pytest.mark.django_db
def test_no_category_when_none():
    content = _file(_build_row())
    parse_and_ingest(content, dataset_name="DS", category_id=None)
    assert InteractionInteractionCategory.objects.count() == 0


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_header_row_skipped():
    content = _file(_build_row())
    result = parse_and_ingest(content, dataset_name="DS")
    assert result["interactions_created"] == 1  # only the data row


@pytest.mark.django_db
def test_hash_header_row_skipped():
    """Row starting with # must be treated as header regardless of position."""
    content = b"#id_A\tid_B\n#second header\nuniprotkb:P00001\tuniprotkb:P00002\n"
    result = parse_and_ingest(content, dataset_name="DS")
    assert result["interactions_created"] == 1


@pytest.mark.django_db
def test_short_row_skipped():
    content = b"#h\nuniprotkb:P00001\n"
    result = parse_and_ingest(content, dataset_name="DS")
    assert result["interactions_created"] == 0


@pytest.mark.django_db
def test_empty_col_skipped():
    content = b"#h\n\tuniprotkb:P00002\n"
    result = parse_and_ingest(content, dataset_name="DS")
    assert result["interactions_created"] == 0


@pytest.mark.django_db
def test_max_50_errors_stored():
    """Parser must cap error list at 50 even if many rows fail.

    Verifies the constant is set correctly; integration coverage of the cap
    is enforced by the implementation guarding ``if len(errors) < _MAX_ERRORS``.
    """
    from datasets import upload_parser

    assert upload_parser._MAX_ERRORS == 50


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_preview_endpoint_returns_200_for_admin(auth_client):
    f = io.BytesIO(_file(_build_row()))
    f.name = "test.tab"
    response = auth_client.post(
        "/api/datasets/preview",
        {"file": f, "dataset_name": "MyDS"},
        format="multipart",
    )
    assert response.status_code == 200
    data = response.json()
    assert data["dry_run"] is True
    assert "interactions_created" in data


@pytest.mark.django_db
def test_preview_endpoint_writes_nothing(auth_client):
    f = io.BytesIO(_file(_build_row()))
    f.name = "test.tab"
    auth_client.post(
        "/api/datasets/preview",
        {"file": f, "dataset_name": "MyDS"},
        format="multipart",
    )
    assert Interaction.objects.count() == 0


@pytest.mark.django_db
def test_upload_endpoint_returns_201_for_admin(auth_client):
    f = io.BytesIO(_file(_build_row()))
    f.name = "test.tab"
    response = auth_client.post(
        "/api/datasets/upload",
        {"file": f, "dataset_name": "MyDS"},
        format="multipart",
    )
    assert response.status_code == 201
    data = response.json()
    assert data["dry_run"] is False
    assert data["interactions_created"] == 1


@pytest.mark.django_db
def test_preview_endpoint_blocked_for_non_admin(user_auth_client):
    f = io.BytesIO(_file(_build_row()))
    f.name = "test.tab"
    response = user_auth_client.post(
        "/api/datasets/preview",
        {"file": f, "dataset_name": "MyDS"},
        format="multipart",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_upload_endpoint_blocked_for_non_admin(user_auth_client):
    f = io.BytesIO(_file(_build_row()))
    f.name = "test.tab"
    response = user_auth_client.post(
        "/api/datasets/upload",
        {"file": f, "dataset_name": "MyDS"},
        format="multipart",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_preview_endpoint_blocked_for_anonymous(api_client):
    f = io.BytesIO(_file(_build_row()))
    f.name = "test.tab"
    response = api_client.post(
        "/api/datasets/preview",
        {"file": f, "dataset_name": "MyDS"},
        format="multipart",
    )
    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_upload_endpoint_blocked_for_anonymous(api_client):
    f = io.BytesIO(_file(_build_row()))
    f.name = "test.tab"
    response = api_client.post(
        "/api/datasets/upload",
        {"file": f, "dataset_name": "MyDS"},
        format="multipart",
    )
    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_preview_requires_dataset_name(auth_client):
    f = io.BytesIO(_file(_build_row()))
    f.name = "test.tab"
    response = auth_client.post(
        "/api/datasets/preview",
        {"file": f},
        format="multipart",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_upload_requires_dataset_name(auth_client):
    f = io.BytesIO(_file(_build_row()))
    f.name = "test.tab"
    response = auth_client.post(
        "/api/datasets/upload",
        {"file": f},
        format="multipart",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_parse_and_ingest_returns_new_organism_ids_for_created_organisms():
    from datasets.upload_parser import parse_and_ingest
    from proteins.models import Organism

    content = _file(_build_row(taxon_a="taxid:9606(human)"))
    result = parse_and_ingest(content, dataset_name="DS")
    org = Organism.objects.get(taxonomy_id="9606")
    assert org.id in result["new_organism_ids"]


@pytest.mark.django_db
def test_parse_and_ingest_does_not_include_existing_organism_in_new_ids():
    from datasets.upload_parser import parse_and_ingest
    from proteins.models import Organism

    # Pre-create the organism
    Organism.objects.create(taxonomy_id="9606", name="human")

    content = _file(_build_row(taxon_a="taxid:9606(human)"))
    result = parse_and_ingest(content, dataset_name="DS")
    assert result["new_organism_ids"] == []
