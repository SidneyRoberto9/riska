import { CircleDot, StickyNote, Trash2 } from "lucide-react"
import { useState } from "react"
import { useActions } from "#/data/actions"
import type { Status, Task } from "#/lib/types"
import { dragFrom, useClickGuard, useSortableItem } from "./dnd"
import { Menu } from "./Menu"
import { MenuItem } from "./MenuItem"
import { StatusOptions } from "./StatusOptions"

export function BoardCard({
  task,
  statuses,
  sectionTitle,
  onOpen,
}: {
  task: Task
  statuses: Status[]
  sectionTitle?: string
  onOpen: (id: string) => void
}) {
  const a = useActions()
  const [menu, setMenu] = useState<"actions" | "status">("actions")
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, style, isDragging } = useSortableItem(
    task.id,
    "cartão arrastável"
  )
  const blocked = useClickGuard()

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: pointer shortcut only, keyboard opens the card through its inner button
    <article
      ref={setNodeRef}
      style={style}
      {...dragFrom(listeners)}
      // Clicks anywhere on the card open it, except on its own controls (checkbox, menu)
      onClick={(e) => {
        if (!(e.target as Element).closest("[data-no-drag]") && !blocked()) {
          onOpen(task.id)
        }
      }}
      className={`group cursor-grab rounded-xl border border-line bg-surface p-2.5 shadow-sm transition-shadow hover:shadow-md ${isDragging ? "drag-ghost" : ""}`}
    >
      <div className="flex items-start gap-2">
        <label data-no-drag className="-m-2.75 cursor-pointer p-2.75">
          <input
            type="checkbox"
            className="check"
            checked={task.done}
            onChange={(e) => a.setTaskDone(task, e.target.checked)}
            aria-label={`Concluída: ${task.text}`}
          />
        </label>
        {/* Enter opens the details; Space lifts the card (keyboard drag starts only from this activator) */}
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          aria-haspopup="dialog"
          className={`min-w-0 flex-1 cursor-pointer text-left text-[0.9rem] leading-snug break-words line-clamp-3 ${task.done ? "text-ink-soft line-through decoration-ink-soft/40" : ""}`}
        >
          {task.text}
        </button>
        <span data-no-drag className="-my-1.5">
          <Menu label="Ações da tarefa" quiet onClose={() => setMenu("actions")}>
            {(close) =>
              menu === "status" ? (
                <StatusOptions task={task} statuses={statuses} onDone={close} />
              ) : (
                <>
                  <MenuItem icon={CircleDot} onClick={() => setMenu("status")}>
                    Mover para…
                  </MenuItem>
                  <MenuItem
                    icon={Trash2}
                    danger
                    onClick={() => {
                      a.deleteTask(task.id)
                      close()
                    }}
                  >
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
