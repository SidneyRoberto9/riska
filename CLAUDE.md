# Riska — Project Instructions

Checklist + kanban web app. Named sessions (slug + 4-digit PIN, no
accounts) synced through PostgreSQL, or a local mode that lives only in
`localStorage`. TanStack Start (SSR, server functions) + TanStack Router +
TanStack DB/Query + React 19 + TypeScript + Tailwind CSS 4 + `postgres.js`
+ `@dnd-kit`. The UI is PT-BR; code, comments and docs are English. See
`docs/adr/` for why each piece exists and `docs/REQUIREMENTS_FREEZE.md` for
the locked product decisions.

## Priority order

1. Data integrity (no lost or cross-session writes)
2. Security
3. Correctness
4. UX (phone first, keyboard and screen reader included)
5. Simplicity / maintainability
6. Aesthetics
7. Implementation convenience

## Hard rules

- **Package manager: npm only.** No pnpm, yarn or bun.
- **No dependency "just in case."** Before adding one, check the standard
  library, a native platform feature (e.g. `<dialog>`, `popover`, Web
  Speech API) and the already-installed dependencies.
- **The server is the source of truth for session data.** Every server
  function validates its input with `src/server/validate.ts` and calls
  `requireAccess(slug)` before touching a row; queries always scope by
  `session_slug`.
- **Local mode never hits the network.** `/local` reads and writes only
  `localStorage` collections (`getLocalSource`).
- **Components read data through `useSource()`**, never by importing a
  server function or `localStorage` directly — one code path serves both
  modes (ADR 0002).
- **UI strings are PT-BR.**
- **Conventions are enforced, not suggested** — Biome, max 300 lines per
  file, one component per `.tsx`. See `docs/CONVENTIONS.md`.

## Security

- SQL only through `postgres.js` tagged templates — never build a query by
  string concatenation. Dynamic column sets go through `sql(obj)` after
  `partial(...)` has whitelisted the keys.
- PIN handling stays in `src/server/auth.server.ts` / `session.ts`: scrypt
  hashes, timing-safe comparison, HMAC-signed `httpOnly` cookie per slug,
  lockout after 5 failures. Don't weaken any of these for convenience.
- `dangerouslySetInnerHTML` only for static constants (the pre-paint theme
  script), with a `biome-ignore` explaining why.

## Before claiming something works

Run it and say what you actually verified — not "should work":

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

UI changes also get exercised in a browser (`npm run dev`), both in a
session (`/s/<slug>`) and in local mode (`/local`). If something can't be
verified in the current environment, say exactly what wasn't checked.
