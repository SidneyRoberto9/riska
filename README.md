# Riska

*Simple checklists, synced between phone and PC.*

Riska is a minimal checklist and kanban app. Create a named session with a
4-digit PIN, share the link with yourself or someone else, and every page,
section and task stays in sync between devices — or skip the account
entirely and use it disposably, saved only in the browser.

## Why

Most task apps make you sign up before you can write anything down. Riska
keeps the two paths that actually matter separate: a **named session**
(slug + PIN, no email, no password reset flow) for lists you want to reopen
on another device, and a **local mode** for the throwaway list you just need
right now, gone the moment you clear your browser.

## Features

- **Sessions without accounts** — pick a slug, set a 4-digit PIN, get a
  shareable URL (`/s/<slug>`). Five wrong PIN attempts lock the session with
  exponential backoff (15min → up to 24h).
- **Local mode** — `/local` skips the server entirely; pages, sections and
  tasks live only in `localStorage`.
- **Pages → sections → tasks** — each page holds sections (checklist
  groups), each section holds tasks, with inline editing throughout.
- **Two views of the same data** — a linear checklist (**List**) and a
  **Board** (kanban) view, both backed by the same tasks; switching views
  never duplicates data.
- **Drag-and-drop** — reorder tasks in a list or drag cards between board
  columns (`@dnd-kit`), touch and mouse alike.
- **Custom statuses** — each page defines its own kanban columns (name,
  color, done flag), not a fixed to-do/doing/done set.
- **Task notes** — a longer free-text note per task, separate from its
  title.
- **Voice dictation** — dictate a task with the Web Speech API where the
  browser supports it; the button disappears where it doesn't.
- **Themes** — 6 accent colors × light/dark/system mode, persisted per
  session.
- **Recent sessions** — the last 10 sessions opened on this device are
  offered on the home screen, remembered client-side only.

## Architecture

```
React 19 (TanStack Start, SSR)
        │
        ├── /              session create / join
        ├── /local          offline mode, no server round-trip
        └── /s/$slug/...    PIN-gated session, list + board views
        │
        ▼
TanStack DB collections (client cache + optimistic writes)
        │
        ├── local mode  → localStorageCollectionOptions
        └── session mode → queryCollectionOptions, serialized per session
                              │
                              ▼
                     TanStack Start server functions
                              │
                              ▼
                          PostgreSQL
```

Both modes share the same `Source` shape (`pages`, `sections`, `statuses`,
`tasks`, `settings` collections) — components read from `useSource()` and
never know whether they're talking to Postgres or `localStorage`.

Server writes for a given session are serialized through a queue so
concurrent drag-and-drop reorders from two tabs never race each other into
an inconsistent position.

## Data model

| Table       | Key columns                                                              |
| ----------- | ------------------------------------------------------------------------ |
| `sessions`  | `slug` (PK, URL-safe), `pin_hash`, `theme`, `mode`, lockout counters      |
| `pages`     | `title`, `subtitle`, `position`                                          |
| `sections`  | `page_id`, `title`, `note`, `highlight`, `position`                      |
| `statuses`  | `page_id`, `name`, `color`, `done`, `position` — a page's kanban columns  |
| `tasks`     | `section_id`, `status_id`, `text`, `note`, `done`, `position` (list order), `board_position` (kanban order) |

Migrations (`src/server/schema.sql`) run idempotently on the first database
query of each server process (retried on the next request if they fail),
including backfilling default statuses for pages created before the kanban
board existed.

## Security

- PINs are hashed, never stored or logged in plain text.
- 5 failed attempts lock a session; the lockout window doubles each
  additional failure (15min, 30min, 1h, … capped at 24h).
- Session slugs are validated against `^[a-z0-9]{3,40}$` server-side, so a
  slug can never be used to inject a path or query.
- Local mode never touches the network — nothing about it is exposed to the
  server.

## Testing

```bash
npm run lint        # Biome + file-size and one-component-per-file checks
npm run typecheck   # tsc --noEmit
npm test            # unit tests
```

`npm test` runs `node --test` over `src/lib/*.test.ts` — covers the pure ordering
(`order.ts`) and status (`status.ts`) logic that drag-and-drop and the
board depend on.

## Running locally

Requires Node 22+ and a PostgreSQL database.

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and COOKIE_SECRET
npm run dev
```

Before opening a PR: `npm run lint && npm run typecheck && npm test && npm run build`.

| Variable        | Purpose                                                |
| --------------- | ------------------------------------------------------- |
| `DATABASE_URL`  | Postgres connection string                              |
| `COOKIE_SECRET` | Session cookie signing secret — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |

## Documentation

- [CLAUDE.md](CLAUDE.md) — project rules for contributors and AI agents
- [CONTRIBUTING.md](CONTRIBUTING.md) — setup, checks, commit style
- [SECURITY.md](SECURITY.md) — reporting vulnerabilities, security scope
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md) — enforced code conventions
- [docs/DESIGN.md](docs/DESIGN.md) — themes, tokens, layout, accessibility
- [docs/REQUIREMENTS_FREEZE.md](docs/REQUIREMENTS_FREEZE.md) — locked product decisions
- [docs/adr/](docs/adr/) — architecture decision records

## Stack

TanStack Start · TanStack Router · TanStack DB · TanStack Query · React 19 ·
TypeScript · Tailwind CSS 4 · PostgreSQL · `@dnd-kit` · Vite · Nitro
