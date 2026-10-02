from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401, F403

# JWTs are signed with SECRET_KEY, so base.py's public fallback would let anyone
# mint an admin token. Refuse to start rather than serve with it.
if SECRET_KEY.startswith("django-insecure"):  # noqa: F405
    raise ImproperlyConfigured("Set a real SECRET_KEY in .env for production.")

# App is mounted at /v2/ in production nginx — tells Django's reverse() to
# prepend this prefix so generated URLs (e.g. Swagger schema link) are correct.
FORCE_SCRIPT_NAME = "/v2"

SECURE_HSTS_SECONDS = 3600
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
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
