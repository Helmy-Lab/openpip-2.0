from django.conf import settings
from django.db import models


class SavedView(models.Model):
    """A search plus the filter/layout settings it was looked at with.

    The network itself is not stored: opening a saved view re-runs the search,
    so a collaborator sees today's data rather than a snapshot.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_views",
    )
    name = models.CharField(max_length=200)
    query = models.TextField()
    # searchStore's view state — score/category/annotation/tissue filters,
    # filter mode, layout, highlight, active table tab. Opaque here: the
    # frontend owns the shape, the backend just hands it back.
    state = models.JSONField(default=dict, blank=True)
    # The owner's own notes on the view. Private: not sent with a share or a
    # public link — a share carries its own note.
    note = models.TextField(blank=True)
    # Unguessable token for the no-login public link; null means no link.
    # Revoking clears it, so an old link stops working for good.
    public_token = models.CharField(max_length=64, unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "saved_views"
        ordering = ["-updated_at"]

    def __str__(self):
        return self.name


class Share(models.Model):
    """One saved view handed to one other user.

    Deleting the row is both "revoke" (by the sender) and "dismiss" (by the
    recipient) — neither party keeps a copy the other cannot see.
    """

    saved_view = models.ForeignKey(
        SavedView,
        on_delete=models.CASCADE,
        related_name="shares",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shares_sent",
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shares_received",
    )
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "shares"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.saved_view.name} -> {self.recipient.username}"


class Comment(models.Model):
    share = models.ForeignKey(
        Share,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="share_comments",
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    # An author can rewrite a comment, so the discussion marks the ones that
    # changed rather than letting them change silently.
    edited = models.BooleanField(default=False)

    class Meta:
        db_table = "share_comments"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.author.username}: {self.body[:40]}"


class Notification(models.Model):
    """In-site only. openPIP sends no mail — see docs/project/specs."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    text = models.CharField(max_length=300)
    # Site-relative, e.g. "/shared/12".
    link = models.CharField(max_length=300, blank=True)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]

    def __str__(self):
        return self.text
