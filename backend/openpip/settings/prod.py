from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401, F403

# JWTs are signed with SECRET_KEY, so base.py's public fallback would let anyone
# mint an admin token. Refuse to start rather than serve with it.
if SECRET_KEY.startswith("django-insecure"):  # noqa: F405
    raise ImproperlyConfigured("Set a real SECRET_KEY in .env for production.")

# The path the site is served under, taken from PUBLIC_URL (e.g. "/v2"), so
# reverse() and STATIC_URL generate URLs with it. Empty at the root of a domain.
# The frontend image derives its VITE_BASE from the same PUBLIC_URL.
_parts = PUBLIC_URL_PARTS  # noqa: F405
FORCE_SCRIPT_NAME = (_parts.path if _parts else "").rstrip("/")

# Enforce HTTPS only when the public address is https. Unset or http:// is a
# local install (http://localhost:8080), where a redirect to https would leave
# the site unreachable.
_HTTPS = PUBLIC_URL.startswith("https://")  # noqa: F405
SECURE_HSTS_SECONDS = 3600 if _HTTPS else 0
SECURE_SSL_REDIRECT = _HTTPS
SESSION_COOKIE_SECURE = _HTTPS
CSRF_COOKIE_SECURE = _HTTPS
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

DATABASES["default"]["CONN_MAX_AGE"] = 60  # noqa: F405

# Rate limits identify anonymous callers by IP. Requests arrive through the
# host's HTTPS proxy, which sets X-Forwarded-For, then the frontend nginx,
# which leaves it alone — so only the last address in that header is trusted.
# Without this DRF keyed on the whole client-supplied header, and a caller could
# get a fresh limit by sending a different value each time.
REST_FRAMEWORK = {**REST_FRAMEWORK, "NUM_PROXIES": 1}  # noqa: F405

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "WARNING",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "datasets": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
