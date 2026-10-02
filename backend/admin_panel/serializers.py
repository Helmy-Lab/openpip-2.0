from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import AdminSettings, Announcement, SiteText
from interactions.models import InteractionCategory

User = get_user_model()


class SiteTextMirrorField(serializers.CharField):
    """Read-only view of one site_text override, exposed on /api/settings.

    The home-page prose these fields describe moved into the site_text table in
    migration 0006, but the legacy settings payload advertises them and
    tests/parity/test_catalog_parity.py asserts they are present, so they stay
    on the response. Writes go through /api/settings/text instead.
    """

    def __init__(self, text_key: str, **kwargs):
        self.text_key = text_key
        kwargs["read_only"] = True
        super().__init__(**kwargs)

    def get_attribute(self, instance):
        # The value comes from site_text, not from the settings row, but DRF
        # still needs a non-None attribute to hand to to_representation.
        return instance

    def to_representation(self, value) -> str:
        return self.parent.home_prose().get(self.text_key, "")


class AdminSettingsSerializer(serializers.ModelSerializer):
    title = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    footer = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    url = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    version = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    shortTitle = serializers.CharField(
        source="short_title", allow_null=True, allow_blank=True, required=False
    )
    homePage = serializers.CharField(
        source="home_page", allow_null=True, allow_blank=True, required=False
    )
    missionTitle = SiteTextMirrorField("home.mission.heading")
    missionText = SiteTextMirrorField("home.mission.body")
    methodTitle = SiteTextMirrorField("home.methods.heading")
    methodText = SiteTextMirrorField("home.methods.body")
    mainColorScheme = serializers.CharField(
        source="main_color_scheme", allow_null=True, allow_blank=True, required=False
    )
    headerColorScheme = serializers.CharField(
        source="header_color_scheme", allow_null=True, allow_blank=True, required=False
    )
    logoColorScheme = serializers.CharField(
        source="logo_color_scheme", allow_null=True, allow_blank=True, required=False
    )
    buttonColorScheme = serializers.CharField(
        source="button_color_scheme", allow_null=True, allow_blank=True, required=False
    )
    queryNodeColor = serializers.CharField(
        source="query_node_color", allow_null=True, allow_blank=True, required=False
    )
    interactorNodeColor = serializers.CharField(
        source="interactor_node_color",
        allow_null=True,
        allow_blank=True,
        required=False,
    )
    publishedEdgeColor = serializers.CharField(
        source="published_edge_color", allow_null=True, allow_blank=True, required=False
    )
    validatedEdgeColor = serializers.CharField(
        source="validated_edge_color", allow_null=True, allow_blank=True, required=False
    )
    verifiedEdgeColor = serializers.CharField(
        source="verified_edge_color", allow_null=True, allow_blank=True, required=False
    )
    literatureEdgeColor = serializers.CharField(
        source="literature_edge_color",
        allow_null=True,
        allow_blank=True,
        required=False,
    )
    logoUrl = serializers.SerializerMethodField()
    navStyle = serializers.CharField(
        source="nav_style", allow_null=True, allow_blank=True, required=False
    )
    navStyleOverrides = serializers.CharField(
        source="nav_style_overrides", allow_null=True, allow_blank=True, required=False
    )
    mainColorScheme2 = serializers.CharField(
        source="main_color_scheme_2", allow_null=True, allow_blank=True, required=False
    )
    gradientAngle = serializers.IntegerField(
        source="gradient_angle", allow_null=True, required=False
    )
    about = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    faq = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    contact = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    download = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    showTissueExpression = serializers.BooleanField(
        source="show_tissue_expression", required=False
    )
    showSubcellularLocation = serializers.BooleanField(
        source="show_subcellular_location", required=False
    )
    horizontalFilterBar = serializers.BooleanField(
        source="horizontal_filter_bar", required=False
    )
    canvasBackgroundColor = serializers.CharField(
        source="canvas_background_color",
        allow_null=True,
        allow_blank=True,
        required=False,
    )
    showDownloads = serializers.BooleanField(source="show_downloads", required=False)
    showDownloadAll = serializers.BooleanField(
        source="show_download_all", required=False
    )
    example1 = serializers.CharField(
        source="example_1", allow_null=True, allow_blank=True, required=False
    )
    example2 = serializers.CharField(
        source="example_2", allow_null=True, allow_blank=True, required=False
    )
    example3 = serializers.CharField(
        source="example_3", allow_null=True, allow_blank=True, required=False
    )
    example1Type = serializers.CharField(
        source="example_1_type", allow_null=True, allow_blank=True, required=False
    )
    example2Type = serializers.CharField(
        source="example_2_type", allow_null=True, allow_blank=True, required=False
    )
    example3Type = serializers.CharField(
        source="example_3_type", allow_null=True, allow_blank=True, required=False
    )

    class Meta:
        model = AdminSettings
        fields = [
            "title",
            "shortTitle",
            "footer",
            "homePage",
            "missionTitle",
            "missionText",
            "methodTitle",
            "methodText",
            "mainColorScheme",
            "headerColorScheme",
            "logoColorScheme",
            "buttonColorScheme",
            "queryNodeColor",
            "interactorNodeColor",
            "publishedEdgeColor",
            "validatedEdgeColor",
            "verifiedEdgeColor",
            "literatureEdgeColor",
            "url",
            "version",
            "logoUrl",
            "navStyle",
            "navStyleOverrides",
            "mainColorScheme2",
            "gradientAngle",
            "about",
            "faq",
            "contact",
            "download",
            "showTissueExpression",
            "showSubcellularLocation",
            "horizontalFilterBar",
            "canvasBackgroundColor",
            "showDownloads",
            "showDownloadAll",
            "example1",
            "example2",
            "example3",
            "example1Type",
            "example2Type",
            "example3Type",
        ]

    #: Legacy payload field → the site_text key that now backs it.
    HOME_PROSE_KEYS = {
        "home.mission.heading",
        "home.mission.body",
        "home.methods.heading",
        "home.methods.body",
    }

    def home_prose(self) -> dict[str, str]:
        """The home-page prose overrides, fetched once per serialization."""
        if not hasattr(self, "_home_prose"):
            self._home_prose = dict(
                SiteText.objects.filter(
                    key__in=self.HOME_PROSE_KEYS, locale="en"
                ).values_list("key", "value")
            )
        return self._home_prose

    def get_logoUrl(self, obj):
        if not obj.logo:
            return None
        return obj.logo.url


class SiteTextSerializer(serializers.ModelSerializer):
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = SiteText
        fields = ["key", "locale", "value", "updatedAt"]


class SiteTextWriteSerializer(serializers.Serializer):
    """Validates one entry of a bulk site-text write.

    A blank or null value is meaningful: it clears the override so the shipped
    default takes over again.
    """

    key = serializers.CharField(max_length=200)
    value = serializers.CharField(
        allow_blank=True, allow_null=True, required=False, trim_whitespace=False
    )

    def validate_key(self, value: str) -> str:
        key = value.strip()
        if not key:
            raise serializers.ValidationError("Key must not be blank.")
        return key


class AnnouncementSerializer(serializers.ModelSerializer):
    showOnHomePage = serializers.BooleanField(source="show_on_home_page")

    class Meta:
        model = Announcement
        fields = ["id", "title", "text", "date", "show", "showOnHomePage"]


class AdminUserSerializer(serializers.ModelSerializer):
    """A selectable account, plus whether it already holds admin access.

    isSuperuser is exposed so the UI can grey out a revoke it knows the API
    will refuse; AdminUserDetailView is what actually enforces that.
    """

    isAdmin = serializers.BooleanField(source="is_staff", read_only=True)
    isSuperuser = serializers.BooleanField(source="is_superuser", read_only=True)
    dateJoined = serializers.DateTimeField(source="date_joined", read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "isAdmin", "isSuperuser", "dateJoined"]
        read_only_fields = fields


class InteractionCategorySerializer(serializers.ModelSerializer):
    categoryName = serializers.CharField(
        source="category_name", allow_null=True, allow_blank=True, required=False
    )
    colorScheme = serializers.CharField(
        source="color_scheme", allow_null=True, allow_blank=True, required=False
    )

    class Meta:
        model = InteractionCategory
        fields = ["id", "categoryName", "order", "colorScheme", "description"]
