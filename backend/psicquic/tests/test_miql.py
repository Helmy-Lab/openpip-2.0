# backend/psicquic/tests/test_miql.py
import pytest
from psicquic.miql import parse_miql, UnsupportedQuery
from interactions.models import Interaction
from proteins.models import Protein, Organism, ProteinOrganism


@pytest.fixture
def two_proteins(db):
    org = Organism.objects.create(name="Homo sapiens", taxonomy_id="9606")
    p1 = Protein.objects.create(gene_name="BRCA1", uniprot_id="P38398")
    p2 = Protein.objects.create(gene_name="TP53", uniprot_id="P04637")
    p3 = Protein.objects.create(gene_name="BRCA2", uniprot_id="P51587")
    ProteinOrganism.objects.create(protein=p1, organism=org)
    ProteinOrganism.objects.create(protein=p2, organism=org)
    ProteinOrganism.objects.create(protein=p3, organism=org)
    Interaction.objects.create(interactor_A=p1, interactor_B=p2, score="0.9")
    Interaction.objects.create(interactor_A=p1, interactor_B=p3, score="0.8")
    Interaction.objects.create(interactor_A=p2, interactor_B=p3, score="0.7")
    return p1, p2, p3


def test_plain_text_query(two_proteins):
    qs = parse_miql("BRCA1")
    assert qs.count() == 2  # BRCA1-TP53 and BRCA1-BRCA2


def test_plain_uniprot_query(two_proteins):
    qs = parse_miql("P38398")
    assert qs.count() == 2


def test_ida_prefix(two_proteins):
    qs = parse_miql("idA:P38398")
    assert qs.count() == 2


def test_idb_prefix(two_proteins):
    qs = parse_miql("idB:P04637")
    assert qs.count() == 1


def test_id_prefix_matches_either(two_proteins):
    qs = parse_miql("id:P51587")
    assert qs.count() == 2  # BRCA1-BRCA2 and TP53-BRCA2


def test_taxida_filter(two_proteins):
    qs = parse_miql("taxidA:9606")
    assert qs.count() == 3


def test_unknown_taxon_returns_empty(two_proteins):
    qs = parse_miql("taxidA:0000")
    assert qs.count() == 0


def test_empty_query_returns_all(two_proteins):
    qs = parse_miql("*")
    assert qs.count() == 3


@pytest.mark.django_db
def test_species_matches_either_interactor(two_proteins):
    # The bug that prompted this: species:9606 answered 0 against a database of
    # entirely human interactions.
    assert parse_miql("species:9606").count() == parse_miql("*").count()


@pytest.mark.django_db
def test_species_excludes_a_taxon_we_do_not_hold(two_proteins):
    assert parse_miql("species:10090").count() == 0


@pytest.mark.django_db
def test_species_is_the_union_of_taxida_and_taxidb(two_proteins):
    side_a = set(parse_miql("taxidA:9606").values_list("pk", flat=True))
    side_b = set(parse_miql("taxidB:9606").values_list("pk", flat=True))
    both = set(parse_miql("species:9606").values_list("pk", flat=True))
    assert both == side_a | side_b


# ── Boolean operators ──────────────────────────────────────────────────────


@pytest.mark.django_db
def test_and_narrows(two_proteins):
    # BRCA1 is in 2 interactions, BRCA2 in 2; only one has both.
    assert parse_miql("id:BRCA1 AND id:BRCA2").count() == 1


@pytest.mark.django_db
def test_or_widens(two_proteins):
    assert parse_miql("idA:BRCA1 OR idA:TP53").count() == 3


@pytest.mark.django_db
def test_not_excludes(two_proteins):
    total = parse_miql("*").count()
    assert parse_miql("NOT id:BRCA1").count() == total - 2


@pytest.mark.django_db
def test_adjacency_means_and(two_proteins):
    assert (
        parse_miql("id:BRCA1 id:BRCA2").count()
        == parse_miql("id:BRCA1 AND id:BRCA2").count()
    )


@pytest.mark.django_db
def test_parentheses_change_grouping(two_proteins):
    # Without grouping, AND binds tighter than OR.
    loose = parse_miql("id:TP53 OR id:BRCA1 AND id:BRCA2").count()
    grouped = parse_miql("(id:TP53 OR id:BRCA1) AND id:BRCA2").count()
    assert loose != grouped


@pytest.mark.django_db
def test_not_applies_to_a_parenthesised_group(two_proteins):
    total = parse_miql("*").count()
    assert parse_miql("NOT (id:BRCA1 OR id:TP53)").count() == total - 3


@pytest.mark.django_db
def test_quoted_values_may_contain_spaces(two_proteins):
    # Would otherwise tokenise as two terms and silently mean something else.
    assert parse_miql('pubauth:"Rolland et al"').count() == 0


@pytest.mark.django_db
def test_unbalanced_parentheses_are_refused(two_proteins):
    for bad in ["(id:BRCA1", "id:BRCA1)", "((id:BRCA1)"]:
        with pytest.raises(UnsupportedQuery):
            parse_miql(bad)


@pytest.mark.django_db
def test_an_unsupported_field_inside_a_group_is_still_refused(two_proteins):
    with pytest.raises(UnsupportedQuery):
        parse_miql("id:BRCA1 AND (detmethod:x OR id:TP53)")


@pytest.mark.django_db
def test_results_are_not_duplicated_by_dataset_joins(two_proteins):
    from datasets.models import Dataset
    from interactions.models import InteractionDataset

    interaction = parse_miql("id:BRCA1").first()
    for name in ("D1", "D2"):
        dataset = Dataset.objects.create(name=name, pubmed_id="24153252")
        InteractionDataset.objects.create(interaction=interaction, dataset=dataset)

    # Two datasets match the same interaction; it must appear once.
    assert parse_miql("pubid:24153252").count() == 1


@pytest.mark.django_db
def test_pubid_and_pubauth_match_the_source_dataset(two_proteins):
    from datasets.models import Dataset
    from interactions.models import InteractionDataset

    interaction = parse_miql("id:BRCA1").first()
    dataset = Dataset.objects.create(
        name="HuRI", pubmed_id="24153252", author="Rolland et al."
    )
    InteractionDataset.objects.create(interaction=interaction, dataset=dataset)

    assert parse_miql("pubid:24153252").count() == 1
    assert parse_miql("pubauth:Rolland").count() == 1
    assert parse_miql("pubauth:Nobody").count() == 0
