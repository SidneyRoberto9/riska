# Requirements Freeze

Locked product decisions, as implemented. Treat these as fixed unless the
maintainer explicitly asks for a change — and record the change here (and
in an ADR when it's architectural).

## Access

- **No accounts.** A session is a slug (`^[a-z0-9]{3,40}$`, doubles as the
  URL `/s/<slug>`) plus a 4-digit numeric PIN. No email, no password
  reset: a forgotten PIN means a lost session.
- Entering the right PIN once grants a signed cookie valid for 1 year on
  that browser. 5 wrong PINs lock the session (15 min, doubling each
  lock, capped at 24 h).
- A session can be deleted from its settings by typing its slug and PIN
  again; deletion cascades to all its data.
- **Local mode** (`/local`): no slug, no PIN, no server. Data stays in that
  browser's `localStorage` and never syncs.
- The home screen lists the last 10 sessions opened on this device
  (client-side only).

## Content model

- Pages → sections → tasks. Sections have a note and a highlight flag;
  tasks have a title, a done flag, a status, a description (the `note`
  column), a **responsável** (free text) and a creation date. In a session
  a task can also have **images** (PNG, JPEG, WebP, GIF, AVIF; ≤ 10 MB
  each, ≤ 20 per task; no SVG) stored in a private R2 bucket (ADR 0010).
  Local mode has no images.
- Each page owns its statuses (the board columns). New pages get
  **A Fazer**, **Em Andamento**, **Concluído** (the last marked done).
  Colors come from a fixed palette of 8.
- Limits (`LIMITS` in `src/lib/types.ts`): page/section titles 200,
  section notes 500, task titles 120 when typed (longer titles created
  before this limit are kept and stay editable; the server still accepts
  1000), task descriptions 2000, responsável 80, image names 200, status
  names 30 characters.

## Views

- Two views of the same tasks per page: **Lista** (sections, checklist
  order) and **Quadro** (kanban by status, `?view=quadro`). A task keeps a
  separate order in each.
- New tasks are created through a modal in both views (**Título**,
  **Descrição**, **Responsável**, **Coluna** chips, **Seção**, **Imagens**
  in sessions). "Adicionar tarefa" in a board column preselects that
  column. The modal can't be closed while images are uploading.
- Task details open in a dialog from a board card or a list row's title,
  addressable by URL (`?task=<id>`). The column is switched with chips.
- Rows and cards show a meta line: responsável, image count, and an icon
  when the task has a description.
- Drag-and-drop in both views, by mouse, touch (long-press) and keyboard.

## Sync

- Session data syncs by polling: collections refetch every 15 s; writes
  are optimistic and sent in order per session.

## Presentation

- UI in PT-BR only.
- 6 accent themes × light/dark/system, saved per session (or per browser in
  local mode).
- Content max width 1440 px; phone-first layout, task dialog becomes a
  bottom sheet on small screens.
- Voice dictation of tasks where the browser supports the Web Speech API
  (`pt-BR`); hidden elsewhere.

## Deployment

- Single Node process (TanStack Start / Nitro output) + PostgreSQL.
- Docker image built on `node:24-alpine` (`npm ci`, `npm run build`), runs
  as the `node` user on port 3000.
- Configuration: `DATABASE_URL`, `COOKIE_SECRET` (≥ 32 chars), and
  optionally `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_BUCKET` (images are hidden without them).
