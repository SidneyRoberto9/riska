# Task modal, assignee and image attachments — Design

Date: 2026-09-24 · Status: awaiting review

## Why

A manager used the app and pasted a whole requirement into the task title
(and a person's name into the description). Tasks became huge in both views.
The model needs to steer people to: short title, long text in the
description, a separate "responsible person" field, and screenshots as
images instead of prose.

## Decisions (from the maintainer)

- Existing tasks are **not migrated**. Old long titles stay; the UI clamps them.
- R2 bucket is **private**; the app serves images through short-lived signed URLs.
- Local mode (`/local`) has **no images** (it never touches the network).
- SigV4 signing via **`aws4fetch`** (one small, zero-dependency package).

## 1. Data

| Change | Detail |
| --- | --- |
| Title limit | New `LIMITS.taskTitle = 120` used by every title input. The server keeps `str(LIMITS.task)` (1000) so legacy titles stay editable; the edit input uses `maxLength = max(120, current length)`. |
| Assignee | `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee text NOT NULL DEFAULT ''`. `Task.assignee: string`, `LIMITS.assignee = 80`, added to `taskFields`. Local rows without it read as `""` (`upgradeLocalPage` fills it). |
| Attachments | New table (below), new `Attachment` type, new `attachments` collection on `Source`. |

```sql
CREATE TABLE IF NOT EXISTS attachments (
  id           text PRIMARY KEY,
  task_id      text NOT NULL REFERENCES tasks ON DELETE CASCADE,
  key          text NOT NULL,
  name         text NOT NULL,
  content_type text NOT NULL,
  size         int  NOT NULL,
  position     int  NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attachments_task_idx ON attachments (task_id);
```

- `Attachment = { id, taskId, pageId, name, contentType, size, position }`
  (`pageId` derived server-side from the task's section's page, for cheap
  client filtering — same pattern as `Task.pageId`). The R2 `key` never
  leaves the server.
- The local source gets an in-memory, never-written `attachments`
  collection so `useSource()` stays one code path; the image field is
  hidden when `source.slug === null` or storage is not configured.
- **Undo on task delete** re-inserts the task and then its attachment rows
  (still in the client collection). R2 objects are never deleted by task
  deletion, so the images come back.

## 2. Storage (R2, private)

Env: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET`. Missing any → `storageEnabled = false`, image UI hidden,
upload functions reject.

Module `src/server/storage.server.ts` (aws4fetch `AwsClient`, service `s3`,
region `auto`): `presignPut(key, contentType)`, `presignGet(key)`,
`head(key)`, `remove(key)`.

Shared rules in `src/lib/images.ts` (unit-tested):
`IMAGE_TYPES = png, jpeg, webp, gif, avif` (**no SVG** — script-capable),
`MAX_IMAGE_BYTES = 10 MB`, `MAX_IMAGES_PER_TASK = 20`,
`checkImage(type, size)`.

### Upload flow

1. Client picks files (button with `accept`, drag-drop, paste). `checkImage`
   rejects bad ones immediately with a PT-BR message.
2. `createUploadFn({ slug, contentType, size })` → validate, `requireAccess`,
   `checkImage`; returns `{ id, url }` with key `<slug>/<id>`, a 5-minute
   presigned PUT with `Content-Type` signed.
3. Browser `PUT`s the file straight to R2 (`XMLHttpRequest` for progress).
4. Client inserts the attachment row through the collection (serial queue,
   so it always lands after the task insert). `insertAttachmentsFn`:
   `requireAccess`; the task must be in this session; count ≤ 20;
   **`HEAD` the object** — must exist, `content-type` in `IMAGE_TYPES`,
   `content-length` ≤ 10 MB — else delete the object and throw.
   `key` is recomputed server-side as `<slug>/<id>`, never taken from the client.

### Reading

Server route `GET /api/s/$slug/img/$id`: checks the session cookie (same
check as `requireAccess`), looks the row up scoped by slug, responds
`302` to a presigned GET (1 h) with `Cache-Control: private, max-age=3000`.
Stable `src` → the browser caches; the 15 s poll does not re-download.
Response also sets `X-Content-Type-Options: nosniff` on the redirect.

### Removing an image

Deletes the row (with undo toast) — the R2 object stays.

### R2 setup (one-off, documented in README)

- Bucket CORS: allow `PUT` from the app origins with header `Content-Type`.
- The public `r2.dev` URL is **not used** and should be disabled
  (otherwise objects are readable by anyone who learns a key).

### Deliberately deferred (`ponytail:` comments)

- Orphaned objects (deleted image/task/page/session) are not purged —
  add a sweep script listing `<slug>/` prefixes vs. rows when storage cost matters.
- No client-side downscaling — add a canvas resize if phone uploads are slow.

## 3. UI

### New task modal (`TaskCreateDialog`)

Same component from both views. Native `<dialog>`, same shell/animation as
`TaskDialog` (bottom sheet ≤ 640 px). Fields, in order:

1. **Título** — input, required, 120 chars, counter near the limit, voice.
   Hint: "Curto. Detalhes vão na descrição."
2. **Descrição** — auto-growing textarea, voice.
3. **Responsável** — input, optional, 80 chars, `<datalist>` of assignees
   already used on this page.
4. **Coluna** — radio group rendered as colored chips (the page's
   statuses, in order). Preselected: the clicked column (Quadro) or the
   first status (Lista). Arrow keys move within the group (native radios).
5. **Seção** — `<select>`, only when the page has > 1 section. Preselected:
   the section clicked (Lista) or the last used one (Quadro, existing
   `localStorage` key).
6. **Imagens** — drop zone + "Adicionar imagens" button; thumbnails with
   progress; remove (×) before submit. Hidden without storage.

Footer: Cancelar · **Criar tarefa** (Ctrl/⌘+Enter submits). On submit the
task is inserted optimistically, pending uploads run; the modal stays open
showing progress until they finish, then closes. A failed upload shows
"Tentar de novo" on that thumbnail and the modal stays; closing anyway
keeps the task and drops the failed image (toast says so).

### Entry points

- **Lista**: `NewTaskInput` becomes a "+ Nova tarefa" button per section.
- **Quadro**: `BoardAddCard` becomes a button opening the modal with its column.

### Lista row (`TaskRow`)

- Title is a button (2-line clamp) that opens the details dialog
  (`?task=<id>`, same mechanism the board uses). No inline title/note editing.
- Meta line under it: user icon + responsável · image icon + count ·
  note icon when there is a description.
- Menu: Subir, Descer, Status, Deletar ("Editar nota" goes — the dialog does it).

### Board card (`BoardCardFace`)

2-line clamp, same meta line (section · responsável · images · note).

### Details dialog (`TaskDialog`)

- Width 512 → 640 px.
- Title smaller (1rem semibold), still inline-editable.
- `dl`: **Coluna** (chips, replaces the Status chip), **Responsável**
  (inline input, datalist), Seção, Criada.
- Descrição textarea (unchanged behavior: saved on blur/unmount).
- **Imagens**: thumbnail grid (square, `object-cover`, lazy), each a button
  opening the lightbox, with a remove action; add button / drop / paste.

### Lightbox (`ImageLightbox`)

`<dialog>` 96vw × 96dvh over a near-black backdrop, image `object-contain`.
Prev/next buttons + ←/→ keys + horizontal swipe when > 1, counter "2 / 5",
"Abrir original" link, X / Esc / backdrop close. Opens as a second top-layer
dialog above `TaskDialog`; closing it returns focus to the thumbnail.
Reduced motion respected.

### Shared pieces

`ColumnChips`, `AssigneeInput`, `ImageField` (picker + thumbnails +
uploads), `ImageLightbox`, `useUploads` hook — each its own file, under
300 lines, one component per `.tsx`.

## 4. Error handling

- Upload/insert failures → existing `run` toast ("Não salvou." + retry).
- `insertAttachmentsFn` rejection (bad object) → row rolled back, toast
  "Imagem inválida.".
- Lightbox image load error → "Não foi possível carregar a imagem." with
  "Abrir original".

## 5. Verification

- `node --test`: `checkImage` (types, SVG rejected, size edges).
- `npm run lint && npm run typecheck && npm test && npm run build`.
- Browser (Playwright, `npm run dev` with the real R2 `.env`):
  create via modal in Lista and Quadro, with assignee, column and images;
  open details from the list title; lightbox navigation; remove + undo;
  delete task + undo keeps images; `/local` shows no image field.
- Docs: ADR 0010 (R2 attachments), `REQUIREMENTS_FREEZE.md`,
  `DESIGN.md`, `.env.example`, README (CORS + disable public URL).
