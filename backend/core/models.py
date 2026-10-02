from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.functions import Lower


class User(AbstractUser):
    # [{"question": "...", "answer": "<hashed>"}, ...] — see core.views
    security_questions = models.JSONField(default=list, blank=True)

    # Optional profile details. The display name reuses AbstractUser's
    # first_name column rather than adding one: openPIP asks for a single
    # name, not a given/family pair.
    affiliation = models.CharField(max_length=200, blank=True)
    position = models.CharField(max_length=100, blank=True)
    website = models.URLField(blank=True)
    bio = models.TextField(blank=True)
    # FileField, not ImageField: Pillow is not a dependency, and the upload
    # view checks the content type. See core.views.MeView.
    avatar = models.FileField(upload_to="avatars/", null=True, blank=True)

    # Off means: absent from people search, and cannot be sent a network.
    # The public profile page stays reachable either way — it only ever
    # shows what the user chose to put on it.
    discoverable = models.BooleanField(default=True)

    class Meta:
        db_table = "user"
        constraints = [
            # Accounts predating registration-time email have "", and several
            # may share it, so the constraint has to skip blanks. Lower()
            # because the login and reset flows both match email
            # case-insensitively.
            models.UniqueConstraint(
                Lower("email"),
                condition=~models.Q(email=""),
                name="user_email_unique_nonblank",
            )
        ]

    def __str__(self):
        return self.username


class UserDataset(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        db_column="user_id",
        related_name="user_datasets",
    )
    dataset = models.ForeignKey(
        "datasets.Dataset",
        on_delete=models.CASCADE,
        db_column="dataset_id",
        related_name="user_datasets",
    )

    class Meta:
        db_table = "user_datasets"


class UserInteractionNetwork(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        db_column="user_id",
        related_name="user_networks",
    )
    interaction_network = models.ForeignKey(
        "interactions.InteractionNetwork",
        on_delete=models.CASCADE,
        db_column="interaction_network_id",
        related_name="user_networks",
    )

    class Meta:
        db_table = "user_interaction_networks"


class UserProtein(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        db_column="user_id",
        related_name="user_proteins",
    )
    protein = models.ForeignKey(
        "proteins.Protein",
        on_delete=models.CASCADE,
        db_column="protein_id",
        related_name="user_proteins",
    )

    class Meta:
        db_table = "user_protein"
