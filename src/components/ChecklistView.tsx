import { eq, useLiveQuery } from '@tanstack/react-db'
import { ChevronLeft, Plus } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useActions } from '#/data/actions'
import { useSetPageSearch } from '#/data/page-search'
import { useSource } from '#/data/source-context'
import { LIMITS, type Task } from '#/lib/types'
import { Board } from './Board'
import { DragPreview, SortableBoard, SortableColumns } from './dnd'
import { InlineEdit } from './InlineEdit'
import { PagesLink } from './links'
import { ProgressBar } from './ProgressBar'
import { SectionCard } from './SectionCard'
import { TaskDialog } from './TaskDialog'
import { ViewToggle } from './ViewToggle'

export function ChecklistView({ pageId, view, taskId }: { pageId: string; view?: 'quadro'; taskId?: string }) {
  const source = useSource()
  const a = useActions()
  const { data: pages, isReady } = useLiveQuery((q) => q.from({ p: source.pages }).where(({ p }) => eq(p.id, pageId)), [source, pageId])
  const { data: sections } = useLiveQuery(
    (q) => q.from({ s: source.sections }).where(({ s }) => eq(s.pageId, pageId)).orderBy(({ s }) => s.position),
    [source, pageId],
  )
  const { data: tasks, isReady: tasksReady } = useLiveQuery(
    (q) => q.from({ t: source.tasks }).where(({ t }) => eq(t.pageId, pageId)).orderBy(({ t }) => t.position),
    [source, pageId],
  )
  const { data: statuses } = useLiveQuery(
    (q) => q.from({ s: source.statuses }).where(({ s }) => eq(s.pageId, pageId)).orderBy(({ s }) => s.position),
    [source, pageId],
  )

  // Local mode only: pages saved before statuses existed get the defaults once
  useEffect(() => {
    if (isReady && pages[0]) a.upgradeLocalPage(pageId)
  }, [isReady, pages[0]?.id])

  const setSearch = useSetPageSearch()
  const router = useRouter()
  // Opened from a card → closing goes back (so the phone's back button and X agree);
  // opened from a shared link → closing replaces, so we never navigate out of the app
  const openedHere = useRef(false)
  // Set while our own navigation away from ?task= is in flight, so nothing navigates twice
  const closing = useRef(false)
  const openTask = (id: string) => {
    openedHere.current = true
    setSearch({ task: id })
  }
  const closeTask = () => {
    // Already gone from the URL (Back was pressed) or already closing: nothing to undo
    if (closing.current || !new URLSearchParams(location.search).has('task')) return
    closing.current = true
    if (openedHere.current) router.history.back()
    else setSearch({ task: undefined }, { replace: true })
  }
  const dialogTask = view === 'quadro' && taskId ? tasks.find((t) => t.id === taskId) : undefined

  useEffect(() => {
    if (!taskId) {
      openedHere.current = false
      closing.current = false
    } else if (tasksReady && !closing.current && !tasks.some((t) => t.id === taskId)) {
      // Task deleted on another device while its dialog is open, or a stale link
      closeTask()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, tasksReady, tasks])

  const page = pages[0]
  if (!page) {
    if (!isReady) return null
    return (
      <div className="pt-24 text-center">
        <h1 className="text-2xl font-extrabold">Página não encontrada</h1>
        <p className="mt-1 text-ink-soft">Ela pode ter sido deletada em outro aparelho.</p>
        <PagesLink source={source} className="mt-4 inline-block font-semibold text-accent underline underline-offset-2">
          Ver páginas
        </PagesLink>
      </div>
    )
  }

  const bySection = new Map<string, Task[]>()
  for (const t of tasks) bySection.set(t.sectionId, [...(bySection.get(t.sectionId) ?? []), t])
  const taskById = new Map(tasks.map((t) => [t.id, t]))
  const sectionById = new Map(sections.map((s) => [s.id, s]))
  const done = tasks.filter((t) => t.done).length

  return (
    <>
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-10 bg-ground pt-6 pb-3.5">
        <PagesLink
          source={source}
          className="-ml-1.5 mb-1 inline-flex min-h-8 items-center gap-0.5 rounded-md pr-2 text-sm text-ink-soft hover:text-accent"
        >
          <ChevronLeft size={16} aria-hidden />
          Páginas
        </PagesLink>
        <h1 className="m-0 mb-1 text-2xl font-extrabold tracking-[-0.01em]">
          <InlineEdit
            value={page.title}
            required
            maxLength={LIMITS.title}
            label="Título da página"
            onSave={(title) => a.updatePage(page.id, { title })}
          />
        </h1>
        <p className="m-0 mb-3.5 text-[0.9rem] text-ink-soft">
          <InlineEdit
            value={page.subtitle}
            placeholder="Adicionar subtítulo"
            maxLength={LIMITS.title}
            label="Subtítulo da página"
            onSave={(subtitle) => a.updatePage(page.id, { subtitle })}
          />
        </p>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <ProgressBar done={done} total={tasks.length} />
          </div>
          <ViewToggle view={view} />
        </div>
      </header>
      <main>
        {view === 'quadro' ? (
          <Board pageId={page.id} statuses={statuses} sections={sections} tasks={tasks} onOpen={openTask} />
        ) : (
          <>
            {sections.length === 0 && (
              <p className="mb-3.5 text-[0.9rem] text-ink-soft">Comece criando uma seção, como “Hortifruti” ou “Hoje”.</p>
            )}
            <SortableBoard
              columns={sections.map((s) => ({ id: s.id, items: (bySection.get(s.id) ?? []).map((t) => t.id) }))}
              onItemsCommit={({ id, from, to, order }) => a.reorderTasks(order, from !== to ? { id, sectionId: to } : undefined)}
              onColumnsCommit={a.reorderSections}
              label={(kind, id) => (kind === 'item' ? `tarefa “${taskById.get(id)?.text ?? ''}”` : `seção “${sectionById.get(id)?.title ?? ''}”`)}
              renderOverlay={(kind, id) =>
                kind === 'item' ? <DragPreview>{taskById.get(id)?.text}</DragPreview> : <DragPreview strong>{sectionById.get(id)?.title}</DragPreview>
              }
            >
              <SortableColumns>
                {(ids) =>
                  ids.map((id, i) => {
                    const s = sectionById.get(id)
                    return s && <SectionCard key={id} section={s} index={i} siblings={sections} taskById={taskById} statuses={statuses} />
                  })
                }
              </SortableColumns>
            </SortableBoard>
            <NewSection onAdd={(title) => a.addSection(page.id, title)} />
          </>
        )}
      </main>
      <footer className="pt-2 text-center text-[0.78rem] text-ink-soft">
        {source.slug ? `Sincronizado na sessão ${source.slug}.` : 'Salvo só neste navegador.'}
      </footer>
      {dialogTask && (
        <TaskDialog
          key={dialogTask.id}
          task={dialogTask}
          statuses={statuses}
          section={sections.find((s) => s.id === dialogTask.sectionId)}
          onClose={closeTask}
        />
      )}
    </>
  )
}

function NewSection({ onAdd }: { onAdd: (title: string) => void }) {
  const [title, setTitle] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = title.trim()
    if (!v) return
    onAdd(v)
    setTitle('')
  }
  return (
    <form
      onSubmit={submit}
      className="mb-3.5 flex items-center gap-2 rounded-2xl border border-dashed border-line p-2 pl-4 focus-within:border-accent"
    >
      <Plus size={18} aria-hidden className="shrink-0 text-ink-soft" />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={LIMITS.title}
        placeholder="Nova seção…"
        aria-label="Nova seção"
        autoComplete="off"
        className="min-w-0 flex-1 rounded-lg bg-transparent py-2 font-display font-bold outline-none placeholder:text-ink-soft"
      />
      {title.trim() && <button className="min-h-10 rounded-xl bg-accent px-4 font-semibold text-surface">Criar seção</button>}
    </form>
  )
}
