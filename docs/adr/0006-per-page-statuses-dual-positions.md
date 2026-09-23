# ADR 0006: Per-page statuses, separate list and board positions

## Status
Accepted

## Context
The kanban board was added to an existing checklist. Columns differ by
page (a shopping list and a project don't share workflows), and ordering
tasks on the board shouldn't reshuffle the checklist, or vice versa.

## Decision
A `statuses` table per page (name, color, `done`, position), seeded with
A Fazer / Em Andamento / Concluído. Tasks get `status_id` (null or a
deleted status means the page's first column), plus `board_position`
alongside the existing list `position`. The checkbox and the columns stay
consistent through `src/lib/status.ts`: checking moves a task into the
first done column; unchecking from a done column moves it to the first
open one.

## Consequences
- List and board are two orderings over the same rows — no copies.
- `done` and `status_id` must always be written together (`doneChanges`,
  `statusChanges`).
- Deleting a column moves its tasks to the neighbouring column rather
  than deleting them.
