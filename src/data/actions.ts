import type { Collection, Transaction } from "@tanstack/react-db"
import { useRouter } from "@tanstack/react-router"
import { useToast } from "#/components/ToastProvider"
import { newId } from "#/lib/id"
import { nextPosition, shift } from "#/lib/order"
import { doneChanges, statusChanges, statusOf } from "#/lib/status"
import type { Page, Section, Settings, Status, Task } from "#/lib/types"
import { DEFAULT_SETTINGS, DEFAULT_STATUSES } from "#/lib/types"
import { attachmentActions } from "./attachmentActions"
import { reorderTx } from "./reorder"
import type { Source } from "./source"
import { useSource } from "./source-context"
import { statusActions } from "./statusActions"

type Run = (mutate: () => Transaction | null) => void
export type ActionContext = {
  source: Source
  run: Run
  all: <T extends object>(c: Collection<T, string>) => T[]
  pageStatuses: (pageId: string) => Status[]
  toast: ReturnType<typeof useToast>
}

export function useActions() {
  const source = useSource()
  const toast = useToast()
  const router = useRouter()

  // Every mutation is optimistic; on failure TanStack DB rolls back and we offer a retry
  const run: Run = (mutate) => {
    mutate()?.isPersisted.promise.catch((err: Error) => {
      if (err?.message === "UNAUTHORIZED") {
        router.invalidate()
        return
      }
      toast("Não salvou.", { label: "Tentar de novo", onClick: () => run(mutate) })
    })
  }

  const { pages, sections, statuses, tasks, settings, attachments } = source
  const all = <T extends object>(c: Collection<T, string>) => [...c.values()]
  const pageStatuses = (pageId: string) =>
    all(statuses)
      .filter((s) => s.pageId === pageId)
      .sort((a, b) => a.position - b.position)
  const defaultStatuses = (pageId: string): Status[] =>
    DEFAULT_STATUSES.map((s, i) => ({ ...s, id: newId(), pageId, position: i + 1 }))
  // A task that changes column lands at the bottom of it
  const boardEnd = (pageId: string) =>
    nextPosition(
      all(tasks)
        .filter((t) => t.pageId === pageId)
        .map((t) => ({ position: t.boardPosition ?? 0 }))
    )
  const setTaskState = (task: Task, changes: Partial<Task>) => {
    if (!tasks.has(task.id)) {
      return
    }
    // Compare against the resolved column, not the raw field: a null statusId that already resolves
    // to the first column (e.g. re-checking a task already in it) is not a move
    const moved = changes.statusId !== undefined && changes.statusId !== statusOf(task, pageStatuses(task.pageId))?.id
    const extra = moved ? { boardPosition: boardEnd(task.pageId) } : {}
    run(() => tasks.update(task.id, (d) => void Object.assign(d, changes, extra)))
  }

  const context: ActionContext = { source, run, all, pageStatuses, toast }

  return {
    ...statusActions(context),
    ...attachmentActions(context),
    addPage(title: string) {
      const id = newId()
      run(() => pages.insert({ id, title, subtitle: "", position: nextPosition(all(pages)) }))
      run(() => statuses.insert(defaultStatuses(id)))
      return id
    },
    updatePage(id: string, changes: Partial<Omit<Page, "id">>) {
      run(() => pages.update(id, (d) => void Object.assign(d, changes)))
    },
    deletePage(id: string) {
      const sectionIds = all(sections)
        .filter((s) => s.pageId === id)
        .map((s) => s.id)
      const statusIds = all(statuses)
        .filter((s) => s.pageId === id)
        .map((s) => s.id)
      const taskIds = all(tasks)
        .filter((t) => t.pageId === id)
        .map((t) => t.id)
      // Server cascades; local storage does not, so children are removed explicitly in both modes
      if (taskIds.length) {
        run(() => tasks.delete(taskIds))
      }
      if (sectionIds.length) {
        run(() => sections.delete(sectionIds))
      }
      if (statusIds.length) {
        run(() => statuses.delete(statusIds))
      }
      run(() => pages.delete(id))
    },
    movePage(sorted: Page[], id: string, dir: -1 | 1) {
      run(() =>
        reorderTx(
          pages,
          shift(
            sorted.map((p) => p.id),
            id,
            dir
          ),
          "position"
        )
      )
    },
    reorderPages(ids: string[]) {
      run(() => reorderTx(pages, ids, "position"))
    },

    addSection(pageId: string, title: string) {
      const siblings = all(sections).filter((s) => s.pageId === pageId)
      run(() =>
        sections.insert({ id: newId(), pageId, title, note: "", highlight: false, position: nextPosition(siblings) })
      )
    },
    updateSection(id: string, changes: Partial<Pick<Section, "title" | "note" | "highlight">>) {
      run(() => sections.update(id, (d) => void Object.assign(d, changes)))
    },
    deleteSection(id: string) {
      const taskIds = all(tasks)
        .filter((t) => t.sectionId === id)
        .map((t) => t.id)
      if (taskIds.length) {
        run(() => tasks.delete(taskIds))
      }
      run(() => sections.delete(id))
    },
    moveSection(sorted: Section[], id: string, dir: -1 | 1) {
      run(() =>
        reorderTx(
          sections,
          shift(
            sorted.map((s) => s.id),
            id,
            dir
          ),
          "position"
        )
      )
    },
    reorderSections(ids: string[]) {
      run(() => reorderTx(sections, ids, "position"))
    },

    addTask({
      section,
      text,
      note = "",
      assignee = "",
      status,
    }: {
      section: Section
      text: string
      note?: string
      assignee?: string
      status?: Status
    }) {
      const id = newId()
      const siblings = all(tasks).filter((t) => t.sectionId === section.id)
      run(() =>
        tasks.insert({
          id,
          sectionId: section.id,
          pageId: section.pageId,
          text,
          note,
          assignee,
          statusId: status?.id ?? null,
          done: status?.done ?? false,
          createdAt: new Date().toISOString(),
          position: nextPosition(siblings),
          boardPosition: boardEnd(section.pageId),
        })
      )
      return id
    },
    // Guarded: an inline edit can blur after another device deleted the task
    updateTask(id: string, changes: Partial<Pick<Task, "text" | "note" | "assignee">>) {
      if (tasks.has(id)) {
        run(() => tasks.update(id, (d) => void Object.assign(d, changes)))
      }
    },
    setTaskDone(task: Task, done: boolean) {
      setTaskState(task, doneChanges(task, pageStatuses(task.pageId), done))
    },
    setTaskStatus(task: Task, status: Status) {
      setTaskState(task, statusChanges(status))
    },
    deleteTask(id: string) {
      const task = tasks.get(id)
      const images = all(attachments).filter((x) => x.taskId === id)
      if (images.length) {
        run(() => attachments.delete(images.map((x) => x.id)))
      }
      run(() => tasks.delete(id))
      if (task) {
        toast("Tarefa deletada.", {
          label: "Desfazer",
          onClick: () => {
            run(() => tasks.insert(task))
            if (images.length) {
              run(() => attachments.insert(images))
            }
          },
        })
      }
    },
    moveTask(sorted: Task[], id: string, dir: -1 | 1) {
      run(() =>
        reorderTx(
          tasks,
          shift(
            sorted.map((t) => t.id),
            id,
            dir
          ),
          "position"
        )
      )
    },
    // List drop: `ids` is the target section's final order; a task from another section also changes section
    reorderTasks(ids: string[], moved?: { id: string; sectionId: string }) {
      run(() => reorderTx(tasks, ids, "position", moved ? { [moved.id]: { sectionId: moved.sectionId } } : {}))
    },
    // Board drop: `ids` is the target column's final order; a card from another column takes its status (and done)
    reorderBoard(ids: string[], moved?: { id: string; status: Status }) {
      run(() => reorderTx(tasks, ids, "boardPosition", moved ? { [moved.id]: statusChanges(moved.status) } : {}))
    },
    // localStorage pages from before statuses existed: add the defaults and fill the new task fields, once
    upgradeLocalPage(pageId: string) {
      if (source.slug) {
        return
      }
      const noAssignee = all(tasks).filter((t) => t.pageId === pageId && t.assignee === undefined)
      if (noAssignee.length) {
        run(() =>
          tasks.update(
            noAssignee.map((t) => t.id),
            (ds) =>
              ds.forEach((d) => {
                d.assignee = ""
              })
          )
        )
      }
      if (all(statuses).some((s) => s.pageId === pageId)) {
        return
      }
      const defaults = defaultStatuses(pageId)
      run(() => statuses.insert(defaults))
      const doneId = defaults.find((s) => s.done)?.id ?? null
      const legacy = all(tasks).filter((t) => t.pageId === pageId && t.boardPosition === undefined)
      if (!legacy.length) {
        return
      }
      run(() =>
        tasks.update(
          legacy.map((t) => t.id),
          (ds) =>
            ds.forEach((d) => {
              Object.assign(d, {
                statusId: d.done ? doneId : null,
                note: d.note ?? "",
                createdAt: null,
                boardPosition: d.position,
              })
            })
        )
      )
    },

    setSettings(changes: Partial<Omit<Settings, "id">>) {
      if (settings.has("settings")) {
        run(() => settings.update("settings", (d) => void Object.assign(d, changes)))
      } else {
        run(() => settings.insert({ ...DEFAULT_SETTINGS, ...changes }))
      }
    },
  }
}
