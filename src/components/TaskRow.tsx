import { ArrowDown, ArrowUp, CircleDot, GripVertical, Trash2 } from "lucide-react"
import { useState } from "react"
import { useActions } from "#/data/actions"
import { chipHidden, statusOf } from "#/lib/status"
import type { Status, Task } from "#/lib/types"
import { useSortableItem } from "./dnd"
import { Menu } from "./Menu"
import { MenuItem } from "./MenuItem"
import { StatusChip } from "./StatusChip"
import { StatusOptions } from "./StatusOptions"
import { StatusPicker } from "./StatusPicker"
import { TaskMeta } from "./TaskMeta"

export function TaskRow({
  task,
  siblings,
  statuses,
  images,
  onOpen,
}: {
  task: Task
  siblings: Task[]
  statuses: Status[]
  images: number
  onOpen: (id: string) => void
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, style, isDragging } = useSortableItem(
    task.id,
    "tarefa arrastável"
  )
  const a = useActions()
  const [menu, setMenu] = useState<"actions" | "status">("actions")
  const i = siblings.findIndex((t) => t.id === task.id)
  const status = statusOf(task, statuses)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-1.5 border-t border-line py-2 first:border-t-0 ${isDragging ? "drag-ghost" : ""}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Arrastar tarefa: ${task.text}`}
        className="drag-handle -ml-1.5 grid h-7 w-6 shrink-0 cursor-grab touch-none place-items-center rounded-md text-ink-soft"
      >
        <GripVertical size={15} aria-hidden />
      </button>
      <label className="-my-3 -ml-1.5 -mr-2.5 cursor-pointer py-3 pr-2.5 pl-1.5">
        <input
          type="checkbox"
          className="check"
          checked={task.done}
          onChange={(e) => a.setTaskDone(task, e.target.checked)}
          aria-label={`Concluída: ${task.text}`}
        />
      </label>
      <div className="ml-1 min-w-0 flex-1 text-[0.92rem] leading-[1.42]">
        <div className="flex items-start gap-1.5">
          <button
            type="button"
            onClick={() => onOpen(task.id)}
            aria-haspopup="dialog"
            className={`w-full min-w-0 cursor-pointer text-left break-words line-clamp-2 hover:text-accent ${task.done ? "text-ink-soft line-through decoration-ink-soft/40" : ""}`}
          >
            {task.text}
          </button>
          {status && !chipHidden(task, statuses) && (
            <StatusPicker
              task={task}
              statuses={statuses}
              trigger={(p) => (
                <StatusChip
                  {...p}
                  status={status}
                  aria-label={`Status: ${status.name}. Alterar`}
                  className="mt-0.5 shrink-0"
                />
              )}
            />
          )}
        </div>
        <TaskMeta assignee={task.assignee ?? ""} images={images} note={!!task.note} className="mt-0.5" />
      </div>
      <Menu label="Ações da tarefa" quiet onClose={() => setMenu("actions")}>
        {(close) =>
          menu === "status" ? (
            <StatusOptions task={task} statuses={statuses} onDone={close} />
          ) : (
            <>
              <MenuItem
                icon={ArrowUp}
                disabled={i <= 0}
                onClick={() => {
                  a.moveTask(siblings, task.id, -1)
                  close()
                }}
              >
                Subir
              </MenuItem>
              <MenuItem
                icon={ArrowDown}
                disabled={i >= siblings.length - 1}
                onClick={() => {
                  a.moveTask(siblings, task.id, 1)
                  close()
                }}
              >
                Descer
              </MenuItem>
              <MenuItem icon={CircleDot} onClick={() => setMenu("status")}>
                Status{status ? `: ${status.name}` : ""}
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
    </div>
  )
}
