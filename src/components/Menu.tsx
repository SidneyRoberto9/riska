import { Ellipsis } from "lucide-react"
import type { ReactNode } from "react"
import { Popover } from "./Popover"

export function Menu({
  label,
  children,
  onClose,
  quiet = false,
}: {
  label: string
  children: (close: () => void) => ReactNode
  onClose?: () => void
  /** Dim until the enclosing `.group` is hovered (pointer devices only) */
  quiet?: boolean
}) {
  return (
    <Popover
      className="min-w-48 p-1"
      onClose={onClose}
      trigger={(p) => (
        <button
          {...p}
          aria-label={label}
          className={`-my-1.5 grid size-10 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-accent-soft hover:text-accent ${quiet ? "row-action" : ""}`}
        >
          <Ellipsis size={18} aria-hidden />
        </button>
      )}
    >
      {children}
    </Popover>
  )
}
