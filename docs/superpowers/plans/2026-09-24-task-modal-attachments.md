# Task Modal, Assignee and Image Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Short task titles, a free-text "Responsável" field, image attachments in a private R2 bucket with a near-fullscreen lightbox, and one "Nova tarefa" modal used by both views.

**Architecture:** `tasks.assignee` column + new `attachments` table, exposed as a fifth TanStack DB collection on `Source` (same optimistic/serial-queue path as the others). Browsers upload straight to R2 with a server-presigned PUT; the server verifies the object (HEAD) before inserting its row, and serves images through a cookie-checked route that 302s to a presigned GET. UI adds `TaskCreateDialog`, reworks `TaskDialog`/`TaskRow`/board cards, and shares field components between create and details.

**Tech Stack:** TanStack Start 1.168 (server functions + server routes), TanStack DB, React 19, Tailwind 4, postgres.js, `aws4fetch` 1.0.20 (new, zero deps), native `<dialog>`/`<datalist>`/radio inputs.

**Spec:** `docs/superpowers/specs/2026-09-24-task-modal-attachments-design.md`

## Global Constraints

- npm only. The only new dependency is `aws4fetch`.
- UI strings in PT-BR; identifiers, comments, docs, commits in English.
- Biome clean, ≤ 300 lines per file under `src/` (incl. `styles.css`, currently 277 — do **not** add CSS there beyond changing the dialog width; use Tailwind classes), one React component per `.tsx`, named after the file.
- Every server function: validate with `src/server/validate.ts`, call `requireAccess(slug)` first, scope every query by `session_slug`. SQL only via postgres.js tagged templates / `sql(obj)`.
- Local mode (`/local`) never hits the network: no server function call, no image UI.
- Components read data via `useSource()`/`useActions()`, never import a server fn for session data directly (exception: `createUploadFn` and `storageEnabledFn` are called from `src/data/*` hooks, not components).
- `LIMITS.taskTitle = 120`, `LIMITS.assignee = 80`, `LIMITS.fileName = 200`; server keeps `str(LIMITS.task)` (1000) for `text`.
- Images: `image/png|jpeg|webp|gif|avif` only (no SVG), ≤ 10 MB (`10 * 1024 * 1024`), ≤ 20 per task.
- R2 key is always `<slug>/<attachmentId>`, computed server-side; never sent to the client.
- Commits: never raw `git commit`; use the `auto-commit` skill at each task's commit step. Work on branch `feat/task-modal-attachments`.
- Verification command: `npm run lint && npm run typecheck && npm test && npm run build`.

## Review Focus

1. **Esc / backdrop / X while uploads are running in the create modal** → the modal must not close (task already inserted, images mid-flight); after uploads finish it closes normally.
2. **Closing the lightbox (Esc) inside the details dialog** → only the lightbox closes; `TaskDialog`'s `onClose` must ignore `close` events whose target is not its own `<dialog>` (React propagates `close` through the component tree).
3. **Undo after deleting a task that has images** → task and all its images come back (no duplicate-key error from rows lingering in the client collection).
4. **Editing a legacy title longer than 120 chars** → editing keeps the full text (`maxLength = max(120, length)`), saving succeeds.
5. **`/local`** → no request to `storageEnabledFn`/attachments, no image field, create modal works without images.

Each is pinned by a test or an explicit browser check in the owning task.

---

### Task 1: Pure rules — types, limits, image checks, task helpers

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/images.ts`, `src/lib/images.test.ts`, `src/lib/task.ts`, `src/lib/task.test.ts`, `src/lib/time.ts`

**Interfaces:**
- Produces:
  - `LIMITS` gains `taskTitle: 120, assignee: 80, fileName: 200`.
  - `Task` gains `assignee: string`.
  - `type Attachment = { id: string; taskId: string; pageId: string; name: string; contentType: string; size: number; position: number }`
  - `IMAGE_TYPES: readonly ["image/png","image/jpeg","image/webp","image/gif","image/avif"]`, `MAX_IMAGE_BYTES`, `MAX_IMAGES_PER_TASK`, `IMAGE_ACCEPT: string` (comma-joined types), `checkImage(type: string, size: number): "type" | "size" | null`, `IMAGE_ERRORS: Record<"type"|"size", string>`
  - `titleMax(value: string): number`, `assigneesOf(tasks: Pick<Task,"assignee">[]): string[]`
  - `formatDate(iso: string): string`, `relative(iso: string): string` (moved out of `TaskDialog.tsx`)

- [ ] **Step 1: Create the branch**

```bash
git switch -c feat/task-modal-attachments
```

- [ ] **Step 2: Write failing tests**

`src/lib/images.test.ts`:
```ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { checkImage, MAX_IMAGE_BYTES } from "./images.ts"

test("accepts the raster image types within the size limit", () => {
  for (const t of ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]) {
    assert.equal(checkImage(t, 1024), null)
  }
  assert.equal(checkImage("image/png", MAX_IMAGE_BYTES), null)
})

test("rejects SVG and non-images", () => {
  assert.equal(checkImage("image/svg+xml", 10), "type")
  assert.equal(checkImage("application/pdf", 10), "type")
  assert.equal(checkImage("", 10), "type")
})

test("rejects empty, oversized and non-integer sizes", () => {
  assert.equal(checkImage("image/png", 0), "size")
  assert.equal(checkImage("image/png", MAX_IMAGE_BYTES + 1), "size")
  assert.equal(checkImage("image/png", 1.5), "size")
  assert.equal(checkImage("image/png", Number.NaN), "size")
})
```

`src/lib/task.test.ts`:
```ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { assigneesOf, titleMax } from "./task.ts"

test("titleMax keeps legacy long titles editable", () => {
  assert.equal(titleMax(""), 120)
  assert.equal(titleMax("x".repeat(119)), 120)
  assert.equal(titleMax("x".repeat(900)), 900)
})

test("assigneesOf returns unique, trimmed, sorted, non-empty names", () => {
  assert.deepEqual(assigneesOf([{ assignee: "Sidney" }, { assignee: " Davi " }, { assignee: "" }, { assignee: "Sidney" }]), [
    "Davi",
    "Sidney",
  ])
  assert.deepEqual(assigneesOf([{ assignee: undefined as unknown as string }]), [])
})
```

- [ ] **Step 3: Run to see them fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './images.ts'` / `'./task.ts'`.

- [ ] **Step 4: Implement**

`src/lib/types.ts` — change `LIMITS` and `Task`, add `Attachment`:
```ts
export const LIMITS = {
  title: 200,
  note: 500,
  task: 1000,
  taskTitle: 120,
  taskNote: 2000,
  statusName: 30,
  assignee: 80,
  fileName: 200,
}
```
Add `assignee: string` to `Task` (after `note`), and below `Task`:
```ts
// pageId is derived server-side from the task (not a column), like Task.pageId. The R2 key never reaches the client.
export type Attachment = {
  id: string
  taskId: string
  pageId: string
  name: string
  contentType: string
  size: number
  position: number
}
```

`src/lib/images.ts`:
```ts
// No SVG: it can carry script and would be served from our bucket
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"] as const
export const IMAGE_ACCEPT = IMAGE_TYPES.join(",")
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_IMAGES_PER_TASK = 20

export const IMAGE_ERRORS = {
  type: "Só imagens PNG, JPEG, WebP, GIF ou AVIF.",
  size: "Imagem maior que 10 MB.",
} as const

export function checkImage(type: string, size: number): "type" | "size" | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(type)) {
    return "type"
  }
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_IMAGE_BYTES) {
    return "size"
  }
  return null
}
```

`src/lib/task.ts`:
```ts
import { LIMITS, type Task } from "./types.ts"

// Titles created before the 120-char limit stay editable without being cut
export const titleMax = (value: string) => Math.max(LIMITS.taskTitle, value.length)

export const assigneesOf = (tasks: Pick<Task, "assignee">[]) =>
  [...new Set(tasks.map((t) => (t.assignee ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"))
```
(Check how `status.ts` imports `./types` — match it; tests import with `.ts` extension, source files in `src/lib` import `./types` without extension if that's what `status.ts` does.)

`src/lib/time.ts` — move `dateFmt`, `relFmt`, `UNITS`, `relative` verbatim from `src/components/TaskDialog.tsx` lines 11-28, exporting:
```ts
export const formatDate = (iso: string) => dateFmt.format(new Date(iso))
export function relative(iso: string) { /* body unchanged */ }
```
and in `TaskDialog.tsx` replace the local definitions with `import { formatDate, relative } from "#/lib/time"` and `dateFmt.format(new Date(task.createdAt))` → `formatDate(task.createdAt)`.

- [ ] **Step 5: Run tests**

Run: `npm test` → PASS. Then `npm run typecheck` — expected FAILS only where `Task` objects are built without `assignee` (`src/data/actions.ts` `addTask`). Leave those for Task 3; note them.

- [ ] **Step 6: Commit** — invoke the `auto-commit` skill.

---

### Task 2: Server — schema, assignee, R2 storage, attachment functions, image route, bucket CORS

**Files:**
- Modify: `package.json` (+ lockfile) — `npm install aws4fetch@^1.0.20`
- Modify: `src/server/schema.sql`, `src/server/validate.ts`, `src/server/data.ts` (listTasks select)
- Create: `src/server/storage.server.ts`, `src/server/attachments.ts`, `src/routes/api.s.$slug.img.$id.ts`, `scripts/r2-cors.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: Task 1 (`Attachment`, `IMAGE_TYPES`, `checkImage`, `MAX_IMAGES_PER_TASK`, `LIMITS`).
- Produces (server fns, all in `src/server/attachments.ts`):
  - `storageEnabledFn(): Promise<boolean>` (GET, no input)
  - `listAttachmentsFn({ data: { slug } }): Promise<Attachment[]>`
  - `createUploadFn({ data: { slug, contentType, size } }): Promise<{ id: string; url: string }>`
  - `insertAttachmentsFn({ data: { slug, items: { id, taskId, name, contentType, size, position }[] } })`
  - `deleteAttachmentsFn({ data: { slug, ids: string[] } })`
  - Route `GET /api/s/:slug/img/:id` → 302 to presigned GET, 404 otherwise.

- [ ] **Step 1: Install**

```bash
npm install aws4fetch@^1.0.20
```

- [ ] **Step 2: Schema** — append to `src/server/schema.sql` (idempotent, runs on every boot):

```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee text NOT NULL DEFAULT '';

-- Image attachments; the object lives in R2 at `key` (<slug>/<id>). Deleting a task drops its rows, not the objects.
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

- [ ] **Step 3: Validation** — `src/server/validate.ts`:

```ts
import { IMAGE_TYPES } from "#/lib/images"
```
Add `assignee: str(LIMITS.assignee),` to `taskFields` (after `note`). Add:
```ts
export const imageType = oneOf(IMAGE_TYPES)
export const attachmentFields = { name: str(LIMITS.fileName), contentType: imageType, size: int, position: int }
```

- [ ] **Step 4: listTasks** — in `src/server/data.ts` `listTasksFn` select, add `t.assignee` after `t.note`.

- [ ] **Step 5: Storage module** — `src/server/storage.server.ts`:

```ts
import { AwsClient } from "aws4fetch"

function config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    return null
  }
  return { account: R2_ACCOUNT_ID, key: R2_ACCESS_KEY_ID, secret: R2_SECRET_ACCESS_KEY, bucket: R2_BUCKET }
}

export const storageEnabled = () => config() !== null

let client: AwsClient | undefined

function r2() {
  const c = config()
  if (!c) {
    throw new Error("STORAGE_DISABLED")
  }
  client ??= new AwsClient({ accessKeyId: c.key, secretAccessKey: c.secret, service: "s3", region: "auto" })
  return { client, base: `https://${c.account}.r2.cloudflarestorage.com/${c.bucket}` }
}

export const objectKey = (slug: string, id: string) => `${slug}/${id}`

// allHeaders: aws4fetch skips Content-Type by default; signing it makes R2 reject a PUT with any other type
async function presign(method: "GET" | "PUT", key: string, seconds: number, headers?: Record<string, string>) {
  const { client, base } = r2()
  const url = new URL(`${base}/${key}`)
  url.searchParams.set("X-Amz-Expires", String(seconds))
  const signed = await client.sign(new Request(url, { method, headers }), { aws: { signQuery: true, allHeaders: true } })
  return signed.url
}

export const presignPut = (key: string, contentType: string) => presign("PUT", key, 300, { "Content-Type": contentType })
export const presignGet = (key: string) => presign("GET", key, 3600)

export async function headObject(key: string): Promise<{ size: number; contentType: string } | null> {
  const { client, base } = r2()
  const res = await client.fetch(`${base}/${key}`, { method: "HEAD" })
  if (res.status === 404) {
    return null
  }
  if (!res.ok) {
    throw new Error(`R2 HEAD ${res.status}`)
  }
  return { size: Number(res.headers.get("content-length")), contentType: res.headers.get("content-type") ?? "" }
}

export async function deleteObject(key: string) {
  const { client, base } = r2()
  const res = await client.fetch(`${base}/${key}`, { method: "DELETE" })
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 DELETE ${res.status}`)
  }
}
```

- [ ] **Step 6: Server functions** — `src/server/attachments.ts`:

```ts
import { createServerFn } from "@tanstack/react-start"
import { newId } from "#/lib/id"
import { checkImage, MAX_IMAGES_PER_TASK } from "#/lib/images"
import type { Attachment } from "#/lib/types"
import { requireAccess } from "./auth.server"
import { db } from "./db.server"
import { deleteObject, headObject, objectKey, presignPut, storageEnabled } from "./storage.server"
import { arr, attachmentFields, id, imageType, int, invalid, shape, slug } from "./validate"

export const storageEnabledFn = createServerFn().handler(async () => storageEnabled())

export const listAttachmentsFn = createServerFn()
  .validator(shape({ slug }))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    return [
      ...(await sql<Attachment[]>`
      select a.id, a.task_id, sc.page_id, a.name, a.content_type, a.size, a.position
      from attachments a join tasks t on t.id = a.task_id join sections sc on sc.id = t.section_id
        join pages p on p.id = sc.page_id
      where p.session_slug = ${s}`),
    ]
  })

// The object key is derived from the session and a server-made id, so a client can only ever write under its own slug
export const createUploadFn = createServerFn({ method: "POST" })
  .validator(shape({ slug, contentType: imageType, size: int }))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    if (checkImage(data.contentType, data.size)) {
      invalid()
    }
    const attachmentId = newId()
    return { id: attachmentId, url: await presignPut(objectKey(s, attachmentId), data.contentType) }
  })

export const insertAttachmentsFn = createServerFn({ method: "POST" })
  .validator(shape({ slug, items: arr(shape({ id, taskId: id, ...attachmentFields }), MAX_IMAGES_PER_TASK) }))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql.begin(async (tx) => {
      for (const x of data.items) {
        // Lock the task row so concurrent inserts can't both pass the per-task limit
        const [task] = await tx`
          select t.id from tasks t join sections sc on sc.id = t.section_id join pages p on p.id = sc.page_id
          where t.id = ${x.taskId} and p.session_slug = ${s} for update of t`
        if (!task) {
          throw new Error("NOT_FOUND")
        }
        const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from attachments where task_id = ${x.taskId}`
        if (n >= MAX_IMAGES_PER_TASK) {
          throw new Error("TOO_MANY")
        }
        // Trust the stored object, not the client's claim: it must exist and be an allowed image within the size limit
        const key = objectKey(s, x.id)
        const head = await headObject(key)
        if (!head || checkImage(head.contentType, head.size)) {
          if (head) {
            await deleteObject(key)
          }
          throw new Error("INVALID_IMAGE")
        }
        await tx`insert into attachments ${tx({
          id: x.id,
          taskId: x.taskId,
          key,
          name: x.name,
          contentType: head.contentType,
          size: head.size,
          position: x.position,
        })}`
      }
    })
  })

// ponytail: rows only — R2 objects of removed images (and of deleted tasks/pages/sessions) are left behind;
// add a sweep that lists `<slug>/` prefixes against `attachments.key` when storage cost matters
export const deleteAttachmentsFn = createServerFn({ method: "POST" })
  .validator(shape({ slug, ids: arr(id) }))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql`delete from attachments where id = any(${data.ids}) and task_id in (
      select t.id from tasks t join sections sc on sc.id = t.section_id join pages p on p.id = sc.page_id
      where p.session_slug = ${s})`
  })
```
Note on `insert ... ${tx({...})}`: `postgres.camel` transform maps `taskId`→`task_id`, `contentType`→`content_type` (same as the existing `insert into tasks ${tx(x)}`).

- [ ] **Step 7: Image route** — `src/routes/api.s.$slug.img.$id.ts`:

```ts
import { createFileRoute } from "@tanstack/react-router"
import { ID_RE } from "#/lib/id"
import { hasAccess } from "#/server/auth.server"
import { db } from "#/server/db.server"
import { presignGet } from "#/server/storage.server"

const notFound = () => new Response(null, { status: 404 })

// Stable, cookie-checked URL for <img src>; redirects to a 1 h presigned GET that the browser caches for 50 min
export const Route = createFileRoute("/api/s/$slug/img/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!ID_RE.test(params.id) || !(await hasAccess(params.slug))) {
          return notFound()
        }
        const sql = await db()
        const [row] = await sql<{ key: string }[]>`
          select a.key from attachments a join tasks t on t.id = a.task_id join sections sc on sc.id = t.section_id
            join pages p on p.id = sc.page_id
          where a.id = ${params.id} and p.session_slug = ${params.slug}`
        if (!row) {
          return notFound()
        }
        return new Response(null, {
          status: 302,
          headers: { Location: await presignGet(row.key), "Cache-Control": "private, max-age=3000" },
        })
      },
    },
  },
})
```
Run `npm run generate-routes` so `routeTree.gen.ts` includes it. If the build reports server-only imports leaking into the client bundle, check the TanStack Start server-routes docs via context7 (`/tanstack/router`, topic "server routes") and follow the documented pattern; do not weaken the access check.

- [ ] **Step 8: Bucket CORS script** — `scripts/r2-cors.ts` (one-off; browsers PUT straight to R2):

```ts
// Usage: node --env-file=.env scripts/r2-cors.ts https://app.example.com http://localhost:3000
import { createHash } from "node:crypto"
import { AwsClient } from "aws4fetch"

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env
const origins = process.argv.slice(2)
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !origins.length) {
  throw new Error("Set R2_* in the env and pass at least one origin")
}
const body = `<CORSConfiguration><CORSRule>${origins.map((o) => `<AllowedOrigin>${o}</AllowedOrigin>`).join("")}<AllowedMethod>PUT</AllowedMethod><AllowedHeader>content-type</AllowedHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>`
const aws = new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" })
const res = await aws.fetch(`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}?cors`, {
  method: "PUT",
  body,
  headers: { "Content-MD5": createHash("md5").update(body).digest("base64"), "Content-Type": "application/xml" },
})
process.stdout.write(`${res.status} ${await res.text()}\n`)
```
Run it:
```bash
node --env-file=.env scripts/r2-cors.ts https://riska.naofoibugfoifeature.com.br http://localhost:3000
```
Expected: `200` (empty body). If R2 rejects the XML, fall back to the Cloudflare dashboard (bucket → Settings → CORS policy) with the same rule and note it.

- [ ] **Step 9: `.env.example`** — append:
```
# Image attachments (Cloudflare R2, private bucket). Leave empty to hide the image field.
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
```

- [ ] **Step 10: Verify against real R2** — throwaway script in the session scratchpad (not in the repo), run with `node --env-file=.env`:
  1. `presignPut("smoke/test", "image/png")` → `curl -X PUT -H "Content-Type: image/png" --data-binary @<a small png> "<url>"` → 200.
  2. Same URL with `-H "Content-Type: image/jpeg"` → 403 (Content-Type is signed).
  3. `headObject("smoke/test")` → `{ size, contentType: "image/png" }`; `presignGet` URL → `curl -I` 200.
  4. `deleteObject("smoke/test")`, then `headObject` → `null`.
  Report each result. Then `npm run typecheck` (only Task 3's known `addTask` errors may remain) and `npm run lint`.

- [ ] **Step 11: Commit** — invoke the `auto-commit` skill.

---

### Task 3: Client data — attachments collection, actions, image hooks, uploader

**Files:**
- Modify: `src/data/source.ts`, `src/data/actions.ts`
- Create: `src/data/attachmentActions.ts`, `src/data/images.ts`, `src/data/useUploads.ts`

**Interfaces:**
- Consumes: Task 1 types/rules; Task 2 server fns.
- Produces:
  - `Source.attachments: Collection<Attachment, string>`; `queryKeys.attachments(slug)`; `listFns.attachments`.
  - `ActionContext` gains `toast: ReturnType<typeof useToast>`.
  - Actions: `addTask(input: { section: Section; text: string; note?: string; assignee?: string; status?: Status }): string` (returns the new task id); `updateTask(id, changes: Partial<Pick<Task, "text" | "note" | "assignee">>)`; `addAttachment(att: Attachment): Promise<void>` (rejects on failure, no toast); `removeAttachment(att: Attachment): void` (undo toast).
  - `useImagesEnabled(): boolean`, `imageSrc(slug: string, id: string): string`
  - `useUploads(): { items: Upload[]; add(files: File[], existing: number): void; remove(key: string): void; start(task: { id: string; pageId: string }): Promise<boolean>; busy: boolean }` with `type Upload = { key: string; file: File; preview: string; progress: number; state: "pending" | "uploading" | "error" }`

- [ ] **Step 1: Source** — `src/data/source.ts`:
  - Import `Attachment`, and `deleteAttachmentsFn, insertAttachmentsFn, listAttachmentsFn` from `#/server/attachments`.
  - `Source` gets `attachments: Collection<Attachment, string>`.
  - `queryKeys.attachments = (slug: string) => ["attachments", slug]`; `listFns.attachments = listAttachmentsFn`.
  - In `serverCollection`, make `update` optional (`update?:`) and call `fns.update?.(...)` inside an `async` like the others.
  - `getServerSource`: `attachments: serverCollection<Attachment>(qc, slug, "attachments", { insert: insertAttachmentsFn, remove: deleteAttachmentsFn }, serial)`.
  - `getLocalSource`: `attachments: localCollection<Attachment>("attachments")` (never written; keeps one code path).
  The `/s/$slug` loader prefetches every `queryKeys` entry, so attachments are SSR-prefetched automatically.

- [ ] **Step 2: Attachment actions** — `src/data/attachmentActions.ts`:

```ts
import type { Attachment } from "#/lib/types"
import type { ActionContext } from "./actions"

export function attachmentActions({ source, run, toast }: ActionContext) {
  const { attachments } = source
  return {
    // Awaited by the uploader, which shows its own per-image retry; no generic toast here
    async addAttachment(att: Attachment) {
      await attachments.insert(att).isPersisted.promise
    },
    // ponytail: the R2 object stays (see deleteAttachmentsFn), which is what makes undo possible
    removeAttachment(att: Attachment) {
      run(() => attachments.delete(att.id))
      toast("Imagem removida.", { label: "Desfazer", onClick: () => run(() => attachments.insert(att)) })
    },
  }
}
```

- [ ] **Step 3: Actions** — `src/data/actions.ts`:
  - `ActionContext` gets `toast: ReturnType<typeof useToast>`; build `context = { source, run, all, pageStatuses, toast }`; spread `...attachmentActions(context)` next to `...statusActions(context)`.
  - Destructure `attachments` from `source`.
  - Replace `addTask`:
```ts
    addTask({ section, text, note = "", assignee = "", status }: {
      section: Section
      text: string
      note?: string
      assignee?: string
      status?: Status
    }) {
      const id = newId()
      const siblings = all(tasks).filter((t) => t.sectionId === section.id)
      run(() =>
        tasks.insert({
          id,
          sectionId: section.id,
          pageId: section.pageId,
          text,
          note,
          assignee,
          statusId: status?.id ?? null,
          done: status?.done ?? false,
          createdAt: new Date().toISOString(),
          position: nextPosition(siblings),
          boardPosition: boardEnd(section.pageId),
        })
      )
      return id
    },
```
  - `updateTask` changes type → `Partial<Pick<Task, "text" | "note" | "assignee">>`.
  - Replace `deleteTask` (Review Focus 3 — rows would otherwise linger in the client collection and the undo re-insert would hit a duplicate key):
```ts
    deleteTask(id: string) {
      const task = tasks.get(id)
      const images = all(attachments).filter((x) => x.taskId === id)
      if (images.length) {
        run(() => attachments.delete(images.map((x) => x.id)))
      }
      run(() => tasks.delete(id))
      if (task) {
        toast("Tarefa deletada.", {
          label: "Desfazer",
          onClick: () => {
            run(() => tasks.insert(task))
            if (images.length) {
              run(() => attachments.insert(images))
            }
          },
        })
      }
    },
```
  - `upgradeLocalPage`: at the very top (after the `source.slug` check but **before** the statuses early-return), fill `assignee` for legacy local tasks:
```ts
      const noAssignee = all(tasks).filter((t) => t.pageId === pageId && t.assignee === undefined)
      if (noAssignee.length) {
        run(() => tasks.update(noAssignee.map((t) => t.id), (ds) => ds.forEach((d) => void (d.assignee = ""))))
      }
```
  (Split the existing `source.slug || statuses.some(...)` condition into two ifs to make room.) Keep `actions.ts` ≤ 300 lines.

- [ ] **Step 4: Image hooks** — `src/data/images.ts`:

```ts
import { useQuery } from "@tanstack/react-query"
import { storageEnabledFn } from "#/server/attachments"
import { useSource } from "./source-context"

// Local mode never asks the server (it never hits the network) and never shows images
export function useImagesEnabled() {
  const { slug } = useSource()
  const { data } = useQuery({
    queryKey: ["storage-enabled"],
    queryFn: () => storageEnabledFn(),
    enabled: slug !== null,
    staleTime: Number.POSITIVE_INFINITY,
  })
  return slug !== null && data === true
}

export const imageSrc = (slug: string, id: string) => `/api/s/${slug}/img/${id}`
```

- [ ] **Step 5: Uploader** — `src/data/useUploads.ts`:

```ts
import { useEffect, useReducer, useRef } from "react"
import { useToast } from "#/components/ToastProvider"
import { nextPosition } from "#/lib/order"
import { checkImage, IMAGE_ERRORS, MAX_IMAGES_PER_TASK } from "#/lib/images"
import { LIMITS } from "#/lib/types"
import { createUploadFn } from "#/server/attachments"
import { useActions } from "./actions"
import { useSource } from "./source-context"

export type Upload = { key: string; file: File; preview: string; progress: number; state: "pending" | "uploading" | "error" }

let seq = 0

function put(url: string, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    xhr.setRequestHeader("Content-Type", file.type)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(e.loaded / e.total)
      }
    }
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`PUT ${xhr.status}`)))
    xhr.onerror = () => reject(new Error("PUT failed"))
    xhr.send(file)
  })
}

// Files picked for one task: validated on add, sent one at a time by start(); done items leave the list
// (the attachment row then shows up through the collection). The ref is the source of truth so start()
// right after add() sees the new files.
export function useUploads() {
  const source = useSource()
  const a = useActions()
  const toast = useToast()
  const items = useRef<Upload[]>([])
  const running = useRef<Promise<boolean> | null>(null)
  const [, render] = useReducer((n: number) => n + 1, 0)
  const set = (next: Upload[]) => {
    items.current = next
    render()
  }
  const patch = (key: string, changes: Partial<Upload>) =>
    set(items.current.map((u) => (u.key === key ? { ...u, ...changes } : u)))
  const drop = (key: string) => {
    const u = items.current.find((x) => x.key === key)
    if (u) {
      URL.revokeObjectURL(u.preview)
    }
    set(items.current.filter((x) => x.key !== key))
  }

  useEffect(() => () => items.current.forEach((u) => URL.revokeObjectURL(u.preview)), [])

  const send = async (u: Upload, task: { id: string; pageId: string }) => {
    patch(u.key, { state: "uploading", progress: 0 })
    try {
      const { id, url } = await createUploadFn({
        data: { slug: source.slug ?? "", contentType: u.file.type, size: u.file.size },
      })
      await put(url, u.file, (progress) => patch(u.key, { progress }))
      const existing = [...source.attachments.values()].filter((x) => x.taskId === task.id)
      await a.addAttachment({
        id,
        taskId: task.id,
        pageId: task.pageId,
        name: u.file.name.slice(0, LIMITS.fileName),
        contentType: u.file.type,
        size: u.file.size,
        position: nextPosition(existing),
      })
      drop(u.key)
    } catch {
      patch(u.key, { state: "error" })
    }
  }

  return {
    items: items.current,
    busy: items.current.some((u) => u.state === "uploading"),
    add(files: File[], existing: number) {
      const room = MAX_IMAGES_PER_TASK - existing - items.current.length
      const ok: Upload[] = []
      for (const file of files) {
        const problem = checkImage(file.type, file.size)
        if (problem) {
          toast(`${file.name}: ${IMAGE_ERRORS[problem]}`)
        } else if (ok.length >= room) {
          toast(`Máximo de ${MAX_IMAGES_PER_TASK} imagens por tarefa.`)
          break
        } else {
          ok.push({ key: String(++seq), file, preview: URL.createObjectURL(file), progress: 0, state: "pending" })
        }
      }
      set([...items.current, ...ok])
    },
    remove: drop,
    // Sends pending and failed items in order; resolves true when nothing is left in error.
    // A second call while running joins the same run (which also picks up files added meanwhile).
    start(task: { id: string; pageId: string }) {
      if (!running.current) {
        running.current = sendAll(task).finally(() => {
          running.current = null
        })
      }
      return running.current
    },
  }

  async function sendAll(task: { id: string; pageId: string }) {
    set(items.current.map((u) => (u.state === "error" ? { ...u, state: "pending" as const } : u)))
    // send() leaves each item done (removed) or "error", never "pending", so this terminates
    let next = items.current.find((x) => x.state === "pending")
    while (next) {
      await send(next, task)
      next = items.current.find((x) => x.state === "pending")
    }
    return !items.current.some((x) => x.state === "error")
  }
}
```
Keep ≤ 300 lines.

- [ ] **Step 6: Callers compile** — `NewTaskInput.tsx` and `BoardAddCard.tsx` still call the old `addTask(section, text, status)`; update them to the object form (`a.addTask({ section, text: v })` / `a.addTask({ section, text: v, status })`) so the tree compiles — Task 5 replaces both. Run `npm run lint && npm run typecheck && npm test` → all green.

- [ ] **Step 7: Commit** — invoke the `auto-commit` skill.

---

### Task 4: Shared UI pieces — ColumnChips, AssigneeInput, TaskMeta, ImageField, ImageLightbox

**Files:**
- Create: `src/components/fieldStyles.ts`, `src/components/ColumnChips.tsx`, `src/components/AssigneeInput.tsx`, `src/components/TaskMeta.tsx`, `src/components/ImageField.tsx`, `src/components/ImageLightbox.tsx`

**Interfaces:**
- Consumes: `tint` from `#/lib/status`; `Upload`, `useUploads` return type; `imageSrc`; `IMAGE_ACCEPT`.
- Produces:
  - `FIELD: string` (input/textarea classes), `LABEL: string`
  - `<ColumnChips statuses={Status[]} value={string | undefined} onChange={(s: Status) => void} />`
  - `<AssigneeInput id?={string} value onChange={(v: string) => void} onBlur?={() => void} options={string[]} />`
  - `<TaskMeta section?={string} assignee={string} images={number} note={boolean} className?={string} />` (renders nothing when all empty)
  - `<ImageField slug={string} attachments={Attachment[]} uploads={ReturnType<typeof useUploads>} onFiles={(files: File[]) => void} onOpen={(index: number) => void} onRemove?={(att: Attachment) => void} />`
  - `<ImageLightbox images={{ src: string; name: string }[]} index={number} onClose={() => void} />`

- [ ] **Step 1: `fieldStyles.ts`**

```ts
export const FIELD =
  "block w-full rounded-xl border border-line bg-ground px-3 py-2 text-[0.92rem] placeholder:text-ink-soft focus-visible:border-accent focus-visible:outline-offset-0"
export const LABEL = "mb-1.5 block text-sm font-semibold"
```
(Reuse `FIELD` for the existing description textarea classes in Tasks 5/6 — it matches the current `TaskDialog` textarea look.)

- [ ] **Step 2: `ColumnChips.tsx`** — native radios, so arrow keys and screen readers work for free:

```tsx
import { useId } from "react"
import { tint } from "#/lib/status"
import type { Status } from "#/lib/types"

export function ColumnChips({
  statuses,
  value,
  onChange,
}: {
  statuses: Status[]
  value: string | undefined
  onChange: (status: Status) => void
}) {
  const name = useId()
  return (
    <fieldset className="m-0 flex min-w-0 flex-wrap gap-1.5 border-0 p-0">
      <legend className="sr-only">Coluna</legend>
      {statuses.map((s) => {
        const on = s.id === value
        return (
          <label key={s.id} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={s.id}
              checked={on}
              onChange={() => onChange(s)}
              className="peer sr-only"
            />
            <span
              style={on ? tint(s.color) : undefined}
              className={`flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[0.8rem] font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${on ? "border-transparent" : "border-line text-ink-soft hover:border-ink-soft"}`}
            >
              <span aria-hidden className="size-2 rounded-full" style={{ background: s.color }} />
              {s.name}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
```

- [ ] **Step 3: `AssigneeInput.tsx`**

```tsx
import { useId } from "react"
import { LIMITS } from "#/lib/types"
import { FIELD } from "./fieldStyles"

// Free text with the page's existing names as native suggestions
export function AssigneeInput({
  id,
  value,
  onChange,
  onBlur,
  options,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  options: string[]
}) {
  const listId = useId()
  return (
    <>
      <input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        maxLength={LIMITS.assignee}
        autoComplete="off"
        placeholder="Quem cuida disso?"
        className={FIELD}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  )
}
```

- [ ] **Step 4: `TaskMeta.tsx`**

```tsx
import { Image, StickyNote, UserRound } from "lucide-react"

// One-line summary under a task title (list row and board card)
export function TaskMeta({
  section,
  assignee,
  images,
  note,
  className = "",
}: {
  section?: string
  assignee: string
  images: number
  note: boolean
  className?: string
}) {
  if (!section && !assignee && !images && !note) {
    return null
  }
  return (
    <div className={`flex min-w-0 items-center gap-2.5 text-[0.75rem] text-ink-soft ${className}`}>
      {section && <span className="min-w-0 truncate">{section}</span>}
      {assignee && (
        <span className="flex min-w-0 items-center gap-1">
          <UserRound size={13} aria-hidden className="shrink-0" />
          <span className="sr-only">Responsável:</span>
          <span className="truncate">{assignee}</span>
        </span>
      )}
      {images > 0 && (
        <span className="flex shrink-0 items-center gap-1">
          <Image size={13} aria-hidden />
          <span className="sr-only">Imagens:</span>
          {images}
        </span>
      )}
      {note && <StickyNote size={13} role="img" aria-label="Tem descrição" className="shrink-0" />}
    </div>
  )
}
```

- [ ] **Step 5: `ImageField.tsx`** — grid of saved thumbnails (open lightbox / remove), pending uploads (preview + progress / retry state), and an add tile that is also a drop target:

```tsx
import { ImagePlus, Loader2, RotateCw, X } from "lucide-react"
import { useRef, useState } from "react"
import type { useUploads } from "#/data/useUploads"
import { imageSrc } from "#/data/images"
import { IMAGE_ACCEPT } from "#/lib/images"
import type { Attachment } from "#/lib/types"

const TILE = "relative aspect-square overflow-hidden rounded-xl border border-line bg-ground"

export function ImageField({
  slug,
  attachments,
  uploads,
  onFiles,
  onOpen,
  onRemove,
}: {
  slug: string
  attachments: Attachment[]
  uploads: ReturnType<typeof useUploads>
  onFiles: (files: File[]) => void
  onOpen: (index: number) => void
  onRemove?: (att: Attachment) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
      {attachments.map((att, i) => (
        <div key={att.id} className={`group ${TILE}`}>
          <button type="button" onClick={() => onOpen(i)} aria-label={`Ver imagem ${att.name}`} className="size-full">
            <img src={imageSrc(slug, att.id)} alt="" loading="lazy" className="size-full object-cover" />
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(att)}
              aria-label={`Remover imagem ${att.name}`}
              className="absolute top-1 right-1 grid size-8 place-items-center rounded-full bg-black/60 text-white opacity-100 hover:bg-black/80 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
            >
              <X size={15} aria-hidden />
            </button>
          )}
        </div>
      ))}
      {uploads.items.map((u) => (
        <div key={u.key} className={TILE}>
          <img src={u.preview} alt="" className={`size-full object-cover ${u.state === "error" ? "opacity-40" : ""}`} />
          {u.state === "uploading" && (
            <div className="absolute inset-0 grid place-items-center bg-black/40 text-white">
              <Loader2 size={18} aria-hidden className="animate-spin" />
              <span className="sr-only">Enviando {u.file.name}</span>
              <span aria-hidden className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-white/30">
                <span className="block h-full bg-white" style={{ width: `${Math.round(u.progress * 100)}%` }} />
              </span>
            </div>
          )}
          {u.state === "error" && (
            <span className="absolute inset-x-1 bottom-1 flex items-center gap-1 rounded-md bg-warn px-1.5 py-0.5 text-[0.68rem] font-semibold text-white">
              <RotateCw size={11} aria-hidden /> Falhou
            </span>
          )}
          {u.state !== "uploading" && (
            <button
              type="button"
              onClick={() => uploads.remove(u.key)}
              aria-label={`Tirar ${u.file.name}`}
              className="absolute top-1 right-1 grid size-8 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <X size={15} aria-hidden />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          onFiles([...e.dataTransfer.files])
        }}
        className={`${TILE} flex flex-col items-center justify-center gap-1 border-dashed text-xs text-ink-soft hover:border-accent hover:text-accent ${over ? "border-accent bg-accent-soft text-accent" : ""}`}
      >
        <ImagePlus size={20} aria-hidden />
        Adicionar
      </button>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])])
          e.target.value = ""
        }}
      />
    </div>
  )
}
```
Add under the grid, in the consumer, a hint line: `"Arraste, cole (Ctrl+V) ou clique. PNG, JPEG, WebP, GIF ou AVIF até 10 MB."` (`text-xs text-ink-soft`).

- [ ] **Step 6: `ImageLightbox.tsx`** — second top-layer `<dialog>`; styling via Tailwind only (`styles.css` has no room):

```tsx
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

const NAV = "grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"

export function ImageLightbox({
  images,
  index,
  onClose,
}: {
  images: { src: string; name: string }[]
  index: number
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [i, setI] = useState(index)
  const [failed, setFailed] = useState(false)
  const touchX = useRef<number | null>(null)
  const many = images.length > 1
  const go = (d: number) => {
    setFailed(false)
    setI((x) => (x + d + images.length) % images.length)
  }
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  const img = images[i]
  if (!img) {
    return null
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click to close; Esc and arrows are handled on keydown
    <dialog
      ref={ref}
      aria-label={`Imagem ${i + 1} de ${images.length}: ${img.name}`}
      onClose={onClose}
      onKeyDown={(e) => {
        if (many && e.key === "ArrowLeft") {
          go(-1)
        } else if (many && e.key === "ArrowRight") {
          go(1)
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          ref.current?.close()
        }
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(e) => {
        const start = touchX.current
        const end = e.changedTouches[0]?.clientX
        if (many && start !== null && end !== undefined && Math.abs(end - start) > 50) {
          go(end < start ? 1 : -1)
        }
      }}
      className="m-auto h-[96dvh] max-h-none w-[96vw] max-w-none overflow-hidden border-0 bg-transparent p-0 text-white backdrop:bg-black/85"
    >
      <div className="flex size-full flex-col">
        <header className="flex items-center gap-3 px-2 py-2">
          <span className="text-sm tabular-nums text-white/80">
            {i + 1} / {images.length}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">{img.name}</span>
          <a href={img.src} target="_blank" rel="noopener" className={NAV} aria-label="Abrir original">
            <ExternalLink size={18} aria-hidden />
          </a>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Fechar" className={NAV}>
            <X size={20} aria-hidden />
          </button>
        </header>
        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {failed ? (
            <p className="text-white/80">Não foi possível carregar a imagem.</p>
          ) : (
            <img
              key={img.src}
              src={img.src}
              alt={img.name}
              onError={() => setFailed(true)}
              className="max-h-full max-w-full object-contain"
            />
          )}
          {many && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label="Imagem anterior" className={`${NAV} absolute left-2`}>
                <ChevronLeft size={22} aria-hidden />
              </button>
              <button type="button" onClick={() => go(1)} aria-label="Próxima imagem" className={`${NAV} absolute right-2`}>
                <ChevronRight size={22} aria-hidden />
              </button>
            </>
          )}
        </div>
      </div>
    </dialog>
  )
}
```
Focus return: the opener re-focuses the thumbnail in its `onClose` handler (Task 6).

- [ ] **Step 7: Verify** — `npm run lint && npm run typecheck && npm test`. (Components are unused until Tasks 5/6; that's fine.)

- [ ] **Step 8: Commit** — invoke the `auto-commit` skill.

---

### Task 5: "Nova tarefa" modal and entry points in both views

**Files:**
- Create: `src/components/TaskCreateDialog.tsx`, `src/components/NewTaskButton.tsx`
- Modify: `src/components/ChecklistView.tsx`, `src/components/SectionCard.tsx`, `src/components/Board.tsx`, `src/components/BoardColumn.tsx`, `src/components/BoardAddCard.tsx`, `src/styles.css` (dialog width only)
- Delete: `src/components/NewTaskInput.tsx`

**Interfaces:**
- Consumes: Task 3 `addTask(input)`, `useUploads`, `useImagesEnabled`; Task 4 `ColumnChips`, `AssigneeInput`, `ImageField`, `FIELD`, `LABEL`; Task 1 `assigneesOf`.
- Produces:
  - `type NewTaskTarget = { sectionId?: string; statusId?: string }` (exported from `TaskCreateDialog.tsx`)
  - `<TaskCreateDialog pageId sections statuses assignees initial={NewTaskTarget} onClose />`
  - `SectionCard` prop `onNew: (target: NewTaskTarget) => void`; `Board`/`BoardColumn` prop `onNew` likewise; `BoardAddCard` props become `{ status: Status; onNew: (t: NewTaskTarget) => void }`.

- [ ] **Step 1: Dialog width** — in `src/styles.css` `.task-dialog`, `width: min(512px, calc(100vw - 32px))` → `width: min(640px, calc(100vw - 32px))`. Nothing else in that file.

- [ ] **Step 2: `TaskCreateDialog.tsx`**

Behavior (implement exactly):
- `<dialog className="task-dialog">` opened with `showModal()` on mount, `aria-labelledby` → "Nova tarefa" heading. Same backdrop press+release close logic as `TaskDialog`.
- `onCancel={(e) => busy && e.preventDefault()}` and the X / "Cancelar" buttons `disabled={busy}` (Review Focus 1). Backdrop click also ignored while busy.
- State: `title`, `note`, `assignee`, `statusId` (init `initial.statusId ?? statuses[0]?.id`), `sectionId` (init `initial.sectionId ?? readLastSection(pageId) ?? sections[0]?.id`, falling back to `sections[0]` if the stored id isn't in `sections`), `createdId: string | null`.
- Last-used section key: `checklist-board-section-${pageId}` (the key `BoardAddCard` used), read/written in try/catch; written on `<select>` change.
- `const uploads = useUploads()`, `const images = useImagesEnabled()`, `const source = useSource()`.
- `onPaste` on the `<dialog>`: when `images` and `e.clipboardData.files.length`, `e.preventDefault()` and `uploads.add([...files], 0)`.
- Form fields (labels via `LABEL`, inputs via `FIELD`):
  1. `Título` — `<input required autoFocus maxLength={LIMITS.taskTitle}>` + `VoiceButton` (`label="Ditar título"`); hint under it: `Curto. Detalhes vão na descrição.`; counter `n/120` when `title.length > 100`. (`biome-ignore lint/a11y/noAutofocus` with the existing reason text.)
  2. `Descrição` — `<textarea maxLength={LIMITS.taskNote} className={`${FIELD} min-h-24 resize-none field-sizing-content`}>` + `VoiceButton` (`label="Ditar descrição"`).
  3. `Responsável` — `<AssigneeInput options={assignees}>`, label shows `(opcional)` in `font-normal text-ink-soft`.
  4. `Coluna` — label element is a `<span className={LABEL}>` (the fieldset has its own sr-only legend) + `<ColumnChips statuses value={statusId} onChange={(s) => setStatusId(s.id)}>`.
  5. `Seção` — only when `sections.length > 1`: `<select className={FIELD}>`.
  6. `Imagens (opcional)` — only when `images`: `<ImageField slug={source.slug ?? ""} attachments={[]} uploads onFiles={(f) => uploads.add(f, 0)} onOpen={() => {}} />` + the hint line from Task 4 Step 5.
- Footer: `Cancelar` (ghost) and submit button: `createdId ? "Tentar de novo" : "Criar tarefa"`, disabled while `busy` or `!title.trim()`, shows `Loader2` spinner while busy.
- `onKeyDown` on the form: `(e.ctrlKey || e.metaKey) && e.key === "Enter"` → `e.currentTarget.requestSubmit()`.
- Submit:
```ts
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (uploads.busy) {
      return
    }
    const section = sections.find((s) => s.id === sectionId) ?? sections[0]
    const text = title.trim()
    if (!section || !text) {
      return
    }
    // A retry after a failed image must not create the task twice
    const id =
      createdId ??
      a.addTask({
        section,
        text,
        note: note.trim(),
        assignee: assignee.trim(),
        status: statuses.find((s) => s.id === statusId),
      })
    setCreatedId(id)
    if (uploads.items.length && !(await uploads.start({ id, pageId: section.pageId }))) {
      return // failed thumbnails show "Falhou"; the button now reads "Tentar de novo"
    }
    ref.current?.close()
  }
```
- `onClose` of the dialog: if `createdId` and `uploads.items.length` (failed leftovers), `toast("Tarefa criada sem algumas imagens.")`; then call `props.onClose()`.
- Once `createdId` is set, the text fields become `readOnly` (the task already exists; edits go through the details dialog).
Keep the file ≤ 300 lines; if it gets close, move the last-section read/write helpers into `src/data/lastSection.ts`.

- [ ] **Step 3: `NewTaskButton.tsx`** — the list's per-section trigger (replaces `NewTaskInput`):

```tsx
import { Plus } from "lucide-react"

export function NewTaskButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className="-mx-1 flex min-h-10 w-[calc(100%+0.5rem)] items-center gap-2 rounded-lg border-t border-line px-2 text-[0.92rem] text-ink-soft hover:bg-accent-soft hover:text-accent"
    >
      <Plus size={18} aria-hidden />
      Nova tarefa
    </button>
  )
}
```
Delete `src/components/NewTaskInput.tsx`.

- [ ] **Step 4: `BoardAddCard.tsx`** — replace the whole inline form with a button:

```tsx
import { Plus } from "lucide-react"
import type { Status } from "#/lib/types"
import type { NewTaskTarget } from "./TaskCreateDialog"

export function BoardAddCard({ status, onNew }: { status: Status; onNew: (target: NewTaskTarget) => void }) {
  return (
    <button
      type="button"
      onClick={() => onNew({ statusId: status.id })}
      aria-haspopup="dialog"
      aria-label={`Adicionar tarefa em ${status.name}`}
      className="mx-2 mb-2 flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm text-ink-soft hover:bg-accent-soft hover:text-accent"
    >
      <Plus size={16} aria-hidden />
      Adicionar tarefa
    </button>
  )
}
```
`BoardColumn`: drop the `sections` prop use for `BoardAddCard`, add `onNew` prop, render `<BoardAddCard status={status} onNew={onNew} />`. `Board`: add `onNew` prop and pass it to each `BoardColumn`. (Leave `sections` in `Board` where it's still used for the empty state/section titles.)

- [ ] **Step 5: `SectionCard.tsx`** — add prop `onNew: (target: NewTaskTarget) => void`; replace `<NewTaskInput section={section} />` with `<NewTaskButton onClick={() => onNew({ sectionId: section.id })} />`.

- [ ] **Step 6: `ChecklistView.tsx`**
  - `const [creating, setCreating] = useState<NewTaskTarget | null>(null)`
  - `const assignees = assigneesOf(tasks)`
  - Pass `onNew={setCreating}` to every `SectionCard` and to `Board`.
  - Render next to the `TaskDialog`:
```tsx
      {creating && (
        <TaskCreateDialog
          pageId={page.id}
          sections={sections}
          statuses={statuses}
          assignees={assignees}
          initial={creating}
          onClose={() => setCreating(null)}
        />
      )}
```

- [ ] **Step 7: Verify** — `npm run lint && npm run typecheck && npm test && npm run build` → all green. Browser check deferred to Task 7 (but a quick smoke here is welcome: `npm run dev`, create one task from each view).

- [ ] **Step 8: Commit** — invoke the `auto-commit` skill.

---

### Task 6: Details dialog, list row and board card rework

**Files:**
- Modify: `src/components/TaskDialog.tsx`, `src/components/TaskRow.tsx`, `src/components/BoardCard.tsx`, `src/components/BoardCardFace.tsx`, `src/components/BoardColumn.tsx`, `src/components/Board.tsx`, `src/components/SectionCard.tsx`, `src/components/ChecklistView.tsx`

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: `TaskDialog` props `{ task; statuses; section?; assignees: string[]; attachments: Attachment[]; onClose }`; `TaskRow` props add `onOpen: (id: string) => void; images: number`; `BoardCard`/`BoardCardFace` prop `images: number`; `SectionCard` props add `onOpen`, `imageCounts: Map<string, number>`; `Board`/`BoardColumn` prop `imageCounts: Map<string, number>`.

- [ ] **Step 1: `ChecklistView.tsx`**
  - Live query attachments of the page, ordered:
```ts
  const { data: attachments } = useLiveQuery(
    (q) =>
      q
        .from({ a: source.attachments })
        .where(({ a }) => eq(a.pageId, pageId))
        .orderBy(({ a }) => a.position),
    [source, pageId]
  )
```
  - `const imageCounts = new Map<string, number>()` filled from `attachments` by `taskId`.
  - **Details dialog in both views**: `const dialogTask = taskId ? tasks.find((t) => t.id === taskId) : undefined` (drop the `view === "quadro"` condition).
  - Pass `onOpen={openTask}` and `imageCounts` to `SectionCard`; `imageCounts` to `Board`.
  - `TaskDialog` gets `assignees={assignees}` and `attachments={attachments.filter((x) => x.taskId === dialogTask.id)}`.
  - Stay ≤ 300 lines (currently 224).

- [ ] **Step 2: `TaskRow.tsx`** — the title opens the details:
  - Remove the title `InlineEdit`, the note block, `editingNote` state, and the "Editar/Adicionar nota" menu item (and its `StickyNote` import).
  - Title:
```tsx
        <button
          type="button"
          onClick={() => onOpen(task.id)}
          aria-haspopup="dialog"
          className={`block w-full cursor-pointer text-left break-words line-clamp-2 hover:text-accent ${task.done ? "text-ink-soft line-through decoration-ink-soft/40" : ""}`}
        >
          {task.text}
        </button>
```
  - Keep the `StatusPicker` chip after it (it was inline after the title; put title + chip in a `flex items-start gap-1.5` wrapper so the chip stays on the first line).
  - Below: `<TaskMeta assignee={task.assignee ?? ""} images={images} note={!!task.note} className="mt-0.5" />`.
  - `SectionCard` passes `onOpen` and `images={imageCounts.get(t.id) ?? 0}`.

- [ ] **Step 3: Board cards** — `BoardCard.tsx`: replace the bottom `(sectionTitle || task.note) && …` block with `<TaskMeta section={sectionTitle} assignee={task.assignee ?? ""} images={images} note={!!task.note} className="mt-1.5 pl-7" />`; title `line-clamp-3` → `line-clamp-2`. Same two changes in `BoardCardFace.tsx` (keep its box identical to `BoardCard`). `BoardColumn` receives `imageCounts` and passes `images={imageCounts.get(t.id) ?? 0}`; `Board` passes `imageCounts` to columns and `images` to the `BoardCardFace` drag overlay.

- [ ] **Step 4: `TaskDialog.tsx`** — rework (≤ 300 lines; time helpers already moved to `#/lib/time` in Task 1):
  - Header: keep checkbox + close; title `h2` class → `m-0 min-w-0 flex-1 text-base leading-snug font-semibold`; `InlineEdit` gets `maxLength={titleMax(task.text)}` (Review Focus 4).
  - `onClose` guard (Review Focus 2): `onClose={(e) => { if (e.target === e.currentTarget) { onClose() } }}`.
  - `dl` rows: **Coluna** → `<ColumnChips statuses={statuses} value={statusOf(task, statuses)?.id} onChange={(s) => a.setTaskStatus(task, s)} />` (remove `StatusPicker`/`StatusChip` imports if unused); **Responsável** → `<AssigneeInput value={assignee} onChange={setAssignee} onBlur={save} options={assignees} />`; keep **Seção** and **Criada**. Use `items-start` on the grid and `pt-2` on `dt`s so labels align with the taller controls.
  - Assignee saved like the note: add `assignee` state (init `task.assignee ?? ""`), include it in the `latest` ref, and rename `saveNote` → `save` which writes `{ note, assignee }` changes that differ (trimmed) in one `a.updateTask` call; `save` runs on both fields' blur and on unmount.
  - Description textarea unchanged except classes → `${FIELD} min-h-28 resize-none leading-relaxed field-sizing-content`.
  - **Imagens** section (only when `useImagesEnabled()`), after the description:
```tsx
  const images = useImagesEnabled()
  const uploads = useUploads()
  const [viewing, setViewing] = useState<number | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const addFiles = (files: File[]) => {
    uploads.add(files, attachments.length)
    void uploads.start({ id: task.id, pageId: task.pageId })
  }
```
    Render heading `Imagens` (+ count), `<ImageField slug={source.slug ?? ""} attachments={attachments} uploads={uploads} onFiles={addFiles} onOpen={(i) => { opener.current = document.activeElement as HTMLElement; setViewing(i) }} onRemove={a.removeAttachment} />`, hint line, and an error note when any upload failed: `"Algumas imagens falharam."` + button `Tentar de novo` → `uploads.start(...)`.
    `onPaste` on the `<dialog>`: when `images` and clipboard has files and the target is not a text field with text being pasted (i.e. `e.clipboardData.files.length > 0`), `preventDefault()` and `addFiles`.
    Lightbox: `{viewing !== null && <ImageLightbox images={attachments.map((x) => ({ src: imageSrc(slug, x.id), name: x.name }))} index={viewing} onClose={() => { setViewing(null); opener.current?.focus() }} />}`.
  - While `uploads.busy`, closing is allowed (the task already exists; the uploader keeps running and inserts the row) — no guard needed here, unlike the create modal.
  - Footer unchanged.

- [ ] **Step 5: Verify** — `npm run lint && npm run typecheck && npm test && npm run build` → green.

- [ ] **Step 6: Commit** — invoke the `auto-commit` skill.

---

### Task 7: Docs and end-to-end verification

**Files:**
- Create: `docs/adr/0010-r2-image-attachments.md`
- Modify: `docs/REQUIREMENTS_FREEZE.md`, `docs/DESIGN.md`, `README.md`, `SECURITY.md` (if it lists data stores/secrets)

- [ ] **Step 1: ADR 0010** (same format as `docs/adr/0008-web-speech-dictation.md`): context (manager pasted prose + names into titles; screenshots needed), decision (private R2, presigned PUT from the browser, server HEAD verification, cookie-checked 302 image route, `aws4fetch` for SigV4, no SVG, 10 MB / 20 per task, objects never deleted by the app → undo works, orphans accepted), consequences (bucket CORS needed; `r2.dev` public URL must stay disabled; orphan sweep deferred; local mode has no images).

- [ ] **Step 2: REQUIREMENTS_FREEZE** — Content model: tasks have a title (120 chars when typed; legacy longer titles kept), description, **responsável** (free text, 80) and **images** (session only). Limits line updated. Views: new tasks are created through a modal (Título, Descrição, Responsável, Coluna, Seção, Imagens) in both views; task details open from the list title too. Deployment: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (optional; images hidden without them).

- [ ] **Step 3: DESIGN.md** — task dialog width 640 px; lightbox (96vw × 96dvh, `bg-black/85` backdrop, arrows/swipe); column chips; meta line icons.

- [ ] **Step 4: README** — R2 setup: create a private bucket, an R2 API token (Object Read & Write, that bucket only), the four env vars, run `node --env-file=.env scripts/r2-cors.ts <origins…>`, keep the Public Development URL disabled.

- [ ] **Step 5: Full check** — `npm run lint && npm run typecheck && npm test && npm run build`. Paste the tail of each.

- [ ] **Step 6: Browser check** — `npm run dev` (uses `.env` with real Postgres + R2), Playwright MCP, create a throwaway session (e.g. slug `riskatest<4 digits>`, PIN `1234`), desktop 1280×800 and phone 390×844:
  1. Lista: "+ Nova tarefa" → modal; type title, description, responsável, pick "Em Andamento" chip, attach a PNG and paste another → "Criar tarefa" shows progress then closes; row shows short title, meta line (responsável, 2 images, description icon), status chip.
  2. Esc while uploading in the create modal does **not** close it (throttle network in Playwright or use a large image).
  3. Click the row title → details dialog opens (URL has `?task=`); title is small; chips switch column; edit responsável (blur saves; reload shows it).
  4. Click a thumbnail → lightbox; ←/→ navigate; Esc closes **only** the lightbox; focus back on the thumbnail.
  5. Remove an image → toast "Desfazer" restores it.
  6. Delete the task → "Desfazer" → task and both images are back (thumbnails load).
  7. Quadro: "Adicionar tarefa" in "Concluído" → modal preselects "Concluído"; created card lands in that column, checked.
  8. Open a legacy long-title task (create one via the old data or set one > 120 chars via SQL in the throwaway session) → edit title, append text, saves.
  9. `/local`: create a task via modal — no image field; network panel shows **no** requests to the server for storage/attachments.
  10. Direct `curl -I http://localhost:3000/api/s/<slug>/img/<id>` without the cookie → 404; with the browser → 302 to R2 and the image loads.
  Take screenshots of: list with meta lines, create modal (desktop + phone bottom sheet), details dialog with images, lightbox.
  Delete the throwaway session afterwards (Settings → Deletar sessão).

- [ ] **Step 7: Commit** — invoke the `auto-commit` skill.
