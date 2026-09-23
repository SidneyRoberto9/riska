# ADR 0001: TanStack Start + TanStack DB collections

## Status
Accepted

## Context
The app needs SSR (first paint already themed and populated), a few
authenticated server endpoints, and a client that stays responsive while
writes are in flight — checking a box or dragging a card can't wait on a
round-trip. It also has to run with no server at all (local mode, ADR 0002).

## Decision
TanStack Start for SSR and `createServerFn` server functions (no separate
API layer), TanStack Router for file routes and typed search params, and
TanStack DB collections for client data: `useLiveQuery` for reads,
optimistic `insert`/`update`/`delete` for writes. Server collections use
`@tanstack/query-db-collection` on top of TanStack Query; route loaders
share its query keys so SSR-prefetched data seeds the collections.

## Consequences
- Components never wait on writes; the UI shows the optimistic state and
  the collection reconciles when the server function resolves.
- One stack, one vendor's conventions for routing, data and server code.
- TanStack DB is young (0.x); upgrades need reading its changelog and
  re-running the E2E flows.
