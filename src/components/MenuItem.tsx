import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

export function MenuItem({
  onClick,
  children,
  icon: Icon,
  danger,
  disabled,
}: {
  onClick: () => void
  children: ReactNode
  icon: LucideIcon
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left hover:bg-accent-soft disabled:pointer-events-none disabled:opacity-40 ${danger ? "text-warn hover:bg-warn-soft" : ""}`}
    >
      <Icon size={16} aria-hidden className={danger ? "" : "text-ink-soft"} />
      {children}
    </button>
  )
}
