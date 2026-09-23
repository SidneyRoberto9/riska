import assert from "node:assert/strict"
import { test } from "node:test"
import { nextPosition, renumber, shift } from "./order.ts"

test("renumber returns only the rows whose position changes", () => {
  const current = new Map([
    ["a", 1],
    ["b", 2],
    ["c", 3],
  ])
  assert.deepEqual(
    [...renumber(["a", "c", "b"], current)],
    [
      ["c", 2],
      ["b", 3],
    ]
  )
  assert.equal(renumber(["a", "b", "c"], current).size, 0)
})

test("renumber fills gaps and unknown ids", () => {
  assert.deepEqual(
    [...renumber(["x", "a"], new Map([["a", 5]]))],
    [
      ["x", 1],
      ["a", 2],
    ]
  )
})

test("shift swaps with the neighbour and clamps at the edges", () => {
  assert.deepEqual(shift(["a", "b", "c"], "b", -1), ["b", "a", "c"])
  assert.deepEqual(shift(["a", "b", "c"], "b", 1), ["a", "c", "b"])
  assert.deepEqual(shift(["a", "b"], "a", -1), ["a", "b"])
  assert.deepEqual(shift(["a", "b"], "b", 1), ["a", "b"])
  assert.deepEqual(shift(["a"], "zz", 1), ["a"])
})

test("nextPosition is max + 1", () => {
  assert.equal(nextPosition([]), 1)
  assert.equal(nextPosition([{ position: 4 }, { position: 2 }]), 5)
})
