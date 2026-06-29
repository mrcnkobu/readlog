# Readlog

Readlog is an [Obsidian](https://obsidian.md) plugin for tracking books in plain markdown. It keeps one note per book, appends reading sessions to a vault-native reading log, writes a compact session line into the book note and into your daily note, and can import Kindle highlights and notes from a local `My Clippings.txt` file.

## Scope

### Core workflow

- Book-only workflow
- One note per book under `Reading/Books/`
- Append-only `Reading/reading-log.md`
- Optional daily note integration with configurable folder template, filename template, and markdown heading line
- Four core commands:
  - `Add book`
  - `Edit book`
  - `Log reading session`
  - `Add entry`

### Kindle import

- Local `My Clippings.txt` import
- Highlights imported into `## Citations`
- Kindle notes imported into `## Notes`
- Conservative matching against existing book notes
- Optional creation of missing book notes
- Deduplicated imports via persistent clipping fingerprints

The detailed product spec lives in [docs/spec.md](./docs/spec.md).

## Features

- Plain markdown first
- Frontmatter-backed book metadata
- Manual cover support through a standard `## Cover` section
- Book metadata for `medium` and `device`
- Unit-based progress tracking with `page`, `loc`, or `percent`
- Stored computed `progress_percent` in frontmatter
- Session logs that include both the unit range and the percent range
- Per-book `## Log` entries with a subtle backlink to the corresponding daily note
- Conservative file writes that preserve manual edits
- Delete-book action that trashes only the book note and leaves historical logs intact
- Configurable root folder and daily note integration
- Shortcode-based daily note folder and filename templates
- Local Kindle import that does not touch `reading-log.md` or daily notes
- Testable pure helpers for section insertion, daily note templates, My Clippings parsing, and progress normalization

## Installation

### From source

```bash
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` into:

```bash
<your-vault>/.obsidian/plugins/readlog/
```

### Deploy to configured vaults

```bash
cp .env.example .env
# Edit .env with absolute vault paths

npm run deploy:test
npm run deploy:prod
```

The deploy scripts build the plugin and copy `main.js`, `manifest.json`, and `styles.css` into:

- `$READLOG_TEST_VAULT/.obsidian/plugins/readlog/`
- `$READLOG_PROD_VAULT/.obsidian/plugins/readlog/`

## Development

```bash
npm run dev
npm run lint
npm run test
npm run verify
```

## Commands

| Command | Description |
|---|---|
| `Add book` | Create a new book note with frontmatter, `## Cover`, and the standard sections |
| `Edit book` | Update metadata such as status, medium, device, progress unit, current progress, progress total, rating, and dates, or delete the book note |
| `Log reading session` | Update reading progress, choose the session date, capture optional minutes spent, append to `reading-log.md`, append a timestamped line to that date’s daily note, and add the same session to the book note `## Log` section |
| `Add entry` | Append a note or citation under the correct section in the selected book note |
| `Import Kindle Clippings` | Pick a local `My Clippings.txt` file, import new highlights and notes, match existing books conservatively, and optionally create missing book notes |

## Progress model

Readlog tracks one active progress unit per book:

- `page`
- `loc`
- `percent`

Example frontmatter:

```md
---
progress_unit: loc
progress_current: 1845
progress_total: 3200
progress_percent: 58
---
```

Example session output:

```md
- [[Deep Work]] - *locations* 1845-1910 (*58%-60%*, *21:14*, *35 min*)
- **Deep Work** - *locations* 1845-1910 (*65 loc*, *58%-60%*, *21:14*, *35 min*)
- *2026-03-29* - *locations* 1845-1910 (*58%-60%*, *21:14*, *35 min*) · [[2026-03/2026-03-29_Sun|daily]]
```

## Daily note templates

Readlog supports these shortcodes in both the daily folder template and daily note name template:

- `{year}`
- `{month}`
- `{day}`
- `{weekday_short}`
- `{weekday_long}`

Example:

- folder template: `{year}-{month}`
- name template: `{year}-{month}-{day}_{weekday_short}`
- resolved path for January 6, 2025: `2025-01/2025-01-06_Mon.md`

## Kindle import notes

- Bookmarks are ignored.
- Duplicate clippings are skipped across repeated imports.
- Imported clippings update only book notes.
- Kindle import does not write to `reading-log.md`.
- Kindle import does not write to daily notes.
- Kindle import does not change reading progress.

## License

MIT
