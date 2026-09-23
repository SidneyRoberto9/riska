import { eq, useLiveQuery } from '@tanstack/react-db'
import { useState, type FormEvent } from 'react'
import { useActions } from '#/data/actions'
import { useSource } from '#/data/source-context'
import { LIMITS, type Task } from '#/lib/types'
import { InlineEdit } from './InlineEdit'
import { PagesLink } from './links'
import { ProgressBar } from './ProgressBar'
import { SectionCard } from './SectionCard'
import { NotFound } from './Shell'

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

  const page = pages[0]
  if (!page) return isReady ? <NotFound /> : null

  const bySection = new Map<string, Task[]>()
  for (const t of tasks) bySection.set(t.sectionId, [...(bySection.get(t.sectionId) ?? []), t])
  const done = tasks.filter((t) => t.done).length

  return (
    <>
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-10 bg-ground pt-6 pb-3.5">
        <PagesLink source={source} className="mb-2 inline-block text-sm text-ink-soft hover:text-accent">
          ← Páginas
        </PagesLink>
        <h1 className="m-0 mb-1 text-2xl font-extrabold tracking-[-0.01em]">
          <InlineEdit value={page.title} required maxLength={LIMITS.title} onSave={(title) => a.updatePage(page.id, { title })} />
        </h1>
        <p className="m-0 mb-3.5 text-[0.9rem] text-ink-soft">
          <InlineEdit
            value={page.subtitle}
            placeholder="Adicionar subtítulo"
            maxLength={LIMITS.title}
            onSave={(subtitle) => a.updatePage(page.id, { subtitle })}
          />
        </p>
        <ProgressBar done={done} total={tasks.length} />
      </header>
      <main>
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
    <form onSubmit={submit} className="mb-3.5 flex gap-2 rounded-2xl border border-dashed border-line p-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={LIMITS.title}
        placeholder="+ nova seção"
        aria-label="Nova seção"
        className="min-w-0 flex-1 bg-transparent px-2 py-2 font-display font-bold outline-none placeholder:text-ink-soft"
      />
      {title.trim() && <button className="rounded-xl bg-accent px-4 font-semibold text-surface">Criar</button>}
    </form>
  )
}
