import { eq, useLiveQuery } from '@tanstack/react-db'
import { ChevronLeft, Plus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useActions } from '#/data/actions'
import { useSource } from '#/data/source-context'
import { LIMITS, type Task } from '#/lib/types'
import { InlineEdit } from './InlineEdit'
import { PagesLink } from './links'
import { ProgressBar } from './ProgressBar'
import { SectionCard } from './SectionCard'

export function ChecklistView({ pageId }: { pageId: string }) {
  const source = useSource()
  const a = useActions()
  const { data: pages, isReady } = useLiveQuery((q) => q.from({ p: source.pages }).where(({ p }) => eq(p.id, pageId)), [source, pageId])
  const { data: sections } = useLiveQuery(
    (q) => q.from({ s: source.sections }).where(({ s }) => eq(s.pageId, pageId)).orderBy(({ s }) => s.position),
    [source, pageId],
  )
  const { data: tasks } = useLiveQuery(
    (q) => q.from({ t: source.tasks }).where(({ t }) => eq(t.pageId, pageId)).orderBy(({ t }) => t.position),
    [source, pageId],
  )

  // Local mode only: pages saved before statuses existed get the defaults once
  useEffect(() => {
    if (isReady && pages[0]) a.upgradeLocalPage(pageId)
  }, [isReady, pages[0]?.id])

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
        <ProgressBar done={done} total={tasks.length} />
      </header>
      <main>
        {sections.length === 0 && (
          <p className="mb-3.5 text-[0.9rem] text-ink-soft">Comece criando uma seção, como “Hortifruti” ou “Hoje”.</p>
        )}
        {sections.map((s, i) => (
          <SectionCard key={s.id} section={s} index={i} siblings={sections} tasks={bySection.get(s.id) ?? []} />
        ))}
        <NewSection onAdd={(title) => a.addSection(page.id, title)} />
      </main>
      <footer className="pt-2 text-center text-[0.78rem] text-ink-soft">
        {source.slug ? `Sincronizado na sessão ${source.slug}.` : 'Salvo só neste navegador.'}
      </footer>
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
