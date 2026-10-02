export interface SavedNetwork {
  id: number
  name: string
  query: string
  interaction_count: number
  created_at: string | null
}

export interface AdminSettings {
  title: string
  shortTitle: string
  footer: string
  homePage: string
  /**
   * Home-page prose, moved into the site-text registry (backend migration
   * 0006). Still returned by /api/settings for legacy API parity, but read-only
   * — render and edit these through the `home.mission.*` / `home.methods.*`
   * text keys instead.
   * @deprecated
   */
  missionTitle: string
  /** @deprecated See {@link AdminSettings.missionTitle}. */
  missionText: string
  /** @deprecated See {@link AdminSettings.missionTitle}. */
  methodTitle: string
  /** @deprecated See {@link AdminSettings.missionTitle}. */
  methodText: string
  mainColorScheme: string
  headerColorScheme: string
  logoColorScheme: string
  buttonColorScheme: string
  queryNodeColor: string
  interactorNodeColor: string
  publishedEdgeColor: string
  validatedEdgeColor: string
  verifiedEdgeColor: string
  literatureEdgeColor: string
  url: string
  version: string
  logoUrl?: string | null
  navStyle?: string | null
  /** Per-page navbar style, as `home:gradient,search:solid`. */
  navStyleOverrides?: string | null
  mainColorScheme2?: string | null
  gradientAngle?: number | null
  about: string
  faq: string
  contact: string
  download: string
  /** Annotation features that only apply to a multicellular organism. */
  showTissueExpression: boolean
  showSubcellularLocation: boolean
  /** Search controls as a ribbon under the navbar instead of a left sidebar. */
  horizontalFilterBar: boolean
  /** Network canvas background; null follows the light/dark theme. */
  canvasBackgroundColor?: string | null
  showDownloads: boolean
  showDownloadAll: boolean
  example1: string
  example2: string
  example3: string
  example1Type: string
  example2Type: string
  example3Type: string
}

/** Admin overrides for user-facing copy, keyed by site-text key. */
export interface SiteTextResponse {
  locale: string
  text: Record<string, string>
}

/** One entry of a bulk site-text write. `null` clears the override. */
export interface SiteTextEntry {
  key: string
  value: string | null
}

export interface InteractionCategory {
  id: number
  categoryName: string
  order: string
  colorScheme: string
  description: string
}

export interface Announcement {
  id: number
  title: string
  text: string
  date: string | null
  show: boolean
  showOnHomePage: boolean
}

export interface Counts {
  proteins: number
  interactions: number
  datasets: number
}

export type PublicationStatus = 'published' | 'preprint' | 'unpublished'

export interface DatasetRef {
  id: number
  /** Legacy alias for `pubmed_id`, kept for search/export consumers. */
  dataset_reference: string
  /** Legacy alias for `author`, falls back to "Unpublished Dataset". */
  dataset_author: string
  year: string
  description: string
  interaction_status: string
  name: string
  /** Recomputed after every import; a string because the legacy column is one. */
  number_of_interactions: string | null

  // ── Citation ──
  /** Pre-formatted reference string, or null when the dataset is unciteable. */
  citation: string | null
  pubmed_id: string | null
  author: string | null
  title: string | null
  journal: string | null
  doi: string | null
  url: string | null
  publication_status: PublicationStatus

  // ── About page ──
  about_heading: string | null
  about_body: string | null
  show_on_about: boolean
  about_order: number
}

export interface CategoryEntry {
  category_name: string
  order: number
}

export interface Protein {
  protein_id: number
  protein_uniprot_id: string
  protein_ensembl_id: string
  protein_entrez_id: string
  protein_gene_name: string
  protein_protein_name: string
  protein_description: string
  protein_sequence: string
  number_of_interactions_in_database: number
  annotation_array: Record<string, string>
  tissue_expression_array: Record<string, unknown>
  subcellular_location_expression_array: Record<string, unknown>
  tissue_specificity_array?: Record<string, unknown>
}

export interface Interaction {
  interaction_id: number
  interactor_A: {
    protein_id: number
    protein_uniprot_id: string
    protein_gene_name: string
    protein_ensembl_id: string
  }
  interactor_B: {
    protein_id: number
    protein_uniprot_id: string
    protein_gene_name: string
    protein_ensembl_id: string
  }
  score: number | null
  annotation_array: Record<string, string[]>
  experiment_array: string[]
  dataset_array: DatasetRef[]
  interaction_category_array: {
    highest_category_status: string
    highest_order: number
    interaction_category_array: CategoryEntry[]
  }
}

/** An account listed in Settings → Accounts, for granting admin access. */
export interface AdminUser {
  id: number
  username: string
  email: string
  isAdmin: boolean
  /** Superusers cannot be revoked — is_staff also gates /django-admin/. */
  isSuperuser: boolean
  dateJoined: string
}
