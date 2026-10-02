# News, datasets and files

## News

**Admin → News** manages the announcements in the home page's news panel.

- **New announcement** opens the form: **Title**, **Date** (date and time),
  **Show on home page** (on by default) and **Body** (rich text). **Publish**
  saves it.
- **Active** lists current announcements. **Edit** changes one, and **Hide**
  takes it off the home page.
- **History** lists hidden announcements. **Restore** brings one back, and
  **Delete** removes it permanently, after asking.

An announcement appears on the home page only while it is active and **Show
on home page** is ticked. Newest announcements come first.

## Datasets

**Admin → Datasets** shows how many proteins, interactions and datasets the
portal holds, lists every dataset, and imports new ones.

### Importing a dataset

Before you start, check that your file is in a supported format: PSI-MI TAB
or simple CSV, described in [Data file formats](../operator-guide/data-formats.md).
The upload form's **File format reference** summarises the same thing.

1. **Select file.** Drop the file onto the page or browse to it (`.tab`,
   `.tsv`, `.txt` or `.csv`). The first part of the file is checked straight
   away, and any format problems are listed. **Next** becomes available once
   the file is valid.
2. **Metadata.**
    - **Dataset name** (required), pre-filled from the file name. **Using the
      name of an existing dataset adds the file's interactions to that
      dataset.**
    - **Interaction status**: a label for the dataset, such as Published. It
      is shown with the dataset but does not filter or colour anything.
    - **Category**: the [interaction category](settings.md#search) every
      interaction in the file is added to, or none.
    - **Citation and About-page copy**, optional and editable later: PubMed ID
      or DOI, with **Look up details**, then title, journal, year, status,
      authors and the paragraph for the About page.
3. **Preview.** The first rows of the file are shown, and the proteins in it
   are checked against the portal: how many are new and how many it already
   holds, and how many rows the file has.
4. **Import.** The file is processed in the background, and a checklist shows
   each stage: **Parsing rows**, then **Fetching UniProt metadata**,
   **Fetching Ensembl data** and **Fetching organism names**, which fill in
   details for new proteins and organisms. If one of those outside services
   is unavailable, the import still succeeds and a warning says which details
   were skipped.

When the import finishes you see how many proteins and interactions were
created, how many rows matched interactions already in the portal (these are
credited to your dataset as well), and the first few rows that failed, with
the reason. You can leave the page while an import runs. It carries on in
the background.

Large files take a while: each row is stored and checked individually, and
every new protein is looked up in UniProt afterwards.

### Editing a dataset

The edit button on a dataset ("Edit citation and About paragraph") opens
**Edit**:

- **Citation**: enter a **PubMed ID** or **DOI** and choose **Look up
  details**. The details are fetched from PubMed or Crossref and fill in
  **empty** fields only. Check them, then **Save changes**. You can also edit
  title, journal, year, status (Published, Preprint or Unpublished), authors
  and link by hand.
- **About page**: the dataset's section on the About page. **Heading** (empty
  uses the dataset name), **Paragraph**, **Order** (lower numbers come first)
  and **Show on the About page**.

The citation appears on the Downloads and About pages, and at the top of
the dataset's tab-separated download. A dataset's name cannot be changed.

### Deleting a dataset

The delete button asks for confirmation, then deletes the dataset **and every
interaction that belongs to no other dataset**. Interactions shared with
another dataset stay. Proteins are never deleted. This cannot be undone, so
take a [backup](../operator-guide/maintenance.md#backups) first if in doubt.

## Files

**Admin → Files** publishes extra downloads, such as sequence files or
supplementary tables, in the **Supplementary Files** section of the Downloads
page.

- Drop a file onto the page, or click to browse: `.fasta`, `.fa`, `.tab`,
  `.tsv`, `.sif` or `.csv`, up to 500 MB, as UTF-8 text. A new file is
  published straight away.
- If a file with the same name exists, you can cancel and rename yours, or
  **Upload anyway**. Both files are then listed under the same name, so
  renaming first is clearer.
- Each file has **Download**, **Hide** or **Show** (whether it is listed on the
  Downloads page), and **Delete**, which asks first. A hidden file cannot be
  downloaded by visitors.
