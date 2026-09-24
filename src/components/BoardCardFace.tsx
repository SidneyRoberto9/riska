import type { Task } from "#/lib/types"
import { TaskMeta } from "./TaskMeta"

// Same box as BoardCard (checkbox gutter, menu-width spacer) so the text doesn't shift when the overlay replaces it
export function BoardCardFace({ task, sectionTitle, images }: { task: Task; sectionTitle?: string; images: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-2.5 shadow-sm">
      <div className="flex items-start gap-2">
        <span aria-hidden className="-m-2.75 p-2.75">
          <input type="checkbox" className="check" checked={task.done} readOnly tabIndex={-1} />
        </span>
        <p
          className={`m-0 min-w-0 flex-1 text-[0.9rem] leading-snug break-words line-clamp-2 ${task.done ? "text-ink-soft line-through decoration-ink-soft/40" : ""}`}
        >
          {task.text}
        </p>
        <span aria-hidden className="-my-1.5 size-10 shrink-0" />
      </div>
      {/* The drag overlay duplicates the card: keep its meta labels away from screen readers */}
      <div aria-hidden>
        <TaskMeta
          section={sectionTitle}
          assignee={task.assignee ?? ""}
          images={images}
          note={!!task.note}
          className="mt-1.5 pl-7"
        />
      </div>
    </div>
  )
}
