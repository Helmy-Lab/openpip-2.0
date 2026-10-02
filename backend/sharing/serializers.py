from rest_framework import serializers

from core.views import user_card
from .models import Comment, Notification, SavedView, Share


class UserCardField(serializers.Field):
    """A user rendered as the public card, read-only."""

    def __init__(self, **kwargs):
        kwargs.setdefault("read_only", True)
        super().__init__(**kwargs)

    def to_representation(self, user):
        return user_card(user)


class SavedViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedView
        fields = [
            "id",
            "name",
            "query",
            "state",
            "note",
            "public_token",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "public_token", "created_at", "updated_at"]


class PublicViewSerializer(serializers.ModelSerializer):
    """What a no-login visitor needs to re-run the view — nothing about the
    owner, and not the owner's private note."""

    class Meta:
        model = SavedView
        fields = ["name", "query", "state"]


class SavedViewNestedSerializer(serializers.ModelSerializer):
    """The view as a share recipient sees it: without the owner's own note
    or public-link token."""

    class Meta:
        model = SavedView
        fields = ["id", "name", "query", "state", "created_at", "updated_at"]


class ShareSerializer(serializers.ModelSerializer):
    saved_view = SavedViewNestedSerializer(read_only=True)
    sender = UserCardField()
    recipient = UserCardField()

    class Meta:
        model = Share
        fields = ["id", "saved_view", "sender", "recipient", "note", "created_at"]


class CommentSerializer(serializers.ModelSerializer):
    author = UserCardField()

    class Meta:
        model = Comment
        fields = ["id", "author", "body", "created_at", "edited"]
        read_only_fields = ["id", "created_at", "edited"]


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "text", "link", "read", "created_at"]
        read_only_fields = ["id", "text", "link", "created_at"]
