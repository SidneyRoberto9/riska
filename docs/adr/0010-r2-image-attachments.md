# ADR 0010: Task images in a private Cloudflare R2 bucket

## Status
Accepted

## Context
A manager using Riska pasted whole paragraphs and people's names into
task titles, and needs to attach screenshots to tasks. Titles got a
separate description and a **responsável** field; images need storage
that Postgres shouldn't carry (up to 10 MB each) and must stay as private
as the session itself.

## Decision
- Objects live in a **private** Cloudflare R2 bucket under
  `<slug>/<attachment id>`; the key is built on the server from the
  session and a server-made id, and never reaches the client.
- Uploads go straight from the browser to R2 with a **presigned PUT**
  (5 min) from `createUploadFn`, which signs `Content-Type` **and**
  `Content-Length`, so the URL can't be reused for another type or size.
- `insertAttachmentsFn` then **HEADs** each object and trusts only what R2
  reports (type, size) before inserting the row, locking the task row to
  enforce the per-task limit. An object that fails the check is deleted.
- Images are shown through `/api/s/$slug/img/$id`: it checks the session
  cookie and the row's `session_slug`, then **302**s to a 1 h presigned GET
  (`Cache-Control: private, max-age=3000`). Anything else is a 404.
- SigV4 signing via `aws4fetch` (small, fetch-based) instead of the AWS SDK.
- Allowed: PNG, JPEG, WebP, GIF, AVIF — **no SVG** (it can carry script).
  At most **10 MB** per image and **20 per task** (`src/lib/images.ts`).
- Removing an image or deleting a task/page/session deletes only the
  **rows**; the app never deletes a stored object, so "Desfazer" can
  re-insert the rows and the images still load. Orphaned objects are
  accepted.
- Storage is optional: without the four `R2_*` variables the image field is
  hidden.

## Consequences
- The bucket needs a CORS rule allowing `PUT` with `content-type` from the
  app's origins (`scripts/r2-cors.ts`).
- The bucket's **Public Development URL (`r2.dev`) must stay disabled**;
  otherwise the cookie check is bypassable by anyone who learns a key.
- Orphans accumulate; a sweep comparing `<slug>/` prefixes against
  `attachments.key` is deferred until storage cost matters.
- Local mode has no images (it never touches the network, ADR 0002).
- In `npm run dev`, Nitro serves any `Sec-Fetch-Dest: image` request as a
  static file, so a dev-only Vite plugin in `vite.config.ts` rewrites that
  header for `/api/` requests.
