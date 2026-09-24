import { Image, StickyNote, UserRound } from "lucide-react"

// One-line summary under a task title (list row and board card)
export function TaskMeta({
  section,
  assignee,
  images,
  note,
  className = "",
}: {
  section?: string
  assignee: string
  images: number
  note: boolean
  className?: string
}) {
  if (!section && !assignee && !images && !note) {
    return null
  }
  return (
    <div className={`flex min-w-0 items-center gap-2.5 text-[0.75rem] text-ink-soft ${className}`}>
      {section && <span className="min-w-0 truncate">{section}</span>}
      {assignee && (
        <span className="flex min-w-0 items-center gap-1">
          <UserRound size={13} aria-hidden className="shrink-0" />
          <span className="sr-only">Responsável:</span>
          <span className="truncate">{assignee}</span>
        </span>
      )}
      {images > 0 && (
        <span className="flex shrink-0 items-center gap-1">
          <Image size={13} aria-hidden />
          <span className="sr-only">Imagens:</span>
          {images}
        </span>
      )}
      {note && <StickyNote size={13} role="img" aria-label="Tem descrição" className="shrink-0" />}
    </div>
  )
}
