# NativeDeck

A local-only flashcard app, similar to Quizlet, that runs entirely on your machine — as
a browser app or a packaged desktop app. No account, no server — everything is stored
locally (IndexedDB).

Grab the latest Windows installer from the
[Releases page](https://github.com/afranz29/NativeDeck-local-flashcard-app/releases) —
no build step required. The installed app updates itself automatically.

## Features

- **Sets, folders & tags** — organize flashcard sets into flat folders (drag-and-drop),
  and tag sets for cross-folder filtering in the library.
- **Markdown cards** — term and definition fields support Markdown (bold, italics,
  lists, headers, code, etc.), plus an optional image per side.
- **Browse view** — a flip-card viewer with prev/next arrows (spacebar to flip), and a
  full read-only list of every card in the set below it.
- **Study mode** — flip through cards at your own pace, sorting them into "know it" /
  "still learning" as you go.
- **Learn mode** — a Quizlet-style quiz: multiple choice and/or True/False questions,
  with a configurable direction (term→definition, definition→term, or randomized).
  Three correct answers in a row masters a card; a wrong answer resets its streak.
  Mastery persists per card across sessions.
- **Stats** — a per-set progress chart tracking mastery percentage over completed Learn
  rounds.
- **Favorites** — mark individual cards as favorites.
- **Import/export** — paste-import (Quizlet-style, with configurable delimiters),
  export/import a whole library or a single set as JSON (preserves images, mastery,
  and folders), and export a set to CSV.
- **Dark mode** — light/dark/system theme toggle.
- **Desktop app** — an Electron build with a Windows installer and automatic updates
  via GitHub Releases (see [Desktop app](#desktop-app) below).

## CI & security

- **CI** (`.github/workflows/ci.yml`) — lint, typecheck, and build on every push/PR to `main`.
- **CodeQL** (`.github/workflows/codeql.yml`) — static security analysis, on push/PR and weekly.
- **Dependency audit** (`.github/workflows/audit.yml`) — `npm audit` against production
  dependencies, on push/PR and weekly.
- **Dependabot** (`.github/dependabot.yml`) — weekly dependency update PRs for both npm
  packages and GitHub Actions.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (typically `http://localhost:5173`) in your browser.

## Building

```bash
npm run build
```

Outputs a static site to `dist/`, which you can host anywhere (or just open locally) —
no backend required.

## Desktop app

```bash
npm run dist
```

Builds a Windows installer to `release/` via Electron + electron-builder. The installed
app checks GitHub Releases for newer versions on launch and updates itself
automatically (via `electron-updater`).

To cut a new release:

```bash
# bump "version" in package.json first
npm run release
```

## Tech stack

- React + TypeScript + Vite
- Tailwind CSS
- Dexie (IndexedDB) for storage
- react-router-dom
- react-markdown (sanitized) for card rendering

## Data & privacy

All data lives in your browser's IndexedDB, scoped to whichever browser you're using —
it does not sync between browsers or devices. Use the library export/import feature to
move your data between browsers or back it up.
