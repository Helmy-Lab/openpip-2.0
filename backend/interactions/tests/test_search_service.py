"""
Direct unit tests for search_service.py — covers branches missed by the
HTTP-level tests in test_views.py.
"""

import pytest

from proteins.models import Annotation, AnnotationProtein
from proteins.tests.factories import (
    ProteinFactory,
    IdentifierFactory,
    ProteinIdentifierFactory,
)
from interactions.tests.factories import (
    InteractionFactory,
    InteractionInteractionCategoryFactory,
    InteractionCategoryFactory,
)
from interactions.models import InteractionDataset
from datasets.tests.factories import DatasetFactory
from interactions.search_service import (
    _safe_float,
    split_terms,
    execute_search,
    build_result_from_interaction_ids,
)

# ── _safe_float ───────────────────────────────────────────────────────────────


def test_safe_float_converts_numeric_string():
    assert _safe_float("0.82") == pytest.approx(0.82)


def test_safe_float_returns_none_for_none():
    assert _safe_float(None) is None


def test_safe_float_returns_none_for_empty_string():
    assert _safe_float("") is None


def test_safe_float_returns_none_for_invalid_string():
    assert _safe_float("not-a-number") is None


def test_safe_float_returns_none_for_non_numeric_type():
    assert _safe_float([1, 2]) is None


# ── split_terms ──────────────────────────────────────────────────────────────


def test_split_terms_accepts_commas_spaces_and_newlines():
    assert split_terms(" TP53, MDM2\nBRCA1 BCL2 ,, ") == [
        "TP53",
        "MDM2",
        "BRCA1",
        "BCL2",
    ]


def test_split_terms_empty_query():
    assert split_terms("   ") == []


# ── execute_search — edge classification ─────────────────────────────────────


def _protein_with_identifier(gene_name, uniprot_id=None):
    protein = ProteinFactory(
        gene_name=gene_name, uniprot_id=uniprot_id or f"P{gene_name[:5]}"
    )
    ident = IdentifierFactory(identifier=gene_name, naming_convention="gene_name")
    ProteinIdentifierFactory(protein=protein, identifier=ident)
    return protein


@pytest.mark.django_db
@pytest.mark.parametrize("q", ["", "  ", " , "])
def test_search_without_terms_returns_nothing(q):
    """An empty query must not match every identifier and return the whole DB."""
    p = _protein_with_identifier("BAD")
    InteractionFactory(interactor_A=p, interactor_B=p, removed="0")

    result = execute_search(q)
    assert result["all_proteins"] == []
    assert result["all_interactions"] == []


@pytest.mark.django_db
def test_search_b_side_query_edge_swapped_to_a():
    """When B is query and A is not, the edge is swapped so query protein is A."""
    query_p = _protein_with_identifier("BAD")
    interactor_p = ProteinFactory(gene_name="OUTSIDER")
    # Create interaction with interactor as A and query as B
    InteractionFactory(interactor_A=interactor_p, interactor_B=query_p, removed="0")

    result = execute_search("BAD")
    ixs = result["all_interactions"]
    assert len(ixs) == 1
    # After swap, the query protein should be interactor_A
    assert ixs[0]["interactor_A"]["protein_id"] == query_p.id
    assert ixs[0]["interactor_B"]["protein_id"] == interactor_p.id


@pytest.mark.django_db
def test_search_interactor_edge_when_filter_none():
    """filter=None: interactor↔interactor edges (both non-query) are included."""
    q1 = _protein_with_identifier("BAD")
    q2 = _protein_with_identifier("BCL2L1")
    p_other_a = ProteinFactory(gene_name="BYSTANDER_A")
    p_other_b = ProteinFactory(gene_name="BYSTANDER_B")
    # query↔bystander connects bystanders to the network
    InteractionFactory(interactor_A=q1, interactor_B=p_other_a, removed="0")
    # bystander↔bystander — should appear under filter=None
    ix_interactor = InteractionFactory(
        interactor_A=p_other_a, interactor_B=p_other_b, removed="0"
    )
    # bystander B also needs a link to network
    InteractionFactory(interactor_A=q2, interactor_B=p_other_b, removed="0")

    result = execute_search("BAD,BCL2L1", filter_parameter="None")
    ids = {ix["interaction_id"] for ix in result["all_interactions"]}
    assert ix_interactor.id in ids


@pytest.mark.django_db
def test_search_experiment_annotation_goes_to_experiment_array():
    """Annotations with type_name='experiment' are collected in experiment_array."""
    p1 = _protein_with_identifier("BAD")
    p2 = _protein_with_identifier("BCL2L1")
    ix = InteractionFactory(interactor_A=p1, interactor_B=p2, removed="0")

    Annotation.objects.create(
        annotation='{"method": "two-hybrid"}',
        identifier=ix.id,
        type_name="experiment",
    )

    result = execute_search("BAD,BCL2L1")
    ixs = result["all_interactions"]
    assert len(ixs) == 1
    assert '{"method": "two-hybrid"}' in ixs[0]["experiment_array"]
    assert "experiment" not in ixs[0]["annotation_array"]


@pytest.mark.django_db
def test_search_non_experiment_annotation_in_annotation_array():
    """Non-experiment interaction annotations go into annotation_array by type."""
    p1 = _protein_with_identifier("BAD")
    p2 = _protein_with_identifier("BCL2L1")
    ix = InteractionFactory(interactor_A=p1, interactor_B=p2, removed="0")

    Annotation.objects.create(
        annotation="direct binding",
        identifier=ix.id,
        type_name="binding_type",
    )

    result = execute_search("BAD,BCL2L1")
    ixs = result["all_interactions"]
    assert "binding_type" in ixs[0]["annotation_array"]
    assert "direct binding" in ixs[0]["annotation_array"]["binding_type"]


@pytest.mark.django_db
def test_search_protein_annotations_in_protein_dict():
    """Protein-level annotations appear in each protein's annotation_array."""
    p = _protein_with_identifier("BAD")
    ann = Annotation.objects.create(
        annotation="nucleus",
        identifier=p.ensembl_id,
        type_name="subcellular_location",
    )
    AnnotationProtein.objects.create(annotation=ann, protein=p)

    result = execute_search("BAD")
    proteins = result["all_proteins"]
    assert len(proteins) == 1
    assert "subcellular_location" in proteins[0]["annotation_array"]


@pytest.mark.django_db
def test_search_protein_subcellular_location_expression_array_populated():
    """subcellular_location_expression_array is parsed from the JSON annotation."""
    p = _protein_with_identifier("BAD")
    ann = Annotation.objects.create(
        annotation='{"cytosol":"approved","nucleus":"enhanced","plasma_membrane":""}',
        identifier=p.ensembl_id,
        type_name="subcellular_location",
    )
    AnnotationProtein.objects.create(annotation=ann, protein=p)

    result = execute_search("BAD")
    protein = result["all_proteins"][0]
    sloc = protein["subcellular_location_expression_array"]
    assert isinstance(sloc, dict)
    assert sloc.get("cytosol") == "approved"
    assert sloc.get("nucleus") == "enhanced"


@pytest.mark.django_db
def test_search_protein_tissue_expression_array_populated():
    """tissue_expression_array is parsed from the JSON annotation."""
    p = _protein_with_identifier("BAD")
    ann = Annotation.objects.create(
        annotation='{"liver":"10.18","lung":"9.04","whole_blood":"8.23"}',
        identifier=p.ensembl_id,
        type_name="tissue_expression",
    )
    AnnotationProtein.objects.create(annotation=ann, protein=p)

    result = execute_search("BAD")
    protein = result["all_proteins"][0]
    tissue = protein["tissue_expression_array"]
    assert isinstance(tissue, dict)
    assert tissue.get("liver") == "10.18"
    assert tissue.get("lung") == "9.04"


@pytest.mark.django_db
def test_search_protein_arrays_empty_when_no_annotation():
    """Proteins without subcellular/tissue annotations return empty dicts, not errors."""
    _protein_with_identifier("BAD")

    result = execute_search("BAD")
    protein = result["all_proteins"][0]
    assert protein["subcellular_location_expression_array"] == {}
    assert protein["tissue_expression_array"] == {}
    assert protein["tissue_specificity_array"] == {}


# ── build_result_from_interaction_ids ─────────────────────────────────────────


@pytest.mark.django_db
def test_build_result_empty_ids_returns_empty_structure():
    result = build_result_from_interaction_ids([], "BAD")
    assert result["all_proteins"] == []
    assert result["all_interactions"] == []
    assert result["query_protein_id_array"] == []
    assert result["search_term"] == "BAD"


@pytest.mark.django_db
def test_build_result_reconstructs_basic_network():
    p1 = ProteinFactory(gene_name="BAD")
    p2 = ProteinFactory(gene_name="BCL2L1")
    ix = InteractionFactory(interactor_A=p1, interactor_B=p2, removed="0")

    result = build_result_from_interaction_ids([ix.id], "BAD,BCL2L1")
    assert len(result["all_proteins"]) == 2
    assert len(result["all_interactions"]) == 1
    assert result["all_interactions"][0]["interaction_id"] == ix.id


@pytest.mark.django_db
def test_build_result_query_protein_ids_resolved_by_gene_name():
    p1 = ProteinFactory(gene_name="BAD")
    p2 = ProteinFactory(gene_name="BCL2L1")
    ix = InteractionFactory(interactor_A=p1, interactor_B=p2, removed="0")

    result = build_result_from_interaction_ids([ix.id], "BAD")
    # Only BAD is in the query term, so only p1's id should be in query_protein_id_array
    assert p1.id in result["query_protein_id_array"]
    assert p2.id not in result["query_protein_id_array"]


@pytest.mark.django_db
def test_build_result_includes_datasets():
    p1 = ProteinFactory(gene_name="BAD")
    p2 = ProteinFactory(gene_name="BCL2L1")
    ix = InteractionFactory(interactor_A=p1, interactor_B=p2, removed="0")
    dataset = DatasetFactory(name="HuRI", author="Rolland et al.(2014)")
    InteractionDataset.objects.create(interaction=ix, dataset=dataset)

    result = build_result_from_interaction_ids([ix.id], "BAD,BCL2L1")
    ix_data = result["all_interactions"][0]
    assert len(ix_data["dataset_array"]) == 1
    assert ix_data["dataset_array"][0]["name"] == "HuRI"


@pytest.mark.django_db
def test_build_result_includes_categories():
    p1 = ProteinFactory(gene_name="BAD")
    p2 = ProteinFactory(gene_name="BCL2L1")
    ix = InteractionFactory(interactor_A=p1, interactor_B=p2, removed="0")
    cat = InteractionCategoryFactory(category_name="Published", order="1")
    InteractionInteractionCategoryFactory(interaction=ix, interaction_category=cat)

    result = build_result_from_interaction_ids([ix.id], "BAD,BCL2L1")
    cat_data = result["all_interactions"][0]["interaction_category_array"]
    assert cat_data["highest_category_status"] == "Published"


@pytest.mark.django_db
def test_build_result_multi_query_edge():
    """When both interactors are in the query, edge appears as multi-query."""
    p1 = ProteinFactory(gene_name="BAD")
    p2 = ProteinFactory(gene_name="BCL2L1")
    ix = InteractionFactory(interactor_A=p1, interactor_B=p2, removed="0")

    result = build_result_from_interaction_ids([ix.id], "BAD,BCL2L1")
    # multi-query edges appear first in the list
    assert len(result["all_interactions"]) == 1
    ix_data = result["all_interactions"][0]
    assert {
        ix_data["interactor_A"]["protein_gene_name"],
        ix_data["interactor_B"]["protein_gene_name"],
    } == {"BAD", "BCL2L1"}


@pytest.mark.django_db
def test_build_result_interactor_only_edge():
    """When neither interactor matches query terms, edge is an interactor edge."""
    p1 = ProteinFactory(gene_name="OUTSIDER_A")
    p2 = ProteinFactory(gene_name="OUTSIDER_B")
    ix = InteractionFactory(interactor_A=p1, interactor_B=p2, removed="0")

    result = build_result_from_interaction_ids([ix.id], "BAD")
    # Neither protein matches 'BAD', so query_protein_id_array is empty
    assert result["query_protein_id_array"] == []
    # The edge still appears
    assert len(result["all_interactions"]) == 1


@pytest.mark.django_db
def test_search_multi_term_separated_by_space_and_newline():
    """A pasted list works whatever separates it."""
    a = _protein_with_identifier("BAD")
    b = _protein_with_identifier("BCL2L1")
    InteractionFactory(interactor_A=a, interactor_B=b, removed="0")

    for query in ("BAD,BCL2L1", "BAD BCL2L1", "BAD\nBCL2L1"):
        result = execute_search(query)
        assert sorted(result["query_protein_id_array"]) == sorted([a.id, b.id]), query
        assert result["unfound_protein_summary"] == ""


@pytest.mark.django_db
def test_search_protein_tissue_specificity_array_populated():
    """tissue_specificity_array is parsed from the JSON annotation."""
    p = _protein_with_identifier("BAD")
    ann = Annotation.objects.create(
        annotation='{"liver":"3.2", "brain_0":"-1.15"}',
        identifier=p.ensembl_id,
        type_name="tissue_specificity",
    )
    AnnotationProtein.objects.create(annotation=ann, protein=p)

    protein = execute_search("BAD")["all_proteins"][0]
    assert protein["tissue_specificity_array"] == {"liver": "3.2", "brain_0": "-1.15"}
