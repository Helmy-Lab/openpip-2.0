from rest_framework import serializers

from .models import User


class ProfileSerializer(serializers.ModelSerializer):
    """The editable half of a profile. Username, email and staff status are
    not editable here; the avatar file is handled by the view."""

    # The display name lives in AbstractUser's first_name column.
    name = serializers.CharField(
        source="first_name", max_length=150, required=False, allow_blank=True
    )

    class Meta:
        model = User
        fields = ["name", "affiliation", "position", "website", "bio", "discoverable"]
        # discoverable is a boolean, so it is left out of the blank-allowing
        # sweep over the text fields.
        extra_kwargs = {
            f: {"required": False, "allow_blank": True}
            for f in ["affiliation", "position", "website", "bio"]
        }
        extra_kwargs["discoverable"] = {"required": False}
