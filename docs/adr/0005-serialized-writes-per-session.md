# ADR 0005: Serialize server writes per session

## Status
Accepted

## Context
Each collection persists through its own server functions. Rows reference
each other across collections (a task's `status_id`, a section's
`page_id`), so a new status inserted and a task moved into it could reach
the server out of order and violate a foreign key or lose the move.

## Decision
`getServerSource` gives each session one promise chain; every collection's
`onInsert`/`onUpdate`/`onDelete` enqueues its server call on it. Handlers
are invoked synchronously by the mutation, so queue order equals call
order. A failure doesn't block later writes.

## Consequences
- Cross-collection writes land in the order the user made them.
- A slow request delays the writes queued behind it; the UI stays
  optimistic meanwhile. Per-collection or per-row queues would be faster
  but can't preserve cross-collection ordering.
