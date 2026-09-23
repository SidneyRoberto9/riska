# Contributing to Riska

## Before you start

- For anything non-trivial, open an issue first describing the problem or
  idea, so direction is agreed before code is written.
- Read `CLAUDE.md` (hard rules), `docs/CONVENTIONS.md` (enforced style) and
  `docs/adr/` (standing decisions). A change that contradicts an ADR needs
  a new ADR, not a quiet workaround.

## Setup

Requires Node.js 22+ and a PostgreSQL database.

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and COOKIE_SECRET (32+ chars)
npm run dev            # http://localhost:3000
```

The schema in `src/server/schema.sql` is applied automatically, idempotently,
on the first database query — there is no migration command to run.

## Checks to run before opening a PR

```bash
npm run lint        # biome check + scripts/check-conventions.ts
npm run typecheck   # tsc --noEmit
npm test            # node --test src/lib/*.test.ts
npm run build       # vite build
```

`npm run format` (`biome check --write`) applies formatting and safe fixes.
Don't open a PR with failing checks "to get feedback" — open it as a draft
and say so.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/) with a scope
naming the area touched, one logical change per commit:

```
feat(board): add task details dialog
fix(data): serialize server writes per session
docs(status): explain separate task pinning transaction
build: regenerate lockfile for node:24-alpine npm ci
```

Scopes in use: `board`, `tasks`, `pages`, `status`, `dnd`, `data`,
`schema`, `voice`.

## Code style

Enforced by `npm run lint` — see [docs/CONVENTIONS.md](docs/CONVENTIONS.md).

## Reporting bugs

Open a GitHub issue with the browser/device, whether it happened in a
session or in local mode, and steps to reproduce. For security issues, see
[SECURITY.md](SECURITY.md) instead of opening a public issue.
