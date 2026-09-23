import { ArrowLeft, ArrowRight, CheckCheck, CircleDot, GripVertical, Palette, Plus, StickyNote, Trash2, X } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { useActions } from '#/data/actions'
import { useSetPageSearch } from '#/data/page-search'
import { neighbour, statusOf } from '#/lib/status'
import { LIMITS, type Section, type Status, type Task } from '#/lib/types'
import { ColumnItems, DragPreview, SortableBoard, SortableColumns, dragFrom, useClickGuard, useColumnItems, useSortableColumn, useSortableItem } from './dnd'
import { InlineEdit } from './InlineEdit'
import { Menu, MenuItem, Popover } from './Popover'
import { StatusEditor, StatusOptions } from './Status'
import { VoiceButton } from './VoiceButton'

const COLUMN_W = 'w-[min(85vw,300px)]'
// Columns end above the viewport bottom (page header ≈ 11.75rem above, scrollbar gutter + footer ≈ 3.25rem below)
// so the page itself doesn't scroll; cards scroll inside the column
const COLUMN_MAX_H = 'max-h-[calc(100dvh-15rem)]'

export function Board({
  pageId,
  statuses,
  sections,
  tasks,
  onOpen,
}: {
  pageId: string
  statuses: Status[]
  sections: Section[]
  tasks: Task[]
  onOpen: (taskId: string) => void
}) {
  const a = useActions()
  const setSearch = useSetPageSearch()

  if (!sections.length) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-dashed border-line p-8 text-center">
        <p className="m-0 font-semibold">Nenhuma seção ainda</p>
        <p className="m-0 mt-1 text-sm text-ink-soft">O quadro organiza as tarefas das seções. Crie uma seção na lista primeiro.</p>
        <button type="button" onClick={() => setSearch({ view: undefined })} className="mt-4 min-h-10 rounded-xl bg-accent px-4 font-semibold text-surface">
          Ir para a lista
        </button>
      </div>
    )
  }

  const byId = new Map(tasks.map((t) => [t.id, t]))
  const statusById = new Map(statuses.map((s) => [s.id, s]))
  const columns = statuses.map((s) => ({ id: s.id, items: [] as string[] }))
  const column = new Map(columns.map((c) => [c.id, c]))
  for (const t of [...tasks].sort((x, y) => x.boardPosition - y.boardPosition || x.position - y.position || x.id.localeCompare(y.id))) {
    const s = statusOf(t, statuses)
    if (s) column.get(s.id)?.items.push(t.id)
  }
  // Section names on cards only help when there is more than one section
  const sectionTitle = sections.length > 1 ? new Map(sections.map((s) => [s.id, s.title])) : null

  return (
    <SortableBoard
      axis="x"
      columns={columns}
      onItemsCommit={({ id, from, to, order }) => {
        const status = statusById.get(to)
        a.reorderBoard(order, from !== to && status ? { id, status } : undefined)
      }}
      onColumnsCommit={a.reorderStatuses}
      label={(kind, id) => (kind === 'item' ? `tarefa “${byId.get(id)?.text ?? ''}”` : `coluna “${statusById.get(id)?.name ?? ''}”`)}
      renderOverlay={(kind, id) => {
        const t = byId.get(id)
        if (kind === 'item') return t && <CardFace task={t} sectionTitle={sectionTitle?.get(t.sectionId)} />
        return <DragPreview strong>{statusById.get(id)?.name}</DragPreview>
      }}
    >
      <div className="-mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto scroll-px-4 px-4 pb-6 sm:-mx-6 sm:snap-none sm:px-6">
        <SortableColumns>
          {(ids) =>
            ids.map((id) => {
              const s = statusById.get(id)
              return s && <Column key={id} status={s} statuses={statuses} sections={sections} byId={byId} sectionTitle={sectionTitle} onOpen={onOpen} />
            })
          }
        </SortableColumns>
        <NewColumn pageId={pageId} />
      </div>
    </SortableBoard>
  )
}

function Column({
  status,
  statuses,
  sections,
  byId,
  sectionTitle,
  onOpen,
}: {
  status: Status
  statuses: Status[]
  sections: Section[]
  byId: Map<string, Task>
  sectionTitle: Map<string, string> | null
  onOpen: (taskId: string) => void
}) {
  const a = useActions()
  const [editing, setEditing] = useState(false)
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, style, isDragging } = useSortableColumn(status.id)
  const count = useColumnItems(status.id).length
  const i = statuses.findIndex((s) => s.id === status.id)

  const remove = () => {
    const target = neighbour(statuses, status.id)
    if (!target) return
    const moving = count === 1 ? '1 tarefa vai' : `${count} tarefas vão`
    if (count === 0 || confirm(`Deletar a coluna “${status.name}”? ${moving} para “${target.name}”.`)) a.deleteStatus(status)
  }

  return (
    <section
      ref={setNodeRef}
      style={style}
      aria-label={`${status.name}, ${count} ${count === 1 ? 'tarefa' : 'tarefas'}`}
      className={`flex ${COLUMN_W} ${COLUMN_MAX_H} shrink-0 snap-start flex-col rounded-2xl border border-line bg-surface/50 ${isDragging ? 'drag-ghost' : ''}`}
    >
      <header className="group flex items-center gap-1.5 px-2 pt-2 pb-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Arrastar coluna: ${status.name}`}
          className="drag-handle -my-1 -ml-1 grid size-10 shrink-0 cursor-grab touch-none place-items-center rounded-md text-ink-soft"
        >
          <GripVertical size={16} aria-hidden />
        </button>
        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: status.color }} />
        <h2 className="m-0 min-w-0 flex-1 truncate text-[0.95rem] font-bold">
          <InlineEdit value={status.name} required maxLength={LIMITS.statusName} label="Nome da coluna" onSave={(name) => a.updateStatus(status, { name })} />
        </h2>
        <span aria-hidden className="rounded-full bg-line/70 px-2 text-xs font-bold tabular-nums text-ink-soft">
          {count}
        </span>
        <Menu label={`Ações da coluna ${status.name}`} onClose={() => setEditing(false)}>
          {(close) =>
            editing ? (
              <StatusEditor initial={status} onSave={(v) => (a.updateStatus(status, v), close())} />
            ) : (
              <>
                <MenuItem icon={Palette} onClick={() => setEditing(true)}>
                  Editar nome e cor
                </MenuItem>
                <MenuItem icon={CheckCheck} onClick={() => (a.updateStatus(status, { done: !status.done }), close())}>
                  {status.done ? 'Não conta como concluída' : 'Conta como concluída'}
                </MenuItem>
                <MenuItem icon={ArrowLeft} disabled={i <= 0} onClick={() => (a.moveStatus(statuses, status.id, -1), close())}>
                  Mover para a esquerda
                </MenuItem>
                <MenuItem icon={ArrowRight} disabled={i >= statuses.length - 1} onClick={() => (a.moveStatus(statuses, status.id, 1), close())}>
                  Mover para a direita
                </MenuItem>
                <MenuItem icon={Trash2} danger disabled={statuses.length <= 1} onClick={() => (close(), remove())}>
                  Deletar coluna
                </MenuItem>
              </>
            )
          }
        </Menu>
      </header>
      <ColumnItems id={status.id} className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-2 pb-2">
        {(ids) =>
          ids.map((id) => {
            const t = byId.get(id)
            return t && <Card key={id} task={t} statuses={statuses} sectionTitle={sectionTitle?.get(t.sectionId)} onOpen={onOpen} />
          })
        }
      </ColumnItems>
      <AddCard status={status} sections={sections} />
    </section>
  )
}

// Same box as Card (checkbox gutter, menu-width spacer) so the text doesn't shift when the overlay replaces it
function CardFace({ task, sectionTitle }: { task: Task; sectionTitle?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-2.5 shadow-sm">
      <div className="flex items-start gap-2">
        <span aria-hidden className="-m-2.75 p-2.75">
          <input type="checkbox" className="check" checked={task.done} readOnly tabIndex={-1} />
        </span>
        <p className={`m-0 min-w-0 flex-1 text-[0.9rem] leading-snug break-words line-clamp-3 ${task.done ? 'text-ink-soft line-through decoration-ink-soft/40' : ''}`}>
          {task.text}
        </p>
        <span aria-hidden className="-my-1.5 size-10 shrink-0" />
      </div>
      {(sectionTitle || task.note) && (
        <div className="mt-1.5 flex items-center gap-2 pl-7 text-[0.75rem] text-ink-soft">
          {sectionTitle && <span className="min-w-0 truncate">{sectionTitle}</span>}
          {task.note && <StickyNote size={13} aria-hidden className="shrink-0" />}
        </div>
      )}
    </div>
  )
}

function Card({ task, statuses, sectionTitle, onOpen }: { task: Task; statuses: Status[]; sectionTitle?: string; onOpen: (id: string) => void }) {
  const a = useActions()
  const [menu, setMenu] = useState<'actions' | 'status'>('actions')
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, style, isDragging } = useSortableItem(task.id, 'cartão arrastável')
  const blocked = useClickGuard()

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...dragFrom(listeners)}
      // Clicks anywhere on the card open it, except on its own controls (checkbox, menu)
      onClick={(e) => {
        if (!(e.target as Element).closest('[data-no-drag]') && !blocked()) onOpen(task.id)
      }}
      className={`group cursor-grab rounded-xl border border-line bg-surface p-2.5 shadow-sm transition-shadow hover:shadow-md ${isDragging ? 'drag-ghost' : ''}`}
    >
      <div className="flex items-start gap-2">
        <label data-no-drag className="-m-2.75 cursor-pointer p-2.75">
          <input type="checkbox" className="check" checked={task.done} onChange={(e) => a.setTaskDone(task, e.target.checked)} aria-label={`Concluída: ${task.text}`} />
        </label>
        {/* Enter opens the details; Space lifts the card (keyboard drag starts only from this activator) */}
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          aria-haspopup="dialog"
          className={`min-w-0 flex-1 cursor-pointer text-left text-[0.9rem] leading-snug break-words line-clamp-3 ${task.done ? 'text-ink-soft line-through decoration-ink-soft/40' : ''}`}
        >
          {task.text}
        </button>
        <span data-no-drag className="-my-1.5">
          <Menu label="Ações da tarefa" quiet onClose={() => setMenu('actions')}>
            {(close) =>
              menu === 'status' ? (
                <StatusOptions task={task} statuses={statuses} onDone={close} />
              ) : (
                <>
                  <MenuItem icon={CircleDot} onClick={() => setMenu('status')}>
                    Mover para…
                  </MenuItem>
                  <MenuItem icon={Trash2} danger onClick={() => (a.deleteTask(task.id), close())}>
                    Deletar tarefa
                  </MenuItem>
                </>
              )
            }
          </Menu>
        </span>
      </div>
      {(sectionTitle || task.note) && (
        <div className="mt-1.5 flex items-center gap-2 pl-7 text-[0.75rem] text-ink-soft">
          {sectionTitle && <span className="min-w-0 truncate">{sectionTitle}</span>}
          {task.note && <StickyNote size={13} role="img" aria-label="Tem descrição" className="shrink-0" />}
        </div>
      )}
    </article>
  )
}

function AddCard({ status, sections }: { status: Status; sections: Section[] }) {
  const a = useActions()
  const key = `checklist-board-section-${status.pageId}`
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sectionId, setSectionId] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const refocus = useRef(false)
  const section = sections.find((s) => s.id === sectionId) ?? sections[0]

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    a.addTask(section, v, status)
    setText('')
    input.current?.focus()
  }

  // Re-read on open: another column may have picked a section since
  const show = () => {
    try {
      setSectionId(localStorage.getItem(key) ?? '')
    } catch {}
    setOpen(true)
  }
  const hide = () => {
    refocus.current = true
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        ref={(el) => {
          if (el && refocus.current) {
            refocus.current = false
            el.focus()
          }
        }}
        onClick={show}
        className="mx-2 mb-2 flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm text-ink-soft hover:bg-accent-soft hover:text-accent"
      >
        <Plus size={16} aria-hidden />
        Adicionar tarefa
      </button>
    )
  }
  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') hide()
      }}
      className="mx-2 mb-2 space-y-2 rounded-xl border border-accent bg-surface p-2"
    >
      <div className="flex items-center gap-1">
        <input
          ref={input}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={LIMITS.task}
          placeholder="Nova tarefa…"
          aria-label={`Nova tarefa em ${status.name}`}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1.5 text-[0.9rem] outline-none placeholder:text-ink-soft"
        />
        <VoiceButton value={text} onChange={setText} />
      </div>
      <div className="flex items-center gap-2">
        {sections.length > 1 && (
          <select
            value={section.id}
            onChange={(e) => {
              setSectionId(e.target.value)
              try {
                localStorage.setItem(key, e.target.value)
              } catch {}
            }}
            aria-label="Seção"
            className="min-h-10 min-w-0 flex-1 rounded-lg border border-line bg-ground px-2 text-sm"
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        )}
        <button type="submit" disabled={!text.trim()} className="ml-auto min-h-10 rounded-lg bg-accent px-3 text-sm font-semibold text-surface disabled:opacity-40">
          Adicionar
        </button>
        <button type="button" onClick={hide} aria-label="Fechar" className="grid size-10 place-items-center rounded-lg text-ink-soft hover:bg-accent-soft">
          <X size={16} aria-hidden />
        </button>
      </div>
    </form>
  )
}

function NewColumn({ pageId }: { pageId: string }) {
  const a = useActions()
  return (
    <Popover
      trigger={(p) => (
        <button
          {...p}
          className={`flex min-h-12 ${COLUMN_W} shrink-0 snap-start items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-sm font-semibold text-ink-soft hover:border-accent hover:text-accent`}
        >
          <Plus size={16} aria-hidden />
          Nova coluna
        </button>
      )}
    >
      {(close) => <StatusEditor onSave={(v) => (a.addStatus(pageId, v), close())} />}
    </Popover>
  )
}
