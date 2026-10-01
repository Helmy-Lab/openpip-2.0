from django.db import models


class AdminSettings(models.Model):
    title = models.CharField(max_length=200, null=True)
    short_title = models.CharField(max_length=200, null=True)
    url = models.CharField(max_length=200, null=True)
    version = models.CharField(max_length=200, null=True)
    home_page = models.TextField(null=True)
    about = models.TextField(null=True)
    faq = models.TextField(null=True)
    download = models.TextField(null=True)
    contact = models.TextField(null=True)
    show_downloads = models.BooleanField(default=False)
    show_download_all = models.BooleanField(default=False)
    # Annotation features that only mean something for a multicellular organism.
    # The paper records that these "had to be manually removed from the code"
    # to host the yeast YeRI dataset; openPIP is software other labs install, so
    # editing source to hide a tab is not a reasonable ask. Default on, because
    # the reference deployment is human.
    show_tissue_expression = models.BooleanField(default=True)
    show_subcellular_location = models.BooleanField(default=True)
    # Search controls as a ribbon under the navbar rather than a left
    # sidebar. A deployment-wide choice: whoever installs openPIP decides
    # which shape its search page has, the same way they pick its colours.
    horizontal_filter_bar = models.BooleanField(default=False)
    # Network canvas background. Null follows the light/dark theme; viewers
    # can still override it for themselves in the browser.
    canvas_background_color = models.CharField(max_length=20, null=True, blank=True)
    footer = models.TextField(null=True)
    main_color_scheme = models.CharField(max_length=10, null=True)
    header_color_scheme = models.CharField(max_length=10, null=True)
    logo_color_scheme = models.CharField(max_length=10, null=True)
    button_color_scheme = models.CharField(max_length=10, null=True)
    logo = models.FileField(upload_to="logos/", null=True, blank=True)
    nav_style = models.CharField(max_length=20, default="solid", null=True, blank=True)
    # Per-page navbar style, as "home:gradient,search:solid". Pages absent
    # from the list follow nav_style, so one deployment-wide choice still
    # works and an override is only stored where an admin set one.
    nav_style_overrides = models.TextField(null=True, blank=True)
    main_color_scheme_2 = models.CharField(max_length=20, null=True, blank=True)
    gradient_angle = models.IntegerField(default=135, null=True, blank=True)
    example_1 = models.TextField(null=True)
    example_2 = models.TextField(null=True)
    example_3 = models.TextField(null=True)
    example_1_type = models.CharField(max_length=50, null=True)
    example_2_type = models.CharField(max_length=50, null=True)
    example_3_type = models.CharField(max_length=50, null=True)
    query_node_color = models.CharField(max_length=20, null=True)
    interactor_node_color = models.CharField(max_length=20, null=True)
    published_edge_color = models.CharField(max_length=20, null=True)
    validated_edge_color = models.CharField(max_length=20, null=True)
    verified_edge_color = models.CharField(max_length=20, null=True)
    literature_edge_color = models.CharField(max_length=20, null=True)

    class Meta:
        db_table = "admin_settings"
        verbose_name_plural = "admin settings"

    def __str__(self):
        return self.title or "AdminSettings"


class SiteText(models.Model):
    """An admin override for one piece of user-facing copy.

    Rows exist only for keys an admin has actually customized. The frontend
    owns the registry of keys and their default copy, so an absent row simply
    means "use the shipped default" and a stale row for a retired key is inert.
    """

    key = models.CharField(max_length=200)
    locale = models.CharField(max_length=10, default="en")
    value = models.TextField(blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "site_text"
        verbose_name_plural = "site text"
        constraints = [
            models.UniqueConstraint(
                fields=["key", "locale"], name="site_text_key_locale_uniq"
            )
        ]
        indexes = [models.Index(fields=["locale"], name="site_text_locale_idx")]

    def __str__(self):
        return f"{self.key} [{self.locale}]"


class Announcement(models.Model):
    title = models.CharField(max_length=100)
    text = models.CharField(max_length=4000)
    date = models.DateTimeField(null=True)
    show = models.BooleanField(default=True)
    show_on_home_page = models.BooleanField(default=True)

    class Meta:
        db_table = "announcement"

    def __str__(self):
        return self.title
