# Code Conventions

Everything here is enforced by `npm run lint`:

```bash
npm run lint     # biome check && node scripts/check-conventions.ts
npm run format   # biome check --write  (formatting + safe fixes)
```

## Biome

Biome 2.4.15, `biome.json` copied from the media4all UI projects
(eleva-presence) so the same rules apply across projects.

| Setting | Value |
| --- | --- |
| Rules | `recommended` |
| Warn | `noUnusedImports`, `noUnusedVariables`, `noNonNullAssertion`, `noExplicitAny`, `noConsole`, `useSelfClosingElements` |
| Error | `useBlockStatements`, `noParameterAssign` |
| Off | `a11y/useButtonType` |
| Formatter | 2 spaces, 120 columns, LF, double quotes, no semicolons, trailing commas `es5`, always parenthesized arrow params |
| Assist | organize imports on save/fix |
| CSS | Tailwind directives parsed (`@theme`, `@layer`, …) |

**Why:** one fast tool for lint + format + import order, and the same
output as the other UIs, so code moves between projects without a
reformat.

`useBlockStatements` means every `if`/`for` body has braces, including
early returns:

```ts
if (!slug) {
  return null
}
```

### Suppressions

Only a targeted `biome-ignore <rule>: <reason>` with a real reason — never
a file-wide or rule-wide disable. Existing examples:

- `lint/a11y/noAutofocus` — inputs rendered only right after the user asked
  to type (opened editor, PIN screen).
- `lint/correctness/useExhaustiveDependencies` — effects keyed on a trigger
  value, or reading through refs on purpose.
- `lint/security/noDangerouslySetInnerHtml` — the static pre-paint theme
  script in `__root.tsx`.
- `lint/complexity/noImportantStyles` — the `prefers-reduced-motion` block,
  which must beat every component animation.

**Why:** a suppression is a claim that the rule is wrong *here*; the reason
is the claim, and a reviewer can check it.

## Max 300 lines per file

Every `.ts`, `.tsx` and `.css` file under `src/` stays at or under 300
lines (`src/routeTree.gen.ts` is generated and excluded). Checked by
`scripts/check-conventions.ts`.

**Why:** a file that doesn't fit in one read hides its structure. When a
file approaches the limit, split it by component or responsibility —
never by squeezing formatting.

## One component per `.tsx` file

Each `.tsx` file declares exactly one React component and is named after
it (`BoardCard.tsx` → `BoardCard`). A component is a top-level PascalCase
`function`, or a PascalCase `const` initialized with an arrow function,
function expression, `memo(...)` or `forwardRef(...)`.

Allowed alongside the component: its context, its hooks, types, and small
private helpers used only by it. Anything shared gets its own camelCase
`.ts` file (`useDragScroll.ts`, `dnd.ts`).

Route files in `src/routes/` may hold the `Route` export plus the single
page component it renders. Checked by `scripts/check-conventions.ts`.

**Why:** finding a component is a file search, diffs stay scoped to one
component, and a file never grows by accretion of "just one more small
component."

## Layout

| Path | Contents |
| --- | --- |
| `src/components/` | Flat. Related components share a prefix (`Board*`, `Status*`, …) |
| `src/data/` | Client data layer: `Source` collections, actions, search params, local helpers |
| `src/lib/` | Pure logic and types, with `*.test.ts` next to them (`node --test`) |
| `src/server/` | Server functions; `*.server.ts` is server-only (never imported by the client) |
| `src/routes/` | TanStack Router file routes (`routeTree.gen.ts` is generated) |

## Language

UI strings in PT-BR. Identifiers, comments, commits and docs in English.
