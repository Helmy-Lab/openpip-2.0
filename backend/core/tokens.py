from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken as _RefreshToken

from .models import User

# Rotated refresh tokens are never recorded against their user, so blacklisting
# a user's outstanding tokens misses every session that has refreshed once.
# Instead each token carries a fingerprint of the password hash (Django's
# session auth hash, an HMAC — not reversible) and is refused once it no longer
# matches. Rotation copies the payload, so the claim survives every refresh.
PASSWORD_CLAIM = "pwd"


def _password_stamp(user: User) -> str:
    return user.get_session_auth_hash()[:16]


class CustomRefreshToken(_RefreshToken):
    @classmethod
    def for_user(cls, user):
        token = super().for_user(user)
        # Store is_admin in the refresh token payload so it propagates to access tokens
        token["is_admin"] = user.is_staff
        token[PASSWORD_CLAIM] = _password_stamp(user)
        return token

    def verify(self, *args, **kwargs) -> None:
        super().verify(*args, **kwargs)
        user = User.objects.filter(
            **{api_settings.USER_ID_FIELD: self.payload.get(api_settings.USER_ID_CLAIM)}
        ).first()
        if (
            user is None
            or not user.is_active
            or self.payload.get(PASSWORD_CLAIM) != _password_stamp(user)
        ):
            raise TokenError("Token is no longer valid for this account")
        # Re-read rather than carry the login-time value forward, so a
        # demoted admin loses the admin UI at the next refresh.
        self.payload["is_admin"] = user.is_staff

    @property
    def access_token(self):
        access = super().access_token
        # Copy is_admin from refresh payload into every access token we issue
        if "is_admin" in self.payload:
            access["is_admin"] = self.payload["is_admin"]
        # The stamp is only checked on refresh; keep it out of access tokens.
        access.payload.pop(PASSWORD_CLAIM, None)
        return access
