from rest_framework.throttling import SimpleRateThrottle


class EveryCallerRateThrottle(SimpleRateThrottle):
    """Throttles signed-in callers too, unlike DRF's AnonRateThrottle.

    AnonRateThrottle returns no cache key for an authenticated request, so a
    scope built on it stops applying the moment someone logs in — and anyone
    can register. Signed-in callers are counted per account, the rest per IP.
    """

    def get_cache_key(self, request, view):
        user = request.user
        ident = f"user-{user.pk}" if user and user.is_authenticated else None
        return self.cache_format % {
            "scope": self.scope,
            "ident": ident or self.get_ident(request),
        }


class SecurityAnswerThrottle(EveryCallerRateThrottle):
    scope = "security_answer"


class SecurityAnswerAccountThrottle(SimpleRateThrottle):
    """Caps guesses at one account's answers, whoever and wherever they come
    from: the per-caller limit alone falls to rotating IPs or accounts."""

    scope = "security_answer_account"

    def get_cache_key(self, request, view):
        email = str(request.data.get("email", "")).strip().lower()
        if not email:
            return None
        return self.cache_format % {"scope": self.scope, "ident": email}
