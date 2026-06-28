# Readlog Specification

Last updated: 2026-03-29

## Philosophy

- Plain markdown first
- One note per item
- Frontmatter is the source of truth
- Journal-like logging into plain markdown files
- No external dependencies in core book tracking

## v1

### Scope

Readlog v1 is book-focused. Articles and sidebar UI are intentionally deferred.

### Folder structure

```text
Reading/
├── Books/
│   ├── The Pragmatic Programmer.md
│   └── Dune.md
└── reading-log.md
```

The `Reading/` root folder and the `Books/` subfolder are configurable.

### Canonical book schema

```md
---
type: book
title: The Pragmatic Programmer
author: David Thomas, Andrew Hunt
status: reading
added: 2026-03-29
started: 2026-03-29
finished:
rating:
progress_unit: loc
progress_current: 1450
progress_total: 3200
progress_percent: 45
medium: ebook
device: Kindle Paperwhite
tags: [programming, craftsmanship]
---

## Cover

## Notes

## Citations

## Highlights

## Log
```

The `## Cover` section is intentionally manual. Readlog creates the heading, but it does not manage cover images or special cover metadata. If you want a cover, paste an Obsidian image embed there yourself.

### Progress model

Readlog tracks one active progress unit per book:

- `page`
- `loc`
- `percent`

Field rules:

- `progress_unit` defines what `progress_current` and `progress_total` mean
- `progress_current` is the current reading position
- `progress_total` is the total size of the book in that unit
- `progress_percent` is computed by the plugin and stored in frontmatter
- for `percent` books, Readlog keeps `progress_total` at `100`
- for `page` and `loc` books, `progress_percent` is only meaningful when `progress_total` is set

### Status values

- `to-read`
- `reading`
- `done`
- `abandoned`

### Commands

#### `Readlog: Add book`

Creates a book note under `Reading/Books/`.

Inputs:

- title
- author
- medium
- device
- progress unit
- progress total
- tags
- initial status

Behavior:

- sets `added` to today
- sets `started` to today if the initial status is `reading`
- initializes `progress_current` to `0`
- computes `progress_percent`
- creates the standard body sections, including `## Cover`

#### `Readlog: Edit book`

Updates metadata and reading state for an existing book.

Editable fields:

- title
- author
- medium
- device
- status
- progress unit
- current progress
- progress total
- tags
- started
- finished
- rating

Behavior rules:

- recalculates `progress_percent`
- if status becomes `reading` and `started` is empty, set it to today
- if status becomes `done` and `finished` is empty, set it to today
- if title changes, rename the note file conservatively
- allows deleting the book note after confirmation
- deleting a book trashes only the note file and does not rewrite old daily-note or reading-log entries

#### `Readlog: Log reading session`

Logs a reading session for a book.

Inputs:

- book
- new current progress
- optional minutes spent
- optional short session note

Behavior:

- reads the previous position from `progress_current`
- updates `progress_current`
- recalculates `progress_percent`
- sets `status: reading` if needed
- sets `started` if empty
- appends a new entry to `Reading/reading-log.md`
- appends one timestamped line to today’s daily note
- appends one compact session entry under `## Log` in the book note
- includes the percent range from the previous position to the new one
- includes a subtle backlink from the book note log entry to the corresponding daily note
- suggests finishing the book when progress reaches `100%`

Example daily note output:

```md
##### *Reading*

- [[The Pragmatic Programmer]] - *locations* 1450-1520 (*45%-48%*, *21:14*, *35 min*)
```

Example reading-log output:

```md
# Reading Log

## 2026-03-29
- **The Pragmatic Programmer** - *locations* 1450-1520 (*70 loc*, *45%-48%*, *21:14*, *35 min*)
  > Orthogonality section is dense, need to revisit tomorrow.
```

Example book-note log output:

```md
## Log

- *2026-03-29* - *locations* 1450-1520 (*45%-48%*, *21:14*, *35 min*) · [[2026-03/2026-03-29_Sun|daily]]
  > Orthogonality section is dense, need to revisit tomorrow.
```

#### `Readlog: Add entry`

Adds either a note or a citation to a selected book.

Entry types:

- `note`
- `citation`

For notes, Readlog appends:

```md
**2026-03-29** - Your note text here.
```

For citations, Readlog appends:

```md
> "Your quoted text here." - p.42
```

The locator is optional and may also be a Kindle location such as `loc.1845-1848`.

### `reading-log.md`

This file is append-only and oldest-first. Readlog never rewrites old log entries.

### Daily note integration

When a reading session is logged, Readlog appends a plain line under a configurable markdown heading line in today’s daily note. The heading may be a full markdown heading such as `## Reading` or `##### *Reading*`. If the heading does not exist, it is created. The same session is also appended under `## Log` in the corresponding book note.

### Settings

| Setting | Default | Description |
|---|---|---|
| Root folder | `Reading` | Base folder for all Readlog content |
| Books folder | `Books` | Subfolder used for book notes |
| Reading log filename | `reading-log.md` | Append-only reading session log |
| Daily notes folder template | `Daily` | Folder template used to resolve the daily note path |
| Daily note name template | `{year}-{month}-{day}` | Filename template used for the daily note basename |
| Daily note heading line | `## Reading` | Full markdown heading line Readlog appends under |

### Daily note shortcodes

Readlog supports these shortcodes in the daily notes folder template and the daily note name template:

- `{year}` -> `2025`
- `{month}` -> `01`
- `{day}` -> `06`
- `{weekday_short}` -> `Mon`
- `{weekday_long}` -> `Monday`

Example:

- folder template: `{year}-{month}`
- name template: `{year}-{month}-{day}_{weekday_short}`
- resolved path on January 6, 2025: `2025-01/2025-01-06_Mon.md`

Legacy filename formats like `YYYY-MM-DD` are migrated to shortcode form automatically.

## Kindle import

### Command

Readlog includes a local import command:

- `Readlog: Import Kindle Clippings`

This feature is intentionally scoped to the local `My Clippings.txt` file. No Amazon account login, cloud sync, or Kindle web scraping is part of the plugin.

### Import flow

1. Select a local `My Clippings.txt` file
2. Parse clipping entries into a structured intermediate model
3. Group entries by source book
4. Match each group to an existing Readlog book note
5. If a title is unmatched, optionally create a new book note for it
6. Import only new highlights and notes

### Matching rules

- first try case-insensitive exact title matching
- then try normalized title matching
- if multiple books match the same imported title, skip that title as ambiguous
- if no book matches, the user can import only into existing matches or let Readlog create missing book notes

New books created from Kindle import use conservative defaults:

- `status: to-read`
- `medium: ebook`
- `device: Kindle`
- `progress_unit: loc`
- no total or percent inferred

### Mapping rules

- Kindle `Highlight` -> `## Citations`
- Kindle `Note` -> `## Notes`
- Kindle `Bookmark` -> ignored

Imported notes are appended as plain markdown, for example:

```md
**2025-01-02** - Imported from Kindle: Revisit the chapter on orthogonality. (loc. 400)
```

Imported highlights are appended as plain markdown, for example:

```md
> "Care about your craft." - p. 12; loc. 345-346
```

### Deduplication

Each imported clipping is fingerprinted from normalized title, author, clipping kind, locator, and text. Repeat imports skip fingerprints that have already been imported before.

### Non-goals for Kindle import

- no writes to `reading-log.md`
- no writes to daily notes
- no automatic changes to reading progress
- no automatic status transitions for existing books
