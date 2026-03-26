# Readlog

Readlog is an [Obsidian](https://obsidian.md) plugin for tracking books in plain markdown. It keeps one note per book, appends reading sessions to a vault-native reading log, and optionally writes a plain text line into your daily note.

## Scope

### v1

- Book-only workflow
- One note per book under `Reading/Books/`
- Append-only `Reading/reading-log.md`
- Optional daily note integration with configurable folder template, filename template, and markdown heading line
- Four commands:
  - `Add book`
  - `Edit book`
  - `Log reading session`
  - `Add entry`

### v2

- Kindle `My Clippings.txt` import
- Highlights imported into `## Citations`
- Kindle notes imported into `## Notes`
- Conservative matching against existing book notes
- Deduplicated imports

The detailed product spec lives in [docs/spec.md](./docs/spec.md).

## Features

- Plain markdown first
- Frontmatter-backed book metadata
- Manual cover support through a standard `## Cover` section
- Book metadata for `medium` and `device`
- Conservative file writes that preserve manual edits
- Delete-book action that trashes only the book note and leaves historical logs intact
- Configurable root folder and daily note integration
- Shortcode-based daily note folder and filename templates
- Timestamped session logging in daily notes and the reading log
- Testable pure helpers for section insertion and reading-log appends

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
| `Edit book` | Update metadata such as status, medium, device, progress, pages, tags, rating, and dates, or delete the book note |
| `Log reading session` | Update reading progress, capture optional minutes spent, append to `reading-log.md`, and append a timestamped line to today’s daily note |
| `Add entry` | Append a note or citation under the correct section in the selected book note |

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

## License

MIT
