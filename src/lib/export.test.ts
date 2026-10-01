import assert from "node:assert/strict"
import { test } from "node:test"
import { toCsv } from "./export.ts"
import type { Section, Status, Task } from "./types"

const statuses: Status[] = [
  { id: "todo", pageId: "p", name: "A Fazer", color: "#000000", done: false, position: 0 },
  { id: "ok", pageId: "p", name: "Concluído", color: "#000000", done: true, position: 1 },
]
const sections: Section[] = [
  { id: "s1", pageId: "p", title: "Hoje", note: "", highlight: false, position: 0 },
  { id: "s2", pageId: "p", title: "Depois", note: "", highlight: false, position: 1 },
]
const T = (id: string, over: Partial<Task>): Task => ({
  id,
  sectionId: "s1",
  pageId: "p",
  text: id,
  done: false,
  statusId: null,
  note: "",
  assignee: "",
  createdAt: null,
  position: 0,
  boardPosition: 0,
  ...over,
})

test("toCsv writes chosen columns in page order with friendly status", () => {
  const tasks = [T("b", { sectionId: "s2" }), T("a", { statusId: "ok", done: true, position: 1 }), T("z", {})]
  const csv = toCsv(["title", "status", "done"], tasks, { statuses, sections })
  assert.equal(csv, "﻿Título;Status;Concluída\r\nz;A Fazer;Não\r\na;Concluído;Sim\r\nb;A Fazer;Não\r\n")
})

test("toCsv quotes separators/newlines and neutralises formulas", () => {
  const tasks = [T("x", { text: '=HYPERLINK("x")', note: 'linha 1\nlinha "2"; fim' })]
  const csv = toCsv(["title", "note"], tasks, { statuses, sections })
  assert.equal(csv.split("\r\n")[1], `"'=HYPERLINK(""x"")";"linha 1\nlinha ""2""; fim"`)
})
