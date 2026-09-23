import { useRouter } from '@tanstack/react-router'
import type { Collection, Transaction } from '@tanstack/react-db'
import { useToast } from '#/components/toast'
import { newId } from '#/lib/id'
import { nextPosition, renumber, shift } from '#/lib/order'
import { doneChanges, neighbour, statusChanges, statusOf } from '#/lib/status'
import type { Page, Section, Settings, Status, Task } from '#/lib/types'
import { DEFAULT_SETTINGS, DEFAULT_STATUSES } from '#/lib/types'
import { useSource } from './source-context'

type Row = { id: string }
type StatusDraft = Pick<Status, 'name' | 'color' | 'done'>

// Writes 1..n into `field` for `ids` (only rows that change) plus per-row extra changes:
// one optimistic transaction = one server call, so a drop never half-applies
function reorderTx<T extends Row>(c: Collection<T, string>, ids: string[], field: keyof T & string, extra: Record<string, Partial<T>> = {}) {
  const pos = renumber(ids, new Map(ids.map((id) => [id, Number(c.get(id)?.[field])])))
  const keys = [...new Set([...pos.keys(), ...Object.keys(extra)])].filter((id) => c.has(id))
  if (!keys.length) return null
  return c.update(keys, (drafts) => {
    drafts.forEach((d, i) => {
      const p = pos.get(keys[i])
      if (p !== undefined) Object.assign(d, { [field]: p })
      Object.assign(d, extra[keys[i]])
    })
  })
}

export function useActions() {
  const source = useSource()
  const toast = useToast()
  const router = useRouter()

  // Every mutation is optimistic; on failure TanStack DB rolls back and we offer a retry
  const run = (mutate: () => Transaction | null) => {
    const tx = mutate()
    tx?.isPersisted.promise.catch((err: Error) => {
      if (err?.message === 'UNAUTHORIZED') {
        router.invalidate()
        return
      }
      toast('Não salvou.', { label: 'Tentar de novo', onClick: () => run(mutate) })
    })
    return tx
  }

  const { pages, sections, statuses, tasks, settings } = source
  const all = <T extends object>(c: Collection<T, string>) => [...c.values()]
  const pageStatuses = (pageId: string) =>
    all(statuses)
      .filter((s) => s.pageId === pageId)
      .sort((a, b) => a.position - b.position)
  const defaultStatuses = (pageId: string): Status[] =>
    DEFAULT_STATUSES.map((s, i) => ({ ...s, id: newId(), pageId, position: i + 1 }))
  // A task that changes column lands at the bottom of it
  const boardEnd = (pageId: string) =>
    nextPosition(all(tasks).filter((t) => t.pageId === pageId).map((t) => ({ position: t.boardPosition ?? 0 })))
  const setTaskState = (task: Task, changes: Partial<Task>) => {
    if (!tasks.has(task.id)) return
    // Compare against the resolved column, not the raw field: a null statusId that already resolves
    // to the first column (e.g. re-checking a task already in it) is not a move
    const moved = changes.statusId !== undefined && changes.statusId !== statusOf(task, pageStatuses(task.pageId))?.id
    const extra = moved ? { boardPosition: boardEnd(task.pageId) } : {}
    run(() => tasks.update(task.id, (d) => void Object.assign(d, changes, extra)))
  }
  const tasksInColumn = (status: Status) => {
    const list = pageStatuses(status.pageId)
    return all(tasks).filter((t) => t.pageId === status.pageId && statusOf(t, list)?.id === status.id)
  }

  return {
    addPage(title: string) {
      const id = newId()
      const page = run(() => pages.insert({ id, title, subtitle: '', position: nextPosition(all(pages)) }))
      const insertStatuses = () => run(() => statuses.insert(defaultStatuses(id)))
      // Server mode: pages and statuses are separate POSTs, and a status row has a page FK,
      // so it must wait for the page insert to land (local mode has no such ordering constraint)
      if (!source.slug || !page) insertStatuses()
      else page.isPersisted.promise.then(insertStatuses, () => {})
      return id
    },
    updatePage(id: string, changes: Partial<Omit<Page, 'id'>>) {
      run(() => pages.update(id, (d) => void Object.assign(d, changes)))
    },
    deletePage(id: string) {
      const sectionIds = all(sections).filter((s) => s.pageId === id).map((s) => s.id)
      const statusIds = all(statuses).filter((s) => s.pageId === id).map((s) => s.id)
      const taskIds = all(tasks).filter((t) => t.pageId === id).map((t) => t.id)
      // Server cascades; local storage does not, so children are removed explicitly in both modes
      if (taskIds.length) run(() => tasks.delete(taskIds))
      if (sectionIds.length) run(() => sections.delete(sectionIds))
      if (statusIds.length) run(() => statuses.delete(statusIds))
      run(() => pages.delete(id))
    },
    movePage(sorted: Page[], id: string, dir: -1 | 1) {
      run(() => reorderTx(pages, shift(sorted.map((p) => p.id), id, dir), 'position'))
    },
    reorderPages(ids: string[]) {
      run(() => reorderTx(pages, ids, 'position'))
    },

    addSection(pageId: string, title: string) {
      const siblings = all(sections).filter((s) => s.pageId === pageId)
      run(() => sections.insert({ id: newId(), pageId, title, note: '', highlight: false, position: nextPosition(siblings) }))
    },
    updateSection(id: string, changes: Partial<Pick<Section, 'title' | 'note' | 'highlight'>>) {
      run(() => sections.update(id, (d) => void Object.assign(d, changes)))
    },
    deleteSection(id: string) {
      const taskIds = all(tasks).filter((t) => t.sectionId === id).map((t) => t.id)
      if (taskIds.length) run(() => tasks.delete(taskIds))
      run(() => sections.delete(id))
    },
    moveSection(sorted: Section[], id: string, dir: -1 | 1) {
      run(() => reorderTx(sections, shift(sorted.map((s) => s.id), id, dir), 'position'))
    },
    reorderSections(ids: string[]) {
      run(() => reorderTx(sections, ids, 'position'))
    },

    addStatus(pageId: string, draft: StatusDraft) {
      const id = newId()
      run(() => statuses.insert({ ...draft, id, pageId, position: nextPosition(pageStatuses(pageId)) }))
      return id
    },
    // Flipping a column's "done" flag re-syncs the checkbox of every task in it
    updateStatus(status: Status, changes: Partial<StatusDraft>) {
      run(() => statuses.update(status.id, (d) => void Object.assign(d, changes)))
      const done = changes.done
      if (done === undefined || done === status.done) return
      const ids = tasksInColumn(status).filter((t) => t.done !== done).map((t) => t.id)
      if (ids.length) run(() => tasks.update(ids, (ds) => ds.forEach((d) => void (d.done = done))))
    },
    // Tasks move to the neighbour column first, so nothing ends up orphaned; the last column can't be deleted
    deleteStatus(status: Status) {
      const target = neighbour(pageStatuses(status.pageId), status.id)
      if (!target) return
      const ids = tasksInColumn(status).map((t) => t.id)
      if (ids.length) run(() => tasks.update(ids, (ds) => ds.forEach((d) => void Object.assign(d, statusChanges(target)))))
      run(() => statuses.delete(status.id))
    },
    moveStatus(sorted: Status[], id: string, dir: -1 | 1) {
      run(() => reorderTx(statuses, shift(sorted.map((s) => s.id), id, dir), 'position'))
    },
    reorderStatuses(ids: string[]) {
      run(() => reorderTx(statuses, ids, 'position'))
    },

    addTask(section: Section, text: string, status?: Status) {
      const siblings = all(tasks).filter((t) => t.sectionId === section.id)
      run(() =>
        tasks.insert({
          id: newId(),
          sectionId: section.id,
          pageId: section.pageId,
          text,
          note: '',
          statusId: status?.id ?? null,
          done: status?.done ?? false,
          createdAt: new Date().toISOString(),
          position: nextPosition(siblings),
          boardPosition: boardEnd(section.pageId),
        }),
      )
    },
    // Guarded: an inline edit can blur after another device deleted the task
    updateTask(id: string, changes: Partial<Pick<Task, 'text' | 'note'>>) {
      if (tasks.has(id)) run(() => tasks.update(id, (d) => void Object.assign(d, changes)))
    },
    setTaskDone(task: Task, done: boolean) {
      setTaskState(task, doneChanges(task, pageStatuses(task.pageId), done))
    },
    setTaskStatus(task: Task, status: Status) {
      setTaskState(task, statusChanges(status))
    },
    deleteTask(id: string) {
      const task = tasks.get(id)
      run(() => tasks.delete(id))
      if (task) toast('Tarefa deletada.', { label: 'Desfazer', onClick: () => run(() => tasks.insert(task)) })
    },
    moveTask(sorted: Task[], id: string, dir: -1 | 1) {
      run(() => reorderTx(tasks, shift(sorted.map((t) => t.id), id, dir), 'position'))
    },
    // List drop: `ids` is the target section's final order; a task from another section also changes section
    reorderTasks(ids: string[], moved?: { id: string; sectionId: string }) {
      run(() => reorderTx(tasks, ids, 'position', moved ? { [moved.id]: { sectionId: moved.sectionId } } : {}))
    },
    // Board drop: `ids` is the target column's final order; a card from another column takes its status (and done)
    reorderBoard(ids: string[], moved?: { id: string; status: Status }) {
      run(() => reorderTx(tasks, ids, 'boardPosition', moved ? { [moved.id]: statusChanges(moved.status) } : {}))
    },
    // localStorage pages from before statuses existed: add the defaults and fill the new task fields, once
    upgradeLocalPage(pageId: string) {
      if (source.slug || all(statuses).some((s) => s.pageId === pageId)) return
      const defaults = defaultStatuses(pageId)
      run(() => statuses.insert(defaults))
      const doneId = defaults.find((s) => s.done)?.id ?? null
      const legacy = all(tasks).filter((t) => t.pageId === pageId && t.boardPosition === undefined)
      if (!legacy.length) return
      run(() =>
        tasks.update(
          legacy.map((t) => t.id),
          (ds) =>
            ds.forEach((d) => {
              Object.assign(d, { statusId: d.done ? doneId : null, note: d.note ?? '', createdAt: null, boardPosition: d.position })
            }),
        ),
      )
    },

    setSettings(changes: Partial<Omit<Settings, 'id'>>) {
      if (settings.has('settings')) run(() => settings.update('settings', (d) => void Object.assign(d, changes)))
      else run(() => settings.insert({ ...DEFAULT_SETTINGS, ...changes }))
    },
  }
}
