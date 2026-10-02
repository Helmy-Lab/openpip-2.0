from django.urls import path
from .views import (
    LoginView,
    LogoutView,
    RegisterView,
    MeView,
    CustomTokenRefreshView,
    PasswordResetConfirmView,
    SecurityQuestionView,
    SecurityAnswerView,
    UserSearchView,
    PublicProfileView,
)

urlpatterns = [
    path("auth/login", LoginView.as_view()),
    path("auth/logout", LogoutView.as_view()),
    path("auth/token/refresh", CustomTokenRefreshView.as_view()),
    path("auth/register", RegisterView.as_view()),
    path("auth/me", MeView.as_view()),
    path("auth/password-reset-confirm", PasswordResetConfirmView.as_view()),
    path("auth/security-question", SecurityQuestionView.as_view()),
    path("auth/security-answer", SecurityAnswerView.as_view()),
    path("users/search", UserSearchView.as_view()),
    path("users/<str:username>", PublicProfileView.as_view()),
]
