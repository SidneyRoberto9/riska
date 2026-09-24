import { Plus } from "lucide-react"
import type { Status } from "#/lib/types"
import type { NewTaskTarget } from "./TaskCreateDialog"

export function BoardAddCard({ status, onNew }: { status: Status; onNew: (target: NewTaskTarget) => void }) {
  return (
    <button
      type="button"
      onClick={() => onNew({ statusId: status.id })}
      aria-haspopup="dialog"
      aria-label={`Adicionar tarefa em ${status.name}`}
      className="mx-2 mb-2 flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm text-ink-soft hover:bg-accent-soft hover:text-accent"
    >
      <Plus size={16} aria-hidden />
      Adicionar tarefa
    </button>
  )
}
