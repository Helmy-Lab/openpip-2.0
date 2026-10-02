from django.http import HttpResponse, JsonResponse
from rest_framework.negotiation import DefaultContentNegotiation
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from core.throttling import EveryCallerRateThrottle

from .miql import UnsupportedQuery, parse_miql
from .mitab import format_queryset, VERSION_WIDTHS


class IgnoreFormatQueryParam(DefaultContentNegotiation):
    """Stop DRF from claiming PSICQUIC's `format` parameter.

    DRF reads ?format=x as "render with the renderer named x" and 404s before
    the view runs when there is none. PSICQUIC defines the same parameter with
    an entirely different meaning (tab25, count, json), and the spec wins on
    this URL. These views build their own responses, so negotiation has nothing
    useful to do anyway.
    """

    def select_renderer(self, request, renderers, format_suffix=None):
        return renderers[0], renderers[0].media_type


class PsicquicThrottle(EveryCallerRateThrottle):
    """Rate limit for the public PSICQUIC surface.

    These endpoints are unauthenticated and return bulk data, so they are the
    cheapest thing on the site to hammer. The rate is in settings under the
    "psicquic" scope; it is sized to leave a full paged crawl comfortable while
    stopping a loop with no sleep in it.

    Throttling by IP is a blunt instrument — it counts a shared NAT as one
    caller. If that becomes a problem the answer is API keys, not a looser rate.
    """

    scope = "psicquic"


class PsicquicView(APIView):
    """Shared base: public, throttled, and returning plain responses.

    These were django.views.View before, which DRF's throttling never sees.
    APIView returns HttpResponse untouched — content negotiation only applies
    to DRF's own Response — so the output is byte-identical.
    """

    permission_classes = [AllowAny]
    throttle_classes = [PsicquicThrottle]
    content_negotiation_class = IgnoreFormatQueryParam


# Formats this service answers to. The tab* names and `count` are PSICQUIC spec
# names; `json` is an openPIP extension for browser callers that do not want to
# parse tab-separated text.
#
# tab25 stays the default: it is what PSICQUIC clients ask for unless told
# otherwise, and the wider versions add mostly "-" for openPIP. 2.8 is still
# outstanding — the paper commits to it (Helmy et al., JMB 2022, Future
# Directions).
# Derived from the formatter rather than restated, so adding 2.8 there advertises
# it here automatically instead of being advertised and then 406'd, or the reverse.
SUPPORTED_FORMATS = tuple(VERSION_WIDTHS) + ("count", "json")

# This service's own version, which is what /version means. Checked against the
# EBI registry: the 34 services registered there report 1.5.3, 1.3.3 and 1.3.14
# — values that disagree with each other and carry patch levels, so the field is
# each service's build of the PSICQUIC reference implementation, not a shared
# specification level. The registry record has no separate restVersion field.
#
# openPIP does not run the reference implementation, so reporting a number from
# its series would invite a client to infer an old psicquic-ws build and the
# capabilities that go with it. openPIP's own release number says what is
# actually serving.
SERVICE_VERSION = "2.0.0"
# The spec sets no cap for tab formats; like its 500 limit for XML, going over
# is a 400, not a silently short page a client would read as the last one.
MAX_RESULTS = 2500


def _plain(content: str, status: int = 200) -> HttpResponse:
    return HttpResponse(
        content, status=status, content_type="text/plain; charset=utf-8"
    )


class PsicquicQueryView(PsicquicView):
    def get(self, request):
        query = request.GET.get("q", "*")
        fmt = request.GET.get("format", "tab25").lower()

        if fmt not in SUPPORTED_FORMATS:
            # The spec's answer for a format the service cannot produce. Falling
            # through to TAB — as this view used to — meant format=xml25 got
            # tab-separated text labelled as the caller's requested format.
            return _plain(
                f"Unsupported format: {fmt}. "
                f"Supported formats: {', '.join(SUPPORTED_FORMATS)}\n",
                status=406,
            )

        try:
            matches = parse_miql(query)
        except UnsupportedQuery as exc:
            # 400, not an empty result set: a federating client must be able to
            # tell "openPIP cannot answer this" from "openPIP holds none".
            return _plain(f"{exc}\n", status=400)

        if fmt == "count":
            return _plain(str(matches.count()))

        try:
            first = int(request.GET.get("firstResult", 0))
            max_results = int(request.GET.get("maxResults", 200))
        except ValueError:
            return _plain("firstResult and maxResults must be integers\n", status=400)
        if first < 0 or max_results < 0:
            return _plain(
                "firstResult and maxResults must not be negative\n", status=400
            )
        if max_results > MAX_RESULTS:
            return _plain(f"maxResults must be at most {MAX_RESULTS}\n", status=400)

        qs = matches[first : first + max_results]

        if fmt == "json":
            data = [
                {
                    "interactor_a": {
                        "uniprot_id": i.interactor_A.uniprot_id,
                        "gene_name": i.interactor_A.gene_name,
                    },
                    "interactor_b": {
                        "uniprot_id": i.interactor_B.uniprot_id,
                        "gene_name": i.interactor_B.gene_name,
                    },
                    "score": i.score,
                    "interaction_id": i.pk,
                }
                for i in qs.select_related("interactor_A", "interactor_B")
            ]
            return JsonResponse(data, safe=False)

        return _plain(format_queryset(qs, fmt))


class PsicquicCountView(PsicquicView):
    def get(self, request):
        query = request.GET.get("q", "*")
        try:
            return _plain(str(parse_miql(query).count()))
        except UnsupportedQuery as exc:
            return _plain(f"{exc}\n", status=400)


class PsicquicFormatsView(PsicquicView):
    """The formats this service can return, one per line.

    The EBI registry polls this to learn what a service supports; without it a
    listing cannot be validated.
    """

    def get(self, request):
        return _plain("\n".join(SUPPORTED_FORMATS) + "\n")


class PsicquicVersionView(PsicquicView):
    """This service's version, per the PSICQUIC REST convention."""

    def get(self, request):
        return _plain(SERVICE_VERSION + "\n")
