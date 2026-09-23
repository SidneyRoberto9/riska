# ADR 0004: postgres.js raw SQL + idempotent `schema.sql`, no migration tool

## Status
Accepted

## Context
Five tables, simple queries, one deployment. An ORM or a migration tool
would add a dependency, a CLI step and generated code for little gain.

## Decision
`postgres` (postgres.js) with tagged-template queries and
`postgres.camel` transforms. The whole schema lives in
`src/server/schema.sql`, written to be idempotent (`CREATE ... IF NOT
EXISTS`, `ADD COLUMN IF NOT EXISTS`, guarded `DO` blocks for one-time
backfills). `db()` runs it once per process on the first query; a failed
run is retried on the next request.

## Consequences
- No migration command in deploys — a new process brings the schema up to
  date by itself.
- Every schema change must stay safe to re-run forever; one-time data
  fixes need a guard (see the `badges` backfill).
- Queries are hand-written SQL, so access scoping (`session_slug`) is the
  author's job in every server function.
