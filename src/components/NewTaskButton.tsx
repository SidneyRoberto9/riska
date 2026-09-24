import { Plus } from "lucide-react"

export function NewTaskButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className="-mx-1 flex min-h-10 w-[calc(100%+0.5rem)] items-center gap-2 rounded-lg border-t border-line px-2 text-[0.92rem] text-ink-soft hover:bg-accent-soft hover:text-accent"
    >
      <Plus size={18} aria-hidden />
      Nova tarefa
    </button>
  )
}
