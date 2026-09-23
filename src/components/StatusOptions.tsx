import { Check, Plus } from "lucide-react"
import { useState } from "react"
import { useActions } from "#/data/actions"
import { statusOf } from "#/lib/status"
import type { Status, Task } from "#/lib/types"
import { StatusEditor } from "./StatusEditor"

// The page's statuses as a single-choice list, plus "Novo status" (creates it and moves the task there)
export function StatusOptions({ task, statuses, onDone }: { task: Task; statuses: Status[]; onDone: () => void }) {
  const a = useActions()
  const [creating, setCreating] = useState(false)
  const current = statusOf(task, statuses)

  if (creating) {
    return (
      <StatusEditor
        onSave={(v) => {
          const id = a.addStatus(task.pageId, v)
          a.setTaskStatus(task, { ...v, id, pageId: task.pageId, position: 0 })
          onDone()
        }}
      />
    )
  }
  return (
    <fieldset aria-label="Status da tarefa" className="min-w-0">
      {statuses.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-pressed={s.id === current?.id}
          onClick={() => {
            if (s.id !== current?.id) {
              a.setTaskStatus(task, s)
            }
            onDone()
          }}
          className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left hover:bg-accent-soft"
        >
          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
          <span className="flex-1">{s.name}</span>
          {s.id === current?.id && <Check size={16} aria-hidden className="text-accent" />}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-ink-soft hover:bg-accent-soft hover:text-accent"
      >
        <Plus size={16} aria-hidden />
        Novo status
      </button>
    </fieldset>
  )
}
