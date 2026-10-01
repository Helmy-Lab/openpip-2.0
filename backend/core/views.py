import logging
import uuid

from django.contrib.auth import authenticate
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.db.models import Q
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.views import TokenRefreshView
from .tokens import CustomRefreshToken

from .models import User
from .serializers import ProfileSerializer

logger = logging.getLogger(__name__)
_token_generator = PasswordResetTokenGenerator()


SECURITY_QUESTION_COUNT = 3


def _normalize_answer(answer: str) -> str:
    """Case- and whitespace-insensitive, so 'My  Dog ' matches 'my dog'."""
    return " ".join(answer.split()).lower()


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username", "")
        password = request.data.get("password", "")
        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response(
                {"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED
            )
        refresh = CustomRefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "is_admin": user.is_staff,
            }
        )


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if refresh_token:
            try:
                token = CustomRefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass
        return Response({"detail": "Logged out"})


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username", "").strip()
        email = request.data.get("email", "").strip()
        password = request.data.get("password", "").strip()
        pairs = request.data.get("security_questions") or []
        if not username or not email or not password:
            return Response(
                {"detail": "All fields required."}, status=status.HTTP_400_BAD_REQUEST
            )
        if not isinstance(pairs, list) or not all(isinstance(p, dict) for p in pairs):
            pairs = []
        questions = [str(p.get("question", "")).strip() for p in pairs]
        answers = [str(p.get("answer", "")).strip() for p in pairs]
        if (
            len(pairs) != SECURITY_QUESTION_COUNT
            or not all(questions)
            or not all(answers)
        ):
            return Response(
                {"detail": f"Answer {SECURITY_QUESTION_COUNT} security questions."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(set(questions)) != len(questions):
            return Response(
                {"detail": "Pick three different security questions."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if User.objects.filter(username=username).exists():
            return Response(
                {"detail": "Username already taken."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Checked here as well as by the database constraint: the reset flow
        # looks an account up by email, so two accounts sharing one would make
        # that lookup ambiguous.
        if User.objects.filter(email__iexact=email).exists():
            return Response(
                {"detail": "Email already registered."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        User.objects.create_user(
            username=username,
            email=email,
            password=password,
            security_questions=[
                {"question": q, "answer": make_password(_normalize_answer(a))}
                for q, a in zip(questions, answers)
            ],
        )
        return Response(
            {"detail": "Registration successful"}, status=status.HTTP_201_CREATED
        )


# The stored extension comes from this map, never from the client's filename:
# media is served by extension, so "x.html" sent as image/png would come back
# as same-origin HTML able to read the JWTs in localStorage.
AVATAR_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
}
AVATAR_MAX_BYTES = 2 * 1024 * 1024


def _profile_payload(user):
    return {
        "username": user.username,
        "email": user.email,
        "is_admin": user.is_staff,
        # The display name lives in first_name; openPIP asks for one name.
        "name": user.first_name,
        "affiliation": user.affiliation,
        "position": user.position,
        "website": user.website,
        "bio": user.bio,
        "discoverable": user.discoverable,
        # Relative, like AdminSettings.logoUrl: the page is served from the
        # same origin, and an absolute URL would name the backend's own host.
        "avatar": user.avatar.url if user.avatar else None,
    }


class MeView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        return Response(_profile_payload(request.user))

    def patch(self, request):
        """Update the optional profile details. Every field is optional, and
        an omitted field is left alone; an empty string clears one."""
        user = request.user
        serializer = ProfileSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # The avatar arrives as a file on the same PATCH; an empty "avatar"
        # value clears the current one.
        if "avatar" in request.FILES:
            upload = request.FILES["avatar"]
            if upload.content_type not in AVATAR_TYPES:
                return Response(
                    {"detail": "Unsupported image type."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if upload.size > AVATAR_MAX_BYTES:
                return Response(
                    {"detail": "Image must be 2 MB or smaller."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if user.avatar:
                user.avatar.delete(save=False)
            upload.name = uuid.uuid4().hex + AVATAR_TYPES[upload.content_type]
            user.avatar = upload
            user.save(update_fields=["avatar"])
        elif request.data.get("avatar") == "" and user.avatar:
            user.avatar.delete(save=False)
            user.save(update_fields=["avatar"])

        return Response(_profile_payload(user))


def user_card(user):
    """The slice of a profile other users are allowed to see."""
    return {
        "username": user.username,
        "name": user.first_name,
        "affiliation": user.affiliation,
        "avatar": user.avatar.url if user.avatar else None,
    }


class UserSearchView(APIView):
    """Find someone to share a network with, by name, username, lab or email."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        # Two characters is the point where the result list means something;
        # below it every user in the deployment would match.
        if len(q) < 2:
            return Response([])
        matches = (
            User.objects.filter(is_active=True, discoverable=True)
            .filter(
                Q(username__icontains=q)
                | Q(first_name__icontains=q)
                | Q(affiliation__icontains=q)
                # Exact only: a substring match would turn this into an
                # address-harvesting endpoint.
                | Q(email__iexact=q)
            )
            .exclude(pk=request.user.pk)
            .order_by("first_name", "username")[:10]
        )
        return Response([user_card(u) for u in matches])


class PublicProfileView(APIView):
    """Whatever a user chose to put on their profile, shown to other users."""

    permission_classes = [IsAuthenticated]

    def get(self, request, username):
        user = User.objects.filter(username=username, is_active=True).first()
        if user is None:
            return Response(
                {"detail": "No such user."}, status=status.HTTP_404_NOT_FOUND
            )
        # discoverable only governs search and sharing: someone who has already
        # been given a link to a profile can read it.
        return Response(
            {
                **user_card(user),
                "position": user.position,
                "website": user.website,
                "bio": user.bio,
                "joined": user.date_joined,
            }
        )


class SecurityQuestionView(APIView):
    """Step 1 of the reset flow: look up the questions set at registration."""

    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip()
        user = User.objects.filter(email__iexact=email).first()
        if user is None or not user.security_questions:
            return Response(
                {"detail": "No security questions are set for that email."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({"questions": [p["question"] for p in user.security_questions]})


class _SecurityAnswerThrottle(AnonRateThrottle):
    # CACHES points at Redis when REDIS_URL is set, so this counts across all
    # gunicorn workers rather than per process. Without it the effective limit
    # was silently 3x the configured one.
    scope = "security_answer"


class SecurityAnswerView(APIView):
    """Step 2: a correct answer hands back a normal password-reset token."""

    permission_classes = [AllowAny]
    throttle_classes = [_SecurityAnswerThrottle]

    def post(self, request):
        email = request.data.get("email", "").strip()
        answers = request.data.get("answers") or []
        user = User.objects.filter(email__iexact=email).first()
        stored = user.security_questions if user else []
        # Every answer must match, in the order the questions were returned.
        correct = len(answers) == len(stored) and all(
            check_password(_normalize_answer(str(given)), pair["answer"])
            for given, pair in zip(answers, stored)
        )
        if not stored or not correct:
            logger.info("Failed security answers for %s", email)
            return Response(
                {"detail": "Those answers are incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {
                "uid": urlsafe_base64_encode(force_bytes(user.pk)),
                "token": _token_generator.make_token(user),
            }
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        uid = request.data.get("uid", "")
        token = request.data.get("token", "")
        password = request.data.get("password", "").strip()

        if not uid or not token or not password:
            return Response(
                {"detail": "uid, token, and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(password) < 8:
            return Response(
                {"detail": "Password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=pk)
        except (User.DoesNotExist, ValueError, TypeError):
            return Response(
                {"detail": "Invalid reset link."}, status=status.HTTP_400_BAD_REQUEST
            )

        if not _token_generator.check_token(user, token):
            return Response(
                {"detail": "Reset link is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(password)
        user.save()
        logger.info("Password reset completed for user %s", user.username)
        return Response({"detail": "Password updated successfully."})


class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    token_class = CustomRefreshToken


class CustomTokenRefreshView(TokenRefreshView):
    serializer_class = CustomTokenRefreshSerializer
