# backend/psicquic/tests/test_tab25.py
import pytest
from psicquic.mitab import (
    format_interaction_tab25,
    format_interaction,
    header_for,
    TAB25_HEADER,
    COLUMN_NAMES,
    VERSION_WIDTHS,
)
from interactions.models import Interaction, InteractionDataset
from proteins.models import Protein, Organism, ProteinOrganism, Annotation
from interactions.models import AnnotationInteraction
from datasets.models import Dataset


@pytest.fixture
def interaction_with_data(db):
    org = Organism.objects.create(name="Homo sapiens", taxonomy_id="9606")
    p_a = Protein.objects.create(
        gene_name="BRCA1", uniprot_id="P38398", entrez_id="672"
    )
    p_b = Protein.objects.create(
        gene_name="BRCA2", uniprot_id="P51587", entrez_id="675"
    )
    ProteinOrganism.objects.create(protein=p_a, organism=org)
    ProteinOrganism.objects.create(protein=p_b, organism=org)
    dataset = Dataset.objects.create(
        name="Test Dataset",
        pubmed_id="12345678",
        author="Foo et al.",
        year="2020",
    )
    interaction = Interaction.objects.create(
        interactor_A=p_a, interactor_B=p_b, score="0.98"
    )
    InteractionDataset.objects.create(interaction=interaction, dataset=dataset)
    return interaction


def test_tab25_header():
    assert TAB25_HEADER.startswith("#ID(s) interactor A")
    assert TAB25_HEADER.count("\t") == 14  # 15 columns


def test_tab25_format_basic(interaction_with_data):
    line = format_interaction_tab25(interaction_with_data)
    columns = line.split("\t")
    assert len(columns) == 15


def test_tab25_uniprot_ids(interaction_with_data):
    line = format_interaction_tab25(interaction_with_data)
    cols = line.split("\t")
    assert cols[0] == "uniprotkb:P38398"
    assert cols[1] == "uniprotkb:P51587"


def test_tab25_gene_aliases(interaction_with_data):
    line = format_interaction_tab25(interaction_with_data)
    cols = line.split("\t")
    assert "BRCA1" in cols[4]
    assert "BRCA2" in cols[5]


def test_tab25_taxon(interaction_with_data):
    line = format_interaction_tab25(interaction_with_data)
    cols = line.split("\t")
    assert "taxid:9606" in cols[9]
    assert "taxid:9606" in cols[10]


def test_tab25_confidence(interaction_with_data):
    line = format_interaction_tab25(interaction_with_data)
    cols = line.split("\t")
    assert "0.98" in cols[14]


def test_tab25_publication(interaction_with_data):
    line = format_interaction_tab25(interaction_with_data)
    cols = line.split("\t")
    assert "pubmed:12345678" in cols[8]
    # TAB 2.5 column 8 is `Surname-Year`, not the free-text author string.
    assert cols[7] == "Foo-2020"


def test_tab25_appends_doi_to_publication_identifiers(db):
    """Column 9 takes several pipe-separated identifiers; preprints need the DOI."""
    org = Organism.objects.create(name="Homo sapiens", taxonomy_id="9606")
    p_a = Protein.objects.create(gene_name="A", uniprot_id="P00001")
    p_b = Protein.objects.create(gene_name="B", uniprot_id="P00002")
    ProteinOrganism.objects.create(protein=p_a, organism=org)
    ProteinOrganism.objects.create(protein=p_b, organism=org)
    dataset = Dataset.objects.create(
        name="Preprint Dataset",
        pubmed_id="12345678",
        doi="10.1038/s41586-020-2188-x",
        author="Luck et al.",
        year="2020",
    )
    interaction = Interaction.objects.create(interactor_A=p_a, interactor_B=p_b)
    InteractionDataset.objects.create(interaction=interaction, dataset=dataset)

    cols = format_interaction_tab25(interaction).split("\t")
    assert cols[8] == "pubmed:12345678|doi:10.1038/s41586-020-2188-x"
    assert cols[7] == "Luck-2020"


def test_tab25_publication_falls_back_when_dataset_is_uncited(db):
    p_a = Protein.objects.create(gene_name="A", uniprot_id="P00003")
    p_b = Protein.objects.create(gene_name="B", uniprot_id="P00004")
    dataset = Dataset.objects.create(name="Unpublished")
    interaction = Interaction.objects.create(interactor_A=p_a, interactor_B=p_b)
    InteractionDataset.objects.create(interaction=interaction, dataset=dataset)

    cols = format_interaction_tab25(interaction).split("\t")
    assert cols[7] == "-"
    assert cols[8] == "-"


def _annotate(interaction, type_name, payload):
    """Attach a raw annotation row, as the legacy dump stores them."""
    annotation = Annotation.objects.create(annotation=payload, type_name=type_name)
    AnnotationInteraction.objects.create(interaction=interaction, annotation=annotation)


def test_tab25_detection_method_from_litbm(interaction_with_data):
    _annotate(
        interaction_with_data,
        "litbm_interaction",
        '{"pmid":"8555189","experiment_type":"0018","binary_type":"binary"}',
    )
    columns = format_interaction_tab25(interaction_with_data).split("\t")
    assert columns[6] == 'psi-mi:"MI:0018"(two hybrid)'
    # Not MI:0407: a binary assay detects an interaction, it does not prove
    # direct contact, and reporting that would upgrade Lit-BM's own flag.
    assert columns[11] == 'psi-mi:"MI:0915"(physical association)'


def test_tab25_detection_method_pipes_multiple_experiments(interaction_with_data):
    # 47k litbm rows cover 12k interactions, so several methods per row is normal.
    _annotate(
        interaction_with_data,
        "litbm_interaction",
        '{"experiment_type":"0096","binary_type":"non_binary"}',
    )
    _annotate(
        interaction_with_data,
        "litbm_interaction",
        '{"experiment_type":"0018","binary_type":"binary"}',
    )
    columns = format_interaction_tab25(interaction_with_data).split("\t")
    assert columns[6] == 'psi-mi:"MI:0018"(two hybrid)|psi-mi:"MI:0096"(pull down)'
    # Both evidence strengths are reported rather than collapsed to the stronger.
    assert 'psi-mi:"MI:0915"(physical association)' in columns[11]
    assert 'psi-mi:"MI:0914"(association)' in columns[11]


def test_tab25_unlabelled_code_emits_bare_identifier(interaction_with_data):
    # Better an unlabelled CV reference than an invented term name.
    _annotate(interaction_with_data, "litbm_interaction", '{"experiment_type":"9999"}')
    columns = format_interaction_tab25(interaction_with_data).split("\t")
    assert columns[6] == 'psi-mi:"MI:9999"'


def test_tab25_y2h_screen_infers_two_hybrid(interaction_with_data):
    # An experiment annotation carries DB/AD domains, which only Y2H produces.
    _annotate(
        interaction_with_data,
        "experiment",
        '{"dataset":"HI-III","dna_binding_domain":"TNMD",'
        '"activation_binding_domain":"SPAG4","assay_version":2}',
    )
    columns = format_interaction_tab25(interaction_with_data).split("\t")
    assert columns[6] == 'psi-mi:"MI:0018"(two hybrid)'
    assert columns[11] == 'psi-mi:"MI:0915"(physical association)'


def test_tab25_litbm_wins_over_the_y2h_default(interaction_with_data):
    # Recorded evidence beats the inference when both are present.
    _annotate(interaction_with_data, "experiment", '{"dna_binding_domain":"TNMD"}')
    _annotate(interaction_with_data, "litbm_interaction", '{"experiment_type":"0114"}')
    columns = format_interaction_tab25(interaction_with_data).split("\t")
    assert columns[6] == 'psi-mi:"MI:0114"(x-ray crystallography)'


def test_tab25_survives_a_malformed_annotation(interaction_with_data):
    # A varchar column holding JSON will eventually hold something that is not.
    _annotate(interaction_with_data, "litbm_interaction", "{not json at all")
    columns = format_interaction_tab25(interaction_with_data).split("\t")
    assert columns[6] == "-"
    assert len(columns) == 15


def test_tab25_no_annotations_still_reports_unknown(interaction_with_data):
    columns = format_interaction_tab25(interaction_with_data).split("\t")
    assert columns[6] == "-"
    assert columns[11] == "-"


@pytest.mark.parametrize("placeholder", ["NULL", "null", "None", "-", "n/a", ""])
def test_tab25_treats_placeholder_accessions_as_absent(db, placeholder):
    # The legacy dump spells "no accession" several ways; only NULL and "" are
    # falsey in Python, so the literal text "NULL" was emitted as an identifier.
    p_a = Protein.objects.create(gene_name="A", uniprot_id=placeholder)
    p_b = Protein.objects.create(gene_name="B", uniprot_id="P04637")
    interaction = Interaction.objects.create(interactor_A=p_a, interactor_B=p_b)
    columns = format_interaction_tab25(interaction).split("\t")
    assert columns[0] == f"openPIP:{p_a.pk}"
    assert columns[1] == "uniprotkb:P04637"


@pytest.mark.django_db
def test_tab25_drops_placeholder_alt_ids():
    p_a = Protein.objects.create(gene_name="A", uniprot_id="P38398", entrez_id="NULL")
    p_b = Protein.objects.create(gene_name="B", uniprot_id="P04637", entrez_id="7157")
    interaction = Interaction.objects.create(interactor_A=p_a, interactor_B=p_b)
    columns = format_interaction_tab25(interaction).split("\t")
    assert columns[2] == "-"
    assert columns[3] == "entrez:7157"


# ── TAB 2.6 / 2.7 ──────────────────────────────────────────────────────────


def test_version_widths_match_the_specs():
    # Deliberately restated rather than derived: adding a version should force
    # someone to check the spec, not silently widen the output.
    assert VERSION_WIDTHS == {"tab25": 15, "tab26": 36, "tab27": 42, "tab28": 46}
    assert len(COLUMN_NAMES) == 46


@pytest.mark.django_db
def test_wider_versions_are_prefixed_by_narrower_ones(interaction_with_data):
    # The whole design rests on this: adding a column cannot disturb 2.5.
    t25 = format_interaction(interaction_with_data, "tab25").split("\t")
    t26 = format_interaction(interaction_with_data, "tab26").split("\t")
    t27 = format_interaction(interaction_with_data, "tab27").split("\t")
    t28 = format_interaction(interaction_with_data, "tab28").split("\t")
    assert [len(t25), len(t26), len(t27), len(t28)] == [15, 36, 42, 46]
    assert t26[:15] == t25
    assert t27[:36] == t26
    assert t28[:42] == t27


@pytest.mark.django_db
def test_tab27_fills_the_columns_openpip_actually_knows(interaction_with_data):
    cols = format_interaction(interaction_with_data, "tab27").split("\t")
    assert cols[20] == 'psi-mi:"MI:0326"(protein)'  # 21 interactor type A
    assert cols[21] == 'psi-mi:"MI:0326"(protein)'  # 22 interactor type B
    assert cols[35] == "false"  # 36 negative — openPIP stores no negatives
    # Unknown is stated as unspecified, not left blank.
    assert cols[16] == 'psi-mi:"MI:0499"(unspecified role)'  # 17 biological role A


@pytest.mark.django_db
def test_tab27_reports_y2h_bait_and_prey(interaction_with_data):
    # The one genuinely new fact 2.6 buys: the screen recorded which protein
    # carried the DNA-binding domain.
    _annotate(
        interaction_with_data,
        "experiment",
        '{"dna_binding_domain":"BRCA1","activation_binding_domain":"BRCA2"}',
    )
    cols = format_interaction(interaction_with_data, "tab27").split("\t")
    assert cols[18] == 'psi-mi:"MI:0496"(bait)'  # 19 experimental role A
    assert cols[19] == 'psi-mi:"MI:0498"(prey)'  # 20 experimental role B


@pytest.mark.django_db
def test_tab27_reverses_bait_and_prey_when_the_screen_did(interaction_with_data):
    _annotate(
        interaction_with_data,
        "experiment",
        '{"dna_binding_domain":"BRCA2","activation_binding_domain":"BRCA1"}',
    )
    cols = format_interaction(interaction_with_data, "tab27").split("\t")
    assert cols[18] == 'psi-mi:"MI:0498"(prey)'
    assert cols[19] == 'psi-mi:"MI:0496"(bait)'


@pytest.mark.django_db
def test_tab27_leaves_roles_unspecified_when_the_genes_do_not_match(
    interaction_with_data,
):
    # Rather than assign a role arbitrarily when the annotation names proteins
    # that are not these two interactors.
    _annotate(
        interaction_with_data,
        "experiment",
        '{"dna_binding_domain":"TP53","activation_binding_domain":"MDM2"}',
    )
    cols = format_interaction(interaction_with_data, "tab27").split("\t")
    assert cols[18] == 'psi-mi:"MI:0499"(unspecified role)'
    assert cols[19] == 'psi-mi:"MI:0499"(unspecified role)'


@pytest.mark.django_db
def test_header_width_tracks_the_version(interaction_with_data):
    for version, width in VERSION_WIDTHS.items():
        assert header_for(version).count("\t") == width - 1


@pytest.mark.django_db
def test_tab28_causal_columns_are_empty_for_physical_interactions(
    interaction_with_data,
):
    # 43-46 are CausalTAB: directional regulation. openPIP hosts undirected
    # physical PPIs, so these are empty by nature and would be for any
    # physical-interaction portal. Asserting it keeps a future contributor from
    # "fixing" them with invented values.
    cols = format_interaction(interaction_with_data, "tab28").split("\t")
    assert cols[42:] == ["-", "-", "-", "-"]


@pytest.mark.django_db
def test_cross_references_go_to_the_xref_columns_not_the_alt_id_columns(
    interaction_with_data,
):
    # MITAB separates "another name for this molecule" from "a pointer to
    # another resource". Mixing them would claim a PDB entry is an identifier
    # for the protein.
    from proteins.models import Identifier, ProteinIdentifier

    protein = interaction_with_data.interactor_A
    for convention, value in [("ensembl", "ENSG00000012048"), ("pdb", "1JM7")]:
        identifier = Identifier.objects.create(
            identifier=value, naming_convention=convention
        )
        ProteinIdentifier.objects.create(protein=protein, identifier=identifier)

    cols = format_interaction(interaction_with_data, "tab27").split("\t")
    assert "ensembl:ENSG00000012048" in cols[2]  # alt ID — names the molecule
    assert "pdb:1JM7" not in cols[2]
    assert cols[22] == "pdb:1JM7"  # xref — points elsewhere


@pytest.mark.django_db
def test_xref_column_is_dash_when_there_are_none(interaction_with_data):
    cols = format_interaction(interaction_with_data, "tab27").split("\t")
    assert cols[22] == "-"
