# ADR 0009: Biome + a custom conventions script

## Status
Accepted

## Context
The project had no linter or formatter. The maintainer's media4all UI
projects already standardize on Biome, and this project also needs two
structural rules: at most 300 lines per file and one component per
`.tsx` file.

## Decision
Biome 2.4.15 with the same `biome.json` as the media4all UIs
(eleva-presence) for lint, format and import order. The two structural
rules live in `scripts/check-conventions.ts`, run by `npm run lint` after
`biome check`. Details in `docs/CONVENTIONS.md`.

## Consequences
- One fast tool instead of ESLint + Prettier, with the same output as the
  other projects.
- Biome has no per-file line cap or one-component-per-file rule, so the
  script is ours to maintain — keep it small and free of new
  dependencies.
- The initial adoption reformatted the whole codebase (double quotes,
  120 columns) in one change.
