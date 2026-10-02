from django.db import models
from proteins.models import Protein, Annotation, Domain


class InteractionCategory(models.Model):
    admin_settings = models.ForeignKey(
        "admin_panel.AdminSettings",
        on_delete=models.SET_NULL,
        null=True,
        db_column="admin_settings_id",
        related_name="interaction_categories",
    )
    category_name = models.CharField(max_length=200, null=True)
    order = models.CharField(max_length=200, null=True)
    color_scheme = models.CharField(max_length=200, null=True)
    description = models.CharField(max_length=1000, null=True)
    selected_by_default = models.CharField(max_length=10, null=True)
    include_in_home_page_count = models.CharField(max_length=10, null=True)

    class Meta:
        db_table = "interaction_category"

    def __str__(self):
        return self.category_name or str(self.pk)

    def sort_key(self) -> tuple:
        """`order` is a text column but holds numbers; sort them as numbers
        ("2" before "10"), as legacy's ksort did. Anything else goes last."""
        order = (self.order or "").strip()
        return (0, int(order), "") if order.isdigit() else (1, 0, order)


class Interaction(models.Model):
    interactor_A = models.ForeignKey(
        Protein,
        on_delete=models.CASCADE,
        db_column="interactor_A",
        related_name="interactions_as_A",
    )
    interactor_B = models.ForeignKey(
        Protein,
        on_delete=models.CASCADE,
        db_column="interactor_B",
        related_name="interactions_as_B",
    )
    score = models.CharField(max_length=10, null=True)
    # MITAB column 36. A negative interaction is a reported *non*-interaction —
    # an experiment that looked and found nothing. Before this field the parser
    # dropped the column and the formatter hardcoded "false", so uploading a
    # negative result re-published it as a positive claim: the opposite of what
    # the depositor stated, which is worse than losing it.
    #
    # Not nullable, because MITAB has no "unstated" for this column: a row that
    # says nothing means the interaction is positive, which is what False says.
    negative = models.BooleanField(default=False)
    # MITAB column 12, as a bare PSI-MI accession ("0407"). Null when the file
    # said nothing, which is different from a stated value — openPIP then falls
    # back to inferring one from the evidence.
    #
    # Stored rather than always inferred because a depositor describing their
    # own experiment outranks our reading of it. That is the same rule taxonomy
    # follows: a taxon stated in the file beats the UniProt lookup.
    interaction_type = models.CharField(max_length=10, null=True, blank=True)
    binding_start = models.CharField(max_length=10, null=True)
    binding_end = models.CharField(max_length=10, null=True)
    removed = models.CharField(max_length=10, default="0")
    domain = models.IntegerField(null=True)

    class Meta:
        db_table = "interaction"
        indexes = [
            # Every search filters WHERE removed='0'
            models.Index(fields=["removed"], name="interaction_removed_idx"),
            # Covers: WHERE interactor_A IN (...) AND interactor_B IN (...)
            models.Index(
                fields=["interactor_A", "interactor_B"], name="interaction_a_b_idx"
            ),
            # Covers: B-side queries in query_interactor filter mode
            models.Index(
                fields=["interactor_B", "interactor_A"], name="interaction_b_a_idx"
            ),
        ]

    def __str__(self):
        return f"{self.interactor_A} — {self.interactor_B}"


class InteractionDataset(models.Model):
    interaction = models.ForeignKey(
        Interaction,
        on_delete=models.CASCADE,
        db_column="interaction_id",
        related_name="interaction_datasets",
    )
    dataset = models.ForeignKey(
        "datasets.Dataset",
        on_delete=models.CASCADE,
        db_column="dataset_id",
        related_name="interaction_datasets",
    )

    class Meta:
        db_table = "interaction_dataset"


class InteractionInteractionCategory(models.Model):
    interaction = models.ForeignKey(
        Interaction,
        on_delete=models.CASCADE,
        db_column="interaction_id",
        related_name="interaction_categories",
    )
    interaction_category = models.ForeignKey(
        InteractionCategory,
        on_delete=models.CASCADE,
        db_column="interaction_category_id",
        related_name="interaction_categories",
    )

    class Meta:
        db_table = "interaction_interaction_category"


class InteractionDomain(models.Model):
    interaction = models.ForeignKey(
        Interaction,
        on_delete=models.CASCADE,
        db_column="interaction_id",
        related_name="interaction_domains",
    )
    domain = models.ForeignKey(
        Domain,
        on_delete=models.CASCADE,
        db_column="domain_id",
        related_name="interaction_domains",
    )

    class Meta:
        db_table = "interaction_domain"


class AnnotationInteraction(models.Model):
    interaction = models.ForeignKey(
        Interaction,
        on_delete=models.CASCADE,
        db_column="interaction_id",
        related_name="annotation_interactions",
    )
    annotation = models.ForeignKey(
        Annotation,
        on_delete=models.CASCADE,
        db_column="annotation_id",
        related_name="annotation_interactions",
    )

    class Meta:
        db_table = "annotation_interaction"


class InteractionNetwork(models.Model):
    name = models.CharField(max_length=100, null=True)
    interactor_query_string = models.CharField(max_length=3000, null=True)
    score_parameter = models.CharField(max_length=100, null=True)
    category_array = models.CharField(max_length=100, null=True)
    tissue_expression_array = models.CharField(max_length=100, null=True)
    query = models.CharField(max_length=100, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        db_table = "interaction_network"

    def __str__(self):
        return self.name or str(self.pk)


class InteractionInteractionNetworks(models.Model):
    interaction_network = models.ForeignKey(
        InteractionNetwork,
        on_delete=models.CASCADE,
        db_column="interaction_network_id",
        related_name="network_interactions",
    )
    interaction = models.ForeignKey(
        Interaction,
        on_delete=models.CASCADE,
        db_column="interaction_id",
        related_name="network_memberships",
    )

    class Meta:
        db_table = "interaction_interaction_networks"


class SupportInformation(models.Model):
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=100, null=True)

    class Meta:
        db_table = "support_information"

    def __str__(self):
        return self.name


class InteractionSupportInformation(models.Model):
    interaction = models.ForeignKey(
        Interaction,
        on_delete=models.CASCADE,
        null=True,
        db_column="interaction_id",
        related_name="support_info",
    )
    support_information = models.ForeignKey(
        SupportInformation,
        on_delete=models.CASCADE,
        null=True,
        db_column="support_information_id",
        related_name="interaction_support",
    )
    value = models.CharField(max_length=100, null=True)

    class Meta:
        db_table = "interaction_support_information"


class InteractionParticipant(models.Model):
    """One protein's role in one interaction.

    PSI-MI models participants as first-class: a protein is not simply "in" an
    interaction, it takes part in a particular way — as bait or prey, as the
    enzyme or the target. MITAB carries that per side (columns 17-22, 37-44),
    and openPIP had nowhere to put it, so the parser discarded those columns and
    the formatter had to re-derive bait/prey from a Y2H annotation blob on every
    request.

    New table, no legacy column touched. Roles are stored as bare PSI-MI
    accession numbers ("0496"), not as rendered `psi-mi:"MI:0496"(bait)` cells,
    so they can be queried — the reason for modelling this rather than keeping
    the JSON passthrough. Labels are resolved at render time from
    psicquic.mitab; a code with no known label still renders, just without the
    parenthetical.
    """

    SIDE_A = "A"
    SIDE_B = "B"
    SIDE_CHOICES = [(SIDE_A, "interactor A"), (SIDE_B, "interactor B")]

    interaction = models.ForeignKey(
        Interaction,
        on_delete=models.CASCADE,
        db_column="interaction_id",
        related_name="participants",
    )
    protein = models.ForeignKey(
        Protein,
        on_delete=models.CASCADE,
        db_column="protein_id",
        related_name="participations",
    )
    side = models.CharField(max_length=1, choices=SIDE_CHOICES)

    # PSI-MI CV accessions, digits only. Null means the source did not say,
    # which is different from MI:0499 "unspecified role" — that is a positive
    # statement that the role is unspecified.
    biological_role = models.CharField(max_length=10, null=True, blank=True)
    experimental_role = models.CharField(max_length=10, null=True, blank=True)
    interactor_type = models.CharField(max_length=10, null=True, blank=True)
    identification_method = models.CharField(max_length=10, null=True, blank=True)
    biological_effect = models.CharField(max_length=10, null=True, blank=True)

    # Free text: these are not CV terms. Features look like
    # "binding-associated region:1-50", stoichiometry is a number or range.
    features = models.CharField(max_length=1000, null=True, blank=True)
    stoichiometry = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = "interaction_participant"
        constraints = [
            models.UniqueConstraint(
                fields=["interaction", "side"], name="one_participant_per_side"
            )
        ]
        indexes = [
            # "which interactions was this protein the bait in"
            models.Index(
                fields=["protein", "experimental_role"], name="participant_role_idx"
            ),
        ]

    def __str__(self):
        return f"{self.protein} as {self.side} in {self.interaction_id}"
