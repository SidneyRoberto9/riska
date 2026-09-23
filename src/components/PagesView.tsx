import { useLiveQuery } from '@tanstack/react-db'
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useActions } from '#/data/actions'
import { useSource } from '#/data/source-context'
import { LIMITS, type Page } from '#/lib/types'
import { ColumnItems, DragPreview, SortableBoard, useSortableItem } from './dnd'
import { PageLink } from './links'
import { Menu, MenuItem } from './Popover'
import { ProgressBar } from './ProgressBar'
import { SettingsButton } from './Settings'

export function PagesView() {
  const source = useSource()
  const a = useActions()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const { data: pages } = useLiveQuery((q) => q.from({ p: source.pages }).orderBy(({ p }) => p.position), [source])
  const { data: tasks } = useLiveQuery((q) => q.from({ t: source.tasks }), [source])

  const stats = new Map<string, { done: number; total: number }>()
  for (const t of tasks) {
    const s = stats.get(t.pageId) ?? { done: 0, total: 0 }
    s.total++
    if (t.done) s.done++
    stats.set(t.pageId, s)
  }

  const create = (e: FormEvent) => {
    e.preventDefault()
    const v = title.trim()
    if (!v) return
    const pageId = a.addPage(v)
    setTitle('')
    if (source.slug) navigate({ to: '/s/$slug/p/$pageId', params: { slug: source.slug, pageId } })
    else navigate({ to: '/local/p/$pageId', params: { pageId } })
  }

  return (
    <>
      <header className="flex items-start justify-between gap-3 pt-6 pb-4">
        <div>
          <a href="/" className="mb-2 inline-block text-sm text-ink-soft hover:text-accent">
            ← Início
          </a>
          <h1 className="m-0 text-2xl font-extrabold tracking-[-0.01em]">{source.slug ?? 'Sem salvar'}</h1>
          <p className="m-0 mt-1 text-[0.9rem] text-ink-soft">
            {source.slug ? 'Sessão sincronizada' : 'Dados só neste navegador'}
          </p>
        </div>
        <SettingsButton />
      </header>
      <main>
        <SortableBoard
          columns={[{ id: 'pages', items: pages.map((p) => p.id) }]}
          onItemsCommit={({ order }) => a.reorderPages(order)}
          label={(_, id) => `página “${pages.find((p) => p.id === id)?.title ?? ''}”`}
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
        <form onSubmit={create} className="mt-2.5 flex gap-2 rounded-2xl border border-dashed border-line p-2 focus-within:border-accent">
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

function PageCard({ page: p, stats: s, pages }: { page: Page; stats: { done: number; total: number }; pages: Page[] }) {
  const source = useSource()
  const a = useActions()
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, style, isDragging } = useSortableItem(p.id, 'página arrastável')
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-2 rounded-2xl border border-line bg-surface p-4 pl-2 ${isDragging ? 'drag-ghost' : ''}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Arrastar página: ${p.title}`}
        className="drag-handle grid h-7 w-6 shrink-0 cursor-grab touch-none place-items-center rounded-md text-ink-soft"
      >
        <GripVertical size={16} aria-hidden />
      </button>
      <PageLink source={source} pageId={p.id} className="min-w-0 flex-1">
        <h2 className="m-0 text-[1.02rem] font-bold">{p.title}</h2>
        {p.subtitle && <p className="m-0 mt-0.5 truncate text-[0.82rem] text-ink-soft">{p.subtitle}</p>}
        <div className="mt-3">
          <ProgressBar small done={s.done} total={s.total} />
        </div>
      </PageLink>
      <Menu label="Ações da página">
        {(close) => (
          <>
            <MenuItem icon={ArrowUp} onClick={() => (a.movePage(pages, p.id, -1), close())}>Subir</MenuItem>
            <MenuItem icon={ArrowDown} onClick={() => (a.movePage(pages, p.id, 1), close())}>Descer</MenuItem>
            <MenuItem
              icon={Trash2}
              danger
              onClick={() => {
                close()
                if (confirm(`Deletar a página “${p.title}”?`)) a.deletePage(p.id)
              }}
            >
              Deletar
            </MenuItem>
          </>
        )}
      </Menu>
    </div>
  )
}
