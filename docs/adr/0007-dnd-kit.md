# ADR 0007: dnd-kit for drag-and-drop

## Status
Accepted

## Context
Tasks, sections and board columns are reordered by drag, on phones as much
as on desktop, and must remain operable by keyboard and screen reader.
Native HTML drag-and-drop has no touch support on mobile browsers and no
keyboard path.

## Decision
`@dnd-kit/core` + `@dnd-kit/sortable`, wrapped once (`SortableBoard`, `SortableColumns`, `ColumnItems`
and the shared contexts/hooks in `src/components/dnd.ts`). Sensors: mouse after 5 px of movement, touch after a
180 ms long-press (so the page still scrolls), keyboard with custom
coordinates. PT-BR announcements describe every lift, move and drop.

## Consequences
- One drag implementation serves list and board.
- After a drop, the final order stays on screen until the optimistic write
  reaches the live data, so items don't snap back.
- Three packages added; justified because the touch and keyboard
  requirements are not met by the platform.
