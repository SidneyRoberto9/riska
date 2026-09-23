import type { ReactNode } from "react"

export function DragPreview({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface px-3 py-2 text-[0.92rem] ${strong ? "font-display font-bold" : ""}`}
    >
      {children}
    </div>
  )
}
