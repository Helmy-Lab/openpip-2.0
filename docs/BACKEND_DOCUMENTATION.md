> **Superseded.** This working note is out of date in places and is not part of
> the published documentation. For current, verified behaviour see the
> documentation site (`docs/`, built with `mkdocs.yml`): the API reference in `docs/developer/api/`, configuration in `docs/operator-guide/configuration.md` and deployment in `docs/operator-guide/installation.md`.

# openPIP 2.0 — Backend Documentation

> **Purpose:** A complete, implementation-grade reference for recreating the Django 5 + DRF backend, derived from the legacy PHP/Symfony codebase (`~/openPIP/`) and the live frontend TypeScript contracts (`~/openpip-2.0/frontend/src/`).
>
> **Source of truth for URLs and response shapes:** the frontend API layer (`src/api/*.ts`, `src/types/api.ts`, `src/mocks/handlers/*.ts`). These override anything inferred from legacy PHP.

---

## 1. Technology Stack

| Concern | Technology |
|---|---|
| Framework | Django 5 + Django REST Framework |
| Database | PostgreSQL 16 |
| Auth | `djangorestframework-simplejwt` (JWT) |
| Async (Phase 2 only) | Celery + Redis |
| Linting | ruff + black (line length 100) |
| Testing | pytest + pytest-django + factory_boy |
| Env vars | django-environ |
| Filtering | django-filter |
| Deployment | Docker Compose (multi-container) |

---

## 2. Project Layout

```
backend/
├── manage.py
├── openpip/                   # Django project package
│   ├── settings/
│   │   ├── base.py
│   │   ├── dev.py
│   │   └── prod.py
│   ├── urls.py                # root URL conf
│   └── wsgi.py
├── proteins/                  # Django app
│   ├── models.py
│   ├── serializers.py
│   ├── views.py
│   ├── urls.py
│   ├── admin.py
│   └── tests/
├── interactions/              # Django app
├── datasets/                  # Django app
├── admin_panel/               # Django app
├── core/                      # shared utilities (auth, permissions, parsers)
└── tests/
    └── parity/                # integration tests against legacy
```

Each app holds: `models.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `tests/test_models.py`, `tests/test_views.py`.

---

## 3. Settings

- Use `django-environ`. No hardcoded secrets, URLs, or paths.
- Settings split: `settings/base.py`, `settings/dev.py`, `settings/prod.py`. Selected via `DJANGO_SETTINGS_MODULE`.
- `DEBUG = False` in everything except `dev.py`.
- `ALLOWED_HOSTS` driven by env var.

---

## 4. Data Model

### Overview

The legacy database has ~38 tables. Django models must mirror this exactly: same table names (`Meta.db_table`), same column names. **Never rename a legacy table or column in Phase 1.**

### MySQL → PostgreSQL Type Translation

| Legacy MySQL | Django Field | Postgres |
|---|---|---|
| `int(11) AUTO_INCREMENT` | `BigAutoField` / `AutoField` | `bigserial` / `serial` |
| `tinyint(1)` | `BooleanField` | `boolean` |
| `varchar(N)` | `CharField(max_length=N)` | `varchar(N)` |
| `text` / `longtext` | `TextField` | `text` |
| `datetime` | `DateTimeField` | `timestamp` |
| `enum(...)` | `CharField(choices=...)` | `varchar` + check constraint |

### 4.1 `Protein`

**Table:** `protein`

| Column | Django field | Notes |
|---|---|---|
| `id` | `AutoField` (PK) | |
| `uniprot_id` | `CharField(max_length=100, null=True)` | Index this |
| `protein_name` | `CharField(max_length=200, null=True)` | |
| `ensembl_id` | `CharField(max_length=100, null=True)` | |
| `entrez_id` | `CharField(max_length=100, null=True)` | |
| `gene_name` | `CharField(max_length=100, null=True)` | Index this |
| `sequence` | `CharField(max_length=10000, null=True)` | |
| `description` | `CharField(max_length=10000, null=True)` | |
| `number_of_interactions_in_database` | `CharField(max_length=10, null=True)` | Denormalized count |

**Relationships:**
- M2M → `Identifier` (through `protein_identifier`)
- M2M → `Organism` (through `protein_organism`)
- M2M → `Annotation` (through `annotation_protein`)
- M2M → `Complex` (through `complex_protein`)
- M2M self → `Protein` as isoforms (through `protein_isoform`, columns `protein_id` / `isoform_id`)
- O2M → `Domain` (FK on Domain side, column `protein_id`)
- O2M → `ExternalLink` (FK on ExternalLink side)

### 4.2 `Identifier`

**Table:** `identifier`

| Column | Django field |
|---|---|
| `id` | `AutoField` (PK) |
| `identifier` | `CharField(max_length=100, null=True)` — index this |
| `naming_convention` | `CharField(max_length=100, null=True)` |

**Relationships:** M2M → `Protein` (through `protein_identifier`)

**naming_convention values:** `'gene_name'`, `'uniprotkb'`, `'ensembl'`, `'entrez'`

This is the unified search lookup table. Every protein identifier (gene name, UniProt, Ensembl, Entrez) gets a row here, linked back to its protein via `protein_identifier`. Search, autocomplete, and validation all go through this table.

### 4.3 `Interaction`

**Table:** `interaction`

| Column | Django field | Notes |
|---|---|---|
| `id` | `AutoField` (PK) | |
| `interactor_A` | `ForeignKey(Protein, db_column='interactor_A')` | |
| `interactor_B` | `ForeignKey(Protein, db_column='interactor_B')` | |
| `score` | `CharField(max_length=10, null=True)` | Stored as decimal string |
| `binding_start` | `CharField(max_length=10, null=True)` | |
| `binding_end` | `CharField(max_length=10, null=True)` | |
| `removed` | `CharField(max_length=10, null=True)` | `'0'` = active, `'1'` = soft-deleted |

**Relationships:**
- FK → `Protein` (interactor_A, interactor_B)
- M2M → `Dataset` (through `interaction_dataset`)
- M2M → `InteractionCategory` (through `interaction_interaction_category`)
- M2M → `InteractionNetwork` (through `interaction_interaction_networks`)
- M2M → `Annotation` (see §4.8)
- M2M → `Domain` (through `interaction_domain`)
- O2M → `InteractionSupportInformation`

**Critical:** All interaction queries filter `removed = '0'` (string, not integer).

### 4.4 `Dataset`

**Table:** `dataset`

| Column | Django field |
|---|---|
| `id` | `AutoField` (PK) |
| `name` | `CharField(max_length=100, null=True)` |
| `pubmed_id` | `CharField(max_length=100, null=True)` |
| `author` | `CharField(max_length=100, null=True)` |
| `year` | `CharField(max_length=10, null=True)` |
| `interaction_status` | `CharField(max_length=100, null=True)` |
| `description` | `CharField(max_length=1000, null=True)` |
| `number_of_interactions` | `CharField(max_length=100, null=True)` |
| `file_path` | `CharField(max_length=100, null=True)` |

**Relationships:** M2M → `Interaction`, O2M → `DataFile`, M2M → `User` (through `user_datasets`)

**`interaction_status` values:** `'published'`, `'validated'`, `'verified'`, `'literature'`

### 4.5 `InteractionCategory`

**Table:** `interaction_category`

| Column | Django field |
|---|---|
| `id` | `AutoField` (PK) |
| `category_name` | `CharField(max_length=200, null=True)` |
| `order` | `CharField(max_length=200, null=True)` | Numeric precedence (higher = more curated) |
| `color_scheme` | `CharField(max_length=200, null=True)` |
| `description` | `CharField(max_length=1000, null=True)` |
| `selected_by_default` | `CharField(max_length=10, null=True)` |
| `include_in_home_page_count` | `CharField(max_length=10, null=True)` |
| `admin_settings_id` | `ForeignKey(AdminSettings, null=True)` |

**M2M through table:** `interaction_interaction_category` (`interaction_category_id`, `interaction_id`)

The `order` column determines the "highest category status". When an interaction belongs to multiple categories, the one with the highest `order` is the `highest_category_status` in exports and API responses.

### 4.6 `AdminSettings`

**Table:** `admin_settings` (singleton — always `id=1`)

| Column | Django field |
|---|---|
| `id` | `AutoField` (PK) |
| `title` | `CharField(max_length=200, null=True)` |
| `short_title` | `CharField(max_length=200, null=True)` |
| `url` | `CharField(max_length=200, null=True)` |
| `version` | `CharField(max_length=200, null=True)` |
| `home_page` | `TextField(null=True)` |
| `mission_title` | `TextField(null=True)` |
| `mission_text` | `TextField(null=True)` |
| `method_title` | `TextField(null=True)` |
| `method_text` | `TextField(null=True)` |
| `about` | `TextField(null=True)` |
| `faq` | `TextField(null=True)` |
| `download` | `TextField(null=True)` |
| `contact` | `TextField(null=True)` |
| `show_downloads` | `BooleanField(default=False)` |
| `show_download_all` | `BooleanField(default=False)` |
| `footer` | `TextField(null=True)` |
| `main_color_scheme` | `CharField(max_length=10, null=True)` |
| `header_color_scheme` | `CharField(max_length=10, null=True)` |
| `logo_color_scheme` | `CharField(max_length=10, null=True)` |
| `button_color_scheme` | `CharField(max_length=10, null=True)` |
| `example_1` | `CharField(max_length=100, null=True)` |
| `example_2` | `CharField(max_length=100, null=True)` |
| `example_3` | `CharField(max_length=100, null=True)` |
| `query_node_color` | `CharField(max_length=20, null=True)` |
| `interactor_node_color` | `CharField(max_length=20, null=True)` |
| `published_edge_color` | `CharField(max_length=20, null=True)` |
| `validated_edge_color` | `CharField(max_length=20, null=True)` |
| `verified_edge_color` | `CharField(max_length=20, null=True)` |
| `literature_edge_color` | `CharField(max_length=20, null=True)` |

**Relationships:** O2M → `InteractionCategory`

### 4.7 `Announcement`

**Table:** `announcement`

| Column | Django field |
|---|---|
| `id` | `AutoField` (PK) |
| `title` | `CharField(max_length=100)` |
| `text` | `CharField(max_length=4000)` | Can contain HTML |
| `date` | `DateTimeField` |
| `show` | `BooleanField` |
| `show_on_home_page` | `BooleanField` |

Home page queries: `WHERE show_on_home_page = true ORDER BY show_on_home_page ASC`, then `array_reverse` in PHP. In Django: `filter(show_on_home_page=True).order_by('-date')` (reverse-chronological).

### 4.8 `Annotation`

**Table:** `annotation`

| Column | Django field |
|---|---|
| `id` | `AutoField` (PK) |
| `annotation` | `TextField(null=True)` | JSON blob |
| `type_name` | `CharField(max_length=..., null=True)` |
| `annotation_type` | `IntegerField(null=True)` | FK to annotation_type.id (not enforced) |
| `identifier` | `IntegerField(null=True)` | Can be protein.id OR interaction.id depending on type |

**Relationships:**
- M2M → `Protein` (through `annotation_protein`: `annotation_id`, `protein_id`)
- M2M → `Interaction` (queried directly by `annotation.identifier = interaction.id`)

**type_name values:** `'tissue_expression'`, `'subcellular_location'`, `'litbm_interaction'`, `'experiment'`

**annotation_type values:** 1 = tissue_expression, 2 = subcellular_location, 4 = litbm_interaction, 5 = experiment

**Protein annotations** (`type_name` in `['tissue_expression','subcellular_location']`):
- Linked via `annotation_protein` join table.
- The `annotation` column is a JSON string.
- In the API response, these appear as separate fields: `tissue_expression_array` and `subcellular_location_expression_array` on the protein node object.

**Interaction annotations** (`type_name` in `['litbm_interaction','experiment']`):
- `annotation.identifier` = `interaction.id`
- Queried: `SELECT * FROM annotation WHERE identifier IN (interaction_id_list)`
- In the API response, grouped by `type_name` in `annotation_array`.

### 4.9 `AnnotationType`

**Table:** `annotation_type`

| Column | Django field |
|---|---|
| `id` | `AutoField` (PK) |
| `type` | `CharField` |
| `label` | `CharField` |
| `description` | `TextField` |
| `fields` | `TextField` | JSON string of field names |
| `show_in_filter` | `CharField` | `'1'` = show in search filter panel |
| `show_in_table` | `CharField` | `'1'` = show in results table |

### 4.10 `Organism`

**Table:** `organism`

| Column | Django field |
|---|---|
| `id` | `AutoField` (PK) |
| `name` | `CharField` |
| `taxonomy_id` | `CharField` |

**M2M through table:** `protein_organism`

### 4.11 `Domain`

**Table:** `domain`

| Column | Django field |
|---|---|
| `id` | `AutoField` (PK) |
| `protein_id` | `ForeignKey(Protein, db_column='protein_id')` |
| `type` | `CharField(max_length=100, null=True)` |
| `name` | `CharField(max_length=100, null=True)` |
| `start_position` | `CharField(max_length=100, null=True)` |
| `end_position` | `CharField(max_length=100, null=True)` |
| `description` | `CharField(max_length=100, null=True)` |
| `sequence` | `CharField(max_length=1000, null=True)` |

**Relationships:**
- FK → `Protein`
- M2M → `Organism` (through `organism_domain`)
- M2M → `Interaction` (through `interaction_domain`)

### 4.12 `Complex`

**Table:** `complex`

| Column | Django field |
|---|---|
| `id` | `AutoField` (PK) |
| `name` | `CharField` |
| `description` | `CharField` |

**M2M through table:** `complex_protein` (`complex_id`, `protein_id`)

### 4.13 `InteractionNetwork`

**Table:** `interaction_network`

| Column | Django field |
|---|---|
| `id` | `AutoField` (PK) |
| `name` | `CharField(max_length=100, null=True)` |
| `interactor_query_string` | `CharField(max_length=3000, null=True)` |
| `score_parameter` | `CharField(max_length=100, null=True)` |
| `category_array` | `CharField(max_length=100, null=True)` | Comma-separated category names |
| `tissue_expression_array` | `CharField(max_length=100, null=True)` |
| `query` | `CharField(max_length=100, null=True)` | Full search URL with params |

**Relationships:**
- M2M → `Interaction` (through `interaction_interaction_networks`)
- M2M → `User` (through `user_interaction_networks`)

### 4.14 `ExternalLink`

**Table:** `external_link`

| Column | Django field |
|---|---|
| `id` | `AutoField` (PK) |
| `protein_id` | `ForeignKey(Protein)` |
| `url` | `TextField` |
| `name` | `CharField` |

### 4.15 `DataFile`

**Table:** `data_file`

| Column | Django field |
|---|---|
| `id` | `AutoField` (PK) |
| `dataset_id` | `ForeignKey(Dataset)` |
| `file_name` | `CharField` |
| `file_path` | `CharField` |

### 4.16 `SupportInformation` / `InteractionSupportInformation`

Support/citation records for interactions. `Interaction` has O2M → `InteractionSupportInformation`, which links to `SupportInformation`.

### 4.17 `User`

**Table:** `user`

Extends Django's `AbstractUser`. The legacy used FOSUserBundle's `BaseUser`. Fields from FOSUserBundle that need to be present: `username`, `email`, `password` (hashed), `is_active`, `roles` (in Django: `is_staff`, `is_superuser`).

```python
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    interaction_networks = models.ManyToManyField(
        'InteractionNetwork', through='UserInteractionNetwork', related_name='users'
    )
    datasets = models.ManyToManyField(
        'Dataset', through='UserDataset', related_name='users'
    )

    class Meta:
        db_table = 'user'
```

**Role mapping:** legacy `ROLE_ADMIN` → `is_staff=True` in Django.

### 4.18 `DatasetRequest`

**Table:** `dataset_request`

Used for unpublished dataset access requests. Fields include `email`, `request`, `md5`.

### 4.19 `UploadFiles`

**Table:** `upload_files`

Tracks file uploads to the server.

---

## 5. M2M Through Tables Summary

| Through Table | Left | Right |
|---|---|---|
| `protein_identifier` | `protein_id` | `identifier_id` |
| `protein_organism` | `protein_id` | `organism_id` |
| `protein_isoform` | `protein_id` | `isoform_id` |
| `annotation_protein` | `annotation_id` | `protein_id` |
| `complex_protein` | `complex_id` | `protein_id` |
| `interaction_dataset` | `interaction_id` | `dataset_id` |
| `interaction_interaction_category` | `interaction_id` | `interaction_category_id` |
| `interaction_domain` | `interaction_id` | `domain_id` |
| `interaction_interaction_networks` | `interaction_network_id` | `interaction_id` |
| `user_protein` | `protein_id` | `user_id` |
| `user_datasets` | `dataset_id` | `user_id` |
| `user_interaction_networks` | `interaction_network_id` | `user_id` |
| `dataset_request_dataset` | `dataset_request_id` | `dataset_id` |
| `fos_user_user_group` | `user_id` | `group_id` |

---

## 6. API Endpoints

**Base URL:** `/api` (set by `VITE_API_BASE_URL` in frontend; no trailing slash on the prefix)

**Auth header:** `Authorization: Bearer <token>` (stored in `localStorage` as `openpip_access_token`)

### 6.1 Auth Endpoints

| Method | URL | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | None | Login |
| POST | `/api/auth/logout` | JWT | Logout |
| POST | `/api/auth/register` | None | Register new user |
| GET | `/api/auth/me` | JWT | Get current user info |

**POST `/api/auth/login`**
- Body: `{ username: string, password: string }`
- Response: `{ access: string, refresh: string, is_admin: boolean }`
- On failure: `{ detail: "Invalid credentials" }` with 401

**POST `/api/auth/register`**
- Body: `{ username: string, email: string, password: string }`
- Response: `{ detail: "Registration successful" }` with 201

**GET `/api/auth/me`**
- Response: `{ username: string, email: string, is_admin: boolean }`

### 6.2 Settings

| Method | URL | Auth | Description |
|---|---|---|---|
| GET | `/api/settings` | None | Get portal settings (public) |
| PATCH | `/api/settings` | JWT + admin | Partial update settings |

**Response shape** (camelCase — the frontend TypeScript interface uses camelCase):
```json
{
  "title": "openPIP — Protein Interaction Portal",
  "shortTitle": "HuRI",
  "footer": "<p>© 2026 openPIP.</p>",
  "homePage": "",
  "missionTitle": "<h4>Our Mission</h4>",
  "missionText": "<p>...</p>",
  "methodTitle": "<h4>Methods</h4>",
  "methodText": "<p>...</p>",
  "mainColorScheme": "#a51c30",
  "headerColorScheme": "#ffffff",
  "logoColorScheme": "#ffffff",
  "buttonColorScheme": "#a51c30",
  "queryNodeColor": "#cc0000",
  "interactorNodeColor": "#3c78d8",
  "publishedEdgeColor": "#38761d",
  "validatedEdgeColor": "#1155cc",
  "verifiedEdgeColor": "#cc0000",
  "literatureEdgeColor": "#ff9900",
  "url": "http://...",
  "version": "2.0"
}
```

DRF serializer must convert snake_case DB column names → camelCase JSON. Use `source=` on fields or a custom serializer with `to_representation`.

### 6.3 Announcements

| Method | URL | Auth | Description |
|---|---|---|---|
| GET | `/api/announcements` | None | List announcements shown on home page |

**Response shape** (camelCase):
```json
[
  {
    "id": 1,
    "title": "Welcome to openPIP 2.0",
    "text": "<p>We have launched...</p>",
    "date": "2026-05-01",
    "showOnHomePage": true
  }
]
```

Only returns announcements where `show_on_home_page=True`, reverse-chronological order.

### 6.4 Counts

| Method | URL | Auth | Description |
|---|---|---|---|
| GET | `/api/counts` | None | Homepage statistics |

**Response shape:**
```json
{
  "proteins": 8275,
  "interactions": 52569
}
```

The `interactions` count must filter `removed = '0'`. The home page also uses `organism_count` and `domain_count` internally (from legacy `HomeController::getCounts`), but the frontend only consumes `proteins` and `interactions` in the public `Counts` type.

### 6.5 Search

| Method | URL | Auth | Description |
|---|---|---|---|
| GET | `/api/search` | None | Search by identifier(s) |
| POST | `/api/search/interactors` | None | Expand interactors for an existing result |

**GET `/api/search`**

Query parameters:

| Param | Type | Default | Description |
|---|---|---|---|
| `q` | string | required | Comma-separated gene names / identifiers |
| `filter` | string | `'None'` | `'None'`, `'query_query'`, or `'query_interactor'` |
| `score` | float | `0` | Minimum confidence score filter |
| `published` | bool | `true` | Include published |
| `validated` | bool | `true` | Include validated |
| `verified` | bool | `true` | Include verified |
| `literature` | bool | `true` | Include literature |

**Response shape (SearchResult):**
```json
{
  "all_proteins": [ /* Protein[] */ ],
  "all_interactions": [ /* Interaction[] */ ],
  "domains": "",
  "complexes": "",
  "query_protein_id_array": [1, 2],
  "search_term": "BAD,BCL2L1",
  "found_protein_summary": "BAD<br>BCL2L1",
  "unfound_protein_summary": ""
}
```

Note: `found_protein_summary` / `unfound_protein_summary` use `<br>` (not `</br>`) as separator.

**Protein object shape** (snake_case — frontend types/api.ts):
```json
{
  "protein_id": 1,
  "protein_uniprot_id": "Q92934",
  "protein_ensembl_id": "ENSG00000002330",
  "protein_entrez_id": "572",
  "protein_gene_name": "BAD",
  "protein_protein_name": "Bcl2-associated agonist of cell death",
  "protein_description": "Promotes apoptosis...",
  "protein_sequence": "MRSP...",
  "number_of_interactions_in_database": 12,
  "annotation_array": {},
  "tissue_expression_array": {},
  "subcellular_location_expression_array": {}
}
```

Note: `tissue_expression_array` and `subcellular_location_expression_array` are **separate top-level fields**, not nested inside `annotation_array`. They are extracted from `annotation.annotation` where `type_name` matches.

**Interaction object shape:**
```json
{
  "interaction_id": 1,
  "interactor_A": {
    "protein_id": 1,
    "protein_uniprot_id": "Q92934",
    "protein_gene_name": "BAD",
    "protein_ensembl_id": "ENSG00000002330"
  },
  "interactor_B": {
    "protein_id": 2,
    "protein_uniprot_id": "Q07817",
    "protein_gene_name": "BCL2L1",
    "protein_ensembl_id": "ENSG00000171552"
  },
  "score": 0.82,
  "annotation_array": {},
  "experiment_array": [],
  "dataset_array": [
    {
      "dataset_reference": "24153252",
      "dataset_author": "Rolland et al.(2014)",
      "year": "2014",
      "description": "Human Reference Interactome",
      "interaction_status": "Published",
      "name": "HuRI"
    }
  ],
  "interaction_category_array": {
    "highest_category_status": "Published",
    "highest_order": 1,
    "interaction_category_array": [
      { "category_name": "Published", "order": 1 }
    ]
  }
}
```

Note: `score` is `number | null` in the frontend type (not a string). Cast the stored `CharField` to float when serializing.

**POST `/api/search/interactors`**

Body:
```json
{
  "searchTerm": "BAD,BCL2L1",
  "filterParameter": "query_query",
  "searchTermArray": ["BAD", "BCL2L1"],
  "queryIdArray": [1, 2]
}
```

Response: same `SearchResult` shape. When `filterParameter == 'query_interactor'`, override filter to `'query_query'` (legacy behavior).

### 6.6 Proteins — Autocomplete

| Method | URL | Auth | Description |
|---|---|---|---|
| GET | `/api/proteins/autocomplete` | None | Autocomplete gene names |

Query param: `q` (partial identifier string, min 2 chars)

**Response shape:** `string[]` — a flat list of matching gene names.

```json
["BAD", "BAK1", "BARD1"]
```

This is simpler than the legacy PHP response. The frontend only needs the gene name strings.

### 6.7 Datasets

| Method | URL | Auth | Description |
|---|---|---|---|
| GET | `/api/datasets` | None | List all datasets |

**Response shape:** `DatasetRef[]`
```json
[
  {
    "dataset_reference": "24153252",
    "dataset_author": "Rolland et al.(2014)",
    "year": "2014",
    "description": "Human Reference Interactome",
    "interaction_status": "Published",
    "name": "HuRI"
  }
]
```

When `author` is null, return `"dataset_author": "Unpublished Dataset"`.

### 6.8 Contact

| Method | URL | Auth | Description |
|---|---|---|---|
| POST | `/api/contact` | None | Submit contact form |

Body: `{ name: string, email: string, subject: string, message: string }`

Response: `{ detail: "Message sent" }` (or send an email via Django's email backend).

### 6.9 Upload (Admin)

| Method | URL | Auth | Description |
|---|---|---|---|
| POST | `/api/upload/` | JWT + admin | Upload PSI-MI TAB file (synchronous) |

See §10 for parsing logic.

### 6.10 Admin Settings (see §6.2)

### 6.11 Dataset File Downloads

| Method | URL | Auth | Description |
|---|---|---|---|
| GET | `/api/datasets/{dataset_reference}/download` | JWT required | Download a specific dataset file by its pubmed/reference ID |
| GET | `/api/datasets/download/` | JWT required | Download the complete dataset archive (GZ) |

These are the only server-side downloads. The per-dataset download serves the file at `dataset.file_path`. The archive endpoint serves a GZ of all interaction data files.

**From `DownloadPage.tsx`:** download links are hidden (show "Log in to download") for unauthenticated users.

### 6.12 Search Result Exports — CLIENT-SIDE ONLY

**All search result export formats are generated client-side in `frontend/src/lib/download.ts`.** No backend endpoints are needed or used for these:

| Format | Extension | Generated by |
|---|---|---|
| SIF | `.sif` | `formatSIF()` — `geneA\tpp\tgeneB` per interaction |
| Interactions CSV | `.csv` | `formatInteractionsCSV()` |
| Interactors CSV | `.csv` | `formatInteractorsCSV()` |
| FASTA | `.fasta` | `formatFASTA()` |
| PSI-MI | `.tsv` | `formatPSIMI()` |

The frontend builds these files from the data already in memory (from the `GET /api/search` response) and triggers a browser download via a blob URL. **Do not implement `/api/export/` endpoints.**

### 6.14 Enrichment

Enrichment is **fully client-side** in Phase 1. The frontend calls:
- g:Profiler API directly: `https://biit.cs.ut.ee/gprofiler/api/gost/profile/`
- Reactome API directly: `https://reactome.org/AnalysisService/identifiers/`
- CORUM: returns empty array (Phase 2)

**No backend enrichment endpoint is needed for Phase 1.**

---

## 7. Interaction Category Capitalization

The frontend uses capitalized category names throughout: `'Published'`, `'Validated'`, `'Verified'`, `'Literature'`, `'Mixed'`. This is visible in:
- `searchStore.ts` default `categoryFilter`: `{ Published: true, Validated: true, Verified: true, Literature: true }`
- `cytoscapeElements.ts` `EDGE_COLORS`: keys are `Literature`, `Published`, `Validated`, `Verified`, `Mixed`
- `filterInteractions.ts`: filters on `i.interaction_category_array.highest_category_status`

The legacy PHP stored lowercase (`'published'`, `'validated'`, etc.) in `interaction_category.category_name`. The Django backend must seed the `interaction_category` table with **capitalized** names to match the frontend. Alternatively, normalize to capitalized when serializing.

**Confirmed category names for the DB seed:**
- `Published` (order 1)
- `Validated` (order 2)
- `Verified` (order 3)
- `Literature` (order 4)

---

## 8. Admin Settings — Editable Fields

The admin UI (`AdminSettingsPage.tsx`) only exposes a subset of `AdminSettings` fields for editing:

**Text fields (editable in UI):**
`title`, `shortTitle`, `footer`, `homePage`, `missionTitle`, `missionText`, `methodTitle`, `methodText`, `url`, `version`

**Color fields (editable in UI):**
`mainColorScheme`, `headerColorScheme`, `logoColorScheme`, `buttonColorScheme`, `queryNodeColor`, `interactorNodeColor`, `publishedEdgeColor`, `validatedEdgeColor`, `verifiedEdgeColor`, `literatureEdgeColor`

**DB-only fields (not in admin UI, still in DB):**
`about`, `faq`, `contact`, `download`, `show_downloads`, `show_download_all`, `example_1`, `example_2`, `example_3`

All fields must still exist in the model and serializer (for `GET /api/settings` to return them), but `PATCH /api/settings` may receive any subset.

---

## 9. Frontend Routes

For reference, the React Router routes defined in `App.tsx`:

| Path | Component |
|---|---|
| `/` | `HomePage` |
| `/search` | `SearchResultsPage` |
| `/search/:term` | `SearchResultsPage` |
| `/download` | `DownloadPage` |
| `/about` | `AboutPage` (uses `GET /api/settings`) |
| `/faq` | `FAQPage` (static, no API) |
| `/contact` | `ContactPage` (uses `POST /api/contact`) |
| `/documentation` | `DocumentationPage` (static) |
| `/login` | `LoginPage` |
| `/register` | `RegisterPage` |
| `/profile` | `ProfilePage` |
| `/admin/settings` | `AdminSettingsPage` (admin-only) |

---

## 10. Serialization: camelCase vs snake_case

The frontend expects **camelCase** for settings and announcements, and **snake_case** for search results, proteins, and interactions. This matches the legacy PHP behavior (search results were built as raw PHP arrays with snake_case keys; settings were accessed via method names that map to camelCase in the new frontend).

| Endpoint | Case |
|---|---|
| `/api/settings` | camelCase |
| `/api/announcements` | camelCase (`showOnHomePage`) |
| `/api/auth/me` | snake_case (`is_admin`) |
| `/api/search` | snake_case (all keys) |
| `/api/datasets` | snake_case |
| `/api/counts` | camelCase (`proteins`, `interactions`) |

Use DRF serializer field `source=` mappings or a custom `to_representation` on the settings/announcement serializers to produce camelCase.

---

## 8. Business Logic — Search

### 8.1 Entry Point

Search takes a comma-separated string (e.g. `BRCA1,TP53`) and returns nodes + edges.

### 8.2 Step-by-Step Algorithm

**Step 1 — Resolve query proteins**

```sql
SELECT * FROM identifier WHERE identifier IN ('BRCA1', 'TP53')
-- → identifier_id_array

SELECT * FROM protein_identifier WHERE identifier_id IN (identifier_id_array)
-- → protein_id_array

SELECT * FROM protein WHERE id IN (protein_id_array)
-- → query_protein_array: {protein_id: gene_name}
```

Track which input terms were found (`found_proteins_array`) vs. not found (`not_found_proteins_array`). Join them with `"<br>"` (HTML, not `"</br>"`).

**Step 2 — Find interactors (depends on `filter_parameter`)**

- `filter_parameter == 'None'` or `'query_interactor'`:
  ```sql
  SELECT * FROM interaction
  WHERE removed = 0
    AND (interactor_A IN (query_protein_id_array)
      OR interactor_B IN (query_protein_id_array))
  -- Collect all protein IDs from both columns → interactor_array
  ```

- `filter_parameter == 'query_query'`:
  `interactor_array = query_protein_id_array` (only query proteins)

**Step 3 — Find interactions (depends on `filter_parameter`)**

- `filter_parameter == 'None'`:
  ```sql
  SELECT * FROM interaction WHERE removed = 0
    AND interactor_A IN (interactor_array)
    AND interactor_B IN (interactor_array)
  ```

- `filter_parameter == 'query_interactor'`:
  ```sql
  SELECT * FROM interaction WHERE removed = 0 AND (
    (interactor_A IN (interactor_array) AND interactor_B IN (query_protein_id_array))
    OR (interactor_A IN (query_protein_id_array) AND interactor_B IN (interactor_array))
  )
  ```

- `filter_parameter == 'query_query'`:
  ```sql
  SELECT * FROM interaction WHERE removed = 0
    AND interactor_A IN (query_protein_id_array)
    AND interactor_B IN (query_protein_id_array)
  ```

**Step 4 — Build node objects**

For all proteins in `interactor_array`:

```sql
SELECT a.*, ap.protein_id FROM annotation a
INNER JOIN annotation_protein ap ON a.id = ap.annotation_id
WHERE ap.protein_id IN (interactor_array)
-- → annotation_array: {protein_id: {type_name: annotation_json}}

SELECT * FROM protein WHERE id IN (interactor_array)
```

Separate annotation by `type_name`:
- `type_name == 'tissue_expression'` → `tissue_expression_array`
- `type_name == 'subcellular_location'` → `subcellular_location_expression_array`
- Other types → `annotation_array`

Node ordering: query proteins placed last in the array (they appear on top in Cytoscape rendering).

**Step 5 — Build edge objects and determine ordering**

For each interaction:
1. Look up interactor_A and interactor_B from the already-fetched node_array.
2. Determine edge type:
   - Both A and B are query proteins → `multi_query_edge`
   - Only A is query → `query_edge` (A stays as A)
   - Only B is query → `query_edge` with A↔B swapped (so query protein is always `interactor_A`)
   - Neither → `interactor_edge`
3. Final order: `multi_query_edges + query_edges + interactor_edges`

**Step 6 — Enrich edges with datasets and categories**

```sql
SELECT * FROM interaction_dataset WHERE interaction_id IN (interaction_id_array)
-- join with full dataset info

SELECT * FROM interaction_interaction_category WHERE interaction_id IN (interaction_id_array)
-- compute highest_order and highest_category_status per interaction
```

For each interaction, compute `highest_category_status` = the category name with the maximum `order` value.

**Step 7 — Enrich edges with interaction annotations**

```sql
SELECT * FROM annotation WHERE identifier IN (interaction_id_array)
-- group by type_name per interaction_id
```

### 8.3 `filter_parameter` Values

| Value | Interactor set | Interaction set |
|---|---|---|
| `'None'` | All proteins connected to any query protein | All interactions among that full set |
| `'query_interactor'` | All proteins connected to any query protein | Only interactions where one side is a query protein |
| `'query_query'` | Only the query proteins | Only interactions between query proteins |

---

## 9. Export Formats — Client-Side Only

**All export formats are generated entirely in the browser** from `frontend/src/lib/download.ts`. No backend endpoints exist for these. They operate on data already in the frontend store from `GET /api/search`.

### 9.1 SIF (`.sif`)
```
geneA\tpp\tgeneB
```
One line per interaction. `pp` = protein-protein (hardcoded).

### 9.2 Interactions CSV (`.csv`)
```
UniProt A,UniProt B,Gene A,Gene B,Ensembl A,Ensembl B,Score,Category,Dataset
```

### 9.3 Interactors CSV (`.csv`)
```
Gene Name,UniProt ID,Ensembl ID,Entrez ID,Number of Interactions
```

### 9.4 FASTA (`.fasta`)
```
>{gene_name}|{uniprot_id}
{sequence}
```

### 9.5 PSI-MI (`.tsv`)
42-column tab-separated. Columns 0–1 = `uniprotkb:{uniprot}`, cols 4–5 = `uniprotkb:{gene}(gene name)`, col 14 = score, all others `-`.

### 9.6 Dataset File Downloads (backend)

These two are the only server-side download endpoints:
- `GET /api/datasets/{dataset_reference}/download` — serves the file at `dataset.file_path`; requires JWT
- `GET /api/datasets/download/` — serves a GZ archive of all data; requires JWT

---

## 10. Upload (PSI-MI TAB Ingest)

**Endpoint:** `POST /api/upload/`

**Auth:** JWT required, admin.

**Input:** Multipart form with a tab-separated file (`.tab`, `.tsv`, `.psi`).

**Parsing logic** (from `DataController::insertAction`):

```python
# Pseudocode for the parser
with open(file_path, 'r') as f:
    reader = csv.reader(f, delimiter='\t')
    for row_num, row in enumerate(reader):
        if row_num < 1 or not row:   # skip header (row 0) and empty rows
            continue
        interactor_A_id = row[0]     # column 0: protein A identifier
        interactor_B_id = row[1]     # column 1: protein B identifier

        protein_A = protein_handler(interactor_A_id)
        protein_B = protein_A if interactor_A_id == interactor_B_id else protein_handler(interactor_B_id)

        if is_new_interaction(protein_A, protein_B):
            interaction = Interaction(
                interactor_A=protein_A,
                interactor_B=protein_B,
                removed='0'
            )
        else:
            interaction = get_existing_interaction(protein_A, protein_B)

        interaction.save()
```

**`protein_handler(identifier)`:**
1. Look up `Identifier` by `identifier` string.
2. If found, return the linked `Protein`.
3. If not found, create a new `Protein` and a new `Identifier` (naming_convention = `'uniprotkb'` if starts with standard prefix, else `'gene_name'`).

**`is_new_interaction(A, B)`:**
```sql
SELECT id FROM interaction
WHERE (interactor_A = A_id AND interactor_B = B_id)
   OR (interactor_A = B_id AND interactor_B = A_id)
```

**PSI-MI TAB full column mapping** (42 columns, from `HomeController` lines 301–307):
```
0: interactor_A_id (UniProt or namespace:id)
1: interactor_B_id
2: alt_interactor_A_id (often ensembl:ENSG...)
3: alt_interactor_B_id
4: interactor_A_alias (gene name)
5: interactor_B_alias
6: interaction_detection_method
7: publication_first_author
8: publication_identifier (pubmed id)
9: taxid_interactor_A
10: taxid_interactor_B
11: interaction_type
12: source_database
13: interaction_identifier
14: confidence_value (score)
...
```

The simplified uploader only uses columns 0 and 1. Full PSI-MI TAB import additionally parses columns 2/3 for Ensembl IDs, column 7 for author (→ Dataset), column 8 for PubMed (→ Dataset), and column 14 for score.

---

## 11. Home Page Data

The `HomeController` in legacy supplies:

| Data | Source |
|---|---|
| `protein_count` | `SELECT COUNT(*) FROM protein` |
| `organism_count` | `SELECT COUNT(*) FROM organism` |
| `interaction_count` | `SELECT COUNT(*) FROM interaction WHERE removed = 0` |
| `domain_count` | `SELECT COUNT(*) FROM domain` |
| `rand_protein` | First 100 gene names joined with `;` (used for a random protein display) |
| `announcements` | `WHERE show_on_home_page = '1' ORDER BY show_on_home_page ASC` reversed |

The frontend `GET /api/counts` only returns `{proteins, interactions}`. However, the admin panel or future endpoints may need all four counts, so expose them all from the model layer.

---

## 12. User Profile (Interaction Networks)

**ProfileController** (UserBundle) manages saved interaction networks per user:
- `GET /api/auth/me` → returns user info
- Saving a network: POST to `/api/search` with `add_interaction_network=true` body param
  - Creates an `InteractionNetwork` with: name, interactor_query_string, score_parameter, category_array, tissue_expression_array, query (full URL string), and links it to both the user and the interactions

---

## 13. Admin Settings Controller

The legacy `AdminSettingsController` reads all `AdminSettings` fields plus all `InteractionCategory` rows (for the edge color form). The DRF view just needs to:
- `GET /api/settings` → serialize `AdminSettings.objects.get(pk=1)` with camelCase
- `PATCH /api/settings` → partial update, admin-only

---

## 14. Authentication & Authorization

| Endpoint | Auth |
|---|---|
| Search, protein detail, datasets, autocomplete, counts, settings GET, announcements | `AllowAny` |
| Export endpoints | `AllowAny` (same as legacy) |
| Contact | `AllowAny` |
| Auth login, register | `AllowAny` |
| Auth me, logout, profile | `IsAuthenticated` |
| Save network | `IsAuthenticated` |
| Settings PATCH, upload, admin | `IsAdminUser` (`is_staff=True`) |

---

## 15. Serializers

Use distinct serializers per context:

| Model | Serializers |
|---|---|
| Protein | `ProteinListSerializer`, `ProteinDetailSerializer`, `ProteinNestedSerializer` |
| Interaction | `InteractionListSerializer`, `InteractionDetailSerializer` |
| Dataset | `DatasetSerializer` |
| InteractionCategory | `InteractionCategorySerializer` |
| AdminSettings | `AdminSettingsSerializer` (camelCase output) |
| Announcement | `AnnouncementSerializer` (camelCase: `showOnHomePage`) |
| Identifier | `IdentifierSerializer` |

---

## 16. Django App Structure

### `proteins/`
Models: `Protein`, `Identifier`, `Organism`, `Domain`, `Complex`, `Annotation`, `AnnotationType`, `ExternalLink`
Views: `ProteinViewSet`, `AutocompleteView`

### `interactions/`
Models: `Interaction`, `InteractionCategory`, `InteractionNetwork`, `InteractionSupportInformation`, `SupportInformation`
Views: `SearchView`, `SearchInteractorsView`, `SaveNetworkView`

### `datasets/`
Models: `Dataset`, `DataFile`, `DatasetRequest`, `UploadFiles`
Views: `DatasetListView`, `DatasetFileDownloadView`, `DatasetArchiveDownloadView`, `UploadView`
Note: No export views — all formats (SIF, CSV, FASTA, PSI-MI) are generated client-side.

### `admin_panel/`
Models: `AdminSettings`, `Announcement`
Views: `AdminSettingsView`, `AnnouncementListView`, `CountsView`

### `core/`
Models: `User`
Views: `LoginView`, `LogoutView`, `RegisterView`, `MeView`, `ContactView`
Utilities: auth helpers, common permissions

---

## 17. URL Configuration

```python
# openpip/urls.py
urlpatterns = [
    # Auth
    path('api/auth/login', LoginView.as_view()),
    path('api/auth/logout', LogoutView.as_view()),
    path('api/auth/register', RegisterView.as_view()),
    path('api/auth/me', MeView.as_view()),
    # Settings & content
    path('api/settings', AdminSettingsView.as_view()),
    path('api/announcements', AnnouncementListView.as_view()),
    path('api/counts', CountsView.as_view()),
    # Search
    path('api/search', SearchView.as_view()),
    path('api/search/interactors', SearchInteractorsView.as_view()),
    # Proteins
    path('api/proteins/autocomplete', AutocompleteView.as_view()),
    # Datasets & downloads
    path('api/datasets', DatasetListView.as_view()),
    path('api/datasets/download/', DatasetArchiveDownloadView.as_view()),
    path('api/datasets/<str:dataset_reference>/download', DatasetFileDownloadView.as_view()),
    # Contact
    path('api/contact', ContactView.as_view()),
    # Upload (admin)
    path('api/upload/', UploadView.as_view()),
    # NOTE: No /api/export/ endpoints — all export formats are generated client-side
]
```

---

## 18. Key Query Patterns

### Postgres Case Sensitivity

Legacy MySQL uses `utf8_unicode_ci` (case-insensitive). Use `ILIKE` / `icontains` / `iexact` for all identifier lookups:

```python
Identifier.objects.filter(identifier__iexact=search_term)
Identifier.objects.filter(identifier__icontains=partial_term)
```

### Interaction Query

Always include `removed='0'` filter:
```python
Interaction.objects.filter(
    removed='0',
    interactor_A__in=protein_ids
) | Interaction.objects.filter(
    removed='0',
    interactor_B__in=protein_ids
)
```

### Interaction Category — Highest Order

```python
from django.db.models import Max
interactions.annotate(
    highest_category_order=Max('interaction_categories__order')
)
```

---

## 19. Docker Compose

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: openpip
      POSTGRES_USER: openpip
      POSTGRES_PASSWORD: ${DB_PASSWORD}

  backend:
    build: ./backend
    environment:
      DJANGO_SETTINGS_MODULE: openpip.settings.prod
      DATABASE_URL: postgres://openpip:${DB_PASSWORD}@db:5432/openpip
    depends_on:
      - db
    ports:
      - "8000:8000"

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
```

---

## 20. Model Conventions

- Class names: PascalCase. Table names: snake_case via `Meta.db_table` matching legacy exactly.
- `__str__` returns a human-readable identifier.
- `related_name` on every `ForeignKey` and `ManyToManyField`.
- Index: `gene_name`, `uniprot_id`, `identifier`.
- `managed = True` (flip from `inspectdb` default of `False`).
- Set `verbose_name_plural` explicitly (e.g., `admin_settings` → set `verbose_name_plural = 'admin settings'`).

---

## 21. Testing

- pytest + pytest-django. No Django `TestCase` unless transactions are required.
- factory_boy for fixtures. Never load `dev10.0_huri.sql` — too large.
- Parity tests in `tests/parity/` marked `@pytest.mark.slow`.
- Coverage target: 80% on models, serializers, views, parsers.

```bash
pytest                            # run all tests
pytest -m "not slow"              # skip parity tests
ruff check . && black --check .   # lint
```

---

## 22. Common Gotchas

1. **`removed` is `CharField` not `BooleanField`** — filter with `removed='0'` (string), not `removed=0`.
2. **`score` is `CharField` not float** — cast to float when serializing: `float(score) if score else None`.
3. **Postgres case sensitivity** — use `ILIKE` everywhere identifiers are compared by string.
4. **`managed = False` from inspectdb** — flip to `managed = True` after cleanup.
5. **`admin_settings` verbose_name_plural** — set explicitly to avoid `admin_settingss`.
6. **Interaction edge ordering** — query protein must always be `interactor_A`. If only `interactor_B` is a query protein, swap A↔B in the edge dict.
7. **PSI-MI TAB taxonomy** — always emits `9606` (hardcoded human). Preserve for parity.
8. **`protein_identifier` is the search path** — never search `protein.gene_name` directly for user queries; always resolve through `identifier` → `protein_identifier` → `protein`.
9. **Settings serializer is camelCase** — the frontend `AdminSettings` type uses camelCase. Use `source=` mappings in DRF.
10. **Announcement `showOnHomePage`** — camelCase in the API response, even though DB column is `show_on_home_page`.
11. **Enrichment is client-side** — g:Profiler and Reactome are called from the browser directly. No Django enrichment endpoint needed in Phase 1.
12. **Auth login response includes `is_admin`** — return `{"access": ..., "refresh": ..., "is_admin": user.is_staff}` (not just the standard simplejwt response). Override `TokenObtainPairView` to add this.
13. **`found_protein_summary` separator** — use `"<br>"` not `"</br>"` to join found/unfound protein lists.
14. **Interaction category capitalization** — seed `interaction_category.category_name` as `Published`, `Validated`, `Verified`, `Literature` (capitalized). The frontend `categoryFilter` and Cytoscape edge color map both use these exact capitalized strings. Legacy PHP stored them lowercase; the 2.0 DB must use capitalized.
15. **No `/api/export/` endpoints** — all export formats (SIF, CSV, FASTA, PSI-MI) are generated client-side. Do not build these backend endpoints.
16. **Dataset downloads require auth** — `GET /api/datasets/{ref}/download` and `GET /api/datasets/download/` both check JWT. The download page hides links for unauthenticated users.
