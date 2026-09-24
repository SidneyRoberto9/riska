import assert from "node:assert/strict"
import { test } from "node:test"
import { assigneesOf, titleMax } from "./task.ts"

test("titleMax keeps legacy long titles editable", () => {
  assert.equal(titleMax(""), 120)
  assert.equal(titleMax("x".repeat(119)), 120)
  assert.equal(titleMax("x".repeat(900)), 900)
})

test("assigneesOf returns unique, trimmed, sorted, non-empty names", () => {
  assert.deepEqual(
    assigneesOf([{ assignee: "Sidney" }, { assignee: " Davi " }, { assignee: "" }, { assignee: "Sidney" }]),
    ["Davi", "Sidney"]
  )
  assert.deepEqual(assigneesOf([{ assignee: undefined as unknown as string }]), [])
})
