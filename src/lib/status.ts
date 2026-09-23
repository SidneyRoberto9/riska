import type { Status, Task } from "./types"

// Every function takes ONE page's statuses sorted by position.
type TaskState = Pick<Task, "statusId" | "done">

// A null (or deleted) status means the page's first column, so tasks never disappear from the board
export const statusOf = (task: Pick<Task, "statusId">, statuses: Status[]): Status | undefined =>
  statuses.find((s) => s.id === task.statusId) ?? statuses[0]

export const firstDone = (statuses: Status[]) => statuses.find((s) => s.done)
export const firstOpen = (statuses: Status[]) => statuses.find((s) => !s.done)

export const statusChanges = (s: Status): TaskState => ({ statusId: s.id, done: s.done })

// Checkbox → column: checking goes to the first "done" column; unchecking leaves a done column for the first open one
export function doneChanges(task: TaskState, statuses: Status[], done: boolean): Partial<TaskState> {
  const target = done ? firstDone(statuses) : statusOf(task, statuses)?.done ? firstOpen(statuses) : undefined
  return target ? { done, statusId: target.id } : { done }
}

// The chip is noise for the default column and for tasks checked into the default done column (the strike-through says it)
export function chipHidden(task: TaskState, statuses: Status[]) {
  const s = statusOf(task, statuses)
  return !s || s === statuses[0] || (task.done && s === firstDone(statuses))
}

// Where a deleted column's tasks go: the previous column, or the next one when deleting the first
export function neighbour(statuses: Status[], id: string): Status | undefined {
  const i = statuses.findIndex((s) => s.id === id)
  if (i < 0) {
    return undefined
  }
  return statuses[i - 1] ?? statuses[i + 1]
}

// Tinted from the status colour against the current surface/ink, so it works in light and dark
export const tint = (color: string) => ({
  background: `color-mix(in oklab, ${color} 16%, var(--surface))`,
  color: `color-mix(in oklab, ${color} 80%, var(--ink))`,
})
