import secrets

from django.db import transaction
from django.db.models import Q
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import User
from .models import Comment, Notification, SavedView, Share
from .serializers import (
    CommentSerializer,
    NotificationSerializer,
    PublicViewSerializer,
    SavedViewSerializer,
    ShareSerializer,
)

# Sharing with someone who does not exist and sharing with someone who has
# turned discoverability off give the same answer, so the endpoint cannot be
# used to test whether an account exists.
NO_SUCH_USER = {"detail": "No such user."}


def display_name(user) -> str:
    return user.first_name or user.username


def notify(user, text: str, link: str) -> None:
    # A display name (150) plus a view name (200) can outrun the column.
    limit = Notification._meta.get_field("text").max_length
    if len(text) > limit:
        text = text[: limit - 1] + "…"
    Notification.objects.create(user=user, text=text, link=link)


# These lists are one user's own and short — a handful of saved views, the
# networks shared with them, the newest notifications. The project default is
# cursor pagination, which would wrap each one in an envelope for no gain.
class SavedViewViewSet(viewsets.ModelViewSet):
    serializer_class = SavedViewSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return SavedView.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post", "delete"], url_path="public-link")
    def public_link(self, request, pk=None):
        """POST mints the no-login link (or returns the one that exists);
        DELETE revokes it. get_object() scopes this to the owner."""
        view = self.get_object()
        if request.method == "DELETE":
            view.public_token = None
        elif not view.public_token:
            view.public_token = secrets.token_urlsafe(32)
        view.save(update_fields=["public_token"])
        return Response(SavedViewSerializer(view).data)


class PublicViewView(APIView):
    """A saved view opened by its public link, no login. Read-only."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token):
        view = SavedView.objects.filter(public_token=token).first()
        if view is None:
            return Response(
                {"detail": "This link is no longer active."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(PublicViewSerializer(view).data)


class ShareViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ShareSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        # Both parties can read and delete: delete is "revoke" for the sender
        # and "dismiss" for the recipient.
        qs = Share.objects.filter(Q(sender=user) | Q(recipient=user))
        if self.action == "list":
            if self.request.query_params.get("direction") == "sent":
                qs = qs.filter(sender=user)
            else:
                qs = qs.filter(recipient=user)
        return qs.select_related("saved_view", "sender", "recipient")

    def create(self, request):
        saved_view = SavedView.objects.filter(
            pk=request.data.get("saved_view"), user=request.user
        ).first()
        if saved_view is None:
            return Response(
                {"detail": "No such saved view."}, status=status.HTTP_400_BAD_REQUEST
            )
        recipient = User.objects.filter(
            username=request.data.get("recipient", ""),
            is_active=True,
            discoverable=True,
        ).first()
        if recipient is None or recipient == request.user:
            return Response(NO_SUCH_USER, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            share = Share.objects.create(
                saved_view=saved_view,
                sender=request.user,
                recipient=recipient,
                note=str(request.data.get("note", "")).strip(),
            )
            notify(
                recipient,
                f'{display_name(request.user)} shared "{saved_view.name}" with you',
                f"/shared/{share.pk}",
            )
        return Response(ShareSerializer(share).data, status=status.HTTP_201_CREATED)


def visible_share(request, pk):
    """The share, if this user is one of its two participants."""
    return Share.objects.filter(
        Q(pk=pk) & (Q(sender=request.user) | Q(recipient=request.user))
    ).first()


class ShareCommentsView(APIView):
    """Discussion attached to one shared network. Participants only."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        share = visible_share(request, pk)
        if share is None:
            return Response(NO_SUCH_USER, status=status.HTTP_404_NOT_FOUND)
        return Response(
            CommentSerializer(share.comments.select_related("author"), many=True).data
        )

    def post(self, request, pk):
        share = visible_share(request, pk)
        if share is None:
            return Response(NO_SUCH_USER, status=status.HTTP_404_NOT_FOUND)
        body = str(request.data.get("body", "")).strip()
        if not body:
            return Response(
                {"detail": "Comment cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            comment = Comment.objects.create(
                share=share, author=request.user, body=body
            )
            other = share.recipient if request.user == share.sender else share.sender
            notify(
                other,
                f'{display_name(request.user)} commented on "{share.saved_view.name}"',
                f"/shared/{share.pk}",
            )
        return Response(CommentSerializer(comment).data, status=status.HTTP_201_CREATED)


class ShareCommentDetailView(APIView):
    """Editing one's own message. Only the author, and only the body."""

    permission_classes = [IsAuthenticated]

    def patch(self, request, pk, comment_id):
        share = visible_share(request, pk)
        comment = (
            None
            if share is None
            else Comment.objects.filter(
                pk=comment_id, share=share, author=request.user
            ).first()
        )
        if comment is None:
            return Response(NO_SUCH_USER, status=status.HTTP_404_NOT_FOUND)
        body = str(request.data.get("body", "")).strip()
        if not body:
            return Response(
                {"detail": "Comment cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        comment.body = body
        comment.edited = True
        comment.save(update_fields=["body", "edited"])
        return Response(CommentSerializer(comment).data)


class NotificationViewSet(
    mixins.ListModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = Notification.objects.filter(user=self.request.user)
        # ponytail: newest 50, no pagination — the bell shows a short list and
        # nobody scrolls a notification history. Paginate if that changes.
        # Sliced for the list only: a slice cannot be filtered again, which
        # get_object() does when marking one read.
        return qs[:50] if self.action == "list" else qs

    @action(detail=False, methods=["post"])
    def clear(self, request):
        """Empty the bell. The shares themselves stay on the profile."""
        Notification.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        """Quiet the badge without deleting anything, unlike clear()."""
        Notification.objects.filter(user=request.user, read=False).update(read=True)
        return Response(status=status.HTTP_204_NO_CONTENT)
