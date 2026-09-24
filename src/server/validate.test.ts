import assert from "node:assert/strict"
import { test } from "node:test"
import { shape, taskInsertFields } from "./validate.ts"

const task = { text: "a", done: false, statusId: null, note: "", createdAt: null, position: 0, boardPosition: 0 }

test("a task insert without assignee (a tab from before the field existed) gets an empty one", () => {
  assert.equal(shape(taskInsertFields)(task).assignee, "")
  assert.equal(shape(taskInsertFields)({ ...task, assignee: "Ana" }).assignee, "Ana")
  assert.throws(() => shape(taskInsertFields)({ ...task, assignee: null }), /INVALID/)
  assert.throws(() => shape(taskInsertFields)({ ...task, assignee: "x".repeat(81) }), /INVALID/)
})
