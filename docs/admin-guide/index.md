# Admin guide

This guide is for a portal's administrators: the people who load its data,
write its pages and set its look, all from the **Admin** area in the browser.
Installing and running the server is covered in the
[Operator guide](../operator-guide/installation.md).

## Getting access

**Admin** appears in the top bar for administrator accounts only. Accounts
registered on the site are never administrators. An existing administrator
grants access in **Admin → Accounts** (see
[Settings](settings.md#accounts)), and the very first administrator is created
on the server (see
[Installation](../operator-guide/installation.md#create-the-first-administrator)).

## Finding your way

The sidebar groups every admin screen:

| Section | Screens |
|---|---|
| **Site** | **Site Identity**, **Appearance** |
| **Pages** | **Home**, **Search**, **Downloads**, **About**, **Documentation**, **FAQs**, **Contact**, **Accounts** |
| **Content** | **News**, **Datasets**, **Files** |

The **Site** and **Pages** screens are settings, described in
[Settings](settings.md). **News**, **Datasets** and **Files** manage content,
and are described in [News, datasets and files](content.md).

## Saving settings

All settings screens share one save bar at the bottom:

- **Save N changes** saves everything you changed on every settings screen at
  once. Nothing is saved until you press it.
- **Discard changes** throws away unsaved edits.
- **Reset colors** puts every colour back to its default, after asking. Text
  and content are not affected.

A dot in the sidebar marks screens with unsaved edits, and each changed field
has a **revert** link. Colour changes are previewed across the site as you
make them, and undone if you leave without saving.

!!! warning "Unsaved edits are lost if you leave through the top bar"
    Leaving through the admin sidebar, or closing the browser tab, asks you
    first. Following a link in the top bar does not.

The logo is the exception: uploading or removing it takes effect straight
away, without the save bar.

## Changing the site's wording

Nearly every heading, paragraph, label and button in the portal can be
reworded. Each **Pages** screen lists the text for that page, grouped the way
it appears there. Long lists have a **Filter these fields…** box, and
captions, placeholders and empty-state messages sit under **Labels &
buttons**.

- A field left **empty** uses the wording openPIP ships with, shown in grey as
  its placeholder.
- **Reset** on a field returns it to the shipped wording.
- A **customized** tag marks fields you have changed.
- Some fields are rich text (headings, bold, italic, links and lists). Others
  are plain text, where each line of a list is written as `term | description`.
- **View page ↗** opens the page so you can check the result.

Text is saved with the save bar, like other settings.
