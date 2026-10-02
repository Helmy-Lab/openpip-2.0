import pytest
from proteins.models import Protein, Annotation
from interactions.models import Interaction, AnnotationInteraction
from psicquic.mitab import format_interaction


@pytest.mark.django_db
def test_uploaded_non_y2h_method_is_not_reported_as_two_hybrid():
    """An uploaded co-IP row must not come back out as a Y2H interaction."""
    a = Protein.objects.create(gene_name="A", uniprot_id="P1")
    b = Protein.objects.create(gene_name="B", uniprot_id="P2")
    ix = Interaction.objects.create(interactor_A=a, interactor_B=b)
    # This is exactly what upload_parser._handle_detection_method writes.
    ann = Annotation.objects.create(type_name="experiment", annotation="pull down")
    AnnotationInteraction.objects.create(interaction=ix, annotation=ann)

    cols = format_interaction(ix, "tab25").split("\t")
    assert cols[6] != 'psi-mi:"MI:0018"(two hybrid)', "claimed Y2H from a pull down"


@pytest.mark.django_db
def test_uploaded_detection_method_round_trips_with_its_mi_code():
    """What upload captured must come back out, not degrade to "-"."""
    a = Protein.objects.create(gene_name="A", uniprot_id="P1")
    b = Protein.objects.create(gene_name="B", uniprot_id="P2")
    ix = Interaction.objects.create(interactor_A=a, interactor_B=b)
    ann = Annotation.objects.create(type_name="experiment", annotation="pull down")
    AnnotationInteraction.objects.create(interaction=ix, annotation=ann)

    cols = format_interaction(ix, "tab25").split("\t")
    assert cols[6] == 'psi-mi:"MI:0096"(pull down)'


@pytest.mark.django_db
def test_unrecognised_uploaded_label_is_named_not_invented():
    a = Protein.objects.create(gene_name="A", uniprot_id="P1")
    b = Protein.objects.create(gene_name="B", uniprot_id="P2")
    ix = Interaction.objects.create(interactor_A=a, interactor_B=b)
    ann = Annotation.objects.create(
        type_name="experiment", annotation="some novel assay"
    )
    AnnotationInteraction.objects.create(interaction=ix, annotation=ann)

    cols = format_interaction(ix, "tab25").split("\t")
    # Named without an MI code — better than "-", and no term is fabricated.
    assert cols[6] == 'psi-mi:"some novel assay"'
    assert "MI:" not in cols[6]
