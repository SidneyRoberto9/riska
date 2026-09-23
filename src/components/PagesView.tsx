import { useLiveQuery } from "@tanstack/react-db"
import { useNavigate } from "@tanstack/react-router"
import { type FormEvent, useState } from "react"
import { useActions } from "#/data/actions"
import { useSource } from "#/data/source-context"
import { LIMITS } from "#/lib/types"
import { ColumnItems } from "./ColumnItems"
import { DragPreview } from "./DragPreview"
import { PageCard } from "./PageCard"
import { SettingsButton } from "./SettingsButton"
import { SortableBoard } from "./SortableBoard"

export function PagesView() {
  const source = useSource()
  const a = useActions()
  const navigate = useNavigate()
  const [title, setTitle] = useState("")
  const { data: pages } = useLiveQuery((q) => q.from({ p: source.pages }).orderBy(({ p }) => p.position), [source])
  const { data: tasks } = useLiveQuery((q) => q.from({ t: source.tasks }), [source])

  const stats = new Map<string, { done: number; total: number }>()
  for (const t of tasks) {
    const s = stats.get(t.pageId) ?? { done: 0, total: 0 }
    s.total++
    if (t.done) {
      s.done++
    }
    stats.set(t.pageId, s)
  }

  const create = (e: FormEvent) => {
    e.preventDefault()
    const v = title.trim()
    if (!v) {
      return
    }
    const pageId = a.addPage(v)
    setTitle("")
    if (source.slug) {
      navigate({ to: "/s/$slug/p/$pageId", params: { slug: source.slug, pageId } })
    } else {
      navigate({ to: "/local/p/$pageId", params: { pageId } })
    }
  }

  return (
    <>
      <header className="flex items-start justify-between gap-3 pt-6 pb-4">
        <div>
          <a href="/" className="mb-2 inline-block text-sm text-ink-soft hover:text-accent">
            ← Início
          </a>
          <h1 className="m-0 text-2xl font-extrabold tracking-[-0.01em]">{source.slug ?? "Sem salvar"}</h1>
          <p className="m-0 mt-1 text-[0.9rem] text-ink-soft">
            {source.slug ? "Sessão sincronizada" : "Dados só neste navegador"}
          </p>
        </div>
        <SettingsButton />
      </header>
      <main>
        <SortableBoard
          columns={[{ id: "pages", items: pages.map((p) => p.id) }]}
          onItemsCommit={({ order }) => a.reorderPages(order)}
          label={(_, id) => `página “${pages.find((p) => p.id === id)?.title ?? ""}”`}
          renderOverlay={(_, id) => <DragPreview strong>{pages.find((p) => p.id === id)?.title}</DragPreview>}
        >
          <ColumnItems id="pages" className="space-y-2.5">
            {(ids) =>
              ids.map((id) => {
                const p = pages.find((x) => x.id === id)
                return p && <PageCard key={id} page={p} stats={stats.get(id) ?? { done: 0, total: 0 }} pages={pages} />
              })
            }
          </ColumnItems>
        </SortableBoard>
        <form
          onSubmit={create}
          className="mt-2.5 flex gap-2 rounded-2xl border border-dashed border-line p-2 focus-within:border-accent"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={LIMITS.title}
            placeholder="+ nova página"
            aria-label="Nova página"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent px-2 py-2 font-display font-bold outline-none placeholder:text-ink-soft"
          />
          {title.trim() && <button className="rounded-xl bg-accent px-4 font-semibold text-surface">Criar</button>}
        </form>
      </main>
    </>
  )
}
