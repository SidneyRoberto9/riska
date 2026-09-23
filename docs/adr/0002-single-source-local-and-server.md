# ADR 0002: One `Source` shape for local and server modes

## Status
Accepted

## Context
Riska has two modes: a session synced through PostgreSQL (`/s/<slug>`) and
a local mode that never touches the network (`/local`). Writing each view
twice, or branching on the mode inside components, would double the
surface for bugs.

## Decision
`src/data/source.ts` defines a `Source` — `pages`, `sections`, `statuses`,
`tasks`, `settings` collections plus `slug`/`basePath`. `getServerSource`
builds them with `queryCollectionOptions` (server functions, 15 s refetch);
`getLocalSource` builds them with `localStorageCollectionOptions`
(`checklist-local-*` keys). The route provides one through
`SourceContext`; components and `useActions()` only ever call
`useSource()`.

## Consequences
- Every feature works in both modes with a single implementation.
- Mode-specific behavior is explicit and rare (e.g. `upgradeLocalPage`
  for local pages saved before statuses existed; the local theme script).
- Local mode has no cross-tab or cross-device sync and no backup — by
  design, stated in the UI ("Usar sem salvar").
