import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chipHidden, doneChanges, firstDone, firstOpen, neighbour, statusChanges, statusOf } from './status.ts'
import type { Status } from './types'

const S = (id: string, done = false): Status => ({ id, pageId: 'p', name: id, color: '#000000', done, position: 0 })
const todo = S('todo')
const doing = S('doing')
const done = S('done', true)
const shipped = S('shipped', true)
const all = [todo, doing, done]

test('statusOf falls back to the first status for null or unknown ids', () => {
  assert.equal(statusOf({ statusId: null }, all), todo)
  assert.equal(statusOf({ statusId: 'gone' }, all), todo)
  assert.equal(statusOf({ statusId: 'doing' }, all), doing)
  assert.equal(statusOf({ statusId: null }, []), undefined)
})

test('firstDone / firstOpen', () => {
  assert.equal(firstDone([todo, shipped, done]), shipped)
  assert.equal(firstOpen([done, doing]), doing)
  assert.equal(firstDone([todo]), undefined)
})

test('statusChanges copies the column done flag', () => {
  assert.deepEqual(statusChanges(done), { statusId: 'done', done: true })
  assert.deepEqual(statusChanges(doing), { statusId: 'doing', done: false })
})

test('checking moves to the first done status', () => {
  assert.deepEqual(doneChanges({ statusId: 'doing', done: false }, [todo, doing, done, shipped], true), { done: true, statusId: 'done' })
})

test('checking without any done status only sets done', () => {
  assert.deepEqual(doneChanges({ statusId: 'doing', done: false }, [todo, doing], true), { done: true })
})

test('unchecking from a done column moves to the first open status', () => {
  assert.deepEqual(doneChanges({ statusId: 'shipped', done: true }, [todo, doing, done, shipped], false), { done: false, statusId: 'todo' })
})

test('unchecking from an open column keeps the column', () => {
  assert.deepEqual(doneChanges({ statusId: 'doing', done: true }, all, false), { done: false })
})

test('chipHidden hides the default column and the default done column only', () => {
  const list = [todo, doing, done, shipped]
  assert.equal(chipHidden({ statusId: null, done: false }, list), true)
  assert.equal(chipHidden({ statusId: 'doing', done: false }, list), false)
  assert.equal(chipHidden({ statusId: 'done', done: true }, list), true)
  assert.equal(chipHidden({ statusId: 'shipped', done: true }, list), false)
  assert.equal(chipHidden({ statusId: null, done: false }, []), true)
})

test('neighbour prefers the previous column, then the next, none for a single column', () => {
  assert.equal(neighbour(all, 'doing'), todo)
  assert.equal(neighbour(all, 'todo'), doing)
  assert.equal(neighbour([todo], 'todo'), undefined)
  assert.equal(neighbour(all, 'gone'), undefined)
})
