import { newId } from "#/lib/id"
import { nextPosition, shift } from "#/lib/order"
import { neighbour, statusChanges, statusOf } from "#/lib/status"
import type { Status, StatusDraft } from "#/lib/types"
import type { ActionContext } from "./actions"
import { reorderTx } from "./reorder"

export function statusActions({ source, run, all, pageStatuses }: ActionContext) {
  const { statuses, tasks } = source
  const tasksInColumn = (status: Status) => {
    const list = pageStatuses(status.pageId)
    return all(tasks).filter((t) => t.pageId === status.pageId && statusOf(t, list)?.id === status.id)
  }

  // A null (or deleted) statusId follows whichever column is first; before another column becomes first,
  // those tasks are pinned to the current first one so reordering columns never moves cards
  const reorderStatuses = (ids: string[]) => {
    const pageId = statuses.get(ids[0])?.pageId
    const list = pageId ? pageStatuses(pageId) : []
    const first = list[0]
    if (first && ids[0] !== first.id) {
      const live = new Set(list.map((s) => s.id))
      const loose = all(tasks)
        .filter((t) => t.pageId === pageId && !live.has(t.statusId ?? ""))
        .map((t) => t.id)
      // Separate transaction: tasks and statuses are different collections, persisted by different server functions
      if (loose.length) {
        run(() =>
          tasks.update(loose, (ds) => {
            for (const d of ds) {
              d.statusId = first.id
            }
          })
        )
      }
    }
    run(() => reorderTx(statuses, ids, "position"))
  }

  return {
    addStatus(pageId: string, draft: StatusDraft) {
      const id = newId()
      run(() => statuses.insert({ ...draft, id, pageId, position: nextPosition(pageStatuses(pageId)) }))
      return id
    },
    // Flipping a column's "done" flag re-syncs the checkbox of every task in it
    updateStatus(status: Status, changes: Partial<StatusDraft>) {
      run(() => statuses.update(status.id, (d) => void Object.assign(d, changes)))
      const done = changes.done
      if (done === undefined || done === status.done) {
        return
      }
      const ids = tasksInColumn(status)
        .filter((t) => t.done !== done)
        .map((t) => t.id)
      if (ids.length) {
        run(() =>
          tasks.update(ids, (ds) => {
            for (const d of ds) {
              d.done = done
            }
          })
        )
      }
    },
    // Tasks move to the neighbour column first, so nothing ends up orphaned; the last column can't be deleted
    deleteStatus(status: Status) {
      const target = neighbour(pageStatuses(status.pageId), status.id)
      if (!target) {
        return
      }
      const ids = tasksInColumn(status).map((t) => t.id)
      if (ids.length) {
        run(() => tasks.update(ids, (ds) => ds.forEach((d) => void Object.assign(d, statusChanges(target)))))
      }
      run(() => statuses.delete(status.id))
    },
    moveStatus(sorted: Status[], id: string, dir: -1 | 1) {
      reorderStatuses(
        shift(
          sorted.map((s) => s.id),
          id,
          dir
        )
      )
    },
    reorderStatuses,
  }
}
