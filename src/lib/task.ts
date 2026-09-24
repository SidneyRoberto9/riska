import { LIMITS, type Task } from "./types.ts"

// Titles created before the 120-char limit stay editable without being cut
export const titleMax = (value: string) => Math.max(LIMITS.taskTitle, value.length)

export const assigneesOf = (tasks: Pick<Task, "assignee">[]) =>
  [...new Set(tasks.map((t) => (t.assignee ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"))
