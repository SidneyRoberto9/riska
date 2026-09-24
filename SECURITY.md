# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Use GitHub's private vulnerability reporting for this repository
(Security tab → "Report a vulnerability"). Include:

- A description of the vulnerability and its impact.
- Steps to reproduce, or a proof of concept.
- The commit or deployment affected.

## Scope

- **PIN authentication** (`src/server/session.ts`) — 4-digit PINs hashed
  with scrypt (random 16-byte salt), compared with `timingSafeEqual`.
  Failed attempts are claimed atomically before verifying; the 5th failure
  locks the session for `15 × 2^level` minutes, capped at 24 hours. Unknown
  slugs spend the same scrypt time (anti-enumeration).
- **Session cookies** (`src/server/auth.server.ts`) — one `httpOnly`,
  `SameSite=Lax` cookie per slug (`Secure` in production), value
  HMAC-SHA256-signed with `COOKIE_SECRET` over `slug:pin_hash`, so
  recreating a slug invalidates old cookies. `COOKIE_SECRET` under 32
  characters is refused.
- **Server function input** (`src/server/validate.ts`) — every server
  function validates its payload (IDs `^[A-Za-z0-9]{16}$`, slugs
  `^[a-z0-9]{3,40}$`, PINs `^\d{4}$`, length limits from `LIMITS`, arrays
  capped at 500) and calls `requireAccess(slug)`; row updates are scoped by
  `session_slug`.
- **SQL** — `postgres.js` tagged templates only; dynamic column sets use
  `sql(obj)` over keys whitelisted by `partial(...)`.
- **Inline theme script** (`src/routes/__root.tsx`, `src/data/theme.ts`) —
  a static string run before hydration on `/local` pages; it reads the
  saved theme from `localStorage` and only sets two `data-*` attributes.
- **Image attachments** (`src/server/attachments.ts`,
  `src/server/storage.server.ts`, `src/routes/api.s.$slug.img.$id.ts`) —
  private Cloudflare R2 bucket, keys `<slug>/<server-made id>` never sent
  to the client. Uploads use a 5-minute presigned PUT that signs
  `Content-Type` and `Content-Length`; the server HEADs the object and
  rejects (and deletes) anything that isn't PNG/JPEG/WebP/GIF/AVIF
  ≤ 10 MB, and caps 20 images per task under a row lock. No SVG. Reads go
  through a route that checks the session cookie and the row's session,
  then 302s to a 1-hour presigned GET; everything else is a 404. The
  bucket's public `r2.dev` URL must stay disabled, and the `R2_*`
  credentials should be a token limited to that one bucket. Removed images'
  objects are not deleted (so undo works); a presigned GET already handed
  out stays valid until it expires.
- **Local mode** — data is stored in plain `localStorage`
  (`checklist-local-*`), unencrypted and readable by anything that can run
  script on the origin. It never reaches the server.

Out of scope: guessing a PIN within the lockout limits (5 attempts per
lock window — a way to exceed that limit *is* in scope), vulnerabilities in
dependencies that aren't specific to how Riska uses them (report those
upstream), and anything requiring physical access to an unlocked device.
