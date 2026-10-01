from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    NotificationViewSet,
    PublicViewView,
    SavedViewViewSet,
    ShareCommentDetailView,
    ShareCommentsView,
    ShareViewSet,
)

router = DefaultRouter()
router.register("saved-views", SavedViewViewSet, basename="saved-view")
router.register("shares", ShareViewSet, basename="share")
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("public-views/<str:token>", PublicViewView.as_view()),
    path("shares/<int:pk>/comments", ShareCommentsView.as_view()),
    path(
        "shares/<int:pk>/comments/<int:comment_id>",
        ShareCommentDetailView.as_view(),
    ),
    path("", include(router.urls)),
]
