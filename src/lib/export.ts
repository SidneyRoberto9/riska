import { statusOf } from "./status.ts"
import { formatDate } from "./time.ts"
import type { Section, Status, Task } from "./types.ts"

type Ctx = { statuses: Status[]; sections: Section[] }
type Column = { id: string; label: string; on: boolean; get: (t: Task, c: Ctx) => string }

// `on` = checked by default in the export dialog
export const EXPORT_COLUMNS: Column[] = [
  { id: "title", label: "Título", on: true, get: (t) => t.text },
  { id: "note", label: "Descrição", on: true, get: (t) => t.note },
  { id: "createdAt", label: "Data de criação", on: true, get: (t) => (t.createdAt ? formatDate(t.createdAt) : "") },
  { id: "status", label: "Status", on: true, get: (t, c) => statusOf(t, c.statuses)?.name ?? "" },
  {
    id: "section",
    label: "Seção",
    on: false,
    get: (t, c) => c.sections.find((s) => s.id === t.sectionId)?.title ?? "",
  },
  { id: "assignee", label: "Responsável", on: false, get: (t) => t.assignee ?? "" },
  { id: "done", label: "Concluída", on: false, get: (t) => (t.done ? "Sim" : "Não") },
]

// Neutralise spreadsheet formulas (other session members write these strings), then quote when needed
function cell(value: string) {
  const v = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[;"\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v
}

// `;` + BOM + CRLF: what Excel in pt-BR opens straight into columns with accents intact (Sheets detects it too).
// Rows follow the page: section order, then task order inside the section.
export function toCsv(ids: string[], tasks: Task[], c: Ctx) {
  const cols = EXPORT_COLUMNS.filter((col) => ids.includes(col.id))
  const order = new Map(c.sections.map((s, i) => [s.id, i]))
  const rows = [...tasks].sort(
    (a, b) => (order.get(a.sectionId) ?? 0) - (order.get(b.sectionId) ?? 0) || a.position - b.position
  )
  const lines = [cols.map((col) => col.label), ...rows.map((t) => cols.map((col) => col.get(t, c)))]
  return `﻿${lines.map((l) => l.map(cell).join(";")).join("\r\n")}\r\n`
}
