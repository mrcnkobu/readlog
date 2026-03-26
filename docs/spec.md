# Readlog Specification

Last updated: 2026-03-26

## Philosophy

- Plain markdown first
- One note per item
- Frontmatter is the source of truth
- Journal-like logging into plain markdown files
- No external dependencies in v1

## v1

### Scope

Readlog v1 is book-focused. Articles, sidebar UI, metadata fetch, and external imports are intentionally deferred.

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
added: 2026-03-26
started: 2026-03-26
finished:
rating:
pages: 352
progress: 145
medium: ebook
device: Kindle Paperwhite
tags: [programming, craftsmanship]
---

## Cover

## Notes

## Citations

## Highlights
```

The `## Cover` section is intentionally manual. Readlog creates the heading, but it does not manage cover images or special cover metadata. If you want a cover, paste an Obsidian image embed there yourself.

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
- total pages
- tags
- initial status

Behavior:

- sets `added` to today
- sets `started` to today if the initial status is `reading`
- initializes `progress` to `0`
- creates the standard body sections, including `## Cover`

#### `Readlog: Edit book`

Updates metadata and reading state for an existing book.

Editable fields:

- title
- author
- medium
- device
- status
- pages
- progress
- tags
- started
- finished
- rating

Behavior rules:

- if status becomes `reading` and `started` is empty, set it to today
- if status becomes `done` and `finished` is empty, set it to today
- if title changes, rename the note file conservatively
- allows deleting the book note after confirmation
- deleting a book trashes only the note file and does not rewrite old daily-note or reading-log entries

#### `Readlog: Log reading session`

Logs a reading session for a book.

Inputs:

- book
- new current page
- optional minutes spent
- optional short session note

Behavior:

- reads the previous page from `progress`
- updates `progress` to the new current page
- sets `status: reading` if needed
- sets `started` if empty
- appends a new entry to `Reading/reading-log.md`
- appends one timestamped line to today’s daily note
- suggests finishing the book when progress reaches total pages

#### `Readlog: Add entry`

Adds either a note or a citation to a selected book.

Entry types:

- `note`
- `citation`

For notes, Readlog appends:

```md
**2026-03-26** - Your note text here.
```

For citations, Readlog appends:

```md
> "Your quoted text here." - p.42
```

The locator is optional and may also be a Kindle location such as `loc.1845-1848`.

### `reading-log.md`

This file is append-only and oldest-first.

Example:

```md
# Reading Log

## 2026-03-24
- **Dune** - *pages* 1-40 (*39 pages*, *20:10*)
  > Slow start but the world-building is already pulling me in.

## 2026-03-26
- **The Pragmatic Programmer** - *pages* 120-145 (*25 pages*, *35 min*, *21:14*)
  > Orthogonality section is dense, need to revisit tomorrow.
```

Readlog never rewrites old log entries.

### Daily note integration

When a reading session is logged, Readlog appends a plain line under a configurable markdown heading line in today’s daily note:

```md
##### *Reading*

- [[The Pragmatic Programmer]] - *pages* 120-145 (*21:14*, *35 min*)
```

The heading may be a full markdown heading such as `## Reading` or `##### *Reading*`. If the heading does not exist, it is created.

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

## v2

### Kindle `My Clippings.txt` import

Readlog v2 may add a local import command:

- `Readlog: Import Kindle Clippings`

This feature is intentionally scoped to the local `My Clippings.txt` file. No Amazon account login, cloud sync, or Kindle web scraping is planned.

### Proposed import flow

1. Select a local `My Clippings.txt` file
2. Parse clipping entries into a structured intermediate model
3. Group entries by source book
4. Match each group to an existing Readlog book note, or offer to create one
5. Preview the import plan
6. Import only new entries

### Mapping rules

- Kindle `Highlight` -> `## Citations`
- Kindle `Note` -> `## Notes`
- Kindle `Bookmark` -> ignored in the first import iteration

### Deduplication

Each imported clipping should be fingerprinted from normalized title, clipping type, locator, and body text. Repeat imports should skip previously imported entries.

### Non-goals for Kindle import

- no writes to `reading-log.md`
- no writes to daily notes
- no changes to reading progress
- no automatic status transitions
