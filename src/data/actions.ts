import { useRouter } from '@tanstack/react-router'
import type { Collection, Transaction } from '@tanstack/react-db'
import { newId } from '#/lib/id'
import type { Badge, Page, Section, Settings, Task } from '#/lib/types'
import { DEFAULT_SETTINGS } from '#/lib/types'
import { useToast } from '#/components/toast'
import { useSource } from './source-context'

type Positioned = { id: string; position: number }

const nextPosition = (items: Positioned[]) => items.reduce((max, x) => Math.max(max, x.position), 0) + 1

// Swap position with the neighbour in the given direction; one batch update = one server call/transaction
function swap<T extends Positioned>(collection: Collection<T, string>, sorted: T[], id: string, dir: -1 | 1) {
  const i = sorted.findIndex((x) => x.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= sorted.length) return null
  const a = sorted[i]
  const b = sorted[j]
  const [pa, pb] = a.position === b.position ? [j, i] : [b.position, a.position]
  return collection.update([a.id, b.id], (drafts) => {
    drafts[0].position = pa
    drafts[1].position = pb
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
      toast('Não salvou', () => run(mutate))
    })
  }

  const { pages, sections, tasks, settings } = source
  const all = <T extends object>(c: Collection<T, string>) => [...c.values()]

  return {
    addPage(title: string) {
      const id = newId()
      run(() => pages.insert({ id, title, subtitle: '', position: nextPosition(all(pages)) }))
      return id
    },
    updatePage(id: string, changes: Partial<Omit<Page, 'id'>>) {
      run(() => pages.update(id, (d) => void Object.assign(d, changes)))
    },
    deletePage(id: string) {
      const sectionIds = all(sections).filter((s) => s.pageId === id).map((s) => s.id)
      const taskIds = all(tasks).filter((t) => t.pageId === id).map((t) => t.id)
      // Server cascades; local storage does not, so children are removed explicitly in both modes
      if (taskIds.length) run(() => tasks.delete(taskIds))
      if (sectionIds.length) run(() => sections.delete(sectionIds))
      run(() => pages.delete(id))
    },
    movePage(sorted: Page[], id: string, dir: -1 | 1) {
      run(() => swap(pages, sorted, id, dir))
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
      run(() => swap(sections, sorted, id, dir))
    },

    addTask(section: Section, text: string) {
      const siblings = all(tasks).filter((t) => t.sectionId === section.id)
      run(() =>
        tasks.insert({
          id: newId(),
          sectionId: section.id,
          pageId: section.pageId,
          text,
          done: false,
          badges: [],
          position: nextPosition(siblings),
        }),
      )
    },
    updateTask(id: string, changes: Partial<Pick<Task, 'text' | 'done'>> & { badges?: Badge[] }) {
      run(() => tasks.update(id, (d) => void Object.assign(d, changes)))
    },
    deleteTask(id: string) {
      run(() => tasks.delete(id))
    },
    moveTask(sorted: Task[], id: string, dir: -1 | 1) {
      run(() => swap(tasks, sorted, id, dir))
    },

    setSettings(changes: Partial<Omit<Settings, 'id'>>) {
      if (settings.has('settings')) run(() => settings.update('settings', (d) => void Object.assign(d, changes)))
      else run(() => settings.insert({ ...DEFAULT_SETTINGS, ...changes }))
    },
  }
}
