import { ArrowLeft, ArrowRight, CheckCheck, GripVertical, Palette, Trash2 } from "lucide-react"
import { useState } from "react"
import { useActions } from "#/data/actions"
import { neighbour } from "#/lib/status"
import { LIMITS, type Status, type Task } from "#/lib/types"
import { BoardAddCard } from "./BoardAddCard"
import { BoardCard } from "./BoardCard"
import { COLUMN_MAX_H, COLUMN_W } from "./boardStyles"
import { ColumnItems, useColumnItems } from "./ColumnItems"
import { useSortableColumn } from "./dnd"
import { InlineEdit } from "./InlineEdit"
import { Menu } from "./Menu"
import { MenuItem } from "./MenuItem"
import { StatusEditor } from "./StatusEditor"
import type { NewTaskTarget } from "./TaskCreateDialog"

export function BoardColumn({
  status,
  statuses,
  byId,
  sectionTitle,
  onOpen,
  onNew,
}: {
  status: Status
  statuses: Status[]
  byId: Map<string, Task>
  sectionTitle: Map<string, string> | null
  onOpen: (taskId: string) => void
  onNew: (target: NewTaskTarget) => void
}) {
  const a = useActions()
  const [editing, setEditing] = useState(false)
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, style, isDragging } = useSortableColumn(status.id)
  const count = useColumnItems(status.id).length
  const i = statuses.findIndex((s) => s.id === status.id)

  const remove = () => {
    const target = neighbour(statuses, status.id)
    if (!target) {
      return
    }
    const moving = count === 1 ? "1 tarefa vai" : `${count} tarefas vão`
    if (count === 0 || confirm(`Deletar a coluna “${status.name}”? ${moving} para “${target.name}”.`)) {
      a.deleteStatus(status)
    }
  }

  return (
    <section
      ref={setNodeRef}
      style={style}
      aria-label={`${status.name}, ${count} ${count === 1 ? "tarefa" : "tarefas"}`}
      className={`flex ${COLUMN_W} ${COLUMN_MAX_H} shrink-0 snap-start flex-col rounded-2xl border border-line bg-surface/50 ${isDragging ? "drag-ghost" : ""}`}
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
          <InlineEdit
            value={status.name}
            required
            maxLength={LIMITS.statusName}
            label="Nome da coluna"
            onSave={(name) => a.updateStatus(status, { name })}
          />
        </h2>
        <span aria-hidden className="rounded-full bg-line/70 px-2 text-xs font-bold tabular-nums text-ink-soft">
          {count}
        </span>
        <Menu label={`Ações da coluna ${status.name}`} onClose={() => setEditing(false)}>
          {(close) =>
            editing ? (
              <StatusEditor
                initial={status}
                onSave={(v) => {
                  a.updateStatus(status, v)
                  close()
                }}
              />
            ) : (
              <>
                <MenuItem icon={Palette} onClick={() => setEditing(true)}>
                  Editar nome e cor
                </MenuItem>
                <MenuItem
                  icon={CheckCheck}
                  onClick={() => {
                    a.updateStatus(status, { done: !status.done })
                    close()
                  }}
                >
                  {status.done ? "Não conta como concluída" : "Conta como concluída"}
                </MenuItem>
                <MenuItem
                  icon={ArrowLeft}
                  disabled={i <= 0}
                  onClick={() => {
                    a.moveStatus(statuses, status.id, -1)
                    close()
                  }}
                >
                  Mover para a esquerda
                </MenuItem>
                <MenuItem
                  icon={ArrowRight}
                  disabled={i >= statuses.length - 1}
                  onClick={() => {
                    a.moveStatus(statuses, status.id, 1)
                    close()
                  }}
                >
                  Mover para a direita
                </MenuItem>
                <MenuItem
                  icon={Trash2}
                  danger
                  disabled={statuses.length <= 1}
                  onClick={() => {
                    close()
                    remove()
                  }}
                >
                  Deletar coluna
                </MenuItem>
              </>
            )
          }
        </Menu>
      </header>
      <ColumnItems
        id={status.id}
        className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-2 pb-2"
      >
        {(ids) =>
          ids.map((id) => {
            const t = byId.get(id)
            return (
              t && (
                <BoardCard
                  key={id}
                  task={t}
                  statuses={statuses}
                  sectionTitle={sectionTitle?.get(t.sectionId)}
                  onOpen={onOpen}
                />
              )
            )
          })
        }
      </ColumnItems>
      <BoardAddCard status={status} onNew={onNew} />
    </section>
  )
}
